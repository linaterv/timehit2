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
from apps.users.permissions import has_broker_access_to_client


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
