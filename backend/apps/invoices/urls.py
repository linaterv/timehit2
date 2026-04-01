from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("invoices", views.InvoiceViewSet)
router.register("invoice-templates", views.InvoiceTemplateViewSet)

urlpatterns = [
    path("invoices/generate", views.GenerateInvoicesView.as_view(), name="invoice-generate"),
    path("invoices/preview-series", views.PreviewSeriesView.as_view(), name="invoice-preview-series"),
    path("", include(router.urls)),
]
