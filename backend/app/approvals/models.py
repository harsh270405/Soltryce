import uuid
from django.db import models
from django.conf import settings

class ServiceRequest(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('PENDING_APPROVAL', 'Pending Human Approval'),
        ('PENDING', 'Pending Staff Work'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    query = models.TextField(help_text="The original user request")
    category = models.CharField(max_length=30, default='academic_question')
    language = models.CharField(max_length=10, default='en')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    response = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    agent_thread_id = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ActionApproval(models.Model):
    """Stores suspended agent states awaiting human intervention."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name='approvals')
    thread_id = models.CharField(max_length=255, help_text="LangGraph persistent thread ID")
    tool_name = models.CharField(max_length=100) 
    tool_payload = models.JSONField(help_text="The parameters the agent wants to execute")
    rationale = models.TextField(help_text="Agent's reasoning for this action")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
