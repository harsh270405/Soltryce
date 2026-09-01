from django.contrib import admin
from .models import ServiceRequest, ActionApproval

@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('query', 'user__username')
    readonly_fields = ('id', 'user', 'query', 'created_at')

@admin.register(ActionApproval)
class ActionApprovalAdmin(admin.ModelAdmin):
    list_display = ('request', 'tool_name', 'status', 'created_at')
    list_filter = ('status', 'tool_name')
    readonly_fields = ('request', 'thread_id', 'tool_name', 'tool_payload', 'rationale', 'created_at')
    
    # Allow admins to approve/reject from the list view
    actions = ['approve_actions', 'reject_actions']

    @admin.action(description='Approve selected pending actions')
    def approve_actions(self, request, queryset):
        from app.workflows.tasks import resume_agent_thread_task
        
        pending_qs = queryset.filter(status='PENDING')
        for approval in pending_qs:
            approval.status = 'APPROVED'
            approval.reviewed_by = request.user
            approval.save()
            # Dispatch Celery task to resume
            resume_agent_thread_task.delay(thread_id=approval.thread_id, approved=True)
            
        self.message_user(request, f"{pending_qs.count()} actions approved and agents resumed.")

    @admin.action(description='Reject selected pending actions')
    def reject_actions(self, request, queryset):
        from app.workflows.tasks import resume_agent_thread_task
        
        pending_qs = queryset.filter(status='PENDING')
        for approval in pending_qs:
            approval.status = 'REJECTED'
            approval.reviewed_by = request.user
            approval.rejection_reason = "Rejected by administrator via dashboard."
            approval.save()
            # Dispatch Celery task to resume with rejection
            resume_agent_thread_task.delay(
                thread_id=approval.thread_id, 
                approved=False, 
                feedback=approval.rejection_reason
            )
            
        self.message_user(request, f"{pending_qs.count()} actions rejected and agents notified.")