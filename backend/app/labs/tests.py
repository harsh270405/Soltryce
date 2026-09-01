import datetime
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APIClient

from app.users.models import CustomUser
from .models import Booking, ClearanceLevel, Laboratory
from .serializers import (
    BookingCreateSerializer,
    ClearanceLevelSerializer,
    LaboratorySerializer,
    StudentClearanceSerializer,
)


# ── Model Tests ──────────────────────────────────────────────────


class ClearanceLevelModelTests(TestCase):
    def test_create_clearance_level(self):
        cl = ClearanceLevel.objects.create(level=1, label="Intermediate")
        self.assertEqual(cl.level, 1)
        self.assertEqual(cl.label, "Intermediate")
        self.assertEqual(str(cl), "Level 1: Intermediate")

    def test_cannot_delete_level_0(self):
        cl = ClearanceLevel.objects.get(level=0)
        with self.assertRaises(ValidationError):
            cl.delete()

    def test_level_ordering(self):
        ClearanceLevel.objects.create(level=3, label="Expert")
        ClearanceLevel.objects.create(level=1, label="Basic Plus")
        levels = list(ClearanceLevel.objects.values_list("level", flat=True))
        self.assertEqual(levels, [0, 1, 3])

    def test_cannot_delete_level_assigned_to_students(self):
        cl = ClearanceLevel.objects.create(level=2, label="Advanced")
        CustomUser.objects.create_user(
            username="teststudent",
            email="test@test.com",
            password="testpass123",
            clearance_level=2,
        )
        with self.assertRaises(ValidationError):
            cl.delete()


class LaboratoryModelTests(TestCase):
    def test_create_laboratory(self):
        lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            capacity=30,
            equipment="Computers, projectors",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(17, 0),
        )
        self.assertEqual(lab.name, "CS Lab 1")
        self.assertTrue(lab.is_active)
        self.assertEqual(lab.required_clearance, 0)
        self.assertEqual(lab.operating_hours, 8)

    def test_lab_validation_open_before_close(self):
        lab = Laboratory(
            name="Bad Lab",
            location="Nowhere",
            open_time=datetime.time(17, 0),
            close_time=datetime.time(9, 0),
        )
        with self.assertRaises(ValidationError):
            lab.clean()

    def test_lab_str(self):
        lab = Laboratory.objects.create(name="Physics Lab", location="Building B")
        self.assertEqual(str(lab), "Physics Lab")


class BookingModelTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="student1",
            email="s1@test.com",
            password="testpass123",
        )
        self.lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(17, 0),
        )

    def test_create_booking(self):
        booking = Booking.objects.create(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(10, 0),
            duration=1,
            status="APPROVED",
            purpose="Research",
        )
        self.assertEqual(booking.status, "APPROVED")
        self.assertEqual(booking.duration, 1)

    def test_booking_end_time(self):
        booking = Booking(
            start_time=datetime.time(10, 0),
            duration=2,
        )
        self.assertEqual(booking.end_time, datetime.time(12, 0))

    def test_booking_overlap(self):
        b1 = Booking.objects.create(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(10, 0),
            duration=2,
            status="APPROVED",
        )
        b2 = Booking(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(11, 0),
            duration=1,
            status="APPROVED",
        )
        self.assertTrue(b1.overlaps(b2))

    def test_booking_no_overlap_different_time(self):
        b1 = Booking.objects.create(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(10, 0),
            duration=1,
            status="APPROVED",
        )
        b2 = Booking(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(11, 0),
            duration=1,
            status="APPROVED",
        )
        self.assertFalse(b1.overlaps(b2))

    def test_booking_no_overlap_different_date(self):
        b1 = Booking.objects.create(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(10, 0),
            duration=2,
            status="APPROVED",
        )
        b2 = Booking(
            user=self.user,
            laboratory=self.lab,
            date=datetime.date(2026, 9, 3),
            start_time=datetime.time(10, 0),
            duration=2,
            status="APPROVED",
        )
        self.assertFalse(b1.overlaps(b2))


# ── Serializer Tests ─────────────────────────────────────────────


class ClearanceLevelSerializerTests(TestCase):
    def test_serialize(self):
        cl = ClearanceLevel.objects.create(level=1, label="Intermediate")
        data = ClearanceLevelSerializer(cl).data
        self.assertEqual(data["level"], 1)
        self.assertEqual(data["label"], "Intermediate")


class LaboratorySerializerTests(TestCase):
    def test_serialize(self):
        lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(17, 0),
        )
        data = LaboratorySerializer(lab).data
        self.assertEqual(data["name"], "CS Lab 1")
        self.assertEqual(data["operating_hours"], 8)


