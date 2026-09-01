# Lab Booking System Upgrade — Specification

## Overview

Upgrade the existing lab booking system with:
1. An **admin visual dashboard** — day-by-day schedule grid across all labs with click-to-manage actions, plus lab CRUD.
2. A **clearance-level access control system** — students are assigned integer clearance levels; labs have required clearance levels; auto-approval for qualified students, manual admin approval for under-qualified students.
3. A **student-facing calendar view** — day-by-day grid of available slots that students can click to book.

---

## 1. Clearance Level System

### 1.1 Clearance Levels (Configuration)

A new model stores the institution's clearance level definitions. Admins configure these (e.g. `0 = "Basic"`, `1 = "Intermediate"`, `2 = "Advanced"`).

**Model: `ClearanceLevel`**

| Field | Type | Notes |
|-------|------|-------|
| `level` | IntegerField (PK) | 0, 1, 2, 3… |
| `label` | CharField(64) | Admin-defined name, e.g. "Basic", "Intermediate" |

- Admins can create/edit/delete labels via an API endpoint.
- Level `0` is always present and cannot be deleted (default for all students).

### 1.2 User Model Changes

Add to the existing `User` model:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `clearance_level` | IntegerField | `0` | Must match an existing `ClearanceLevel.level` |

- Students see their own clearance level and label on their profile page.
- Admins can assign clearance levels to individual students or in bulk (select multiple students → set level).

### 1.3 Laboratory Model Changes

Add to the existing `Laboratory` model:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `required_clearance` | IntegerField | `0` | Minimum clearance level needed to auto-book this lab |

Keep all existing fields (`name`, `location`, `capacity`, `equipment`, `is_active`).

### 1.4 Access Control Logic

When a student submits a booking for a lab:

```
IF student.clearance_level >= lab.required_clearance:
    → Auto-approve (subject to conflict check)
    → Booking status = APPROVED immediately
    → No approval request created
ELSE:
    → Booking status = PENDING
    → ApprovalRequest created (existing flow)
    → Admin must approve/reject
```

**Student-facing display:**
- Next to each lab in the student view, show a **qualification badge**:
  - ✅ "You qualify" (green) — student meets or exceeds the required clearance
  - 🔒 "Requires approval" (orange) — student is below the required clearance
- Students see their own clearance level and label on their profile.
- Students do NOT see other students' clearance levels.

### 1.5 Cancellation Rules

- Students can freely cancel their own bookings **before the booking starts** (no change from current behavior for approved bookings).
- Admins can cancel any booking at any time.
- Cancelled bookings free up the slot.

---

## 2. Admin Visual Dashboard

### 2.1 Lab Management

Admins can:
- **Add** a new lab (name, location, capacity, equipment, required clearance level).
- **Edit** an existing lab's details and required clearance level.
- **Deactivate** (soft delete) — lab is hidden from student options; existing bookings remain but no new bookings are accepted. Can be reactivated.
- **Delete** (hard delete) — lab is permanently removed. Requires confirmation. Bookings referencing this lab must be handled:
  - Pending bookings → auto-rejected with reason "Lab was removed."
  - Approved future bookings → auto-cancelled with reason "Lab was removed."
  - Past bookings → remain in history as-is.

### 2.2 Schedule Grid (Day-by-Day)

**Layout:** All labs as rows, time slots as columns. Scrolling vertically for many labs.

**Visual design:**
- Each cell represents a time slot (e.g. 1-hour blocks) for a specific lab on a specific day.
- **Color coding:**
  - 🟢 Green — Available (no booking)
  - 🔵 Blue — Pending approval (awaiting admin action)
  - 🔴 Red — Approved / Booked
  - ⚪ Gray — Cancelled or rejected
- **Hover** on a booked/pending cell shows: student name, email, purpose, clearance level.
- **Click** on any cell:
  - If available → option to block the slot (admin override)
  - If pending → quick approve/reject with reason field
  - If approved → option to cancel with reason field
  - If cancelled → info only

**Navigation:**
- Date picker to select which day to view.
- "Today" button to jump to current date.
- Left/right arrows to move day-by-day.
- Optional: week view toggle (7 days side by side).

**Filtering:**
- Filter by lab name.
- Filter by status (show only pending, show only booked, etc.).

### 2.3 Student Clearance Management

