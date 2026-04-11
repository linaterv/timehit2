from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("api/v1/auth/", include("apps.authentication.urls")),
    path("api/v1/", include("apps.users.urls")),
    path("api/v1/", include("apps.clients.urls")),
    path("api/v1/", include("apps.contractors.urls")),
    path("api/v1/", include("apps.placements.urls")),
    path("api/v1/", include("apps.timesheets.urls")),
    path("api/v1/", include("apps.invoices.urls")),
    path("api/v1/", include("apps.control.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.candidates.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
