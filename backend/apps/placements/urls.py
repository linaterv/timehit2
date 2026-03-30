from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("placements", views.PlacementViewSet)

doc_router = DefaultRouter(trailing_slash=False)
doc_router.register("documents", views.PlacementDocumentViewSet, basename="placement-documents")

flat_doc_router = DefaultRouter(trailing_slash=False)
flat_doc_router.register("documents", views.DocumentListView, basename="documents")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(flat_doc_router.urls)),
    path("placements/<uuid:placement_pk>/", include(doc_router.urls)),
]
