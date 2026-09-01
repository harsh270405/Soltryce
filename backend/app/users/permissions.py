from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    message = 'Administrator access is required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_platform_admin)


class IsSupportStaff(BasePermission):
    message = 'Support staff access is required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'staff')
