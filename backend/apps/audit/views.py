from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework import status
from drf_spectacular.utils import extend_schema
from .models import AuditLog
from .serializers import AuditLogSerializer
from .service import log_audit
from apps.timesheets.models import Timesheet
from apps.timesheets.views import _check_ts_read
from apps.placements.models import Placement
from apps.invoices.models import Invoice, InvoiceTemplate
from apps.clients.models import Client
from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminOrBroker, has_broker_access_to_client
from apps.contractors.models import ContractorProfile

LOCKABLE_MODELS = {
    "placement": Placement,
    "client": Client,
    "contractor": ContractorProfile,
    "invoice": Invoice,
    "user": User,
    "invoice_template": InvoiceTemplate,
}


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


class LockUnlockView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Audit"])
    def post(self, request):
        entity_type = request.data.get("entity_type", "")
        entity_id = request.data.get("entity_id", "")
        action = request.data.get("action", "")  # "lock" or "unlock"
        reason = request.data.get("reason", "").strip()

        if action not in ("lock", "unlock"):
            return Response({"error": "action must be 'lock' or 'unlock'"}, status=400)
        if entity_type not in LOCKABLE_MODELS:
            return Response({"error": f"Unknown entity_type: {entity_type}"}, status=400)
        if action == "unlock" and not reason:
            return Response({"error": "Reason is required when unlocking"}, status=400)

        Model = LOCKABLE_MODELS[entity_type]
        # For contractor, entity_id is user_id — look up by user_id
        if entity_type == "contractor":
            obj = Model.objects.filter(user_id=entity_id).first()
        else:
            obj = Model.objects.filter(pk=entity_id).first()
        if not obj:
            raise NotFound(f"{entity_type} not found")

        new_state = action == "lock"
        if obj.is_locked == new_state:
            return Response({"is_locked": obj.is_locked, "message": f"Already {'locked' if new_state else 'unlocked'}"})

        obj.is_locked = new_state
        obj.save(update_fields=["is_locked"])

        audit_entity_id = entity_id
        if entity_type == "contractor":
            audit_entity_id = str(obj.user_id)

        label = ""
        if hasattr(obj, "company_name"):
            label = obj.company_name
        elif hasattr(obj, "full_name"):
            label = obj.full_name
        elif hasattr(obj, "invoice_number"):
            label = obj.invoice_number
        elif hasattr(obj, "title"):
            label = obj.title

        log_audit(
            entity_type=entity_type,
            entity_id=audit_entity_id,
            action="LOCKED" if new_state else "UNLOCKED",
            title=f"{entity_type.replace('_', ' ').title()} {label} {'locked' if new_state else 'unlocked'}",
            text=reason,
            user=request.user,
            data_before={"is_locked": not new_state},
            data_after={"is_locked": new_state},
        )

        return Response({"is_locked": new_state, "entity_type": entity_type, "entity_id": str(entity_id)})
