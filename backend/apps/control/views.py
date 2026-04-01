import csv
from datetime import date, timedelta
from io import StringIO
from decimal import Decimal
from collections import defaultdict
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter
from apps.placements.models import Placement
from apps.timesheets.models import Timesheet
from apps.invoices.models import Invoice
from apps.users.permissions import IsAdminOrBroker


class ControlOverviewView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        year = int(request.query_params.get("year", 0))
        month = int(request.query_params.get("month", 0))
        if not year or not month:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "year and month required", "details": []}}, status=400)

        placements = Placement.objects.filter(status=Placement.Status.ACTIVE).select_related("client", "contractor")
        user = request.user
        if user.is_broker:
            placements = placements.filter(client__broker_assignments__broker=user)
        p = request.query_params
        if p.get("client_id"):
            placements = placements.filter(client_id=p["client_id"])
        if p.get("contractor_id"):
            placements = placements.filter(contractor_id=p["contractor_id"])

        data = []
        now = date.today()
        is_current_month = year == now.year and month == now.month
        import calendar as cal
        month_start = date(year, month, 1)
        month_end = date(year, month, cal.monthrange(year, month)[1])
        for pl in placements:
            # Skip if placement doesn't overlap with this month
            if pl.start_date > month_end:
                continue
            if pl.end_date and pl.end_date < month_start:
                continue
            ts = Timesheet.objects.filter(placement=pl, year=year, month=month).first()
            c_inv = Invoice.objects.filter(placement=pl, year=year, month=month, invoice_type=Invoice.Type.CLIENT_INVOICE).exclude(status=Invoice.Status.VOIDED).first()
            co_inv = Invoice.objects.filter(placement=pl, year=year, month=month, invoice_type=Invoice.Type.CONTRACTOR_INVOICE).exclude(status=Invoice.Status.VOIDED).first()
            hours = ts.total_hours if ts else Decimal("0")
            margin = hours * (pl.client_rate - pl.contractor_rate)

            flags = []
            if not is_current_month:
                if not ts:
                    flags.append("no_timesheet")
                elif ts.status == Timesheet.Status.DRAFT:
                    flags.append("timesheet_draft")
                elif ts.status in (Timesheet.Status.SUBMITTED, Timesheet.Status.CLIENT_APPROVED):
                    flags.append("pending_approval")
                if ts and ts.status == Timesheet.Status.APPROVED and not c_inv:
                    flags.append("approved_no_invoice")
                if pl.require_timesheet_attachment and ts and not ts.attachments.exists():
                    flags.append("missing_attachment")
                try:
                    prof = pl.contractor.contractor_profile
                    if not prof.bank_account_iban:
                        flags.append("missing_bank_details")
                except Exception:
                    flags.append("missing_bank_details")

                def _inv_flags(inv, terms_days, label, _flags=flags):
                    if not inv:
                        return
                    if inv.status == Invoice.Status.DRAFT:
                        _flags.append(f"{label}_not_sent")
                    elif inv.status == Invoice.Status.ISSUED:
                        due = terms_days or 30
                        if inv.issued_at and inv.issued_at.date() + timedelta(days=due) < now:
                            overdue = (now - (inv.issued_at.date() + timedelta(days=due))).days
                            _flags.append(f"{label}_unpaid_{overdue}d")

                _inv_flags(c_inv, pl.payment_terms_client_days, "client_inv")
                _inv_flags(co_inv, pl.payment_terms_contractor_days, "contr_inv")
                if "client_inv_not_sent" in flags and "contr_inv_not_sent" in flags:
                    flags.remove("client_inv_not_sent")
                    flags.remove("contr_inv_not_sent")
                    flags.append("invoice_not_sent")
            else:
                if ts and ts.status == Timesheet.Status.APPROVED and not c_inv:
                    flags.append("approved_no_invoice")

            if p.get("needs_attention") == "true" and not flags:
                continue
            if p.get("timesheet_status") and (not ts or ts.status not in p["timesheet_status"].split(",")):
                continue
            if p.get("invoice_status"):
                inv_statuses = p["invoice_status"].split(",")
                if not c_inv and "NOT_GENERATED" not in inv_statuses:
                    continue
                if c_inv and c_inv.status not in inv_statuses:
                    continue

            data.append({
                "placement": {
                    "id": str(pl.id), "title": pl.title, "start_date": str(pl.start_date), "end_date": str(pl.end_date) if pl.end_date else None,
                    "client_rate": str(pl.client_rate), "contractor_rate": str(pl.contractor_rate),
                    "currency": pl.currency, "approval_flow": pl.approval_flow,
                    "require_timesheet_attachment": pl.require_timesheet_attachment,
                },
                "client": {"id": str(pl.client_id), "company_name": pl.client.company_name},
                "contractor": {"id": str(pl.contractor_id), "full_name": pl.contractor.full_name},
                "timesheet": {"id": str(ts.id), "status": ts.status, "total_hours": str(ts.total_hours), "submitted_at": ts.submitted_at, "approved_at": ts.approved_at} if ts else None,
                "client_invoice": {"id": str(c_inv.id), "invoice_number": c_inv.invoice_number, "status": c_inv.status, "total_amount": str(c_inv.total_amount)} if c_inv else None,
                "contractor_invoice": {"id": str(co_inv.id), "invoice_number": co_inv.invoice_number, "status": co_inv.status, "total_amount": str(co_inv.total_amount)} if co_inv else None,
                "margin": str(margin),
                "flags": flags,
            })
        return Response({"data": data, "meta": {"total": len(data)}})


