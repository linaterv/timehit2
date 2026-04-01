import calendar
from datetime import date
from decimal import Decimal
from collections import defaultdict
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, JSONParser
from django.http import FileResponse
from drf_spectacular.utils import extend_schema
from .models import Timesheet, TimesheetEntry, TimesheetAttachment
from .serializers import (
    TimesheetListSerializer, TimesheetDetailSerializer, TimesheetCreateSerializer,
    TimesheetEntrySerializer, TimesheetAttachmentSerializer,
    BulkEntrySerializer, SubmitSerializer, RejectSerializer,
)
from apps.placements.models import Placement
from apps.users.permissions import has_broker_access_to_client
from apps.users.exceptions import ConflictError, InvalidStateTransition
from apps.audit.service import log_audit


def _can_act_on_ts(user, ts):
    """Check if user can perform contractor-level actions on a timesheet."""
    if user.is_admin:
        return True
    if user.is_broker and has_broker_access_to_client(user, ts.placement.client_id):
        return True
    if user.is_contractor and ts.placement.contractor_id == user.id:
        return True
    return False


def _ts_snapshot(ts):
    entries = list(ts.entries.order_by("date", "task_name").values("date", "hours", "task_name"))
    return {
        "status": ts.status,
        "total_hours": str(ts.total_hours),
        "entry_count": len(entries),
        "submitted_at": ts.submitted_at.isoformat() if ts.submitted_at else None,
        "approved_at": ts.approved_at.isoformat() if ts.approved_at else None,
        "approved_by": ts.approved_by.full_name if ts.approved_by else None,
        "rejection_reason": ts.rejection_reason or None,
        "entries": [{"date": str(e["date"]), "hours": str(e["hours"]), "task": e["task_name"]} for e in entries],
    }


def _audit(ts, action, title, user, snap_before, snap_after=None, text=""):
    if snap_after is None:
        snap_after = _ts_snapshot(ts)
    log_audit(
        entity_type="timesheet", entity_id=ts.id,
        action=action, title=title, text=text, user=user,
        data_before=snap_before, data_after=snap_after,
    )


def _check_ts_read(user, ts):
    p = ts.placement
    if user.is_admin:
        return
    if user.is_broker and has_broker_access_to_client(user, p.client_id):
        return
    if user.is_contractor and p.contractor_id == user.id:
        return
    if user.is_client_contact:
        try:
            if user.client_contact.client_id == p.client_id:
                return
        except Exception:
            pass
    raise PermissionDenied()


class TimesheetViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete"]
    parser_classes = [JSONParser]

    def get_serializer_class(self):
        if self.action == "create":
            return TimesheetCreateSerializer
        if self.action == "retrieve":
            return TimesheetDetailSerializer
        return TimesheetListSerializer

    def get_queryset(self):
        qs = Timesheet.objects.select_related(
            "placement__client", "placement__contractor", "approved_by", "rejected_by"
        )
        if "placement_pk" in self.kwargs:
            qs = qs.filter(placement_id=self.kwargs["placement_pk"])
        user = self.request.user
        if user.is_broker:
            qs = qs.filter(placement__client__broker_assignments__broker=user)
        elif user.is_contractor:
            qs = qs.filter(placement__contractor=user)
        elif user.is_client_contact:
            try:
                qs = qs.filter(placement__client_id=user.client_contact.client_id)
            except Exception:
                qs = qs.none()
        p = self.request.query_params
        if p.get("year"):
            qs = qs.filter(year=p["year"])
        if p.get("month"):
            qs = qs.filter(month=p["month"])
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("client_id"):
            qs = qs.filter(placement__client_id=p["client_id"])
        if p.get("contractor_id"):
            qs = qs.filter(placement__contractor_id=p["contractor_id"])
        # Sorting
        sort_field = p.get("sort", "updated_at")
        allowed_sorts = {"created_at", "updated_at", "year", "month", "total_hours", "status"}
        if sort_field not in allowed_sorts:
            sort_field = "updated_at"
        if p.get("order") == "asc":
            qs = qs.order_by(sort_field)
        else:
            qs = qs.order_by(f"-{sort_field}")
        return qs

    @extend_schema(tags=["Timesheets"])
    def list(self, request, placement_pk=None, **kwargs):
        return super().list(request)

    @extend_schema(tags=["Timesheets"])
    def create(self, request, placement_pk=None, **kwargs):
        user = request.user
        placement = Placement.objects.get(pk=placement_pk)
        if user.is_contractor and placement.contractor_id != user.id:
            raise PermissionDenied()
        if user.is_client_contact:
            raise PermissionDenied()
        ser = TimesheetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        year, month = ser.validated_data["year"], ser.validated_data["month"]
        m_start = date(year, month, 1)
        m_end = date(year, month, calendar.monthrange(year, month)[1])
        if placement.end_date and m_start > placement.end_date:
            raise ValidationError({"month": "Month is after placement end date"})
        if m_end < placement.start_date:
            raise ValidationError({"month": "Month is before placement start date"})
        if Timesheet.objects.filter(placement=placement, year=year, month=month).exists():
            raise ConflictError("Timesheet already exists for this placement and month")
        ts = Timesheet.objects.create(placement=placement, year=year, month=month)
        _audit(ts, "CREATED", f"Timesheet created for {year}-{str(month).zfill(2)}", user, None)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Timesheets"])
    def retrieve(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related(
            "placement__client", "placement__contractor", "approved_by", "rejected_by"
        ).prefetch_related("entries", "attachments").get(pk=pk)
        _check_ts_read(request.user, ts)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)

    @extend_schema(tags=["Timesheets"])
    def destroy(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        if ts.status != Timesheet.Status.DRAFT:
            raise ConflictError("Can only delete DRAFT timesheets")
        if not _can_act_on_ts(request.user, ts):
            raise PermissionDenied()
        ts.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- State transitions ---

    @extend_schema(tags=["Timesheets"], request=SubmitSerializer)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        if not _can_act_on_ts(request.user, ts):
            raise PermissionDenied()
        ser = SubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        snap_before = _ts_snapshot(ts)
        ts.submit(confirm_zero=ser.validated_data.get("confirm_zero", False))
        _audit(ts, "SUBMITTED", "Timesheet submitted", request.user, snap_before)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)

    @extend_schema(tags=["Timesheets"], request=None)
    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        if not _can_act_on_ts(request.user, ts):
            raise PermissionDenied()
        snap_before = _ts_snapshot(ts)
        ts.withdraw()
        _audit(ts, "WITHDRAWN", "Timesheet withdrawn", request.user, snap_before)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)

    @extend_schema(tags=["Timesheets"], request=None)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        user = request.user
        if not (user.is_admin or user.is_broker):
            raise PermissionDenied()
        if user.is_broker and not has_broker_access_to_client(user, ts.placement.client_id):
            raise PermissionDenied()
        snap_before = _ts_snapshot(ts)
        ts.approve(user)
        _audit(ts, "APPROVED", f"Approved by {user.full_name}", user, snap_before)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)

    @extend_schema(tags=["Timesheets"], request=None)
    @action(detail=True, methods=["post"], url_path="client-approve")
    def client_approve(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        user = request.user
        if not user.is_client_contact:
            raise PermissionDenied()
        try:
            if user.client_contact.client_id != ts.placement.client_id:
                raise PermissionDenied()
        except Exception:
            raise PermissionDenied()
        snap_before = _ts_snapshot(ts)
        ts.client_approve(user)
        _audit(ts, "CLIENT_APPROVED", f"Client approved by {user.full_name}", user, snap_before)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)

    @extend_schema(tags=["Timesheets"], request=RejectSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None, **kwargs):
        ts = Timesheet.objects.select_related("placement").get(pk=pk)
        user = request.user
        ser = RejectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if user.is_admin or (user.is_broker and has_broker_access_to_client(user, ts.placement.client_id)):
            pass
        elif user.is_client_contact:
            if ts.placement.approval_flow != Placement.ApprovalFlow.CLIENT_THEN_BROKER:
                raise PermissionDenied()
            if ts.status != Timesheet.Status.SUBMITTED:
                raise InvalidStateTransition("Client can only reject from SUBMITTED")
        else:
            raise PermissionDenied()
        snap_before = _ts_snapshot(ts)
        reason = ser.validated_data["reason"]
        ts.reject(user, reason)
        _audit(ts, "REJECTED", f"Rejected by {user.full_name}", user, snap_before, text=reason)
        return Response(TimesheetDetailSerializer(ts, context={"request": request}).data)


class TimesheetPendingView(APIView):
    """GET /timesheets/pending — contractor's months needing attention (MISSING or DRAFT)."""

    @extend_schema(tags=["Timesheets"])
    def get(self, request):
        user = request.user
        if not user.is_contractor:
            raise PermissionDenied("Only contractors can access pending timesheets")

        placements = Placement.objects.filter(
            contractor=user, status=Placement.Status.ACTIVE
        ).select_related("client")

        now = date.today()
        results = []

        for pl in placements:
            # Compute month range: placement start to current month
            start_y, start_m = pl.start_date.year, pl.start_date.month
            end_y, end_m = now.year, now.month
            if pl.end_date and pl.end_date < now:
                end_y, end_m = pl.end_date.year, pl.end_date.month

            # Get existing timesheets for this placement
            existing = {
                (ts.year, ts.month): ts
                for ts in Timesheet.objects.filter(placement=pl)
            }

            # Walk each month
            y, m = start_y, start_m
            while (y, m) <= (end_y, end_m):
                ts = existing.get((y, m))
                if ts is None:
                    results.append({
                        "placement_id": str(pl.id),
                        "placement": {
                            "client": {"id": str(pl.client_id), "company_name": pl.client.company_name},
                            "contractor": {"id": str(pl.contractor_id), "full_name": pl.contractor.full_name},
                            "title": pl.title,
                        },
                        "year": y,
                        "month": m,
                        "status": "MISSING",
                        "timesheet_id": None,
                        "total_hours": None,
                    })
                elif ts.status == Timesheet.Status.DRAFT:
                    results.append({
                        "placement_id": str(pl.id),
                        "placement": {
                            "client": {"id": str(pl.client_id), "company_name": pl.client.company_name},
                            "contractor": {"id": str(pl.contractor_id), "full_name": pl.contractor.full_name},
                            "title": pl.title,
                        },
                        "year": y,
                        "month": m,
                        "status": "DRAFT",
                        "timesheet_id": str(ts.id),
                        "total_hours": str(ts.total_hours),
                    })
                # Next month
                if m == 12:
                    y, m = y + 1, 1
                else:
                    m += 1

        # Sort: most recent first
        results.sort(key=lambda r: (r["year"], r["month"]), reverse=True)
        return Response({"data": results})


