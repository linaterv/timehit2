from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.timesheets.models import Timesheet
from apps.timesheets.views import _check_ts_read
from apps.placements.models import Placement
from apps.invoices.models import Invoice
from apps.users.permissions import IsAdmin, has_broker_access_to_client
from apps.contractors.models import ContractorProfile


class TimesheetAuditLogView(APIView):
    @extend_schema(tags=["Timesheets"])
    def get(self, request, pk=None):
        ts = Timesheet.objects.select_related("placement__client", "placement__contractor").get(pk=pk)
        _check_ts_read(request.user, ts)
        qs = AuditLog.objects.filter(
            entity_type="timesheet", entity_id=pk
        ).select_related("created_by")
        user = request.user
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        elif user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})


class PlacementAuditLogView(APIView):
    @extend_schema(tags=["Placements"])
    def get(self, request, pk=None):
        p = Placement.objects.select_related("client", "contractor").get(pk=pk)
        user = request.user
        if user.is_broker and not has_broker_access_to_client(user, p.client_id):
            raise PermissionDenied()
        if user.is_contractor and p.contractor_id != user.id:
            raise PermissionDenied()
        qs = AuditLog.objects.filter(
            entity_type="placement", entity_id=pk
        ).select_related("created_by")
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        elif user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})


class InvoiceAuditLogView(APIView):
    @extend_schema(tags=["Invoices"])
    def get(self, request, pk=None):
        inv = Invoice.objects.select_related("placement__client", "contractor").get(pk=pk)
        user = request.user
        if user.is_contractor and inv.contractor_id != user.id:
            raise PermissionDenied()
        if user.is_broker and not has_broker_access_to_client(user, inv.client_id):
            raise PermissionDenied()
        qs = AuditLog.objects.filter(
            entity_type="invoice", entity_id=pk
        ).select_related("created_by")
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        elif user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})


class ClientAuditLogView(APIView):
    @extend_schema(tags=["Clients"])
    def get(self, request, pk=None):
        from apps.clients.models import Client
        Client.objects.get(pk=pk)  # 404 if not found
        user = request.user
        if user.is_broker and not has_broker_access_to_client(user, pk):
            raise PermissionDenied()
        if user.is_contractor:
            raise PermissionDenied()
        qs = AuditLog.objects.filter(entity_type="client", entity_id=pk).select_related("created_by")
        if user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})


class ContractorAuditLogView(APIView):
    @extend_schema(tags=["Contractors"])
    def get(self, request, pk=None):
        try:
            profile = ContractorProfile.objects.get(pk=pk)
        except ContractorProfile.DoesNotExist:
            raise PermissionDenied()
        user = request.user
        if user.is_contractor and profile.user_id != user.id:
            raise PermissionDenied()
        if user.is_client_contact:
            raise PermissionDenied()
        qs = AuditLog.objects.filter(entity_type="contractor", entity_id=profile.user_id).select_related("created_by")
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        return Response({"data": AuditLogSerializer(qs, many=True).data})


class AuditLogDetailView(APIView):
    @extend_schema(tags=["Audit"])
    def get(self, request, pk=None):
        try:
            entry = AuditLog.objects.select_related("created_by").get(pk=pk)
        except AuditLog.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound()
        # Role-based visibility
        user = request.user
        if user.is_contractor and not entry.visible_to_contractor:
            raise PermissionDenied()
        if user.is_client_contact and not entry.visible_to_client:
            raise PermissionDenied()
        return Response(AuditLogSerializer(entry).data)


class GlobalAuditLogView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(tags=["Audit"])
    def get(self, request):
        qs = AuditLog.objects.select_related("created_by").all()
        p = request.query_params
        if p.get("entity_type"):
            qs = qs.filter(entity_type=p["entity_type"])
        if p.get("entity_id"):
            qs = qs.filter(entity_id=p["entity_id"])
        if p.get("action"):
            qs = qs.filter(action=p["action"])
        if p.get("created_by"):
            qs = qs.filter(created_by_id=p["created_by"])
        if p.get("search"):
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=p["search"]) | Q(text__icontains=p["search"]))
        if p.get("date_from"):
            qs = qs.filter(created_at__date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(created_at__date__lte=p["date_to"])
        page = int(p.get("page", 1))
        per_page = min(int(p.get("per_page", 50)), 200)
        total = qs.count()
        offset = (page - 1) * per_page
        data = AuditLogSerializer(qs[offset:offset + per_page], many=True).data
        return Response({
            "data": data,
            "meta": {"page": page, "per_page": per_page, "total": total, "total_pages": (total + per_page - 1) // per_page},
        })
