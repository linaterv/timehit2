from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from .models import ContractorProfile
from .serializers import (
    ContractorProfileListSerializer, ContractorProfileDetailSerializer,
    ContractorProfileUpdateSerializer,
)


class ContractorViewSet(viewsets.ModelViewSet):
    queryset = ContractorProfile.objects.select_related("user").all()
    http_method_names = ["get", "patch"]

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
    def partial_update(self, request, *args, **kwargs):
        user = request.user
        if user.is_broker:
            raise PermissionDenied("Brokers cannot edit contractor profiles")
        if user.is_contractor:
            obj = self.get_object()
            if obj.user_id != user.id:
                raise PermissionDenied()
        return super().partial_update(request, *args, **kwargs)
