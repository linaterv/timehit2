from datetime import date, timedelta
from django.db import models, transaction
from django.utils import timezone
from django.db.models import F
from django.http import FileResponse, HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from drf_spectacular.utils import extend_schema
from .models import Invoice, InvoiceCorrectionLink, InvoiceLineItem, InvoiceNotification, InvoiceTemplate
from .serializers import (
    InvoiceListSerializer, InvoiceDetailSerializer, GenerateInvoicesSerializer,
    MarkPaidSerializer, VoidSerializer, CorrectSerializer, InvoiceNotificationSerializer,
    InvoiceTemplateListSerializer, InvoiceTemplateDetailSerializer,
    InvoiceTemplateCreateSerializer, InvoiceTemplateUpdateSerializer,
    ManualInvoiceCreateSerializer, ManualInvoicePatchSerializer,
)
from apps.timesheets.models import Timesheet
from apps.contractors.models import ContractorProfile
from apps.users.permissions import IsAdminOrBroker, has_broker_access_to_client
from apps.audit.service import log_audit
from apps.users.exceptions import check_locked


def _inv_snapshot(inv):
    return {
        "status": inv.status,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type,
        "total_amount": str(inv.total_amount),
        "currency": inv.currency,
        "issue_date": str(inv.issue_date) if inv.issue_date else None,
        "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
        "payment_date": str(inv.payment_date) if inv.payment_date else None,
    }


def _inv_audit(inv, action, title, user, snap_before, snap_after=None, text=""):
    if snap_after is None:
        snap_after = _inv_snapshot(inv)
    log_audit(
        entity_type="invoice", entity_id=inv.id,
        action=action, title=title, text=text, user=user,
        data_before=snap_before, data_after=snap_after,
    )


def _inv_audit_tpl(tpl, action, title, user):
    log_audit(entity_type="invoice_template", entity_id=tpl.id, action=action,
              title=title, user=user, data_after={"title": tpl.title, "code": tpl.code, "status": tpl.status})


def _next_number(source, client_code="", contractor_code="", default_template=""):
    """
    Generate next invoice number using the series template engine.
    source: InvoiceTemplate or ContractorProfile (has invoice_series_prefix + counters).
    For CLIENT templates: walks parent chain to find series prefix + uses parent's counters.
    If template has no counter vars, duplicates get auto-suffixed (BLA → BLA, BLA1, BLA2…).
    If template has counter vars, keeps incrementing until unique.
    """
    from .series_engine import resolve_series, VARIABLE_PATTERN, COUNTER_VARS

    # For InvoiceTemplate: walk parent chain to find series owner (prefix + counters)
    counter_source = source
    if isinstance(source, InvoiceTemplate):
        node = source
        while node:
            if node.invoice_series_prefix:
                counter_source = node
                break
            if node.parent_id:
                node = InvoiceTemplate.objects.get(pk=node.parent_id)
            else:
                break

    template = counter_source.invoice_series_prefix or default_template
    if not template:
        template = "INV-{YYYY}-{COUNT_YEAR:4}"

    has_any_var = bool(VARIABLE_PATTERN.search(template))
    has_counter = any(m.group(1) in COUNTER_VARS for m in VARIABLE_PATTERN.finditer(template))

    # Legacy prefix (no vars at all, e.g. "AT-2026-") on ContractorProfile: auto-append counter
    if not has_any_var and isinstance(counter_source, ContractorProfile):
        template = template + "{COUNT_YEAR:4}"
        has_counter = True

    if has_counter:
        # Counter-based: keep incrementing until unique
        counters = counter_source.counters or {}
        for _ in range(100):
            result, new_counters = resolve_series(
                template, client_code=client_code, contractor_code=contractor_code,
                counters=counters,
            )
            if not Invoice.objects.filter(invoice_number=result).exists():
                break
            counters = new_counters
        # Save updated counters
        if isinstance(counter_source, InvoiceTemplate):
            InvoiceTemplate.objects.filter(pk=counter_source.pk).update(counters=new_counters)
        else:
            ContractorProfile.objects.filter(pk=counter_source.pk).update(counters=new_counters)
    else:
        # No counter vars: resolve base, then auto-suffix duplicates (BLA → BLA1 → BLA2…)
        base, _ = resolve_series(
            template, client_code=client_code, contractor_code=contractor_code,
            counters={}, dry_run=True,
        )
        result = base
        if Invoice.objects.filter(invoice_number=base).exists():
            # Count existing duplicates with this base
            dupes = Invoice.objects.filter(invoice_number__startswith=base).count()
            result = f"{base}{dupes}"
            # Safety: ensure uniqueness
            while Invoice.objects.filter(invoice_number=result).exists():
                dupes += 1
                result = f"{base}{dupes}"

    return result


