from django.urls import path
from . import views

urlpatterns = [
    path("timesheets/<uuid:pk>/audit-log", views.TimesheetAuditLogView.as_view(), name="timesheet-audit-log"),
]
