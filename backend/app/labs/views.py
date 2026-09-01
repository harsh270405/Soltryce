from datetime import date, datetime, timedelta

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.audit.models import AuditTrail
from app.users.models import CustomUser
from app.users.permissions import IsPlatformAdmin
from .models import Booking, BookingSettings, ClearanceLevel, Laboratory
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    BookingSettingsSerializer,
    BulkAssignClearanceSerializer,
    ClearanceLevelSerializer,
    LaboratorySerializer,
    LaboratoryStudentSerializer,
    StudentClearanceSerializer,
)


# ── Helper ───────────────────────────────────────────────────────


def _audit(request, action, request_obj=None, extra=""):
    AuditTrail.objects.create(
        request=request_obj
        if request_obj
        else _get_dummy_request(request, action),
        agent_name="labs-api",
        step_number=1,
        action_taken=action + (f" ({extra})" if extra else ""),
        executed_by_human=True,
    )


def _get_dummy_request(request, action):
    """Create a lightweight ServiceRequest for audit trail if none exists."""
    from app.approvals.models import ServiceRequest

    return ServiceRequest.objects.create(
        user=request.user,
        query=f"Audit: {action}",
        category="lab_booking",
        status="COMPLETED",
        response=f"Audited by {request.user.username}",
    )


# ── Clearance Levels ─────────────────────────────────────────────


