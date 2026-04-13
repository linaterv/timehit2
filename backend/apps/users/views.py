import re
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from .models import User
from .serializers import (
    UserListSerializer, UserDetailSerializer, UserCreateSerializer,
    UserUpdateSerializer, UserMeSerializer,
)
from .permissions import IsAdmin
from .exceptions import check_locked
from apps.audit.service import log_audit


class TestUsersView(APIView):
    """Public endpoint listing all users for dev/test login dropdown. Remove in production."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(tags=["Auth"])
    def get(self, request):
        users = User.objects.filter(is_active=True).order_by("role", "email")
        return Response([
            {"email": u.email, "full_name": u.full_name, "role": u.role}
            for u in users
        ])


class BugReportView(APIView):
    """Public endpoint to save bug reports as markdown files."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(tags=["Bug Reports"])
    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

        url = request.data.get("url", "")
        user_email = request.data.get("user_email", "unknown")
        user_role = request.data.get("user_role", "unknown")
        user_agent = request.data.get("user_agent", "")
        timestamp = request.data.get("timestamp", datetime.utcnow().isoformat() + "Z")
        page_context = request.data.get("context", {})

        # Build filename: YYMMDD-HHMMSS-slug.md
        now = datetime.utcnow()
        slug = re.sub(r"[^a-z0-9]+", "-", message[:50].lower()).strip("-")
        filename = f"{now.strftime('%y%m%d-%H%M%S')}-{slug}.md"

        bug_dir = Path(settings.BASE_DIR).parent / "bug-reports"
        bug_dir.mkdir(exist_ok=True)

        content = (
            f"# Bug: {message}\n\n"
            f"- **Page:** {url}\n"
            f"- **User:** {user_email} ({user_role})\n"
            f"- **Browser:** {user_agent}\n"
            f"- **Time:** {timestamp}\n"
        )

        if page_context and isinstance(page_context, dict):
            content += "\n## Page Context\n"
            for key, value in page_context.items():
                label = key.replace("_", " ").replace("-", " ").title()
                content += f"- **{label}:** {value}\n"

        content += f"\n## Description\n{message}\n"

        filepath = bug_dir / filename
        filepath.write_text(content, encoding="utf-8")

        return Response({"status": "ok", "file": filename}, status=status.HTTP_201_CREATED)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("-created_at")
    http_method_names = ["get", "post", "patch", "delete"]

    def get_permissions(self):
        if self.action in ("list", "create"):
            return [IsAdmin()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("partial_update",):
            return UserUpdateSerializer
        if self.action == "me":
            return UserMeSerializer
        return UserDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("role"):
            qs = qs.filter(role=p["role"])
        if p.get("is_active") is not None:
            qs = qs.filter(is_active=p["is_active"].lower() == "true")
        if p.get("search"):
            qs = qs.filter(Q(email__icontains=p["search"]) | Q(full_name__icontains=p["search"]))
        return qs

    def get_object(self):
        obj = super().get_object()
        if not self.request.user.is_admin and obj.id != self.request.user.id:
            raise PermissionDenied()
        return obj

    @extend_schema(tags=["Users"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Users"])
    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        if resp.status_code == 201:
            email = request.data.get("email", "")
            role = request.data.get("role", "")
            # Find created user by email
            try:
                u = User.objects.get(email=email)
                log_audit(entity_type="user", entity_id=u.id, action="CREATED",
                          title=f"User {u.full_name} ({role}) created", user=request.user, data_after={"email": email, "role": role})
                if role == "CONTRACTOR":
                    log_audit(entity_type="contractor", entity_id=u.id, action="CREATED",
                              title=f"Contractor {u.full_name} created", user=request.user,
                              data_after={"email": email, "full_name": u.full_name, "country": request.data.get("country", "LT")})
            except User.DoesNotExist:
                pass
        return resp

    @extend_schema(tags=["Users"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Users"])
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_admin:
            raise PermissionDenied("Only admins can delete users")
        target = self.get_object()
        check_locked(target)
        if target.id == request.user.id:
            raise PermissionDenied("Cannot delete yourself")
        # Check active placements (contractor)
        if target.is_contractor and target.placements.filter(status="ACTIVE").exists():
            return Response(
                {"error": {"code": "CONFLICT", "message": "Cannot delete user with active placements. Complete or cancel them first."}},
                status=status.HTTP_409_CONFLICT,
            )
        # Check broker assignments to clients with active placements
        if target.is_broker:
            from apps.clients.models import BrokerClientAssignment
            active_clients = BrokerClientAssignment.objects.filter(
                broker=target, client__placements__status="ACTIVE"
            ).distinct().count()
            if active_clients:
                return Response(
                    {"error": {"code": "CONFLICT", "message": f"Cannot delete broker assigned to {active_clients} client(s) with active placements. Reassign them first."}},
                    status=status.HTTP_409_CONFLICT,
                )
        # Check for any relations
        has_relations = False
        if target.is_contractor:
            has_relations = target.placements.exists() or target.contractor_invoices.exists()
        elif target.is_broker:
            from apps.clients.models import BrokerClientAssignment
            has_relations = BrokerClientAssignment.objects.filter(broker=target).exists()
        elif target.is_client_contact:
            has_relations = hasattr(target, "client_contact")
        if has_relations:
            target.is_active = False
            target.save(update_fields=["is_active"])
            log_audit(entity_type="user", entity_id=target.id, action="DEACTIVATED",
                      title=f"User {target.full_name} deactivated", user=request.user,
                      data_before={"is_active": True}, data_after={"is_active": False})
            return Response({"deleted": "soft", "message": "User deactivated (has existing relations)"})
        log_audit(entity_type="user", entity_id=target.id, action="DELETED",
                  title=f"User {target.full_name} deleted", user=request.user,
                  data_before={"email": target.email, "role": target.role})
        target.delete()
        return Response({"deleted": "hard", "message": "User permanently deleted"})

    @extend_schema(tags=["Users"])
    def partial_update(self, request, *args, **kwargs):
        if not request.user.is_admin:
            extra = set(request.data.keys()) - {"full_name", "theme"}
            if extra:
                raise PermissionDenied(f"Cannot update fields: {extra}")
        obj = self.get_object()
        check_locked(obj)
        before = {"full_name": obj.full_name, "email": obj.email, "is_active": obj.is_active}
        resp = super().partial_update(request, *args, **kwargs)
        obj.refresh_from_db()
        after = {"full_name": obj.full_name, "email": obj.email, "is_active": obj.is_active}
        if before != after:
            log_audit(entity_type="user", entity_id=obj.id, action="UPDATED",
                      title=f"User {obj.full_name} updated", user=request.user,
                      data_before=before, data_after=after)
        return resp

    @extend_schema(tags=["Users"])
    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(UserMeSerializer(request.user).data)


class GeneratePasswordView(APIView):
    """Generate a memorable password from word dictionary."""

    @extend_schema(tags=["Users"])
    def post(self, request):
        from .wordlist import generate_password
        return Response({"password": generate_password()})
