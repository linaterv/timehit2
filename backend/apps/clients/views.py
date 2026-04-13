from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema
from .models import Client, ClientContact, BrokerClientAssignment, ClientActivity, ClientFile
from .serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientCreateSerializer,
    ClientUpdateSerializer, ClientContactSerializer, ClientContactCreateSerializer,
    ClientContactUpdateSerializer, BrokerAssignSerializer, BrokerAssignmentSerializer,
    ClientActivitySerializer, ClientFileSerializer,
)
from apps.users.models import User
from apps.users.permissions import IsAdminOrBroker, has_broker_access_to_client
from apps.users.exceptions import ConflictError, check_locked
from apps.audit.service import log_audit


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
        resp = super().create(request, *args, **kwargs)
        if resp.status_code == 201 and resp.data.get("id"):
            log_audit(entity_type="client", entity_id=resp.data["id"], action="CREATED",
                      title=f"Client {resp.data.get('company_name', '')} created", user=request.user,
                      data_after={"company_name": resp.data.get("company_name")})
        return resp

    @extend_schema(tags=["Clients"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def partial_update(self, request, *args, **kwargs):
        if "is_active" in request.data and not request.user.is_admin:
            raise PermissionDenied("Only admin can change is_active")
        obj = self.get_object()
        check_locked(obj)
        old_active = obj.is_active
        before = {"company_name": obj.company_name, "is_active": obj.is_active, "country": obj.country}
        resp = super().partial_update(request, *args, **kwargs)
        obj.refresh_from_db()
        after = {"company_name": obj.company_name, "is_active": obj.is_active, "country": obj.country}
        if old_active != obj.is_active:
            ClientActivity.objects.create(
                client=obj, type=ClientActivity.Type.STATUS_CHANGE,
                text=f"Status changed from {'Active' if old_active else 'Inactive'} to {'Active' if obj.is_active else 'Inactive'}",
                old_value="Active" if old_active else "Inactive",
                new_value="Active" if obj.is_active else "Inactive",
                created_by=request.user,
            )
        if before != after:
            log_audit(entity_type="client", entity_id=obj.id, action="UPDATED",
                      title=f"Client {obj.company_name} updated", user=request.user,
                      data_before=before, data_after=after)
        return resp

    @extend_schema(tags=["Clients"])
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_admin:
            raise PermissionDenied("Only admins can delete clients")
        client = self.get_object()
        check_locked(client)
        active_placements = client.placements.filter(status="ACTIVE").count()
        if active_placements:
            return Response(
                {"error": {"code": "CONFLICT", "message": f"Cannot delete client with {active_placements} active placement(s). Complete or cancel them first."}},
                status=status.HTTP_409_CONFLICT,
            )
        has_placements = client.placements.exists()
        has_invoices = client.invoices.exists()
        if has_placements or has_invoices:
            client.is_active = False
            client.save(update_fields=["is_active"])
            log_audit(entity_type="client", entity_id=client.id, action="DEACTIVATED",
                      title=f"Client {client.company_name} deactivated", user=request.user,
                      data_before={"is_active": True}, data_after={"is_active": False})
            return Response({"deleted": "soft", "message": "Client deactivated (has existing placements or invoices)"})
        log_audit(entity_type="client", entity_id=client.id, action="DELETED",
                  title=f"Client {client.company_name} deleted", user=request.user,
                  data_before={"company_name": client.company_name})
        client.delete()
        return Response({"deleted": "hard", "message": "Client permanently deleted"})

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


class ClientActivityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBroker]
    serializer_class = ClientActivitySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post"]

    def get_queryset(self):
        return ClientActivity.objects.filter(
            client_id=self.kwargs["client_pk"]
        ).select_related("created_by").prefetch_related("files")

    def _get_client(self):
        try:
            return Client.objects.get(pk=self.kwargs["client_pk"])
        except Client.DoesNotExist:
            raise NotFound("Client not found")

    @extend_schema(tags=["Clients"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def create(self, request, *args, **kwargs):
        client = self._get_client()
        if request.user.is_broker and not has_broker_access_to_client(request.user, client.id):
            raise PermissionDenied()

        activity = ClientActivity.objects.create(
            client=client,
            type=request.data.get("type", "NOTE"),
            text=request.data.get("text", ""),
            created_by=request.user,
        )

        uploaded_files = request.FILES.getlist("file") or request.FILES.getlist("files")
        for f in uploaded_files:
            ClientFile.objects.create(
                client=client, activity=activity,
                file=f, original_filename=f.name,
                file_type="OTHER", file_size=f.size,
                uploaded_by=request.user,
            )

        log_audit(entity_type="client", entity_id=client.id, action="ACTIVITY_ADDED",
                  title=f"Activity added for {client.company_name}", user=request.user,
                  data_after={"type": activity.type, "text": activity.text[:200]})
        activity.refresh_from_db()
        return Response(ClientActivitySerializer(activity).data, status=status.HTTP_201_CREATED)


class ClientFileViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrBroker]
    serializer_class = ClientFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = ClientFile.objects.filter(client_id=self.kwargs["client_pk"]).select_related("uploaded_by")
        ft = self.request.query_params.get("type")
        if ft:
            qs = qs.filter(file_type=ft)
        return qs

    def _get_client(self):
        try:
            return Client.objects.get(pk=self.kwargs["client_pk"])
        except Client.DoesNotExist:
            raise NotFound("Client not found")

    @extend_schema(tags=["Clients"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Clients"])
    def create(self, request, *args, **kwargs):
        client = self._get_client()
        if request.user.is_broker and not has_broker_access_to_client(request.user, client.id):
            raise PermissionDenied()
        file_type = request.data.get("file_type", "OTHER")
        uploaded_files = request.FILES.getlist("file") or request.FILES.getlist("files")
        if not uploaded_files:
            return Response({"error": "No files provided"}, status=400)

        created = []
        for f in uploaded_files:
            cf = ClientFile.objects.create(
                client=client, file=f, original_filename=f.name,
                file_type=file_type, file_size=f.size,
                uploaded_by=request.user,
            )
            created.append(cf)
            ClientActivity.objects.create(
                client=client, type=ClientActivity.Type.FILE_UPLOADED,
                text=f"Uploaded {f.name}",
                created_by=request.user,
            )

        fnames = [c.original_filename for c in created]
        log_audit(entity_type="client", entity_id=client.id, action="FILE_UPLOADED",
                  title=f"File uploaded for {client.company_name}", user=request.user,
                  data_after={"files": fnames, "file_type": file_type})
        return Response(ClientFileSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Clients"])
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        client = obj.client
        fname = obj.original_filename
        ftype = obj.file_type
        obj.file.delete(save=False)
        obj.delete()
        ClientActivity.objects.create(
            client=client, type=ClientActivity.Type.FILE_REMOVED,
            text=f"Removed {fname}",
            created_by=request.user,
        )
        log_audit(entity_type="client", entity_id=client.id, action="FILE_DELETED",
                  title=f"File removed from {client.company_name}", user=request.user,
                  data_before={"filename": fname, "file_type": ftype})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Clients"])
    @action(detail=True, methods=["get"])
    def download(self, request, client_pk=None, pk=None):
        obj = self.get_object()
        return FileResponse(obj.file.open("rb"), as_attachment=True, filename=obj.original_filename)
