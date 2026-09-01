from django.db import models
from app.approvals.models import ServiceRequest

class AuditTrail(models.Model):
    """Immutable audit logging for compliance."""
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE)
    agent_name = models.CharField(max_length=100)
    step_number = models.IntegerField()
    retrieved_docs = models.JSONField(default=list, help_text="RAG chunks used for context")
    action_taken = models.CharField(max_length=255)
    executed_by_human = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.request.id} - {self.action_taken} at {self.timestamp}"