Admin endpoint to:
- View a list of all students with their current clearance level.
- Filter/search students by name, email, or clearance level.
- Assign clearance level to one or more students (bulk select → set level).

---

## 3. Student-Facing Calendar View

### 3.1 Day-by-Day Grid

Same visual style as the admin grid but **read-only**:
- Labs as rows, time slots as columns.
- Color coding: 🟢 Available, 🔴 Booked (by anyone — students see it as occupied), 🔵 Their own pending booking.
- Qualification badge on each lab row header ("You qualify" / "Requires approval").

### 3.2 Booking Flow

1. Student clicks an available (green) slot.
2. A confirmation dialog appears showing:
   - Lab name, date, time range.
   - Qualification status ("You qualify — booking will be auto-approved" or "Your request will need admin approval").
   - Purpose input field.
3. Student confirms → booking is created.
4. If qualified: booking is auto-approved instantly → slot turns red.
5. If not qualified: booking is pending → slot turns blue → admin must approve.

### 3.3 My Bookings

Student dashboard shows a list of their active and past bookings with:
- Status badge (approved, pending, cancelled).
- Lab name, date/time, purpose.
- Cancel button for approved future bookings.

---

## 4. API Changes

### 4.1 New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/services/labs/schedule/` | Authenticated | Returns bookings for a date range across all labs (for the grid). Query params: `date`, optionally `laboratory_id`. |
| GET/POST | `/api/v1/services/clearance-levels/` | Admin | List or create clearance level definitions. |
| PATCH/DELETE | `/api/v1/services/clearance-levels/<level>/` | Admin | Edit label or delete a clearance level. |
| POST | `/api/v1/services/labs/bulk-assign-clearance/` | Admin | Assign clearance level to multiple students. Body: `{ student_ids: [...], clearance_level: N }`. |
| GET | `/api/v1/services/students/clearance/` | Admin | List students with their clearance levels. Supports filtering. |

### 4.2 Modified Endpoints

**`POST /api/v1/services/bookings/`**
- Before creating the approval request, check `student.clearance_level >= lab.required_clearance`.
- If qualified: create booking with status `APPROVED` (skip approval request, run conflict check).
- If not qualified: existing behavior (status `PENDING` + create approval request).

**`GET /api/v1/services/laboratories/`**
- For students: annotate each lab with the student's qualification status.
- For admins: include `required_clearance` and `is_active` fields.

**`DELETE /api/v1/services/laboratories/<id>/`**
- Hard delete with cascading: reject pending bookings, cancel approved future bookings, preserve past bookings.

**`PATCH /api/v1/services/laboratories/<id>/`**
- Support updating `required_clearance`.

**`GET /api/v1/services/bookings/`**
- For admins: include student clearance level info in the response.

### 4.3 Removed/Changed Behavior

- The existing `lab_availability` endpoint can remain for backward compatibility but the new schedule endpoint is the primary data source for the grid.
- Approval requests for clearance-matched bookings are no longer created (the auto-approve path skips them entirely).

---

## 5. Frontend Changes

### 5.1 New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `ScheduleGrid` | Shared | Reusable day-by-day grid component (labs × time slots). Used by both admin and student views. Props: `labs`, `bookings`, `onSlotClick`, `readOnly`. |
| `LabManagement` | Admin panel | CRUD interface for labs (add/edit/deactivate/delete forms). |
| `ClearanceManager` | Admin panel | Student list with clearance level assignment (individual + bulk). |
| `ClearanceLevelConfig` | Admin panel | Manage clearance level labels (add/edit/delete levels). |
| `StudentSchedule` | Student dashboard | Read-only schedule grid with booking-on-click flow. |
| `BookingConfirmation` | Student dashboard | Modal/dialog for confirming a booking with qualification status. |

### 5.2 Modified Components

| Component | Change |
|-----------|--------|
| `StudentServices` (lab booking form) | Add qualification badge per lab. Show appropriate message based on clearance. |
| `RequestHistory` | Add cancel button for approved future bookings. |
| `AdminDashboard` | Add schedule grid tab, lab management tab, clearance management tab. |
| `AssistantPanel` | Update guidance messages to reflect clearance-based flow. |

### 5.3 Styling

