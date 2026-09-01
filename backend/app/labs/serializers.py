from datetime import date, datetime, timedelta

from rest_framework import serializers

from app.users.models import CustomUser
from .models import Booking, BookingSettings, ClearanceLevel, Laboratory


# ── Clearance Level ──────────────────────────────────────────────


class ClearanceLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClearanceLevel
        fields = ("level", "label")


# ── Laboratory ───────────────────────────────────────────────────


class LaboratorySerializer(serializers.ModelSerializer):
    operating_hours = serializers.ReadOnlyField()

    class Meta:
        model = Laboratory
        fields = (
            "id",
            "name",
            "location",
            "capacity",
            "equipment",
            "is_active",
            "required_clearance",
            "open_time",
            "close_time",
            "operating_hours",
        )


class LaboratoryStudentSerializer(serializers.ModelSerializer):
    """Laboratory serializer enriched with student qualification info."""

    qualifies = serializers.SerializerMethodField()
    qualification_label = serializers.SerializerMethodField()

    class Meta:
        model = Laboratory
        fields = (
            "id",
            "name",
            "location",
            "capacity",
            "equipment",
            "is_active",
            "required_clearance",
            "open_time",
            "close_time",
            "operating_hours",
            "qualifies",
            "qualification_label",
        )

    def get_qualifies(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return request.user.clearance_level >= obj.required_clearance
        return True

    def get_qualification_label(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            if request.user.clearance_level >= obj.required_clearance:
                return "You qualify"
            return "Requires approval"
        return "You qualify"


# ── Booking ──────────────────────────────────────────────────────


class BookingSerializer(serializers.ModelSerializer):
    laboratory_name = serializers.CharField(source="laboratory.name", read_only=True)
    laboratory_location = serializers.CharField(
        source="laboratory.location", read_only=True
    )
    user_display_name = serializers.CharField(
        source="user.display_name", read_only=True
    )
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_clearance_level = serializers.IntegerField(
        source="user.clearance_level", read_only=True
    )
    end_time = serializers.ReadOnlyField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "user",
            "laboratory",
            "laboratory_name",
            "laboratory_location",
            "date",
            "start_time",
            "duration",
            "end_time",
            "status",
            "purpose",
            "cancellation_reason",
            "user_display_name",
            "user_username",
            "user_email",
            "user_clearance_level",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "cancellation_reason",
            "created_at",
            "updated_at",
        )


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ("laboratory", "date", "start_time", "duration", "purpose")

    def validate(self, data):
        lab = data["laboratory"]
        if not lab.is_active:
            raise serializers.ValidationError(
                {"laboratory": "This laboratory is not available for booking."}
            )

        # Prevent booking time slots in the past
        now = datetime.now()
        booking_dt = datetime.combine(data["date"], data["start_time"])
        if booking_dt <= now:
            raise serializers.ValidationError(
                {"date": "Cannot book a time slot in the past."}
            )

        # Enforce max_days_in_advance
        from .models import BookingSettings
        settings = BookingSettings.load()
        max_date = date.today() + timedelta(days=settings.max_days_in_advance)
        if data["date"] > max_date:
            raise serializers.ValidationError(
                {"date": f"Cannot book more than {settings.max_days_in_advance} days in advance."}
            )

        # Check lab operating hours
        if data["start_time"] < lab.open_time or data["start_time"] >= lab.close_time:
            raise serializers.ValidationError(
                {"start_time": f"Lab operates from {lab.open_time} to {lab.close_time}."}
            )
        # Check end time doesn't exceed close_time
        start_dt = datetime.combine(datetime.today(), data["start_time"])
        end_dt = start_dt + timedelta(hours=data["duration"])
        if end_dt.time() > lab.close_time:
            raise serializers.ValidationError(
                {
                    "duration": f"Booking would end at {end_dt.time()}, but lab closes at {lab.close_time}."
                }
            )
        return data


# ── Student (for admin clearance management) ─────────────────────


class StudentClearanceSerializer(serializers.ModelSerializer):
    clearance_label = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "username",
            "display_name",
            "email",
            "department",
            "clearance_level",
            "clearance_label",
        )
        read_only_fields = fields

    def get_clearance_label(self, obj):
        from .models import ClearanceLevel

        try:
            cl = ClearanceLevel.objects.get(level=obj.clearance_level)
            return cl.label
        except ClearanceLevel.DoesNotExist:
            return "Unknown"


class BulkAssignClearanceSerializer(serializers.Serializer):
    student_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1
    )
    clearance_level = serializers.IntegerField(min_value=0)


class BookingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingSettings
        fields = ("max_days_in_advance",)
