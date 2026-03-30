from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("clients", views.ClientViewSet)

contact_router = DefaultRouter(trailing_slash=False)
contact_router.register("contacts", views.ClientContactViewSet, basename="client-contacts")

urlpatterns = [
    path("", include(router.urls)),
    path("clients/<uuid:client_pk>/", include(contact_router.urls)),
]
