from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("users", views.UserViewSet)

urlpatterns = [
    path("test-users", views.TestUsersView.as_view(), name="test-users"),
    path("", include(router.urls)),
]
