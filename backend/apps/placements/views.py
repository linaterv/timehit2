from datetime import date, timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, JSONParser
from django.http import FileResponse
from drf_spectacular.utils import extend_schema, OpenApiParameter
from .models import Placement, PlacementDocument
from .serializers import (
    PlacementListSerializer, PlacementCreateSerializer, PlacementUpdateSerializer,
    PlacementCopySerializer, PlacementDocumentSerializer, PlacementDocumentFlatSerializer,
    PlacementDocumentUploadSerializer,
)
from apps.users.permissions import IsAdminOrBroker, has_broker_access_to_client
from apps.users.exceptions import ConflictError


class PlacementViewSet(viewsets.ModelViewSet):
    queryset = Placement.objects.select_related("client", "contractor").order_by("-created_at")
    http_method_names = ["get", "post", "patch", "delete"]
    parser_classes = [JSONParser]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "destroy", "activate", "complete", "cancel", "copy"):
            return [IsAdminOrBroker()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return PlacementCreateSerializer
        if self.action == "partial_update":
            return PlacementUpdateSerializer
        if self.action == "copy":
            return PlacementCopySerializer
        return PlacementListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_broker:
            qs = qs.filter(client__broker_assignments__broker=user)
        elif user.is_contractor:
            qs = qs.filter(contractor=user)
        elif user.is_client_contact:
            try:
                qs = qs.filter(client_id=user.client_contact.client_id)
            except Exception:
                qs = qs.none()
        p = self.request.query_params
        if p.get("client_id"):
            qs = qs.filter(client_id=p["client_id"])
        if p.get("contractor_id"):
            qs = qs.filter(contractor_id=p["contractor_id"])
        if p.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in p["status"].split(",")])
        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.is_broker and not has_broker_access_to_client(user, obj.client_id):
            raise PermissionDenied()
        return obj

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_broker and not has_broker_access_to_client(user, serializer.validated_data["client_id"]):
            raise PermissionDenied("Not assigned to this client")
        serializer.save()

    @extend_schema(tags=["Placements"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Placements"])
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(tags=["Placements"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Placements"])
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(tags=["Placements"])
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status != Placement.Status.DRAFT:
            raise ConflictError("Can only delete DRAFT placements")
        if obj.timesheets.exists():
            raise ConflictError("Cannot delete placement with timesheets")
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Placements"], request=None)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        p = self.get_object()
        p.activate()
        return Response(PlacementListSerializer(p, context={"request": request}).data)

    @extend_schema(tags=["Placements"], request=None)
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        p = self.get_object()
        warnings = p.complete()
        data = PlacementListSerializer(p, context={"request": request}).data
        data["warnings"] = warnings
        return Response(data)

    @extend_schema(tags=["Placements"], request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        p = self.get_object()
        warnings = p.cancel()
        data = PlacementListSerializer(p, context={"request": request}).data
        data["warnings"] = warnings
        return Response(data)

    @extend_schema(tags=["Placements"])
    @action(detail=True, methods=["post"])
    def copy(self, request, pk=None):
        src = self.get_object()
        ser = PlacementCopySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        default_start = (src.end_date + timedelta(days=1)) if src.end_date else (date.today() + timedelta(days=1))
        new = Placement.objects.create(
            client=src.client, contractor=src.contractor,
            client_rate=d.get("client_rate", src.client_rate),
            contractor_rate=d.get("contractor_rate", src.contractor_rate),
            currency=src.currency, start_date=d.get("start_date", default_start),
            status=Placement.Status.DRAFT, approval_flow=src.approval_flow,
            require_timesheet_attachment=src.require_timesheet_attachment,
            client_can_view_invoices=src.client_can_view_invoices,
            client_can_view_documents=src.client_can_view_documents, notes=src.notes,
        )
        return Response(PlacementListSerializer(new, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PlacementDocumentViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]
    parser_classes = [MultiPartParser]
    serializer_class = PlacementDocumentSerializer

    def get_queryset(self):
        return PlacementDocument.objects.filter(placement_id=self.kwargs["placement_pk"]).select_related("uploaded_by")

    def _get_placement(self):
        return Placement.objects.get(pk=self.kwargs["placement_pk"])

    @extend_schema(tags=["Placement Documents"])
    def list(self, request, placement_pk=None):
        p = self._get_placement()
        qs = self.get_queryset()
        if request.user.is_client_contact:
            if not p.client_can_view_documents:
                raise PermissionDenied()
            qs = qs.filter(visible_to_client=True)
        elif request.user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        return Response({"data": PlacementDocumentSerializer(qs, many=True).data})

    @extend_schema(tags=["Placement Documents"], request=PlacementDocumentUploadSerializer)
    def create(self, request, placement_pk=None):
        p = self._get_placement()
        user = request.user
        if user.is_client_contact or user.is_contractor:
            raise PermissionDenied()
        if user.is_broker and not has_broker_access_to_client(user, p.client_id):
            raise PermissionDenied()
        f = request.FILES.get("file")
        if not f:
            raise ValidationError({"file": "File is required"})
        doc = PlacementDocument.objects.create(
            placement=p, file=f, file_name=f.name, file_size_bytes=f.size,
            mime_type=f.content_type or "application/octet-stream",
            label=request.data.get("label", ""), uploaded_by=user,
            visible_to_client=request.data.get("visible_to_client", "false").lower() in ("true", "1"),
            visible_to_contractor=request.data.get("visible_to_contractor", "false").lower() in ("true", "1"),
        )
        return Response(PlacementDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Placement Documents"])
    def partial_update(self, request, placement_pk=None, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        doc = self.get_object()
        if "label" in request.data:
            doc.label = request.data["label"]
        if "visible_to_client" in request.data:
            doc.visible_to_client = request.data["visible_to_client"]
        if "visible_to_contractor" in request.data:
            doc.visible_to_contractor = request.data["visible_to_contractor"]
        doc.save()
        return Response(PlacementDocumentSerializer(doc).data)

    @extend_schema(tags=["Placement Documents"])
    @action(detail=True, methods=["get"])
    def download(self, request, placement_pk=None, pk=None):
        doc = self.get_object()
        return FileResponse(doc.file.open(), content_type=doc.mime_type, as_attachment=True, filename=doc.file_name)

    @extend_schema(tags=["Placement Documents"])
    def destroy(self, request, placement_pk=None, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        doc = self.get_object()
        doc.file.delete()
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentListView(viewsets.ReadOnlyModelViewSet):
    """Flat listing of all documents the user has access to. GET /documents"""
    serializer_class = PlacementDocumentFlatSerializer

    def get_queryset(self):
        qs = PlacementDocument.objects.select_related(
            "placement__client", "placement__contractor", "uploaded_by"
        ).order_by("-uploaded_at")
        user = self.request.user
        if user.is_broker:
            qs = qs.filter(placement__client__broker_assignments__broker=user)
        elif user.is_contractor:
            qs = qs.filter(placement__contractor=user, visible_to_contractor=True)
        elif user.is_client_contact:
            try:
                qs = qs.filter(
                    placement__client_id=user.client_contact.client_id,
                    placement__client_can_view_documents=True,
                    visible_to_client=True,
                )
            except Exception:
                qs = qs.none()
        p = self.request.query_params
        if p.get("client_id"):
            qs = qs.filter(placement__client_id=p["client_id"])
        if p.get("contractor_id"):
            qs = qs.filter(placement__contractor_id=p["contractor_id"])
        if p.get("placement_id"):
            qs = qs.filter(placement_id=p["placement_id"])
        if p.get("label"):
            qs = qs.filter(label__icontains=p["label"])
        if p.get("search"):
            qs = qs.filter(file_name__icontains=p["search"])
        if p.get("mime_type"):
            qs = qs.filter(mime_type__icontains=p["mime_type"])
        if p.get("uploaded_from"):
            qs = qs.filter(uploaded_at__date__gte=p["uploaded_from"])
        if p.get("uploaded_to"):
            qs = qs.filter(uploaded_at__date__lte=p["uploaded_to"])
        if p.get("uploaded_by"):
            qs = qs.filter(uploaded_by_id=p["uploaded_by"])
        return qs

    @extend_schema(
        tags=["Documents"],
        parameters=[
            OpenApiParameter("client_id", str, description="Filter by client UUID"),
            OpenApiParameter("contractor_id", str, description="Filter by contractor UUID"),
            OpenApiParameter("placement_id", str, description="Filter by placement UUID"),
            OpenApiParameter("label", str, description="Filter by label (partial match)"),
            OpenApiParameter("search", str, description="Search by file name (partial match)"),
            OpenApiParameter("mime_type", str, description="Filter by MIME type (partial match, e.g. 'pdf', 'image')"),
            OpenApiParameter("uploaded_from", str, description="Documents uploaded on or after this date (YYYY-MM-DD)"),
            OpenApiParameter("uploaded_to", str, description="Documents uploaded on or before this date (YYYY-MM-DD)"),
            OpenApiParameter("uploaded_by", str, description="Filter by uploader user UUID"),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Documents"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)
