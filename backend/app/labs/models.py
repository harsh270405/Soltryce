from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class BookingSettings(models.Model):
    """Global booking configuration (singleton row)."""

    max_days_in_advance = models.PositiveIntegerField(
        default=30,
        help_text="Maximum number of days in advance a student can book a lab.",
    )

    class Meta:
        verbose_name = "Booking Settings"
        verbose_name_plural = "Booking Settings"

    def __str__(self):
        return f"Booking Settings (max {self.max_days_in_advance} days)"

    def save(self, *args, **kwargs):
        # Enforce singleton: only allow one row
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        try:
            obj, _ = cls.objects.get_or_create(pk=1)
            return obj
        except Exception:
            # Table may not exist yet (migration pending) — return a default
            default = cls(pk=1, max_days_in_advance=30)
            default._state = type('_state', (), {'adding': False, 'db': None})()
            return default


class ClearanceLevel(models.Model):
    """Institution-defined clearance levels (0 = Basic, 1 = Intermediate, etc.)."""

    level = models.PositiveIntegerField(primary_key=True, help_text="0, 1, 2…")
    label = models.CharField(max_length=64, help_text="Admin-defined name, e.g. Basic, Intermediate")

    class Meta:
        ordering = ["level"]

    def __str__(self):
        return f"Level {self.level}: {self.label}"

    def delete(self, *args, **kwargs):
        if self.level == 0:
            raise ValidationError("Clearance level 0 cannot be deleted.")
        # Check if any students or labs reference this level
        from app.users.models import CustomUser

        if CustomUser.objects.filter(clearance_level=self.level).exists():
            raise ValidationError(
                "Cannot delete a clearance level that is assigned to students."
            )
        if Laboratory.objects.filter(required_clearance=self.level).exists():
            raise ValidationError(
                "Cannot delete a clearance level that is required by laboratories."
            )
        super().delete(*args, **kwargs)


class Laboratory(models.Model):
    """A bookable laboratory with configurable operating hours."""

    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    capacity = models.PositiveIntegerField(default=1)
    equipment = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    required_clearance = models.PositiveIntegerField(
        default=0,
        help_text="Minimum clearance level needed to auto-book this lab",
    )
    # Operating hours
    open_time = models.TimeField(default="09:00", help_text="Lab opens at this time")
    close_time = models.TimeField(default="17:00", help_text="Lab closes at this time")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.open_time >= self.close_time:
            raise ValidationError("open_time must be before close_time.")

    @property
    def operating_hours(self):
        """Return the number of 1-hour slots available in a day."""
        from datetime import datetime

        open_dt = datetime.combine(datetime.today(), self.open_time)
        close_dt = datetime.combine(datetime.today(), self.close_time)
        return int((close_dt - open_dt).total_seconds() // 3600)


class Booking(models.Model):
    """A lab booking made by a student."""

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("CANCELLED", "Cancelled"),
        ("REJECTED", "Rejected"),
    ]
    DURATION_CHOICES = [
        (1, "1 hour"),
        (2, "2 hours"),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lab_bookings",
    )
    laboratory = models.ForeignKey(
        Laboratory,
        on_delete=models.SET_NULL,
        null=True,
        related_name="bookings",
    )
    date = models.DateField()
    start_time = models.TimeField()
    duration = models.PositiveIntegerField(
        choices=DURATION_CHOICES,
        default=1,
        help_text="Booking duration in hours",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    purpose = models.TextField(blank=True, default="")
    cancellation_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-start_time"]
        # Prevent double-booking: one approved booking per lab per slot
        constraints = [
            models.UniqueConstraint(
                fields=["laboratory", "date", "start_time"],
                condition=models.Q(status="APPROVED"),
                name="unique_approved_booking_per_slot",
            )
        ]

    def __str__(self):
        return (
            f"{self.laboratory.name} - {self.user.username} "
            f"on {self.date} at {self.start_time}"
        )

    @property
    def end_time(self):
        """Calculate end time based on start_time + duration."""
        from datetime import datetime, timedelta

        start_dt = datetime.combine(datetime.today(), self.start_time)
        end_dt = start_dt + timedelta(hours=self.duration)
        return end_dt.time()

    def overlaps(self, other):
        """Check if this booking overlaps with another booking."""
        if self.laboratory_id != other.laboratory_id or self.date != other.date:
            return False
        if self.status not in ("APPROVED", "PENDING") or other.status not in (
            "APPROVED",
            "PENDING",
        ):
            return False
        # Convert to minutes for easier comparison
        s1 = self.start_time.hour * 60 + self.start_time.minute
        e1 = s1 + self.duration * 60
        s2 = other.start_time.hour * 60 + other.start_time.minute
        e2 = s2 + other.duration * 60
        return s1 < e2 and s2 < e1
