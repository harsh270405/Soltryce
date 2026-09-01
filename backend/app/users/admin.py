from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser

class CustomUserAdmin(UserAdmin):
    # Add custom fields to the admin form
    fieldsets = UserAdmin.fieldsets + (
        ('Institutional Roles', {'fields': ('role', 'department')}),
    )
    # Add custom fields to the list view
    list_display = ('username', 'email', 'role', 'department', 'is_staff')

admin.site.register(CustomUser, CustomUserAdmin)