class TimesheetEntryViewSet(viewsets.ViewSet):
    parser_classes = [JSONParser]

    @extend_schema(tags=["Timesheet Entries"])
    def list(self, request, timesheet_pk=None):
        ts = Timesheet.objects.select_related("placement__client", "placement__contractor").get(pk=timesheet_pk)
        _check_ts_read(request.user, ts)
        entries = ts.entries.order_by("date", "task_name")
        return Response({"data": TimesheetEntrySerializer(entries, many=True).data, "total_hours": str(ts.total_hours)})

    @extend_schema(tags=["Timesheet Entries"], request=BulkEntrySerializer)
    @action(detail=False, methods=["put"], url_path="")
    def bulk_upsert(self, request, timesheet_pk=None):
        ts = Timesheet.objects.select_related("placement").get(pk=timesheet_pk)
        user = request.user
        if user.is_admin or (user.is_broker and has_broker_access_to_client(user, ts.placement.client_id)):
            pass
        elif user.is_contractor and ts.placement.contractor_id == user.id:
            pass
        else:
            raise PermissionDenied()
        if ts.status != Timesheet.Status.DRAFT:
            raise ConflictError("Timesheet is not in DRAFT status")
        ser = BulkEntrySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        p = ts.placement
        m_start = date(ts.year, ts.month, 1)
        m_end = date(ts.year, ts.month, calendar.monthrange(ts.year, ts.month)[1])
        eff_start = max(m_start, p.start_date)
        eff_end = min(m_end, p.end_date) if p.end_date else m_end

        errors, hours_by_date = [], defaultdict(Decimal)
        for i, e in enumerate(ser.validated_data["entries"]):
            d = e["date"]
            if d < eff_start or d > eff_end:
                errors.append({"field": f"entries[{i}].date", "message": f"{d} outside valid range"})
            hours_by_date[d] += e["hours"]
        for d, total in hours_by_date.items():
            if total > 24:
                errors.append({"field": "hours", "message": f"{d}: total {total}h exceeds 24h"})
        if errors:
            raise ValidationError(errors)

        snap_before = _ts_snapshot(ts)
        ts.entries.all().delete()
        TimesheetEntry.objects.bulk_create([TimesheetEntry(timesheet=ts, **e) for e in ser.validated_data["entries"]])
        ts.recalculate_hours()
        _audit(ts, "ENTRIES_UPDATED", "Time entries updated", user, snap_before)
        warnings = [f"{d}: total {t}h exceeds 8h typical day" for d, t in hours_by_date.items() if t > 8]
        saved = ts.entries.order_by("date", "task_name")
        return Response({"entries": TimesheetEntrySerializer(saved, many=True).data, "total_hours": str(ts.total_hours), "warnings": warnings})


class TimesheetAttachmentViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete"]
    parser_classes = [MultiPartParser]
    serializer_class = TimesheetAttachmentSerializer

    def get_queryset(self):
        return TimesheetAttachment.objects.filter(timesheet_id=self.kwargs["timesheet_pk"])

    @extend_schema(tags=["Timesheet Attachments"])
    def create(self, request, timesheet_pk=None):
        ts = Timesheet.objects.select_related("placement").get(pk=timesheet_pk)
        if not _can_act_on_ts(request.user, ts):
            raise PermissionDenied()
        if ts.status != Timesheet.Status.DRAFT:
            raise ConflictError("Timesheet is not in DRAFT status")
        f = request.FILES.get("file")
        if not f:
            raise ValidationError({"file": "File is required"})
        att = TimesheetAttachment.objects.create(
            timesheet=ts, file=f, file_name=f.name, file_size_bytes=f.size,
            mime_type=f.content_type or "application/octet-stream", uploaded_by=request.user,
        )
        return Response(TimesheetAttachmentSerializer(att).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Timesheet Attachments"])
    @action(detail=True, methods=["get"])
    def download(self, request, timesheet_pk=None, pk=None):
        att = self.get_object()
        return FileResponse(att.file.open(), content_type=att.mime_type, as_attachment=True, filename=att.file_name)

    @extend_schema(tags=["Timesheet Attachments"])
    def destroy(self, request, timesheet_pk=None, pk=None):
        att = self.get_object()
        ts = Timesheet.objects.select_related("placement").get(pk=att.timesheet_id)
        if not _can_act_on_ts(request.user, ts):
            raise PermissionDenied()
        if ts.status != Timesheet.Status.DRAFT:
            raise ConflictError("Timesheet is not in DRAFT status")
        att.file.delete()
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
