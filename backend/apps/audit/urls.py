from django.urls import path
from . import views

urlpatterns = [
    path("timesheets/<uuid:pk>/audit-log", views.TimesheetAuditLogView.as_view(), name="timesheet-audit-log"),
    path("placements/<uuid:pk>/audit-log", views.PlacementAuditLogView.as_view(), name="placement-audit-log"),
    path("invoices/<uuid:pk>/audit-log", views.InvoiceAuditLogView.as_view(), name="invoice-audit-log"),
    path("clients/<uuid:pk>/audit-log", views.ClientAuditLogView.as_view(), name="client-audit-log"),
    path("contractors/<uuid:pk>/audit-log", views.ContractorAuditLogView.as_view(), name="contractor-audit-log"),
    path("audit-logs", views.GlobalAuditLogView.as_view(), name="global-audit-log"),
    path("audit-logs/<uuid:pk>", views.AuditLogDetailView.as_view(), name="audit-log-detail"),
    path("lock", views.LockUnlockView.as_view(), name="lock-unlock"),
]
