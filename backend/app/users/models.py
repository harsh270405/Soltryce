from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('admin', 'Administrator'),
        ('staff', 'Support Staff'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    department = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    clearance_level = models.PositiveIntegerField(default=0)

    def get_access_level(self):
        """Used by the RAG service to filter query results."""
        return self.role

    @property
    def is_platform_admin(self):
        return self.is_superuser or self.role == 'admin'
