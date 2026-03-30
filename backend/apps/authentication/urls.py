from django.urls import path
from . import views

urlpatterns = [
    path("login", views.LoginView.as_view(), name="auth-login"),
    path("refresh", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout", views.LogoutView.as_view(), name="auth-logout"),
    path("change-password", views.ChangePasswordView.as_view(), name="auth-change-password"),
]
