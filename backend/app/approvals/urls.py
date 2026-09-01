from django.urls import path
from .views import (
    CreateServiceRequestView,
    MyRequestsView,
    AdminHistoryView,
    AdminDashboardView,
    ListPendingApprovalsView,
    ProcessApprovalView,
    RequestStatusView,
    StaffTicketListView,
    StaffTicketStatusView,
)

app_name = 'approvals'

urlpatterns = [
    path('request/', CreateServiceRequestView.as_view(), name='create-request'),
    path('mine/', MyRequestsView.as_view(), name='my-requests'),
    path('pending/', ListPendingApprovalsView.as_view(), name='list-pending'),
    path('history/', AdminHistoryView.as_view(), name='history'),
    path('dashboard/', AdminDashboardView.as_view(), name='dashboard'),
    path('staff/tickets/', StaffTicketListView.as_view(), name='staff-tickets'),
    path('request/<uuid:request_id>/', RequestStatusView.as_view(), name='request-status'),
    path('request/<uuid:request_id>/staff-status/', StaffTicketStatusView.as_view(), name='staff-ticket-status'),
    path('<int:approval_id>/process/', ProcessApprovalView.as_view(), name='process-approval'),
]
