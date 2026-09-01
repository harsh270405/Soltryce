import uuid

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.audit.models import AuditTrail
from app.users.permissions import IsPlatformAdmin, IsSupportStaff
from app.workflows.maintenance import AUTO_APPROVE, REJECT, evaluate_maintenance_request
from .models import ActionApproval, ServiceRequest
from app.workflows.tasks import process_user_request, resume_agent_thread_task

VALID_CATEGORIES = {'academic_question', 'maintenance', 'lab_booking'}


def request_data(item):
    return {
        'id': str(item.id), 'query': item.query, 'category': item.category, 'status': item.status,
        'response': item.response, 'metadata': item.metadata, 'created_at': item.created_at,
        'updated_at': item.updated_at,
        'user': {'id': item.user_id, 'username': item.user.username, 'display_name': item.user.display_name},
        'approvals': [{'id': approval.id, 'tool_name': approval.tool_name, 'tool_payload': approval.tool_payload,
                       'status': approval.status, 'rationale': approval.rationale,
                       'rejection_reason': approval.rejection_reason, 'created_at': approval.created_at}
                      for approval in item.approvals.all()],
    }


class CreateServiceRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = str(request.data.get('query', '')).strip()
        category = request.data.get('category', 'academic_question')
        metadata = request.data.get('metadata', {})
        if not query:
            return Response({'detail': 'Please describe your request.'}, status=status.HTTP_400_BAD_REQUEST)
        if category not in VALID_CATEGORIES:
            return Response({'detail': 'Unsupported request category.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(metadata, dict):
            return Response({'detail': 'metadata must be an object.'}, status=status.HTTP_400_BAD_REQUEST)
        item = ServiceRequest.objects.create(
            user=request.user, query=query, category=category, language=request.data.get('language', 'en'),
            metadata=metadata, agent_thread_id=str(uuid.uuid4()),
            status='IN_PROGRESS' if category == 'academic_question' else 'PENDING_APPROVAL',
        )
        AuditTrail.objects.create(request=item, agent_name='request-api', step_number=1, action_taken='Request created')
        if category == 'academic_question':
            process_user_request.delay(str(item.id), query)
        elif category == 'maintenance':
            assessment = evaluate_maintenance_request(query, metadata)
            if assessment.decision == AUTO_APPROVE:
                item.status = 'PENDING'
                item.response = f'Approved for support staff: {assessment.reason}'
                item.save(update_fields=['status', 'response', 'updated_at'])
                AuditTrail.objects.create(request=item, agent_name='maintenance-triage', step_number=2,
                                          action_taken='Maintenance request automatically approved for staff')
            elif assessment.decision == REJECT:
                item.status = 'FAILED'
                item.response = f'We need more information before this request can be processed: {assessment.reason}'
                item.save(update_fields=['status', 'response', 'updated_at'])
                AuditTrail.objects.create(request=item, agent_name='maintenance-triage', step_number=2,
                                          action_taken=f'Maintenance request rejected: {assessment.reason}')
            else:
                item.response = f'Awaiting administrator safety review: {assessment.reason}'
                item.save(update_fields=['response', 'updated_at'])
                ActionApproval.objects.create(
                    request=item, thread_id='', tool_name='create_maintenance_ticket', tool_payload=metadata,
                    rationale=assessment.reason,
                )
                AuditTrail.objects.create(request=item, agent_name='maintenance-triage', step_number=2,
                                          action_taken='Maintenance request escalated for administrator review')
        else:
            ActionApproval.objects.create(
                request=item, thread_id='', tool_name='create_maintenance_ticket' if category == 'maintenance' else 'book_laboratory',
                tool_payload=metadata, rationale='An administrator must review this operational request before it is fulfilled.',
            )
        return Response(request_data(item), status=status.HTTP_201_CREATED)


class MyRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = ServiceRequest.objects.filter(user=request.user).select_related('user').prefetch_related('approvals').order_by('-created_at')
        return Response([request_data(item) for item in items])


class RequestStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        item = get_object_or_404(ServiceRequest.objects.select_related('user').prefetch_related('approvals'), id=request_id)
        can_view_staff_ticket = request.user.role == 'staff' and item.category == 'maintenance'
        if item.user_id != request.user.id and not request.user.is_platform_admin and not can_view_staff_ticket:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(request_data(item))


class ListPendingApprovalsView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        items = ActionApproval.objects.filter(status='PENDING').select_related('request__user').order_by('-created_at')
        return Response([{'id': item.id, 'request_id': str(item.request_id), 'user': item.request.user.username,
                          'original_query': item.request.query, 'category': item.request.category,
                          'tool_name': item.tool_name, 'tool_payload': item.tool_payload,
                          'rationale': item.rationale, 'created_at': item.created_at} for item in items])


class ProcessApprovalView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, approval_id):
        approval = get_object_or_404(ActionApproval, id=approval_id)
        action, reason = request.data.get('action'), str(request.data.get('reason', '')).strip()
        if approval.status != 'PENDING':
            return Response({'detail': 'This action has already been reviewed.'}, status=status.HTTP_400_BAD_REQUEST)
        if action not in {'APPROVE', 'REJECT'}:
            return Response({'detail': 'action must be APPROVE or REJECT.'}, status=status.HTTP_400_BAD_REQUEST)
        if action == 'REJECT' and not reason:
            return Response({'detail': 'A rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
        approval.status = 'APPROVED' if action == 'APPROVE' else 'REJECTED'
        approval.reviewed_by, approval.rejection_reason = request.user, reason or None
        approval.save(update_fields=['status', 'reviewed_by', 'rejection_reason', 'updated_at'])
        item = approval.request
        if approval.thread_id:
            resume_agent_thread_task.delay(approval.thread_id, approved=action == 'APPROVE', feedback=reason)
        else:
            if action == 'APPROVE' and item.category == 'maintenance':
                item.status = 'PENDING'
                item.response = 'Your maintenance request was approved and sent to the support staff.'
            else:
                item.status = 'COMPLETED' if action == 'APPROVE' else 'FAILED'
                item.response = ('Your request was approved and completed.' if action == 'APPROVE'
                                 else f'Your request was declined: {reason}')
            item.save(update_fields=['status', 'response', 'updated_at'])
        AuditTrail.objects.create(request=item, agent_name='admin-review', step_number=2,
                                  action_taken=f'Request {action.lower()}ed', executed_by_human=True)
        item = ServiceRequest.objects.select_related('user').prefetch_related('approvals').get(pk=item.pk)
        return Response(request_data(item))


class AdminHistoryView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        items = ServiceRequest.objects.select_related('user').prefetch_related('approvals').order_by('-created_at')[:200]
        return Response([request_data(item) for item in items])


class StaffTicketListView(APIView):
    """Tickets that have been approved by an administrator and await support work."""
    permission_classes = [IsSupportStaff]

    def get(self, request):
        tickets = ServiceRequest.objects.filter(category='maintenance', status__in=['PENDING', 'COMPLETED']).select_related('user').prefetch_related('approvals').order_by('created_at')
        return Response([request_data(ticket) for ticket in tickets])


class StaffTicketStatusView(APIView):
    permission_classes = [IsSupportStaff]

    def post(self, request, request_id):
        ticket = get_object_or_404(ServiceRequest, id=request_id, category='maintenance')
        new_status = request.data.get('status')
        if new_status not in {'PENDING', 'COMPLETED'}:
            return Response({'detail': 'Status must be PENDING or COMPLETED.'}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.status not in {'PENDING', 'COMPLETED'}:
            return Response({'detail': 'This ticket has not been approved for support work.'}, status=status.HTTP_400_BAD_REQUEST)

        ticket.status = new_status
        ticket.response = ('Maintenance work is complete.' if new_status == 'COMPLETED'
                           else 'Maintenance work is pending with the support team.')
        ticket.save(update_fields=['status', 'response', 'updated_at'])
        AuditTrail.objects.create(request=ticket, agent_name='support-staff', step_number=3,
                                  action_taken=f'Maintenance ticket marked {new_status.lower()}',
                                  executed_by_human=True)
        return Response(request_data(ticket))


class AdminDashboardView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response({'pending_approvals': ActionApproval.objects.filter(status='PENDING').count(),
                         'open_requests': ServiceRequest.objects.filter(status__in=['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL']).count(),
                         'pending_staff_tickets': ServiceRequest.objects.filter(category='maintenance', status='PENDING').count(),
                         'completed_requests': ServiceRequest.objects.filter(status='COMPLETED').count(),
                         'total_users': request.user.__class__.objects.filter(is_active=True).count()})
