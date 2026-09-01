from rest_framework import status
from rest_framework.test import APITestCase

from .models import CustomUser


class AuthenticationTests(APITestCase):
    def test_invalid_login_returns_a_clear_generic_error(self):
        response = self.client.post('/api/v1/auth/login/', {'username': 'does-not-exist', 'password': 'incorrect-password'})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid username or password.')

    def test_admin_can_create_a_support_staff_account(self):
        admin = CustomUser.objects.create_user(username='admin', email='admin@example.com', password='admin-password', role='admin')
        self.client.force_authenticate(admin)

        response = self.client.post('/api/v1/auth/users/', {
            'username': 'maintenance-team', 'email': 'maintenance@example.com', 'display_name': 'Maintenance Team',
            'department': 'Facilities', 'password': 'safe-temporary-password', 'role': 'staff',
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        staff_member = CustomUser.objects.get(username='maintenance-team')
        self.assertEqual(staff_member.role, 'staff')
        self.assertTrue(staff_member.check_password('safe-temporary-password'))
