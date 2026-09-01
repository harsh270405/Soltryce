from django.urls import path

from .views import (
    AssignStudentClearanceView,
    BookingCancelView,
    BookingDetailView,
    BookingListCreateView,
    BookingSettingsView,
    BulkAssignClearanceView,
    ClearanceLevelDetailView,
    ClearanceLevelListCreateView,
    LaboratoryDetailView,
    LaboratoryListCreateView,
    LaboratoryToggleActiveView,
    ScheduleView,
    StudentClearanceListView,
)

app_name = "labs"

urlpatterns = [
    # Booking settings
    path(
        "booking-settings/",
        BookingSettingsView.as_view(),
        name="booking-settings",
    ),
    # Clearance levels
    path(
        "clearance-levels/",
        ClearanceLevelListCreateView.as_view(),
        name="clearance-level-list",
    ),
    path(
        "clearance-levels/<int:level>/",
        ClearanceLevelDetailView.as_view(),
        name="clearance-level-detail",
    ),
    # Laboratories
    path(
        "laboratories/",
        LaboratoryListCreateView.as_view(),
        name="laboratory-list",
    ),
    path(
        "laboratories/<int:pk>/",
        LaboratoryDetailView.as_view(),
        name="laboratory-detail",
    ),
    path(
        "laboratories/<int:pk>/toggle-active/",
        LaboratoryToggleActiveView.as_view(),
        name="laboratory-toggle-active",
    ),
    # Bookings
    path(
        "bookings/",
        BookingListCreateView.as_view(),
        name="booking-list",
    ),
    path(
        "bookings/<int:pk>/",
        BookingDetailView.as_view(),
        name="booking-detail",
    ),
    path(
        "bookings/<int:pk>/cancel/",
        BookingCancelView.as_view(),
        name="booking-cancel",
    ),
    # Schedule grid
    path(
        "schedule/",
        ScheduleView.as_view(),
        name="schedule",
    ),
    # Student clearance management
    path(
        "students/clearance/",
        StudentClearanceListView.as_view(),
        name="student-clearance-list",
    ),
    path(
        "students/<int:student_id>/clearance/",
        AssignStudentClearanceView.as_view(),
        name="assign-student-clearance",
    ),
    path(
        "bulk-assign-clearance/",
        BulkAssignClearanceView.as_view(),
        name="bulk-assign-clearance",
    ),
]