- Follow existing design system (`.card`, `.status`, `.panel`, color palette from `styles.css`).
- Grid cell colors: green (`#dcf5e6`), blue (`#eaf0ff`), red (`#ffe6e5`), gray (`#f0f0f0`).
- Qualification badges: green check for "You qualify", orange lock for "Requires approval".

---

## 6. Backend Model Changes (Migration)

### 6.1 New Migration

```python
# New model
class ClearanceLevel(models.Model):
    level = models.PositiveIntegerField(primary_key=True)  # 0, 1, 2...
    label = models.CharField(max_length=64)

# User model addition
class User(AbstractUser):
    clearance_level = models.PositiveIntegerField(default=0)

# Laboratory model addition
class Laboratory(TimeStampedModel):
    required_clearance = models.PositiveIntegerField(default=0)
```

### 6.2 Data Migration

- Create default `ClearanceLevel(level=0, label="Basic")`.
- Ensure all existing users have `clearance_level=0`.
- Ensure all existing labs have `required_clearance=0`.
- Existing pending bookings remain unchanged (they were created under the old rules).

---

## 7. Audit Events

New audit event actions for this upgrade:

| Action | Trigger |
|--------|---------|
| `clearance_level.assigned` | Admin assigns clearance to a student |
| `clearance_level.bulk_assigned` | Admin bulk-assigns clearance |
| `clearance_level.created` | Admin creates a new clearance level definition |
| `clearance_level.deleted` | Admin deletes a clearance level definition |
| `lab_booking.auto_approved` | Booking auto-approved due to clearance match |
| `laboratory.hard_deleted` | Admin permanently deletes a lab |
| `laboratory.deactivated` | Admin deactivates a lab |
| `laboratory.reactivated` | Admin reactivates a lab |

---

## 8. Testing Plan

### 8.1 Backend Tests

- **Clearance auto-approve**: Student with sufficient clearance → booking created as APPROVED, no ApprovalRequest created.
- **Clearance fallback**: Student without sufficient clearance → booking created as PENDING, ApprovalRequest created.
- **Conflict check on auto-approve**: Auto-approved booking still checks for overlapping approved bookings.
- **Hard delete lab**: Pending bookings → rejected; approved future bookings → cancelled; past bookings preserved.
- **Soft deactivate lab**: Lab hidden from students; existing bookings unaffected.
- **Bulk clearance assignment**: Multiple students updated in one call.
- **Clearance level management**: Create, edit, delete levels; level 0 cannot be deleted.
- **Student can't see other students' clearance**: API returns 403 or omits data.
- **Schedule endpoint**: Returns correct bookings for a date range across all labs.

### 8.2 Frontend Tests

- Schedule grid renders correctly with mock data.
- Booking confirmation dialog shows correct qualification status.
- Admin can click a slot and perform actions.
- Student can click an available slot and complete booking flow.
- Lab management CRUD works end-to-end.
- Clearance assignment UI works for individual and bulk.

---

## 9. Implementation Order

1. **Backend models + migration** — ClearanceLevel model, User.clearance_level, Laboratory.required_clearance, data migration.
2. **Backend API** — Clearance level CRUD, bulk assignment, schedule endpoint, modified booking flow, lab hard delete.
3. **Frontend admin dashboard** — Schedule grid, lab management, clearance management.
4. **Frontend student view** — Schedule grid, booking confirmation with qualification badges.
5. **Audit events** — Add new audit actions for all clearance and lab management operations.
6. **Tests** — Backend pytest tests for all new logic, frontend build verification.

---

## 10. Open Questions / Assumptions

- **Time slot granularity**: Assumed 1-hour blocks for the grid. If different (30 min, 2 hours), the grid component and conflict check need adjustment.
- **Max bookings per student**: The user selected "Max active bookings per student" earlier but the clearance system may subsume this. If still needed, add a global setting (e.g. `MAX_ACTIVE_BOOKINGS_PER_STUDENT = 3`) enforced in the booking creation logic.
- **Clearance level 0 deletion**: Level 0 is the default and cannot be deleted. Levels 1+ can be deleted, but only if no students or labs reference them.
- **Existing approval flow**: Unchanged for non-lab services (certificates, maintenance, grievances). Only the lab booking path is modified.
- **AI assistant**: The assistant's guidance messages should be updated to reflect the new clearance-based flow (e.g. "If you have the required clearance, your booking will be auto-approved.").