class ControlSummaryView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        year = int(request.query_params.get("year", 0))
        month = int(request.query_params.get("month", 0))
        if not year or not month:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "year and month required", "details": []}}, status=400)

        placements = Placement.objects.filter(status=Placement.Status.ACTIVE).select_related("client")
        if request.user.is_broker:
            placements = placements.filter(client__broker_assignments__broker=request.user)

        awaiting, no_inv, unpaid, issues = 0, 0, 0, 0
        total_hours, currency_data = Decimal("0"), defaultdict(lambda: {"revenue": Decimal("0"), "cost": Decimal("0"), "margin": Decimal("0")})

        for pl in placements:
            ts = Timesheet.objects.filter(placement=pl, year=year, month=month).first()
            if ts:
                if ts.status in (Timesheet.Status.SUBMITTED, Timesheet.Status.CLIENT_APPROVED):
                    awaiting += 1
                if ts.status == Timesheet.Status.APPROVED:
                    if not ts.invoices.exclude(status=Invoice.Status.VOIDED).exists():
                        no_inv += 1
                    total_hours += ts.total_hours
                    rev = ts.total_hours * pl.client_rate
                    cost = ts.total_hours * pl.contractor_rate
                    currency_data[pl.currency]["revenue"] += rev
                    currency_data[pl.currency]["cost"] += cost
                    currency_data[pl.currency]["margin"] += rev - cost
            invs = Invoice.objects.filter(placement=pl, year=year, month=month, status=Invoice.Status.ISSUED)
            unpaid += invs.count()
            has_issue = (not ts) or (pl.require_timesheet_attachment and ts and not ts.attachments.exists())
            if has_issue:
                issues += 1

        total_rev = sum(d["revenue"] for d in currency_data.values())
        total_cost = sum(d["cost"] for d in currency_data.values())
        return Response({
            "timesheets_awaiting_approval": awaiting, "approved_without_invoices": no_inv,
            "invoices_awaiting_payment": unpaid, "placements_with_issues": issues,
            "total_active_placements": placements.count(), "total_hours": str(total_hours),
            "total_client_revenue": str(total_rev), "total_contractor_cost": str(total_cost),
            "total_margin": str(total_rev - total_cost),
            "currency_breakdown": [{"currency": c, "revenue": str(d["revenue"]), "cost": str(d["cost"]), "margin": str(d["margin"])} for c, d in currency_data.items()],
        })


class ControlExportView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        overview = ControlOverviewView()
        overview.request = request
        resp = overview.get(request)
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(["Client", "Contractor", "Client Rate", "Contractor Rate", "Currency", "Hours", "Timesheet Status", "Invoice Status", "Margin", "Flags"])
        for row in resp.data.get("data", []):
            writer.writerow([
                row["client"]["company_name"], row["contractor"]["full_name"],
                row["placement"]["client_rate"], row["placement"]["contractor_rate"],
                row["placement"]["currency"],
                row["timesheet"]["total_hours"] if row["timesheet"] else "0",
                row["timesheet"]["status"] if row["timesheet"] else "N/A",
                row["client_invoice"]["status"] if row["client_invoice"] else "N/A",
                row["margin"], ", ".join(row["flags"]),
            ])
        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="control-{request.query_params.get("year", "")}-{request.query_params.get("month", "")}.csv"'
        return response


class AgencySettingsView(APIView):
    """GET/PATCH agency-wide placement defaults. Admin only."""

    @extend_schema(tags=["Control"])
    def get(self, request):
        from .models import AgencySettings
        s = AgencySettings.load()
        return Response({
            "default_payment_terms_client_days": s.default_payment_terms_client_days,
            "default_payment_terms_contractor_days": s.default_payment_terms_contractor_days,
            "default_client_invoice_template_id": str(s.default_client_invoice_template_id) if s.default_client_invoice_template_id else None,
        })

    @extend_schema(tags=["Control"])
    def patch(self, request):
        if not request.user.is_admin:
            raise PermissionDenied("Admin only")
        from .models import AgencySettings
        s = AgencySettings.load()
        if "default_payment_terms_client_days" in request.data:
            s.default_payment_terms_client_days = request.data["default_payment_terms_client_days"]
        if "default_payment_terms_contractor_days" in request.data:
            s.default_payment_terms_contractor_days = request.data["default_payment_terms_contractor_days"]
        if "default_client_invoice_template_id" in request.data:
            val = request.data["default_client_invoice_template_id"]
            s.default_client_invoice_template_id = val if val else None
        s.save()
        return Response({
            "default_payment_terms_client_days": s.default_payment_terms_client_days,
            "default_payment_terms_contractor_days": s.default_payment_terms_contractor_days,
            "default_client_invoice_template_id": str(s.default_client_invoice_template_id) if s.default_client_invoice_template_id else None,
        })


class HolidaysView(APIView):
    """GET /holidays?country=LT&year=2026 — public holidays for timesheet pre-fill."""

    @extend_schema(
        tags=["Control"],
        parameters=[
            OpenApiParameter("country", str, description="Country code: LT, PL, LV, SE, FI, NL, GB, DE"),
            OpenApiParameter("year", str, description="Year: 2026 or 2027"),
        ],
    )
    def get(self, request):
        from .holidays import get_holidays, HOLIDAYS
        country = request.query_params.get("country", "").upper()
        year = request.query_params.get("year")
        if not country or not year:
            return Response({
                "countries": sorted(HOLIDAYS.keys()),
                "years": ["2026", "2027"],
            })
        return Response({
            "country": country,
            "year": int(year),
            "holidays": get_holidays(country, int(year)),
        })
