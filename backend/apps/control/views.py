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
from apps.clients.models import Client
from apps.contractors.models import ContractorProfile
from apps.users.permissions import IsAdminOrBroker


def _compute_overview_rows(user, params, year, month):
    """Build overview rows for (year, month). Shared by overview + summary views."""
    placements = Placement.objects.filter(status=Placement.Status.ACTIVE).select_related("client", "contractor").prefetch_related("client__broker_assignments__broker")
    if user.is_broker:
        placements = placements.filter(client__broker_assignments__broker=user)
    p = params
    if p.get("client_id"):
        placements = placements.filter(client_id=p["client_id"])
    if p.get("contractor_id"):
        placements = placements.filter(contractor_id=p["contractor_id"])
    if p.get("broker_id"):
        placements = placements.filter(client__broker_assignments__broker_id=p["broker_id"])

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
                    issued_date = inv.issued_at.date() if inv.issued_at else inv.created_at.date()
                    if issued_date + timedelta(days=due) < now:
                        overdue = (now - (issued_date + timedelta(days=due))).days
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

        # Suspicious time check — for SUBMITTED timesheets
        if ts and ts.status in (Timesheet.Status.SUBMITTED, Timesheet.Status.CLIENT_APPROVED):
            from .holidays import get_holiday_dates
            country = pl.client.country or "LT"
            holiday_dates = get_holiday_dates(country, year)
            # Calculate workdays in month (Mon-Fri, not holidays)
            workdays = 0
            eff_start = max(month_start, pl.start_date)
            eff_end = min(month_end, pl.end_date) if pl.end_date else month_end
            d = eff_start
            while d <= eff_end:
                if d.weekday() < 5 and str(d) not in holiday_dates:
                    workdays += 1
                d += timedelta(days=1)
            expected = Decimal(str(workdays * 8))
            reasons = []
            if expected > 0 and hours <= expected / 2:
                reasons.append(f"low_hours({hours}/{expected})")
            if hours > expected and expected > 0:
                reasons.append(f"over_hours({hours}/{expected})")
            # Check entries for weekends, holidays, >8h days
            if ts:
                entries = ts.entries.all()
                hours_by_date = {}
                for e in entries:
                    ed = str(e.date)
                    hours_by_date[ed] = hours_by_date.get(ed, Decimal("0")) + e.hours
                    if e.date.weekday() >= 5:
                        reasons.append(f"weekend({ed})")
                    if ed in holiday_dates:
                        reasons.append(f"holiday({ed})")
                for ed, dh in hours_by_date.items():
                    if dh > 8:
                        reasons.append(f"over8h({ed}:{dh}h)")
            if reasons:
                flags.append(f"suspicious:{','.join(set(reasons))}")

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

        # Lock status for chain
        unlocked_items = []
        if not pl.is_locked:
            unlocked_items.append("placement")
        if not pl.client.is_locked:
            unlocked_items.append("client")
        try:
            if not pl.contractor.contractor_profile.is_locked:
                unlocked_items.append("contractor")
        except Exception:
            unlocked_items.append("contractor")
        if c_inv and not c_inv.is_locked:
            unlocked_items.append("client_invoice")
        if co_inv and not co_inv.is_locked:
            unlocked_items.append("contractor_invoice")

        data.append({
            "placement": {
                "id": str(pl.id), "title": pl.title, "start_date": str(pl.start_date), "end_date": str(pl.end_date) if pl.end_date else None,
                "client_rate": str(pl.client_rate), "contractor_rate": str(pl.contractor_rate),
                "currency": pl.currency, "approval_flow": pl.approval_flow,
                "require_timesheet_attachment": pl.require_timesheet_attachment,
            },
            "client": {"id": str(pl.client_id), "company_name": pl.client.company_name},
            "brokers": [{"id": str(a.broker_id), "full_name": a.broker.full_name} for a in pl.client.broker_assignments.all()],
            "contractor": {"id": str(pl.contractor_id), "full_name": pl.contractor.full_name},
            "timesheet": {"id": str(ts.id), "status": ts.status, "total_hours": str(ts.total_hours), "submitted_at": ts.submitted_at, "approved_at": ts.approved_at} if ts else None,
            "client_invoice": {"id": str(c_inv.id), "invoice_number": c_inv.invoice_number, "status": c_inv.status, "total_amount": str(c_inv.total_amount)} if c_inv else None,
            "contractor_invoice": {"id": str(co_inv.id), "invoice_number": co_inv.invoice_number, "status": co_inv.status, "total_amount": str(co_inv.total_amount)} if co_inv else None,
            "margin": str(margin),
            "flags": flags,
            "unlocked": unlocked_items,
        })
    return data, placements