class BookingSettingsView(APIView):
    """Get or update global booking settings (admin only)."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        settings = BookingSettings.load()
        return Response(BookingSettingsSerializer(settings).data)

    def put(self, request):
        settings = BookingSettings.load()
        serializer = BookingSettingsSerializer(settings, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _audit(request, "booking_settings.updated")
        return Response(serializer.data)


class ClearanceLevelListCreateView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        levels = ClearanceLevel.objects.all()
        return Response(ClearanceLevelSerializer(levels, many=True).data)

    def post(self, request):
        serializer = ClearanceLevelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _audit(request, "clearance_level.created")
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClearanceLevelDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def patch(self, request, level):
        cl = get_object_or_404(ClearanceLevel, level=level)
        serializer = ClearanceLevelSerializer(cl, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _audit(request, "clearance_level.updated")
        return Response(serializer.data)

    def delete(self, request, level):
        cl = get_object_or_404(ClearanceLevel, level=level)
        try:
            cl.delete()
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        _audit(request, "clearance_level.deleted")
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Laboratories ─────────────────────────────────────────────────


class LaboratoryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        labs = Laboratory.objects.all()
        if request.user.is_platform_admin:
            return Response(LaboratorySerializer(labs, many=True).data)
        # Students see only active labs with qualification info
        labs = labs.filter(is_active=True)
        return Response(
            LaboratoryStudentSerializer(
                labs, many=True, context={"request": request}
            ).data
        )

    def post(self, request):
        if not request.user.is_platform_admin:
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = LaboratorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        _audit(request, "laboratory.created")
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LaboratoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        lab = get_object_or_404(Laboratory, pk=pk)
        if request.user.is_platform_admin:
            return Response(LaboratorySerializer(lab).data)
        if not lab.is_active:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(
            LaboratoryStudentSerializer(lab, context={"request": request}).data
        )

    def patch(self, request, pk):
        if not request.user.is_platform_admin:
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        lab = get_object_or_404(Laboratory, pk=pk)
        serializer = LaboratorySerializer(lab, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        if not request.user.is_platform_admin:
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        lab = get_object_or_404(Laboratory, pk=pk)
        today = date.today()
        now_time = datetime.now().time()

        with transaction.atomic():
            # Reject pending bookings
            Booking.objects.filter(
                laboratory=lab, status="PENDING"
            ).update(
                status="REJECTED",
                cancellation_reason="Lab was removed.",
            )

            # Cancel approved future bookings
            Booking.objects.filter(
                Q(date__gt=today) | Q(date=today, start_time__gte=now_time),
                laboratory=lab,
                status="APPROVED",
            ).update(
                status="CANCELLED",
                cancellation_reason="Lab was removed.",
            )

            lab.delete()

        _audit(request, "laboratory.hard_deleted")
        return Response(status=status.HTTP_204_NO_CONTENT)


class LaboratoryToggleActiveView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        lab = get_object_or_404(Laboratory, pk=pk)
        lab.is_active = not lab.is_active
        lab.save(update_fields=["is_active"])
        action = "laboratory.reactivated" if lab.is_active else "laboratory.deactivated"
        _audit(request, action)
        return Response(LaboratorySerializer(lab).data)


# ── Bookings ─────────────────────────────────────────────────────


class BookingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_platform_admin:
            bookings = Booking.objects.select_related(
                "laboratory", "user"
            ).all()
        else:
            bookings = Booking.objects.filter(
                user=request.user
            ).select_related("laboratory", "user")
        return Response(BookingSerializer(bookings, many=True).data)

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lab = serializer.validated_data["laboratory"]
        booking_date = serializer.validated_data["date"]
        start_time = serializer.validated_data["start_time"]
        duration = serializer.validated_data["duration"]
        purpose = serializer.validated_data.get("purpose", "")

        # Check for overlapping bookings
        existing = Booking.objects.filter(
            laboratory=lab,
            date=booking_date,
            status__in=("APPROVED", "PENDING"),
        )
        new_s = start_time.hour * 60 + start_time.minute
        new_e = new_s + duration * 60

        for b in existing:
            b_s = b.start_time.hour * 60 + b.start_time.minute
            b_e = b_s + b.duration * 60
            if new_s < b_e and b_s < new_e:
                return Response(
                    {"detail": "This time slot is already booked or pending."},
                    status=status.HTTP_409_CONFLICT,
                )

        # Clearance-based auto-approve
        if request.user.clearance_level >= lab.required_clearance:
            booking_status = "APPROVED"
            action = "lab_booking.auto_approved"
        else:
            booking_status = "PENDING"
            action = "lab_booking.created"

        booking = Booking.objects.create(
            user=request.user,
            laboratory=lab,
            date=booking_date,
            start_time=start_time,
            duration=duration,
            status=booking_status,
            purpose=purpose,
        )

        # Create approval request only if not auto-approved
        if booking_status == "PENDING":
            from app.approvals.models import ActionApproval, ServiceRequest

            service_request = ServiceRequest.objects.create(
                user=request.user,
                query=f"Lab booking request for {lab.name} on {booking_date} at {start_time} ({duration}h).",
                category="lab_booking",
                status="PENDING_APPROVAL",
                metadata={
                    "laboratory_id": lab.id,
                    "laboratory_name": lab.name,
                    "date": str(booking_date),
                    "start_time": str(start_time),
                    "duration": duration,
                    "purpose": purpose,
                    "booking_id": booking.id,
                },
            )
            ActionApproval.objects.create(
                request=service_request,
                thread_id="",
                tool_name="book_laboratory",
                tool_payload={
                    "laboratory": lab.name,
                    "date": str(booking_date),
                    "start_time": str(start_time),
                    "duration": duration,
                    "purpose": purpose,
                },
                rationale=f"Student clearance ({request.user.clearance_level}) is below lab requirement ({lab.required_clearance}).",
            )

        _audit(request, action)
        return Response(
            BookingSerializer(booking).data, status=status.HTTP_201_CREATED
        )


class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        booking = get_object_or_404(
            Booking.objects.select_related("laboratory", "user"), pk=pk
        )
        if (
            booking.user_id != request.user.id
            and not request.user.is_platform_admin
        ):
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(BookingSerializer(booking).data)

    def patch(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        if not request.user.is_platform_admin:
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        new_status = request.data.get("status")
        if new_status not in ("APPROVED", "REJECTED", "CANCELLED"):
            return Response(
                {"detail": "Invalid status."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = new_status
        booking.cancellation_reason = request.data.get("reason", "")
        booking.save(update_fields=["status", "cancellation_reason", "updated_at"])
        return Response(BookingSerializer(booking).data)


class BookingCancelView(APIView):
    """Students cancel their own approved bookings."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        if booking.user_id != request.user.id:
            return Response(
                {"detail": "Not your booking."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if booking.status != "APPROVED":
            return Response(
                {"detail": "Only approved bookings can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Check booking hasn't started yet
        today = date.today()
        if booking.date < today or (
            booking.date == today
            and booking.start_time <= datetime.now().time()
        ):
            return Response(
                {"detail": "Cannot cancel a booking that has already started."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = "CANCELLED"
        booking.cancellation_reason = "Cancelled by student"
        booking.save(update_fields=["status", "cancellation_reason", "updated_at"])
        return Response(BookingSerializer(booking).data)


# ── Schedule Grid ────────────────────────────────────────────────


class ScheduleView(APIView):
    """Returns bookings for a date range across all labs (for the grid)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        if not date_str:
            date_str = str(date.today())

        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lab_id = request.query_params.get("laboratory_id")
        labs = Laboratory.objects.all()
        if lab_id:
            labs = labs.filter(pk=lab_id)

        # Students only see active labs
        if not request.user.is_platform_admin:
            labs = labs.filter(is_active=True)

        bookings = Booking.objects.filter(
            laboratory__in=labs,
            date=target_date,
            status__in=("APPROVED", "PENDING"),
        ).select_related("laboratory", "user")

        # Build schedule data
        booking_settings = BookingSettings.load()
        is_today = target_date == date.today()
        now_time = datetime.now().time() if is_today else None

        schedule = {}
        for lab in labs:
            # Generate time slots from open_time to close_time
            slots = []
            current = datetime.combine(target_date, lab.open_time)
            close_dt = datetime.combine(target_date, lab.close_time)

            while current < close_dt:
                slot_time = current.time()

                # Skip past time slots for today (students can't book them)
                if is_today and not request.user.is_platform_admin and slot_time <= now_time:
                    current += timedelta(hours=1)
                    continue

                # Find bookings for this slot
                slot_bookings = []
                for b in bookings:
                    if b.laboratory_id == lab.id:
                        b_start = b.start_time.hour * 60 + b.start_time.minute
                        b_end = b_start + b.duration * 60
                        s_start = slot_time.hour * 60 + slot_time.minute
                        s_end = s_start + 60
                        if s_start < b_end and b_start < s_end:
                            slot_bookings.append(
                                {
                                    "id": b.id,
                                    "status": b.status,
                                    "user_id": b.user_id,
                                    "user_name": b.user.display_name
                                    or b.user.username,
                                    "user_email": b.user.email,
                                    "purpose": b.purpose,
                                    "duration": b.duration,
                                    "start_time": str(b.start_time),
                                }
                            )
                slots.append(
                    {
                        "time": str(slot_time)[:5],
                        "bookings": slot_bookings,
                    }
                )
                current += timedelta(hours=1)

            # Check student qualification for this lab
            qualifies = True
            qualification_label = "You qualify"
            if not request.user.is_platform_admin:
                qualifies = (
                    request.user.clearance_level >= lab.required_clearance
                )
                qualification_label = (
                    "You qualify" if qualifies else "Requires approval"
                )

            schedule[str(lab.id)] = {
                "lab_id": lab.id,
                "lab_name": lab.name,
                "lab_location": lab.location,
                "required_clearance": lab.required_clearance,
                "qualifies": qualifies,
                "qualification_label": qualification_label,
                "slots": slots,
            }

        return Response(
            {
                "date": str(target_date),
                "max_days_in_advance": booking_settings.max_days_in_advance,
                "labs": schedule,
            }
        )


# ── Student Clearance Management ─────────────────────────────────


class StudentClearanceListView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        students = CustomUser.objects.filter(role="student").order_by(
            "username"
        )

        # Filtering
        search = request.query_params.get("search", "").strip()
        if search:
            students = students.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(display_name__icontains=search)
            )
        clearance = request.query_params.get("clearance_level")
        if clearance is not None:
            try:
                students = students.filter(
                    clearance_level=int(clearance)
                )
            except ValueError:
                pass

        return Response(
            StudentClearanceSerializer(students, many=True).data
        )


class BulkAssignClearanceView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        serializer = BulkAssignClearanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_ids = serializer.validated_data["student_ids"]
        clearance_level = serializer.validated_data["clearance_level"]

        # Validate clearance level exists
        if not ClearanceLevel.objects.filter(level=clearance_level).exists():
            return Response(
                {"detail": f"Clearance level {clearance_level} does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = CustomUser.objects.filter(
            id__in=student_ids, role="student"
        ).update(clearance_level=clearance_level)

        _audit(
            request,
            "clearance_level.bulk_assigned",
            extra=f"level={clearance_level}, updated={updated}",
        )

        return Response(
            {
                "detail": f"Updated {updated} student(s) to clearance level {clearance_level}."
            }
        )


class AssignStudentClearanceView(APIView):
    """Assign clearance to a single student."""

    permission_classes = [IsPlatformAdmin]

    def post(self, request, student_id):
        student = get_object_or_404(CustomUser, pk=student_id, role="student")
        clearance_level = request.data.get("clearance_level")
        if clearance_level is None:
            return Response(
                {"detail": "clearance_level is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        clearance_level = int(clearance_level)
        if not ClearanceLevel.objects.filter(level=clearance_level).exists():
            return Response(
                {"detail": f"Clearance level {clearance_level} does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        student.clearance_level = clearance_level
        student.save(update_fields=["clearance_level"])
        _audit(
            request,
            "clearance_level.assigned",
            extra=f"student={student.username}, level={clearance_level}",
        )
        return Response(
            StudentClearanceSerializer(student).data
        )
