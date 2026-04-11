from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("candidates", views.CandidateViewSet)

file_router = DefaultRouter(trailing_slash=False)
file_router.register("files", views.CandidateFileViewSet, basename="candidate-files")

activity_router = DefaultRouter(trailing_slash=False)
activity_router.register("activities", views.CandidateActivityViewSet, basename="candidate-activities")

urlpatterns = [
    path("candidates/parse-cv", views.ParseCvView.as_view(), name="candidate-parse-cv"),
    path("", include(router.urls)),
    path("candidates/<uuid:candidate_pk>/", include(file_router.urls)),
    path("candidates/<uuid:candidate_pk>/", include(activity_router.urls)),
    path("candidates/<uuid:candidate_pk>/link-contractor", views.ContractorLinkView.as_view(), name="candidate-link-contractor"),
]