class ControlOverviewView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        year = int(request.query_params.get("year", 0))
        month = int(request.query_params.get("month", 0))
        if not year or not month:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "year and month required", "details": []}}, status=400)
        rows, _ = _compute_overview_rows(request.user, request.query_params, year, month)
        return Response({"data": rows, "meta": {"total": len(rows)}})


class ControlSummaryView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        year = int(request.query_params.get("year", 0))
        month = int(request.query_params.get("month", 0))
        if not year:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "year required", "details": []}}, status=400)

        awaiting, no_inv, unpaid, not_sent, issues, ts_issues = 0, 0, 0, 0, 0, 0
        total_hours, currency_data = Decimal("0"), defaultdict(lambda: {"revenue": Decimal("0"), "cost": Decimal("0"), "margin": Decimal("0")})

        # Build list of months to aggregate. month=0 / absent -> whole year
        # (current year capped at current month to match table's all-months behavior).
        if month:
            months_to_process = [month]
        else:
            today = date.today()
            max_m = today.month if year == today.year else 12
            months_to_process = list(range(1, max_m + 1))

        ts_flag_names = {"no_timesheet", "timesheet_draft", "pending_approval", "missing_attachment"}
        placements_qs = None
        for m in months_to_process:
            rows, placements_qs = _compute_overview_rows(request.user, request.query_params, year, m)
            for row in rows:
                flags = row.get("flags", [])
                issues += len(flags)
                if any(f in ts_flag_names for f in flags):
                    ts_issues += 1

        import calendar as cal
        # Reuse the filtered placements qs from the helper for the money-counters loop
        placements = placements_qs if placements_qs is not None else Placement.objects.none()
        for m in months_to_process:
            month_start = date(year, m, 1)
            month_end = date(year, m, cal.monthrange(year, m)[1])
            for pl in placements:
                if pl.start_date > month_end:
                    continue
                if pl.end_date and pl.end_date < month_start:
                    continue

                ts = Timesheet.objects.filter(placement=pl, year=year, month=m).first()
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
                invs = Invoice.objects.filter(placement=pl, year=year, month=m, status=Invoice.Status.ISSUED)
                unpaid += invs.count()
                draft_invs = Invoice.objects.filter(placement=pl, year=year, month=m, status=Invoice.Status.DRAFT)
                not_sent += draft_invs.count()

        # Manual invoices: filter by issue_date (they have null placement/year/month).
        # Scope: broker sees only manual invoices whose client is assigned to them OR has no client link.
        manual_qs = Invoice.objects.filter(is_manual=True, issue_date__year=year)
        if month:
            manual_qs = manual_qs.filter(issue_date__month=month)
        if request.user.is_broker:
            from django.db.models import Q as _Q
            manual_qs = manual_qs.filter(
                _Q(client__broker_assignments__broker=request.user) | _Q(client__isnull=True)
            )
        manual_issued = manual_qs.filter(status=Invoice.Status.ISSUED)
        manual_draft = manual_qs.filter(status=Invoice.Status.DRAFT)
        unpaid += manual_issued.count()
        not_sent += manual_draft.count()

        total_rev = sum(d["revenue"] for d in currency_data.values())
        total_cost = sum(d["cost"] for d in currency_data.values())
        return Response({
            "timesheets_awaiting_approval": awaiting, "approved_without_invoices": no_inv,
            "invoices_awaiting_payment": unpaid, "invoices_not_sent": not_sent, "placements_with_issues": issues,
            "timesheet_issues": ts_issues,
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

        # Append manual invoices (no placement) for the requested period.
        try:
            year = int(request.query_params.get("year", 0))
            month = int(request.query_params.get("month", 0))
        except (TypeError, ValueError):
            year, month = 0, 0
        if year:
            today = date.today()
            manual_qs = Invoice.objects.filter(is_manual=True, issue_date__year=year).select_related("client")
            if month:
                manual_qs = manual_qs.filter(issue_date__month=month)
            if request.user.is_broker:
                from django.db.models import Q as _Q
                manual_qs = manual_qs.filter(
                    _Q(client__broker_assignments__broker=request.user) | _Q(client__isnull=True)
                )
            for mi in manual_qs.exclude(status=Invoice.Status.VOIDED):
                flags = ["manual"]
                if mi.status == Invoice.Status.ISSUED and mi.due_date and mi.due_date < today:
                    overdue_days = (today - mi.due_date).days
                    flags.append(f"overdue_{overdue_days}d")
                writer.writerow([
                    (mi.client.company_name if mi.client else (mi.billing_snapshot or {}).get("client_company_name", "") or "(manual, no client)"),
                    "(manual)",
                    "", "", mi.currency,
                    "", "N/A",
                    mi.status,
                    str(mi.total_amount), ", ".join(flags),
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


class PastIssuesView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        """Scan all past months for unresolved issues across all active placements."""
        now = date.today()
        user = request.user

        placements = Placement.objects.filter(status=Placement.Status.ACTIVE).select_related("client", "contractor")
        if user.is_broker:
            placements = placements.filter(client__broker_assignments__broker=user)

        issues = []
        earliest_year = None
        earliest_month = None

        for pl in placements:
            # Determine month range: placement start to last month
            start = pl.start_date
            # Walk from start month to last month (exclusive of current month)
            y, m = start.year, start.month
            while (y, m) < (now.year, now.month):
                month_start = date(y, m, 1)
                if pl.end_date and pl.end_date < month_start:
                    break

                ts = Timesheet.objects.filter(placement=pl, year=y, month=m).first()
                c_inv = Invoice.objects.filter(
                    placement=pl, year=y, month=m, invoice_type=Invoice.Type.CLIENT_INVOICE
                ).exclude(status=Invoice.Status.VOIDED).first()
                co_inv = Invoice.objects.filter(
                    placement=pl, year=y, month=m, invoice_type=Invoice.Type.CONTRACTOR_INVOICE
                ).exclude(status=Invoice.Status.VOIDED).first()

                row_issues = []

                if not ts:
                    row_issues.append("no_timesheet")
                elif ts.status == Timesheet.Status.DRAFT:
                    row_issues.append("timesheet_draft")
                elif ts.status in (Timesheet.Status.SUBMITTED, Timesheet.Status.CLIENT_APPROVED):
                    row_issues.append("pending_approval")

                if ts and ts.status == Timesheet.Status.APPROVED and not c_inv:
                    row_issues.append("approved_no_invoice")

                if c_inv and c_inv.status == Invoice.Status.DRAFT:
                    row_issues.append("invoice_not_sent")
                if co_inv and co_inv.status == Invoice.Status.DRAFT:
                    row_issues.append("invoice_not_sent")

                if c_inv and c_inv.status == Invoice.Status.ISSUED:
                    terms = pl.payment_terms_client_days or 30
                    issued = c_inv.issued_at.date() if c_inv.issued_at else c_inv.created_at.date()
                    if issued + timedelta(days=terms) < now:
                        amt = str(c_inv.total_amount)
                        row_issues.append(f"unpaid_client_{amt}_{c_inv.currency}")

                if co_inv and co_inv.status == Invoice.Status.ISSUED:
                    terms = pl.payment_terms_contractor_days or 30
                    issued = co_inv.issued_at.date() if co_inv.issued_at else co_inv.created_at.date()
                    if issued + timedelta(days=terms) < now:
                        amt = str(co_inv.total_amount)
                        row_issues.append(f"unpaid_contractor_{amt}_{co_inv.currency}")

                if row_issues:
                    issues.append({
                        "year": y, "month": m,
                        "placement_id": str(pl.id),
                        "client": pl.client.company_name,
                        "contractor": pl.contractor.full_name,
                        "title": pl.title,
                        "flags": row_issues,
                    })
                    if earliest_year is None or (y, m) < (earliest_year, earliest_month):
                        earliest_year, earliest_month = y, m

                # Next month
                m += 1
                if m > 12:
                    m = 1
                    y += 1

        return Response({
            "count": len(issues),
            "earliest_year": earliest_year,
            "earliest_month": earliest_month,
            "issues": issues,
        })


class UnlockedEntitiesView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def get(self, request):
        """Return entities that are unlocked but have active placements — at risk."""
        active = Placement.objects.filter(status="ACTIVE").select_related("client", "contractor")
        client_ids = set()
        contractor_ids = set()
        for p in active:
            client_ids.add(p.client_id)
            contractor_ids.add(p.contractor_id)

        unlocked_placements = [
            {"id": str(p.id), "label": f"{p.client.company_name} → {p.title or p.contractor.full_name}", "type": "placement"}
            for p in active if not p.is_locked
        ]
        unlocked_clients = [
            {"id": str(c.id), "label": c.company_name, "type": "client"}
            for c in Client.objects.filter(id__in=client_ids, is_locked=False)
        ]
        unlocked_contractors = [
            {"id": str(c.user_id), "label": c.user.full_name, "type": "contractor"}
            for c in ContractorProfile.objects.filter(user_id__in=contractor_ids, is_locked=False).select_related("user")
        ]
        unlocked_invoices = [
            {"id": str(i.id), "label": i.invoice_number, "type": "invoice", "status": i.status}
            for i in Invoice.objects.filter(
                placement__status="ACTIVE", is_locked=False
            ).exclude(status__in=["VOIDED", "CORRECTED"])[:50]
        ]

        return Response({
            "placements": unlocked_placements,
            "clients": unlocked_clients,
            "contractors": unlocked_contractors,
            "invoices": unlocked_invoices,
            "total": len(unlocked_placements) + len(unlocked_clients) + len(unlocked_contractors) + len(unlocked_invoices),
        })


class LockRowView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def post(self, request):
        """Lock all entities in a single placement's chain."""
        from apps.audit.service import log_audit
        placement_id = request.data.get("placement_id")
        year = request.data.get("year")
        month = request.data.get("month")
        if not placement_id:
            return Response({"error": "placement_id required"}, status=400)

        try:
            pl = Placement.objects.select_related("client", "contractor").get(pk=placement_id)
        except Placement.DoesNotExist:
            return Response({"error": "Placement not found"}, status=404)

        locked = []
        if not pl.is_locked:
            pl.is_locked = True
            pl.save(update_fields=["is_locked"])
            locked.append("placement")
        if not pl.client.is_locked:
            pl.client.is_locked = True
            pl.client.save(update_fields=["is_locked"])
            locked.append("client")
        try:
            prof = pl.contractor.contractor_profile
            if not prof.is_locked:
                prof.is_locked = True
                prof.save(update_fields=["is_locked"])
                locked.append("contractor")
        except Exception:
            pass

        # Lock invoices for this placement (optionally for specific month)
        inv_qs = Invoice.objects.filter(placement=pl, is_locked=False).exclude(status__in=["VOIDED", "CORRECTED"])
        if year and month:
            inv_qs = inv_qs.filter(year=int(year), month=int(month))
        for inv in inv_qs:
            inv.is_locked = True
            inv.save(update_fields=["is_locked"])
            locked.append(f"invoice:{inv.invoice_number}")

        if locked:
            log_audit(
                entity_type="placement", entity_id=pl.id,
                action="ROW_LOCKED",
                title=f"Row locked: {pl.client.company_name} → {pl.title or pl.contractor.full_name}",
                text=f"Locked: {', '.join(locked)}",
                user=request.user,
            )

        return Response({"locked": locked, "count": len(locked)})


class LockAllView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def post(self, request):
        """Lock all unlocked entities related to active placements."""
        from apps.audit.service import log_audit

        active = Placement.objects.filter(status="ACTIVE").select_related("client", "contractor")
        client_ids = set()
        contractor_ids = set()
        locked = []

        for p in active:
            client_ids.add(p.client_id)
            contractor_ids.add(p.contractor_id)
            if not p.is_locked:
                p.is_locked = True
                p.save(update_fields=["is_locked"])
                locked.append(("placement", str(p.id), f"{p.client.company_name} → {p.title or p.contractor.full_name}"))

        for c in Client.objects.filter(id__in=client_ids, is_locked=False):
            c.is_locked = True
            c.save(update_fields=["is_locked"])
            locked.append(("client", str(c.id), c.company_name))

        for cp in ContractorProfile.objects.filter(user_id__in=contractor_ids, is_locked=False).select_related("user"):
            cp.is_locked = True
            cp.save(update_fields=["is_locked"])
            locked.append(("contractor", str(cp.user_id), cp.user.full_name))

        for inv in Invoice.objects.filter(placement__status="ACTIVE", is_locked=False).exclude(status__in=["VOIDED", "CORRECTED"]):
            inv.is_locked = True
            inv.save(update_fields=["is_locked"])
            locked.append(("invoice", str(inv.id), inv.invoice_number))

        # Single audit entry for the bulk lock
        if locked:
            log_audit(
                entity_type="system", entity_id=request.user.id,
                action="BULK_LOCKED",
                title=f"Bulk locked {len(locked)} entities",
                text=f"Locked by {request.user.full_name}: {len([x for x in locked if x[0]=='placement'])} placements, "
                     f"{len([x for x in locked if x[0]=='client'])} clients, "
                     f"{len([x for x in locked if x[0]=='contractor'])} contractors, "
                     f"{len([x for x in locked if x[0]=='invoice'])} invoices",
                user=request.user,
            )

        return Response({"locked_count": len(locked)})


ALLOWED_REPOPULATE_HOSTS = {"v1ln.l.dedikuoti.lt", "localhost", "127.0.0.1"}


class RepopulateView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(tags=["Control"])
    def post(self, request):
        if not request.user.is_admin:
            raise PermissionDenied("Only admins can repopulate")
        host = request.get_host().split(":")[0]
        if host not in ALLOWED_REPOPULATE_HOSTS:
            return Response({"error": "Repopulate is not allowed on this host"}, status=403)
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        try:
            call_command("populate", "--clean", stdout=out)
            return Response({"status": "ok", "output": out.getvalue()})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=500)


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
