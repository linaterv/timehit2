from django.urls import path
from . import views

urlpatterns = [
    path("timesheets/<uuid:pk>/audit-log", views.TimesheetAuditLogView.as_view(), name="timesheet-audit-log"),
    path("placements/<uuid:pk>/audit-log", views.PlacementAuditLogView.as_view(), name="placement-audit-log"),
    path("invoices/<uuid:pk>/audit-log", views.InvoiceAuditLogView.as_view(), name="invoice-audit-log"),
]