def resolve_template(template_type, contractor=None, client=None, placement=None):
    """Resolve the most specific ACTIVE template, or None for fallback."""
    base = InvoiceTemplate.objects.filter(template_type=template_type, status=InvoiceTemplate.Status.ACTIVE)
    if placement:
        t = base.filter(placement=placement).first()
        if t:
            return t
    if contractor and client:
        t = base.filter(contractor=contractor, client=client, placement__isnull=True).first()
        if t:
            return t
    if contractor:
        t = base.filter(contractor=contractor, client__isnull=True, placement__isnull=True, is_default=True).first()
        if t:
            return t
    if client:
        t = base.filter(client=client, placement__isnull=True, is_default=True).first()
        if t:
            return t
    # Global (shared) template — no contractor/client assigned
    t = base.filter(contractor__isnull=True, client__isnull=True, placement__isnull=True, is_default=True).first()
    if t:
        return t
    return None


class PreviewSeriesView(APIView):
    """POST /invoices/preview-series — dry-run template resolution."""

    @extend_schema(tags=["Invoices"])
    def post(self, request):
        from .series_engine import validate_template, resolve_series, parse_variables
        from apps.placements.models import Placement
        from apps.clients.models import Client

        template = request.data.get("template", "")
        placement_id = request.data.get("placement_id")

        errors = validate_template(template)
        if errors:
            return Response({"valid": False, "errors": errors, "preview": None})

        client_code = ""
        contractor_code = ""
        if placement_id:
            try:
                pl = Placement.objects.select_related("client", "contractor__contractor_profile").get(pk=placement_id)
                client_code = pl.client.code
                contractor_code = pl.contractor.contractor_profile.code if hasattr(pl.contractor, "contractor_profile") else ""
            except Placement.DoesNotExist:
                pass

        preview, _ = resolve_series(
            template, dry_run=True,
            client_code=client_code, contractor_code=contractor_code,
            counters={},
        )
        return Response({
            "valid": True,
            "errors": [],
            "preview": preview,
            "variables": parse_variables(template),
        })


def _build_manual_billing_snapshot(client, bill_to_block, bank_block):
    """Assemble billing_snapshot for a manual invoice.
    client: Client instance or None.
    bill_to_block: dict from request bill_to section (may be empty/None).
    bank_block: dict from request bank section (may be empty/None).
    """
    from apps.control.models import AgencySettings
    snap = {}
    if client is not None:
        ct = resolve_template(InvoiceTemplate.Type.CLIENT, client=client)
        bt = bill_to_block or {}
        snap["client_company_name"] = bt.get("company_name") or (ct.company_name if ct else "") or client.company_name
        snap["client_billing_address"] = bt.get("billing_address") or (ct.billing_address if ct else "") or client.billing_address
        snap["client_registration_number"] = bt.get("registration_number") or (ct.registration_number if ct else "") or client.registration_number
        snap["client_country"] = bt.get("country") or (ct.country if ct else "") or client.country
        snap["client_vat_number"] = bt.get("vat_number") or (ct.vat_number if ct else "") or client.vat_number
    else:
        bt = bill_to_block or {}
        snap["client_company_name"] = bt.get("company_name", "")
        snap["client_billing_address"] = bt.get("billing_address", "")
        snap["client_registration_number"] = bt.get("registration_number", "")
        snap["client_country"] = bt.get("country", "")
        snap["client_vat_number"] = bt.get("vat_number", "")

    bank_source = bank_block if bank_block else None
    if not bank_source:
        settings_obj = AgencySettings.load()
        default_tpl = settings_obj.default_client_invoice_template
        if default_tpl:
            bank_source = {
                "bank_name": default_tpl.bank_name,
                "bank_account_iban": default_tpl.bank_account_iban,
                "bank_swift_bic": default_tpl.bank_swift_bic,
            }
    bank_source = bank_source or {}
    snap["bank_name"] = bank_source.get("bank_name", "")
    snap["bank_account_iban"] = bank_source.get("bank_account_iban", "")
    snap["bank_swift_bic"] = bank_source.get("bank_swift_bic", "")
    return snap


