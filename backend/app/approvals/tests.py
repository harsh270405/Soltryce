from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from app.users.models import CustomUser
from app.workflows.maintenance import AUTO_APPROVE, REJECT, REQUIRES_ADMIN, MaintenanceAssessment
from .models import ActionApproval, ServiceRequest


class MaintenanceWorkflowTests(APITestCase):
    def setUp(self):
        self.student = CustomUser.objects.create_user(username='student', email='student@example.com', password='student-password')
        self.admin = CustomUser.objects.create_user(username='admin', email='admin@example.com', password='admin-password', role='admin')
        self.staff = CustomUser.objects.create_user(username='staff', email='staff@example.com', password='staff-password', role='staff')

    @patch('app.approvals.views.evaluate_maintenance_request')
    def test_approved_maintenance_ticket_is_completed_by_staff(self, triage):
        triage.return_value = MaintenanceAssessment(REQUIRES_ADMIN, 'Administrator review required.')
        self.client.force_authenticate(self.student)
        create_response = self.client.post('/api/v1/requests/request/', {
            'query': 'Maintenance request for Library: Broken light.',
            'category': 'maintenance',
            'metadata': {'location': 'Library', 'issue_description': 'Broken light'},
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        ticket = ServiceRequest.objects.get(pk=create_response.data['id'])
        self.assertEqual(ticket.status, 'PENDING_APPROVAL')

        approval = ActionApproval.objects.get(request=ticket)
        self.client.force_authenticate(self.admin)
        approval_response = self.client.post(f'/api/v1/requests/{approval.id}/process/', {'action': 'APPROVE'}, format='json')
        self.assertEqual(approval_response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'PENDING')

        self.client.force_authenticate(self.staff)
        tickets_response = self.client.get('/api/v1/requests/staff/tickets/')
        self.assertEqual(tickets_response.status_code, status.HTTP_200_OK)
        self.assertEqual(tickets_response.data[0]['id'], str(ticket.id))
        completion_response = self.client.post(f'/api/v1/requests/request/{ticket.id}/staff-status/', {'status': 'COMPLETED'}, format='json')
        self.assertEqual(completion_response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'COMPLETED')

    def test_students_cannot_access_staff_ticket_queue(self):
        self.client.force_authenticate(self.student)

        response = self.client.get('/api/v1/requests/staff/tickets/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('app.approvals.views.evaluate_maintenance_request')
    def test_routine_request_is_automatically_sent_to_staff(self, triage):
        triage.return_value = MaintenanceAssessment(AUTO_APPROVE, 'The location and routine repair are clear.')
        self.client.force_authenticate(self.student)

        response = self.client.post('/api/v1/requests/request/', {
            'query': 'Replace the broken classroom light in Block A, Room 101.',
            'category': 'maintenance',
            'metadata': {'location': 'Block A, Room 101', 'issue_description': 'Broken light'},
        }, format='json')

        ticket = ServiceRequest.objects.get(pk=response.data['id'])
        self.assertEqual(ticket.status, 'PENDING')
        self.assertIn('Approved for support staff', ticket.response)
        self.assertFalse(ActionApproval.objects.filter(request=ticket).exists())

    @patch('app.approvals.views.evaluate_maintenance_request')
    def test_incomplete_request_is_rejected_with_the_triage_reason(self, triage):
        triage.return_value = MaintenanceAssessment(REJECT, 'Please provide the room number.')
        self.client.force_authenticate(self.student)

        response = self.client.post('/api/v1/requests/request/', {
            'query': 'The light is broken.', 'category': 'maintenance', 'metadata': {},
        }, format='json')

        ticket = ServiceRequest.objects.get(pk=response.data['id'])
        self.assertEqual(ticket.status, 'FAILED')
        self.assertIn('Please provide the room number.', ticket.response)
        self.assertFalse(ActionApproval.objects.filter(request=ticket).exists())

    @patch('app.approvals.views.evaluate_maintenance_request')
    def test_hazardous_request_is_sent_to_an_administrator(self, triage):
        triage.return_value = MaintenanceAssessment(REQUIRES_ADMIN, 'Possible exposed wiring requires safety review.')
        self.client.force_authenticate(self.student)

        response = self.client.post('/api/v1/requests/request/', {
            'query': 'There are sparks from a socket in Lab 2.', 'category': 'maintenance',
            'metadata': {'location': 'Lab 2', 'issue_description': 'Sparks from a socket'},
        }, format='json')

        ticket = ServiceRequest.objects.get(pk=response.data['id'])
        self.assertEqual(ticket.status, 'PENDING_APPROVAL')
        approval = ActionApproval.objects.get(request=ticket)
        self.assertEqual(approval.rationale, 'Possible exposed wiring requires safety review.')
