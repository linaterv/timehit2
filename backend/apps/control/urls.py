from django.urls import path
from . import views

urlpatterns = [
    path("control/overview", views.ControlOverviewView.as_view(), name="control-overview"),
    path("control/summary", views.ControlSummaryView.as_view(), name="control-summary"),
    path("control/export", views.ControlExportView.as_view(), name="control-export"),
]