def _compute_manual_totals(line_items_data, vat_rate_percent):
    """Compute subtotal/vat_amount/total_amount from validated line items + vat rate.
    Returns (subtotal, vat_amount, total_amount, line_item_rows) where each row dict has quantity/unit_price/line_total/description/display_order."""
    from decimal import Decimal
    subtotal = Decimal("0")
    rows = []
    for idx, li in enumerate(line_items_data):
        q = Decimal(str(li["quantity"]))
        u = Decimal(str(li["unit_price"]))
        lt = (q * u).quantize(Decimal("0.01"))
        subtotal += lt
        rows.append({
            "display_order": idx,
            "description": li.get("description", ""),
            "quantity": q,
            "unit_price": u,
            "line_total": lt,
        })
    subtotal = subtotal.quantize(Decimal("0.01"))
    vat_amount = None
    if vat_rate_percent is not None:
        vat_amount = (subtotal * Decimal(str(vat_rate_percent)) / Decimal("100")).quantize(Decimal("0.01"))
    total = (subtotal + (vat_amount or Decimal("0"))).quantize(Decimal("0.01"))
    return subtotal, vat_amount, total, rows


def _resolve_manual_payment_terms_days(requested):
    """Use request value if given, else fall back to AgencySettings default client template."""
    if requested is not None:
        return requested
    from apps.control.models import AgencySettings
    s = AgencySettings.load()
    if s.default_client_invoice_template:
        return s.default_client_invoice_template.payment_terms_days
    return None


