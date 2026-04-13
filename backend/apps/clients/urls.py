from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("clients", views.ClientViewSet)

contact_router = DefaultRouter(trailing_slash=False)
contact_router.register("contacts", views.ClientContactViewSet, basename="client-contacts")

file_router = DefaultRouter(trailing_slash=False)
file_router.register("files", views.ClientFileViewSet, basename="client-files")

activity_router = DefaultRouter(trailing_slash=False)
activity_router.register("activities", views.ClientActivityViewSet, basename="client-activities")

urlpatterns = [
    path("", include(router.urls)),
    path("clients/<uuid:client_pk>/", include(contact_router.urls)),
    path("clients/<uuid:client_pk>/", include(file_router.urls)),
    path("clients/<uuid:client_pk>/", include(activity_router.urls)),
]
