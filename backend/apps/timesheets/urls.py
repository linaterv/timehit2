from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

ts_under_placement = DefaultRouter(trailing_slash=False)
ts_under_placement.register("timesheets", views.TimesheetViewSet, basename="placement-timesheets")

ts_root = DefaultRouter(trailing_slash=False)
ts_root.register("timesheets", views.TimesheetViewSet, basename="timesheets")

entry_router = DefaultRouter(trailing_slash=False)
entry_router.register("entries", views.TimesheetEntryViewSet, basename="timesheet-entries")

att_router = DefaultRouter(trailing_slash=False)
att_router.register("attachments", views.TimesheetAttachmentViewSet, basename="timesheet-attachments")

urlpatterns = [
    path("placements/<uuid:placement_pk>/", include(ts_under_placement.urls)),
    path("timesheets/pending", views.TimesheetPendingView.as_view(), name="timesheets-pending"),
    path("", include(ts_root.urls)),
    path("timesheets/<uuid:timesheet_pk>/", include(entry_router.urls)),
    path("timesheets/<uuid:timesheet_pk>/", include(att_router.urls)),
]
