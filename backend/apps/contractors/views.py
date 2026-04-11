from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import ContractorProfile
from .serializers import (
    ContractorProfileListSerializer, ContractorProfileDetailSerializer,
    ContractorProfileUpdateSerializer,
)
from apps.audit.service import log_audit


class ContractorViewSet(viewsets.ModelViewSet):
    queryset = ContractorProfile.objects.select_related("user").all()
    http_method_names = ["get", "patch", "delete"]

    def get_serializer_class(self):
        if self.action == "list":
            return ContractorProfileListSerializer
        if self.action == "partial_update":
            return ContractorProfileUpdateSerializer
        return ContractorProfileDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_contractor:
            qs = qs.filter(user=user)
        elif user.is_client_contact:
            qs = qs.none()
        p = self.request.query_params
        if p.get("search"):
            qs = qs.filter(Q(user__full_name__icontains=p["search"]) | Q(company_name__icontains=p["search"]))
        if p.get("is_active") is not None:
            qs = qs.filter(user__is_active=p["is_active"].lower() == "true")
        if p.get("client_id"):
            qs = qs.filter(user__placements__client_id=p["client_id"]).distinct()
        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.is_contractor and obj.user_id != user.id:
            raise PermissionDenied()
        return obj

    @extend_schema(tags=["Contractors"])
    def list(self, request, *args, **kwargs):
        if request.user.is_client_contact:
            raise PermissionDenied()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Contractors"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Contractors"])
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_admin:
            raise PermissionDenied("Only admins can delete contractors")
        obj = self.get_object()
        user = obj.user
        active_placements = user.placements.filter(status="ACTIVE").count()
        if active_placements:
            return Response(
                {"error": {"code": "CONFLICT", "message": f"Cannot delete contractor with {active_placements} active placement(s). Complete or cancel them first."}},
                status=409,
            )
        has_placements = user.placements.exists()
        has_invoices = user.contractor_invoices.exists()
        if has_placements or has_invoices:
            user.is_active = False
            user.save(update_fields=["is_active"])
            log_audit(entity_type="contractor", entity_id=user.id, action="DEACTIVATED",
                      title=f"Contractor {user.full_name} deactivated", user=request.user,
                      data_before={"is_active": True}, data_after={"is_active": False})
            return Response({"deleted": "soft", "message": "Contractor deactivated (has existing placements or invoices)"})
        log_audit(entity_type="contractor", entity_id=user.id, action="DELETED",
                  title=f"Contractor {user.full_name} deleted", user=request.user,
                  data_before={"full_name": user.full_name, "company": obj.company_name})
        user.delete()
        return Response({"deleted": "hard", "message": "Contractor permanently deleted"})

    @extend_schema(tags=["Contractors"])
    def partial_update(self, request, *args, **kwargs):
        user = request.user
        if user.is_broker:
            raise PermissionDenied("Brokers cannot edit contractor profiles")
        if user.is_contractor:
            obj = self.get_object()
            if obj.user_id != user.id:
                raise PermissionDenied()
        obj = self.get_object()
        before = {"company_name": obj.company_name, "country": obj.country}
        resp = super().partial_update(request, *args, **kwargs)
        obj.refresh_from_db()
        after = {"company_name": obj.company_name, "country": obj.country}
        if before != after:
            log_audit(entity_type="contractor", entity_id=obj.user_id, action="UPDATED",
                      title=f"Contractor {obj.user.full_name} profile updated", user=request.user,
                      data_before=before, data_after=after)
        return resp
