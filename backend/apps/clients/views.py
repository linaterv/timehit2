from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from .models import Client, ClientContact, BrokerClientAssignment
from .serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientCreateSerializer,
    ClientUpdateSerializer, ClientContactSerializer, ClientContactCreateSerializer,
    ClientContactUpdateSerializer, BrokerAssignSerializer, BrokerAssignmentSerializer,
)
from apps.users.models import User
from apps.users.permissions import IsAdminOrBroker, has_broker_access_to_client
from apps.users.exceptions import ConflictError


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.prefetch_related("broker_assignments__broker").all().order_by("-created_at")
    http_method_names = ["get", "post", "patch", "delete"]

    def get_permissions(self):
        if self.action in ("create", "partial_update"):
            return [IsAdminOrBroker()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return ClientCreateSerializer
        if self.action == "partial_update":
            return ClientUpdateSerializer
        if self.action == "retrieve":
            return ClientDetailSerializer
        return ClientListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_broker:
            qs = qs.filter(broker_assignments__broker=user)
        elif user.is_client_contact:
            try:
                qs = qs.filter(id=user.client_contact.client_id)
            except ClientContact.DoesNotExist:
                qs = qs.none()
        elif user.is_contractor:
            qs = qs.none()
        p = self.request.query_params
        if p.get("is_active") is not None:
            qs = qs.filter(is_active=p["is_active"].lower() == "true")
        if p.get("search"):
            qs = qs.filter(company_name__icontains=p["search"])
        if p.get("broker_id") and user.is_admin:
            qs = qs.filter(broker_assignments__broker_id=p["broker_id"])
        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.is_broker and not has_broker_access_to_client(user, obj.id):
            raise PermissionDenied()
        if user.is_client_contact:
            if not hasattr(user, "client_contact") or user.client_contact.client_id != obj.id:
                raise PermissionDenied()
        return obj

    @extend_schema(tags=["Clients"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def partial_update(self, request, *args, **kwargs):
        if "is_active" in request.data and not request.user.is_admin:
            raise PermissionDenied("Only admin can change is_active")
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(request=BrokerAssignSerializer, tags=["Clients"])
    @action(detail=True, methods=["post"], url_path="brokers")
    def assign_brokers(self, request, pk=None):
        client = self.get_object()
        ser = BrokerAssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        for bid in ser.validated_data["broker_ids"]:
            BrokerClientAssignment.objects.get_or_create(broker_id=bid, client=client)
        return Response(BrokerAssignmentSerializer(client.broker_assignments.select_related("broker").all(), many=True).data)

    @extend_schema(tags=["Clients"])
    @action(detail=True, methods=["delete"], url_path="brokers/(?P<broker_user_id>[^/.]+)")
    def remove_broker(self, request, pk=None, broker_user_id=None):
        client = self.get_object()
        assignment = client.broker_assignments.filter(broker_id=broker_user_id).first()
        if not assignment:
            from rest_framework.exceptions import NotFound
            raise NotFound()
        if client.broker_assignments.count() <= 1 and client.placements.filter(status="ACTIVE").exists():
            raise ConflictError("Cannot remove last broker from client with active placements")
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientContactViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch"]
    serializer_class = ClientContactSerializer

    def get_queryset(self):
        return ClientContact.objects.filter(client_id=self.kwargs["client_pk"]).select_related("user")

    def _check_access(self):
        client_id = self.kwargs["client_pk"]
        user = self.request.user
        if user.is_admin:
            return
        if user.is_broker:
            if not has_broker_access_to_client(user, client_id):
                raise PermissionDenied()
            return
        if user.is_client_contact:
            if hasattr(user, "client_contact") and str(user.client_contact.client_id) == str(client_id):
                return
        raise PermissionDenied()

    @extend_schema(tags=["Client Contacts"])
    def list(self, request, client_pk=None):
        self._check_access()
        qs = self.get_queryset()
        return Response({"data": ClientContactSerializer(qs, many=True).data})

    @extend_schema(request=ClientContactCreateSerializer, tags=["Client Contacts"])
    def create(self, request, client_pk=None):
        self._check_access()
        ser = ClientContactCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user = User.objects.create_user(
            email=d["email"], password=d["password"],
            full_name=d["full_name"], role=User.Role.CLIENT_CONTACT,
        )
        contact = ClientContact.objects.create(
            user=user, client_id=client_pk,
            job_title=d.get("job_title", ""), phone=d.get("phone", ""),
            is_primary=d.get("is_primary", False),
        )
        return Response(ClientContactSerializer(contact).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=ClientContactUpdateSerializer, tags=["Client Contacts"])
    def partial_update(self, request, client_pk=None, pk=None):
        self._check_access()
        contact = self.get_object()
        ser = ClientContactUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(contact, k, v)
        contact.save()
        return Response(ClientContactSerializer(contact).data)