class ManualInvoiceView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(request=ManualInvoiceCreateSerializer, tags=["Invoices"])
    def post(self, request):
        from apps.clients.models import Client
        from apps.users.exceptions import ConflictError

        ser = ManualInvoiceCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        client = None
        if data.get("client_id"):
            try:
                client = Client.objects.get(pk=data["client_id"])
            except Client.DoesNotExist:
                raise NotFound("Client not found")
            if request.user.is_broker and not has_broker_access_to_client(request.user, client.id):
                raise PermissionDenied("No access to this client")

        # Broker without client: allowed (per spec, both roles may create with no client link)
        # (IsAdminOrBroker already enforces; no extra gate needed)

        # Uniqueness check up-front for 409
        if Invoice.objects.filter(invoice_number=data["invoice_number"]).exists():
            from apps.users.exceptions import ConflictError
            raise ConflictError(f"Invoice number {data['invoice_number']} already exists")

        vat_rate = data.get("vat_rate_percent")
        subtotal, vat_amount, total, rows = _compute_manual_totals(data["line_items"], vat_rate)

        terms_days = _resolve_manual_payment_terms_days(data.get("payment_terms_days"))
        issue_date = data["issue_date"]
        due_date = data.get("due_date")
        if due_date is None and terms_days is not None:
            due_date = issue_date + timedelta(days=terms_days)

        billing_snapshot = _build_manual_billing_snapshot(
            client=client,
            bill_to_block=data.get("bill_to"),
            bank_block=data.get("bank"),
        )

        with transaction.atomic():
            inv = Invoice.objects.create(
                invoice_number=data["invoice_number"],
                invoice_type=Invoice.Type.CLIENT_INVOICE,
                is_manual=True,
                client=client,
                candidate_id=data.get("candidate_id"),
                currency=data["currency"],
                subtotal=subtotal,
                vat_rate_percent=vat_rate,
                vat_amount=vat_amount,
                total_amount=total,
                status=Invoice.Status.DRAFT,
                issue_date=issue_date,
                due_date=due_date,
                payment_terms_days=terms_days,
                billing_snapshot=billing_snapshot,
                generated_by=request.user,
            )
            for row in rows:
                InvoiceLineItem.objects.create(invoice=inv, **row)

        _inv_audit(inv, "CREATED", f"Manual invoice {inv.invoice_number} created", request.user, None)
        # Refresh with prefetched line_items
        inv = Invoice.objects.select_related("client", "generated_by").prefetch_related("line_items").get(pk=inv.pk)
        return Response(
            InvoiceDetailSerializer(inv, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GenerateInvoicesView(APIView):
    permission_classes = [IsAdminOrBroker]

    @extend_schema(request=GenerateInvoicesSerializer, tags=["Invoices"])
    def post(self, request):
        ser = GenerateInvoicesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        auto_issue = ser.validated_data.get("auto_issue", False)
        generated, errors = [], []
        for ts_id in ser.validated_data["timesheet_ids"]:
            try:
                ts = Timesheet.objects.select_related("placement__client", "placement__contractor").get(pk=ts_id)
            except Timesheet.DoesNotExist:
                errors.append({"timesheet_id": str(ts_id), "error": "Timesheet not found"})
                continue
            if ts.status != Timesheet.Status.APPROVED:
                errors.append({"timesheet_id": str(ts_id), "error": "Timesheet not APPROVED"})
                continue
            existing_client = ts.invoices.filter(invoice_type=Invoice.Type.CLIENT_INVOICE).exclude(status=Invoice.Status.VOIDED).exists()
            existing_contr = ts.invoices.filter(invoice_type=Invoice.Type.CONTRACTOR_INVOICE).exclude(status=Invoice.Status.VOIDED).exists()
            if existing_client and existing_contr:
                errors.append({"timesheet_id": str(ts_id), "error": "Non-voided invoices already exist"})
                continue
            if request.user.is_broker and not has_broker_access_to_client(request.user, ts.placement.client_id):
                errors.append({"timesheet_id": str(ts_id), "error": "Access denied"})
                continue
            try:
                profile = ts.placement.contractor.contractor_profile
            except ContractorProfile.DoesNotExist:
                errors.append({"timesheet_id": str(ts_id), "error": "Contractor has no profile"})
                continue

            pl = ts.placement
            inv_status = Invoice.Status.ISSUED if auto_issue else Invoice.Status.DRAFT
            inv_issued_at = timezone.now() if auto_issue else None
            with transaction.atomic():
                profile = ContractorProfile.objects.select_for_update().get(pk=profile.pk)

                # Resolve templates (or fall back to profile/client)
                ct = resolve_template(InvoiceTemplate.Type.CLIENT, client=pl.client, placement=pl)
                cot = resolve_template(InvoiceTemplate.Type.CONTRACTOR, contractor=pl.contractor, client=pl.client, placement=pl)
                if cot:
                    cot = InvoiceTemplate.objects.select_for_update().get(pk=cot.pk)

                c_inv = None
                co_inv = None
                from .pdf import generate_invoice_pdf

                # Client invoice (skip if non-voided already exists)
                if not existing_client:
                    c_sub = ts.total_hours * pl.client_rate
                    bill_to = (ct.billing_address if ct and ct.billing_address else None) or pl.client.billing_address
                    from_block = ""
                    if ct:
                        p = ct.parent
                        while p:
                            if p.billing_address:
                                from_block = p.billing_address
                                break
                            p = p.parent
                    c_snap = {
                        "client_billing_address": bill_to,
                        "agency_billing_address": from_block,
                        "client_payment_terms_days": pl.payment_terms_client_days or pl.client.payment_terms_days,
                    }
                    if ct:
                        c_snap["template_id"] = str(ct.id)
                        _cl_code = pl.client.code if hasattr(pl.client, "code") else ""
                    _co_code = profile.code if hasattr(profile, "code") else ""
                    c_inv = Invoice.objects.create(
                        invoice_number=_next_number(ct or profile, client_code=_cl_code, contractor_code=_co_code, default_template="WISE-{CLIENT}{CONTRACTOR}{YY}{MM}{DD}"),
                        invoice_type=Invoice.Type.CLIENT_INVOICE,
                        timesheet=ts, placement=pl, client=pl.client, contractor=pl.contractor,
                        year=ts.year, month=ts.month, currency=pl.currency,
                        hourly_rate=pl.client_rate, total_hours=ts.total_hours,
                        subtotal=c_sub, total_amount=c_sub, status=inv_status, issued_at=inv_issued_at,
                        issue_date=date.today(),
                        due_date=date.today() + timedelta(days=pl.payment_terms_client_days or pl.client.payment_terms_days or 30),
                        billing_snapshot=c_snap,
                        generated_by=request.user,
                    )
                    generate_invoice_pdf(c_inv)

                # Contractor invoice (skip if non-voided already exists)
                if not existing_contr:
                    co_sub = ts.total_hours * pl.contractor_rate
                    co_src = cot or profile
                    vat_reg = co_src.vat_registered if co_src.vat_registered is not None else False
                    vat = co_src.vat_rate_percent if vat_reg else None
                    vat_amt = (co_sub * vat / 100) if vat else None
                    total = co_sub + (vat_amt or 0)
                    co_from = co_src.billing_address or co_src.company_name or ""
                    payment_block = co_src.bank_name or ""
                    agency_block = ""
                    if cot:
                        p = cot.parent
                        while p:
                            if p.billing_address:
                                agency_block = p.billing_address
                                break
                            p = p.parent
                    co_snap = {
                        "contractor_billing_address": co_from,
                        "contractor_bank_name": payment_block,
                        "agency_billing_address": agency_block,
                        "contractor_payment_terms_days": pl.payment_terms_contractor_days or co_src.payment_terms_days,
                        "contractor_invoice_series_prefix": co_src.invoice_series_prefix,
                    }
                    if cot:
                        co_snap["template_id"] = str(cot.id)
                    co_inv = Invoice.objects.create(
                        invoice_number=_next_number(cot or profile, client_code=_cl_code, contractor_code=_co_code, default_template="INV-{CONTRACTOR}{CLIENT}{YY}{MM}{DD}"),
                        invoice_type=Invoice.Type.CONTRACTOR_INVOICE,
                        timesheet=ts, placement=pl, client=pl.client, contractor=pl.contractor,
                        year=ts.year, month=ts.month, currency=pl.currency,
                        hourly_rate=pl.contractor_rate, total_hours=ts.total_hours,
                        subtotal=co_sub, vat_rate_percent=vat, vat_amount=vat_amt,
                        total_amount=total, status=inv_status, issued_at=inv_issued_at, issue_date=date.today(),
                        due_date=date.today() + timedelta(days=pl.payment_terms_contractor_days or co_src.payment_terms_days or 14),
                        billing_snapshot=co_snap,
                        generated_by=request.user,
                    )
                    generate_invoice_pdf(co_inv)

            if c_inv:
                _inv_audit(c_inv, "CREATED", f"Invoice {c_inv.invoice_number} generated", request.user, None)
            if co_inv:
                _inv_audit(co_inv, "CREATED", f"Invoice {co_inv.invoice_number} generated", request.user, None)
            result = {"timesheet_id": str(ts_id)}
            if c_inv:
                result["client_invoice"] = {"id": str(c_inv.id), "invoice_number": c_inv.invoice_number, "total_amount": str(c_inv.total_amount), "status": c_inv.status}
            if co_inv:
                result["contractor_invoice"] = {"id": str(co_inv.id), "invoice_number": co_inv.invoice_number, "total_amount": str(co_inv.total_amount), "status": co_inv.status}
            generated.append(result)
        return Response({"generated": generated, "errors": errors}, status=status.HTTP_201_CREATED)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("client", "contractor", "generated_by", "placement").prefetch_related("line_items")
    http_method_names = ["get", "post", "patch", "delete"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return InvoiceDetailSerializer
        if self.action == "partial_update":
            return ManualInvoicePatchSerializer
        return InvoiceListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_broker:
            qs = qs.filter(client__broker_assignments__broker=user)
        elif user.is_contractor:
            qs = qs.filter(contractor=user, invoice_type=Invoice.Type.CONTRACTOR_INVOICE)
        elif user.is_client_contact:
            try:
                qs = qs.filter(client_id=user.client_contact.client_id, invoice_type=Invoice.Type.CLIENT_INVOICE)
            except Exception:
                qs = qs.none()
        p = self.request.query_params
        for f, k in [("invoice_type", "invoice_type"), ("client_id", "client_id"), ("contractor_id", "contractor_id"), ("placement_id", "placement_id"), ("year", "year"), ("month", "month"), ("candidate_id", "candidate_id")]:
            if p.get(f):
                qs = qs.filter(**{k: p[f]})
        if p.get("is_manual") is not None:
            v = p.get("is_manual").lower()
            if v in ("true", "1", "yes"):
                qs = qs.filter(is_manual=True)
            elif v in ("false", "0", "no"):
                qs = qs.filter(is_manual=False)
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("issue_year"):
            qs = qs.filter(issue_date__year=p["issue_year"])
        # Sorting
        sort_field = p.get("sort", "created_at")
        allowed = {"created_at", "updated_at", "issue_date", "due_date", "invoice_number", "status", "total_amount"}
        if sort_field not in allowed:
            sort_field = "created_at"
        if p.get("order") == "asc":
            qs = qs.order_by(sort_field)
        else:
            qs = qs.order_by(f"-{sort_field}")
        return qs

    @extend_schema(request=ManualInvoicePatchSerializer, tags=["Invoices"])
    def partial_update(self, request, *args, **kwargs):
        from apps.clients.models import Client
        from apps.users.exceptions import ConflictError
        inv = self.get_object()
        check_locked(inv)
        if not inv.is_manual:
            raise ConflictError("Can only edit manual invoices via PATCH")
        if inv.status != Invoice.Status.DRAFT:
            raise ConflictError("Can only edit DRAFT invoices")

        # Scope check: if current invoice has a client, broker must have access
        if request.user.is_broker and inv.client_id and not has_broker_access_to_client(request.user, inv.client_id):
            raise PermissionDenied("No access to this client")

        ser = ManualInvoicePatchSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        # Handle client_id change: re-check broker scope
        new_client = inv.client
        if "client_id" in data:
            if data.get("client_id"):
                try:
                    new_client = Client.objects.get(pk=data["client_id"])
                except Client.DoesNotExist:
                    raise NotFound("Client not found")
                if request.user.is_broker and not has_broker_access_to_client(request.user, new_client.id):
                    raise PermissionDenied("No access to this client")
            else:
                new_client = None

        # Uniqueness if invoice_number changed
        if "invoice_number" in data and data["invoice_number"] != inv.invoice_number:
            if Invoice.objects.filter(invoice_number=data["invoice_number"]).exclude(pk=inv.pk).exists():
                raise ConflictError(f"Invoice number {data['invoice_number']} already exists")

        snap = _inv_snapshot(inv)

        with transaction.atomic():
            if "invoice_number" in data:
                inv.invoice_number = data["invoice_number"]
            if "issue_date" in data:
                inv.issue_date = data["issue_date"]
            if "due_date" in data:
                inv.due_date = data["due_date"]
            if "payment_terms_days" in data:
                inv.payment_terms_days = data["payment_terms_days"]
            if "currency" in data:
                inv.currency = data["currency"]
            if "vat_rate_percent" in data:
                inv.vat_rate_percent = data["vat_rate_percent"]
            if "client_id" in data:
                inv.client = new_client
            if "candidate_id" in data:
                inv.candidate_id = data["candidate_id"]

            # Recompute due_date if payment_terms_days changed but due_date not explicitly given
            if "payment_terms_days" in data and "due_date" not in data:
                if inv.payment_terms_days is not None:
                    inv.due_date = inv.issue_date + timedelta(days=inv.payment_terms_days)

            # Handle line_items replacement
            if "line_items" in data:
                vat_for_calc = inv.vat_rate_percent
                subtotal, vat_amount, total, rows = _compute_manual_totals(data["line_items"], vat_for_calc)
                inv.subtotal = subtotal
                inv.vat_amount = vat_amount
                inv.total_amount = total
                inv.line_items.all().delete()
                for row in rows:
                    InvoiceLineItem.objects.create(invoice=inv, **row)
            elif "vat_rate_percent" in data:
                # VAT changed but items didn't — recompute totals from existing items
                existing = list(inv.line_items.all().values("quantity", "unit_price", "description", "display_order"))
                items_data = [{"quantity": r["quantity"], "unit_price": r["unit_price"], "description": r["description"]} for r in existing]
                subtotal, vat_amount, total, _rows = _compute_manual_totals(items_data, inv.vat_rate_percent) if existing else (inv.subtotal, None, inv.subtotal, [])
                inv.subtotal = subtotal
                inv.vat_amount = vat_amount
                inv.total_amount = total

            # Rebuild billing_snapshot if client or bill_to or bank provided
            if any(k in data for k in ("client_id", "bill_to", "bank")):
                inv.billing_snapshot = _build_manual_billing_snapshot(
                    client=new_client,
                    bill_to_block=data.get("bill_to", {}),
                    bank_block=data.get("bank", {}),
                )

            inv.save()

        _inv_audit(inv, "UPDATED", f"Manual invoice {inv.invoice_number} updated", request.user, snap)
        inv = Invoice.objects.select_related("client", "generated_by").prefetch_related("line_items").get(pk=inv.pk)
        return Response(InvoiceDetailSerializer(inv, context={"request": request}).data)

    @extend_schema(tags=["Invoices"])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=["Invoices"])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=["Invoices"])
    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        inv = self.get_object()
        check_locked(inv)
        if inv.status != Invoice.Status.DRAFT:
            from apps.users.exceptions import ConflictError
            raise ConflictError("Can only delete DRAFT invoices")
        inv.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Invoices"], request=None)
    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        inv = self.get_object()
        check_locked(inv)
        snap = _inv_snapshot(inv)
        inv.issue()
        _inv_audit(inv, "ISSUED", f"Invoice {inv.invoice_number} issued", request.user, snap)
        return Response(InvoiceDetailSerializer(inv).data)

    @extend_schema(tags=["Invoices"], request=MarkPaidSerializer)
    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        ser = MarkPaidSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        inv = self.get_object()
        check_locked(inv)
        snap = _inv_snapshot(inv)
        inv.mark_paid(ser.validated_data["payment_date"], ser.validated_data.get("payment_reference", ""))
        _inv_audit(inv, "PAID", f"Invoice {inv.invoice_number} marked paid", request.user, snap)
        return Response(InvoiceDetailSerializer(inv).data)

    @extend_schema(tags=["Invoices"], request=VoidSerializer)
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        inv = self.get_object()
        check_locked(inv)
        snap = _inv_snapshot(inv)
        inv.void()
        _inv_audit(inv, "VOIDED", f"Invoice {inv.invoice_number} voided", request.user, snap)
        return Response(InvoiceDetailSerializer(inv).data)

    @extend_schema(tags=["Invoices"], request=CorrectSerializer)
    @action(detail=True, methods=["post"])
    def correct(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_broker):
            raise PermissionDenied()
        ser = CorrectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        inv = self.get_object()
        check_locked(inv)
        snap = _inv_snapshot(inv)
        d = ser.validated_data
        inv.mark_corrected()
        _inv_audit(inv, "CORRECTED", f"Invoice {inv.invoice_number} corrected", request.user, snap)
        hr = d.get("hourly_rate", inv.hourly_rate)
        th = d.get("total_hours", inv.total_hours)
        sub = hr * th
        vr = d.get("vat_rate_percent", inv.vat_rate_percent)
        va = (sub * vr / 100) if vr else None
        ta = sub + (va or 0)
        _cl_code = inv.client.code if hasattr(inv.client, "code") else ""
        _co_code = inv.contractor.contractor_profile.code if hasattr(inv.contractor, "contractor_profile") and hasattr(inv.contractor.contractor_profile, "code") else ""
        if inv.invoice_type == Invoice.Type.CONTRACTOR_INVOICE:
            num = _next_number(inv.contractor.contractor_profile, client_code=_cl_code, contractor_code=_co_code, default_template="INV-{CONTRACTOR}{CLIENT}{YY}{MM}{DD}")
        else:
            num = _next_number(inv.contractor.contractor_profile, client_code=_cl_code, contractor_code=_co_code, default_template="WISE-{CLIENT}{CONTRACTOR}{YY}{MM}{DD}")
        corrective = Invoice.objects.create(
            invoice_number=num, invoice_type=inv.invoice_type,
            timesheet=inv.timesheet, placement=inv.placement,
            client=inv.client, contractor=inv.contractor,
            year=inv.year, month=inv.month, currency=inv.currency,
            hourly_rate=hr, total_hours=th, subtotal=sub,
            vat_rate_percent=vr, vat_amount=va, total_amount=ta,
            status=Invoice.Status.DRAFT, issue_date=date.today(),
            due_date=inv.due_date, billing_snapshot=inv.billing_snapshot,
            generated_by=request.user,
        )
        InvoiceCorrectionLink.objects.create(original_invoice=inv, corrective_invoice=corrective, reason=d.get("reason", ""))
        return Response({
            "original_invoice": {"id": str(inv.id), "status": inv.status},
            "corrective_invoice": {"id": str(corrective.id), "invoice_number": corrective.invoice_number, "status": corrective.status, "total_amount": str(corrective.total_amount)},
        }, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Invoices"])
    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        inv = self.get_object()
        if inv.is_manual:
            from .pdf import generate_manual_invoice_pdf
            pdf_bytes = generate_manual_invoice_pdf(inv, watermark_draft=(inv.status == Invoice.Status.DRAFT))
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{inv.invoice_number}.pdf"'
            return response
        if inv.pdf_file:
            return FileResponse(inv.pdf_file.open(), content_type="application/pdf", as_attachment=True, filename=f"{inv.invoice_number}.pdf")
        raise NotFound("PDF not yet generated")

    @extend_schema(tags=["Invoices"])
    @action(detail=True, methods=["get"])
    def notifications(self, request, pk=None):
        inv = self.get_object()
        qs = inv.notifications.select_related("created_by").all()
        user = request.user
        if user.is_contractor:
            qs = qs.filter(visible_to_contractor=True)
        elif user.is_client_contact:
            qs = qs.filter(visible_to_client=True)
        return Response({"data": InvoiceNotificationSerializer(qs, many=True).data})


class InvoiceTemplateViewSet(viewsets.ModelViewSet):
    queryset = InvoiceTemplate.objects.select_related("contractor", "client", "placement")

    def get_serializer_class(self):
        if self.action == "create":
            return InvoiceTemplateCreateSerializer
        if self.action in ("update", "partial_update"):
            return InvoiceTemplateUpdateSerializer
        if self.action == "retrieve":
            return InvoiceTemplateDetailSerializer
        return InvoiceTemplateListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_contractor:
            qs = qs.filter(
                models.Q(contractor=user) | models.Q(contractor__isnull=True, client__isnull=True),
                template_type=InvoiceTemplate.Type.CONTRACTOR,
            )
        elif user.is_broker:
            qs = qs.filter(
                models.Q(template_type=InvoiceTemplate.Type.CLIENT, client__broker_assignments__broker=user)
            )
        elif user.is_client_contact:
            try:
                qs = qs.filter(client_id=user.client_contact.client_id, template_type=InvoiceTemplate.Type.CLIENT)
            except Exception:
                qs = qs.none()
        p = self.request.query_params
        if p.get("template_type"):
            qs = qs.filter(template_type=p["template_type"])
        if p.get("contractor_id"):
            qs = qs.filter(contractor_id=p["contractor_id"])
        if p.get("client_id"):
            qs = qs.filter(client_id=p["client_id"])
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        return qs.order_by("-updated_at")

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_contractor:
            if serializer.validated_data.get("template_type") != InvoiceTemplate.Type.CONTRACTOR:
                raise PermissionDenied("Contractors can only create CONTRACTOR templates")
            serializer.save(contractor=user)
        elif user.is_broker:
            if serializer.validated_data.get("template_type") != InvoiceTemplate.Type.CLIENT:
                raise PermissionDenied("Brokers can only create CLIENT templates")
            client_id = serializer.validated_data.get("client_id")
            if client_id and not has_broker_access_to_client(user, client_id):
                raise PermissionDenied("No access to this client")
            serializer.save()
        else:
            serializer.save()
        tpl = serializer.instance
        _inv_audit_tpl(tpl, "CREATED", f"Template '{tpl.title}' created", self.request.user)

    def perform_update(self, serializer):
        check_locked(serializer.instance)
        user = self.request.user
        if user.is_contractor and serializer.instance.contractor_id != user.id:
            raise PermissionDenied()
        if user.is_broker:
            if serializer.instance.template_type != InvoiceTemplate.Type.CLIENT:
                raise PermissionDenied()
            if not has_broker_access_to_client(user, serializer.instance.client_id):
                raise PermissionDenied()
        serializer.save()
        tpl = serializer.instance
        _inv_audit_tpl(tpl, "UPDATED", f"Template '{tpl.title}' updated", self.request.user)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        check_locked(obj)
        if obj.status not in (InvoiceTemplate.Status.DRAFT, InvoiceTemplate.Status.ARCHIVED):
            from apps.users.exceptions import ConflictError
            raise ConflictError("Can only delete DRAFT or ARCHIVED templates")
        _inv_audit_tpl(obj, "DELETED", f"Template '{obj.title}' deleted", request.user)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["Invoice Templates"], request=None)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        obj = self.get_object()
        if obj.status != InvoiceTemplate.Status.DRAFT:
            from apps.users.exceptions import InvalidStateTransition
            raise InvalidStateTransition("Can only activate from DRAFT")
        obj.status = InvoiceTemplate.Status.ACTIVE
        obj.save()
        _inv_audit_tpl(obj, "ACTIVATED", f"Template '{obj.title}' activated", request.user)
        return Response(InvoiceTemplateDetailSerializer(obj).data)

    @extend_schema(tags=["Invoice Templates"], request=None)
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        obj = self.get_object()
        if obj.status != InvoiceTemplate.Status.ACTIVE:
            from apps.users.exceptions import InvalidStateTransition
            raise InvalidStateTransition("Can only archive from ACTIVE")
        obj.status = InvoiceTemplate.Status.ARCHIVED
        obj.save()
        _inv_audit_tpl(obj, "ARCHIVED", f"Template '{obj.title}' archived", request.user)
        return Response(InvoiceTemplateDetailSerializer(obj).data)

    @extend_schema(tags=["Invoice Templates"])
    @action(detail=True, methods=["get", "post"], url_path="sample-pdf", permission_classes=[])
    def sample_pdf(self, request, pk=None):
        from .pdf import generate_sample_pdf
        obj = InvoiceTemplate.objects.get(pk=pk)
        parent = None
        # POST: override template fields with request data for live preview
        if request.method == "POST" and request.data:
            for field in ["billing_address", "bank_name", "company_name", "vat_rate_percent",
                          "vat_registered", "vat_number", "invoice_series_prefix",
                          "next_invoice_number", "payment_terms_days", "default_currency", "country"]:
                if field in request.data:
                    val = request.data[field]
                    if field == "next_invoice_number" and val is not None:
                        try: val = int(val)
                        except (ValueError, TypeError): pass
                    if field == "payment_terms_days" and val is not None:
                        try: val = int(val)
                        except (ValueError, TypeError): pass
                    setattr(obj, field, val)
            # Resolve parent from posted data or from saved template
            parent_id = request.data.get("parent_id") or obj.parent_id
            if parent_id:
                try: parent = InvoiceTemplate.objects.get(pk=parent_id)
                except InvoiceTemplate.DoesNotExist: pass
        else:
            # GET: use saved parent
            if obj.parent_id:
                try: parent = InvoiceTemplate.objects.get(pk=obj.parent_id)
                except InvoiceTemplate.DoesNotExist: pass
        pdf_bytes = generate_sample_pdf(obj, parent=parent)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="sample-{obj.code or obj.id}.pdf"'
        return response