class BookingSerializerTests(TestCase):
    def test_serialize_with_relations(self):
        user = CustomUser.objects.create_user(
            username="student1", email="s1@test.com", password="testpass123"
        )
        lab = Laboratory.objects.create(
            name="CS Lab 1", location="Building A"
        )
        booking = Booking.objects.create(
            user=user,
            laboratory=lab,
            date=datetime.date(2026, 9, 2),
            start_time=datetime.time(10, 0),
            duration=1,
            status="APPROVED",
        )
        from .serializers import BookingSerializer

        data = BookingSerializer(booking).data
        self.assertEqual(data["laboratory_name"], "CS Lab 1")
        self.assertEqual(data["user_username"], "student1")


# ── API View Tests ───────────────────────────────────────────────


class ClearanceLevelAPITests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_list_clearance_levels(self):
        response = self.client.get("/api/v1/services/clearance-levels/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have at least level 0 from migration
        self.assertTrue(len(response.data) >= 1)

    def test_create_clearance_level(self):
        response = self.client.post(
            "/api/v1/services/clearance-levels/",
            {"level": 2, "label": "Advanced"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["level"], 2)
        self.assertEqual(response.data["label"], "Advanced")

    def test_update_clearance_level_label(self):
        ClearanceLevel.objects.create(level=1, label="Basic Plus")
        response = self.client.patch(
            "/api/v1/services/clearance-levels/1/",
            {"label": "Intermediate"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["label"], "Intermediate")

    def test_delete_clearance_level(self):
        ClearanceLevel.objects.create(level=3, label="Expert")
        response = self.client.delete("/api/v1/services/clearance-levels/3/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ClearanceLevel.objects.filter(level=3).exists())

    def test_cannot_delete_level_0(self):
        response = self.client.delete("/api/v1/services/clearance-levels/0/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_access(self):
        student = CustomUser.objects.create_user(
            username="student", email="s@test.com", password="pass1234"
        )
        self.client.force_authenticate(user=student)
        response = self.client.get("/api/v1/services/clearance-levels/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class LaboratoryAPITests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        self.student = CustomUser.objects.create_user(
            username="student", email="s@test.com", password="pass1234"
        )
        self.lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(17, 0),
        )
        self.client = APIClient()

    def test_admin_can_list_labs(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/services/laboratories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_student_sees_active_labs_only(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/services/laboratories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_student_does_not_see_inactive_labs(self):
        self.lab.is_active = False
        self.lab.save()
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/services/laboratories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_admin_can_create_lab(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/v1/services/laboratories/",
            {
                "name": "Physics Lab",
                "location": "Building B",
                "capacity": 25,
                "open_time": "08:00",
                "close_time": "18:00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Physics Lab")

    def test_student_cannot_create_lab(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/services/laboratories/",
            {"name": "Hack Lab", "location": "Basement"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_lab(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/v1/services/laboratories/{self.lab.id}/",
            {"name": "CS Lab 1 Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lab.refresh_from_db()
        self.assertEqual(self.lab.name, "CS Lab 1 Updated")

    def test_admin_can_toggle_active(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/v1/services/laboratories/{self.lab.id}/toggle-active/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lab.refresh_from_db()
        self.assertFalse(self.lab.is_active)

    def test_admin_hard_delete_cascades_bookings(self):
        self.client.force_authenticate(user=self.admin)
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        Booking.objects.create(
            user=self.student,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(10, 0),
            duration=1,
            status="PENDING",
        )
        Booking.objects.create(
            user=self.student,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(12, 0),
            duration=1,
            status="APPROVED",
        )
        response = self.client.delete(f"/api/v1/services/laboratories/{self.lab.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Laboratory.objects.filter(pk=self.lab.id).exists())
        # Pending bookings should be rejected (lab FK set to NULL on delete)
        self.assertEqual(
            Booking.objects.filter(
                user=self.student, status="REJECTED"
            ).count(),
            1,
        )
        # Approved future bookings should be cancelled (lab FK set to NULL on delete)
        self.assertEqual(
            Booking.objects.filter(
                user=self.student, status="CANCELLED"
            ).count(),
            1,
        )


class BookingAPITests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        self.student = CustomUser.objects.create_user(
            username="student", email="s@test.com", password="pass1234"
        )
        self.lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(17, 0),
            required_clearance=0,
        )
        self.client = APIClient()

    def test_student_can_create_booking_qualified(self):
        """Student with sufficient clearance gets auto-approved."""
        self.client.force_authenticate(user=self.student)
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        response = self.client.post(
            "/api/v1/services/bookings/",
            {
                "laboratory": self.lab.id,
                "date": str(tomorrow),
                "start_time": "10:00",
                "duration": 1,
                "purpose": "Research work",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "APPROVED")

    def test_student_without_clearance_gets_pending(self):
        """Student below required clearance gets pending status."""
        self.lab.required_clearance = 2
        self.lab.save()
        self.client.force_authenticate(user=self.student)
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        response = self.client.post(
            "/api/v1/services/bookings/",
            {
                "laboratory": self.lab.id,
                "date": str(tomorrow),
                "start_time": "10:00",
                "duration": 1,
                "purpose": "Research work",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")

    def test_student_cannot_book_in_the_past(self):
        """Cannot book a time slot that is already in the past."""
        self.client.force_authenticate(user=self.student)
        yesterday = datetime.date.today() - datetime.timedelta(days=1)
        response = self.client.post(
            "/api/v1/services/bookings/",
            {
                "laboratory": self.lab.id,
                "date": str(yesterday),
                "start_time": "10:00",
                "duration": 1,
                "purpose": "Research work",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_cannot_book_too_far_in_advance(self):
        """Cannot book more than max_days_in_advance days ahead."""
        from app.labs.models import BookingSettings
        settings = BookingSettings.load()
        settings.max_days_in_advance = 7
        settings.save()
        self.client.force_authenticate(user=self.student)
        too_far = datetime.date.today() + datetime.timedelta(days=10)
        response = self.client.post(
            "/api/v1/services/bookings/",
            {
                "laboratory": self.lab.id,
                "date": str(too_far),
                "start_time": "10:00",
                "duration": 1,
                "purpose": "Research work",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Reset for other tests
        settings.max_days_in_advance = 30
        settings.save()

    def test_booking_conflict_detection(self):
        """Cannot book overlapping slots."""
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        Booking.objects.create(
            user=self.student,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(10, 0),
            duration=2,
            status="APPROVED",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/services/bookings/",
            {
                "laboratory": self.lab.id,
                "date": str(tomorrow),
                "start_time": "11:00",
                "duration": 1,
                "purpose": "Another session",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_student_can_cancel_own_booking(self):
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        booking = Booking.objects.create(
            user=self.student,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(10, 0),
            duration=1,
            status="APPROVED",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f"/api/v1/services/bookings/{booking.id}/cancel/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "CANCELLED")

    def test_student_cannot_cancel别人的_booking(self):
        other = CustomUser.objects.create_user(
            username="other", email="o@test.com", password="pass1234"
        )
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        booking = Booking.objects.create(
            user=other,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(10, 0),
            duration=1,
            status="APPROVED",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f"/api/v1/services/bookings/{booking.id}/cancel/"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ScheduleAPITests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        self.student = CustomUser.objects.create_user(
            username="student", email="s@test.com", password="pass1234"
        )
        self.lab = Laboratory.objects.create(
            name="CS Lab 1",
            location="Building A",
            open_time=datetime.time(9, 0),
            close_time=datetime.time(11, 0),
        )
        self.client = APIClient()

    def test_schedule_returns_labs_and_slots(self):
        self.client.force_authenticate(user=self.student)
        tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        response = self.client.get(f"/api/v1/services/schedule/?date={tomorrow}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("labs", response.data)
        self.assertIn("date", response.data)
        lab_data = response.data["labs"]
        self.assertIn(str(self.lab.id), lab_data)
        # Should have 2 slots (9:00, 10:00) for open_time=9, close_time=11
        self.assertEqual(len(lab_data[str(self.lab.id)]["slots"]), 2)

    def test_schedule_with_bookings(self):
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        Booking.objects.create(
            user=self.student,
            laboratory=self.lab,
            date=tomorrow,
            start_time=datetime.time(9, 0),
            duration=1,
            status="APPROVED",
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.get(
            f"/api/v1/services/schedule/?date={tomorrow.isoformat()}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lab_slots = response.data["labs"][str(self.lab.id)]["slots"]
        # 9:00 slot should have a booking
        slot_9 = next(s for s in lab_slots if s["time"] == "09:00")
        self.assertEqual(len(slot_9["bookings"]), 1)
        self.assertEqual(slot_9["bookings"][0]["status"], "APPROVED")

    def test_schedule_invalid_date(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/services/schedule/?date=invalid")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class StudentClearanceAPITests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )
        self.student = CustomUser.objects.create_user(
            username="student1", email="s1@test.com", password="pass1234"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_bulk_assign_clearance(self):
        s2 = CustomUser.objects.create_user(
            username="student2", email="s2@test.com", password="pass1234"
        )
        response = self.client.post(
            "/api/v1/services/bulk-assign-clearance/",
            {
                "student_ids": [self.student.id, s2.id],
                "clearance_level": 0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        s2.refresh_from_db()
        self.assertEqual(self.student.clearance_level, 0)
        self.assertEqual(s2.clearance_level, 0)

    def test_list_students_with_clearance(self):
        response = self.client.get("/api/v1/services/students/clearance/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)

    def test_search_students(self):
        response = self.client.get(
            "/api/v1/services/students/clearance/?search=student1"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_non_admin_cannot_list_students(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/services/students/clearance/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
