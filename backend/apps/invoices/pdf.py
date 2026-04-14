"""
Generic PDF generation for invoices and template previews.

generate_pdf(data) — renders a PDF from a plain dict, returns bytes.
generate_sample_pdf(template) — builds sample data from an InvoiceTemplate, returns PDF bytes.
generate_invoice_pdf(invoice) — builds data from an Invoice model, saves PDF to invoice.pdf_file.
"""
import os
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register DejaVu Sans (supports Lithuanian, Polish, etc.)
_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
pdfmetrics.registerFont(TTFont("DejaVu", os.path.join(_FONT_DIR, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", os.path.join(_FONT_DIR, "DejaVuSans-Bold.ttf")))

FONT = "DejaVu"
FONT_BOLD = "DejaVu-Bold"

MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt(val):
    """Format a number to 2 decimal places."""
    if val is None:
        return ""
    return f"{Decimal(str(val)):.2f}"


def _draw_multiline(c, x, y, text, font=FONT, size=10, line_height=5):
    """Draw multiline text, return y after last line."""
    c.setFont(font, size)
    for line in str(text).split("\n"):
        c.drawString(x, y, line.strip())
        y -= line_height * mm
    return y


def generate_pdf(data: dict) -> bytes:
    """
    Render an invoice PDF from a data dict. Returns raw PDF bytes.

    Expected keys:
      invoice_number, issue_date, due_date, status, invoice_type,
      from_block (multiline str), to_block (multiline str),
      description, total_hours, hourly_rate, currency, subtotal,
      vat_rate_percent (optional), vat_amount (optional), total_amount,
      payment_block (multiline str, optional),
      footer_text
    """
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # PDF metadata (visible in File → Properties / Document Info)
    meta = data.get("meta", {})
    c.setTitle(meta.get("title", f"Invoice {data.get('invoice_number', '')}"))
    c.setAuthor(meta.get("author", "TimeHit Platform"))
    c.setCreator("TimeHit Platform / ReportLab PDF Engine")

    # Subject: pack all custom metadata as key=value lines
    skip = {"title", "author", "subject", "keywords"}
    custom_lines = []
    if meta.get("subject"):
        custom_lines.append(meta["subject"])
    for k, v in meta.items():
        if k not in skip and v:
            custom_lines.append(f"{k}: {v}")
    c.setSubject("\n".join(custom_lines) if custom_lines else f"{data.get('invoice_type', 'Invoice')} — {data.get('description', '')}")

    # Keywords: all searchable terms
    if meta.get("keywords"):
        kw = meta["keywords"]
        # Also add custom values as keywords for searchability
        for k, v in meta.items():
            if k not in skip and v and str(v) not in kw:
                kw.append(str(v))
        c.setKeywords(kw)

    # Header
    c.setFont(FONT_BOLD, 18)
    c.drawString(25 * mm, h - 25 * mm, "INVOICE")
    c.setFont(FONT, 8)
    c.drawString(25 * mm, h - 32 * mm, f"No: {data.get('invoice_number', '')}")
    c.drawString(25 * mm, h - 37 * mm, f"Date: {data.get('issue_date', '')}")
    c.drawString(25 * mm, h - 42 * mm, f"Due: {data.get('due_date', '')}")
    c.setFont(FONT_BOLD, 8)
    c.drawRightString(w - 25 * mm, h - 25 * mm, str(data.get("status", "")))
    c.setFont(FONT, 7)
    c.drawRightString(w - 25 * mm, h - 32 * mm, str(data.get("invoice_type", "")))

    # From / To
    y = h - 55 * mm
    c.setFont(FONT_BOLD, 9)
    c.drawString(25 * mm, y, "From")
    _draw_multiline(c, 25 * mm, y - 5 * mm, data.get("from_block", ""), size=8, line_height=4)

    c.setFont(FONT_BOLD, 9)
    c.drawString(110 * mm, y, "Bill To")
    _draw_multiline(c, 110 * mm, y - 5 * mm, data.get("to_block", ""), size=8, line_height=4)

    # Spacer before table
    y = h - 100 * mm

    # Table header
    c.setFont(FONT_BOLD, 8)
    c.drawString(25 * mm, y, "Description")
    c.drawString(110 * mm, y, "Hours")
    c.drawString(130 * mm, y, "Rate")
    c.drawRightString(w - 25 * mm, y, "Amount")
    c.line(25 * mm, y - 2 * mm, w - 25 * mm, y - 2 * mm)

    y -= 7 * mm
    c.setFont(FONT, 8)
    currency = data.get("currency", "EUR")
    c.drawString(25 * mm, y, str(data.get("description", "")))
    c.drawString(110 * mm, y, str(data.get("total_hours", "")))
    c.drawString(130 * mm, y, f"{_fmt(data.get('hourly_rate'))} {currency}")
    c.drawRightString(w - 25 * mm, y, f"{_fmt(data.get('subtotal'))} {currency}")

    # Totals
    y -= 12 * mm
    c.line(110 * mm, y + 3 * mm, w - 25 * mm, y + 3 * mm)
    c.setFont(FONT, 8)
    c.drawString(110 * mm, y, "Subtotal")
    c.drawRightString(w - 25 * mm, y, f"{_fmt(data.get('subtotal'))} {currency}")
    vat_pct = data.get("vat_rate_percent")
    if vat_pct:
        y -= 5 * mm
        c.drawString(110 * mm, y, f"VAT ({vat_pct}%)")
        c.drawRightString(w - 25 * mm, y, f"{_fmt(data.get('vat_amount'))} {currency}")
    y -= 6 * mm
    c.setFont(FONT_BOLD, 10)
    c.drawString(110 * mm, y, "Total")
    c.drawRightString(w - 25 * mm, y, f"{_fmt(data.get('total_amount'))} {currency}")

    # Payment details
    payment = data.get("payment_block")
    if payment:
        y -= 15 * mm
        c.setFont(FONT_BOLD, 8)
        c.drawString(25 * mm, y, "Payment Details")
        _draw_multiline(c, 25 * mm, y - 5 * mm, payment, font=FONT, size=7, line_height=3.5)

    # Footer
    c.setFont(FONT, 6)
    c.drawString(25 * mm, 15 * mm, str(data.get("footer_text", "")))
    c.save()

    buf.seek(0)
    return buf.read()


def generate_sample_pdf(template, parent=None) -> bytes:
    """Generate a sample/preview PDF from an InvoiceTemplate with dummy data.
    If parent is provided, uses parent data for the non-editable side."""
    is_contractor = template.template_type == "CONTRACTOR"
    prefix = template.invoice_series_prefix or "???-"
    num = template.next_invoice_number or 1
    preview_number = f"{prefix}{num:04d}"
    today = date.today()
    terms = template.payment_terms_days or 30
    currency = template.default_currency or "EUR"

    # Sample amounts
    hours = Decimal("160.00")
    rate = Decimal("20.00")
    subtotal = hours * rate
    vat_pct = template.vat_rate_percent
    vat_amt = (subtotal * vat_pct / 100) if vat_pct else None
    total = subtotal + (vat_amt or 0)

    # From / To blocks
    tpl_block = template.billing_address or f"{template.company_name or 'Company Name'}\nAddress"
    parent_block = (parent.billing_address if parent and parent.billing_address else None) or "Sample Company Ltd\nSample Address\nSample City, Country"
    is_global = not template.contractor_id and not template.client_id

    if is_contractor:
        if is_global:
            # Global template stores agency (Bill To) side
            from_block = "Sample Contractor Ltd\nSample Address\nSample City, Country"
            to_block = tpl_block
        else:
            # Contractor-owned: template = contractor's From, parent = agency's Bill To
            from_block = tpl_block
            to_block = parent_block
    else:
        if is_global:
            # Global template stores agency (From) side
            from_block = tpl_block
            to_block = "Sample Client Ltd\nSample Address\nSample City, Country"
        else:
            from_block = parent_block
            to_block = tpl_block

    data = {
        "invoice_number": preview_number,
        "issue_date": today,
        "due_date": today + timedelta(days=terms),
        "status": "SAMPLE",
        "invoice_type": "CONTRACTOR INVOICE" if is_contractor else "CLIENT INVOICE",
        "from_block": from_block,
        "to_block": to_block,
        "description": f"Consulting — Sample Contractor — {today.year}.{today.month:02d}",
        "total_hours": hours,
        "hourly_rate": rate,
        "currency": currency,
        "subtotal": subtotal,
        "vat_rate_percent": vat_pct,
        "vat_amount": vat_amt,
        "total_amount": total,
        "payment_block": template.bank_name if is_contractor and template.bank_name else None,
        "footer_text": f"Invoice {preview_number} | SAMPLE — Generated by TimeHit Platform",
    }
    return generate_pdf(data)


def generate_invoice_pdf(invoice):
    """Generate a PDF from an Invoice model and save to invoice.pdf_file."""
    from django.core.files.base import ContentFile

    inv = invoice
    snap = inv.billing_snapshot
    is_client = inv.invoice_type == "CLIENT_INVOICE"

    if is_client:
        from_block = snap.get("agency_billing_address") or "TimeHit Agency"
        to_block = snap.get("client_billing_address") or ""
    else:
        from_block = snap.get("contractor_billing_address") or inv.contractor.full_name
        to_block = snap.get("agency_billing_address") or "TimeHit Agency"

    # Resolve codes safely
    client_code = inv.client.code if hasattr(inv.client, "code") else ""
    contr_code = ""
    contr_company = ""
    contr_vat = ""
    try:
        cp = inv.contractor.contractor_profile
        contr_code = cp.code
        contr_company = cp.company_name
        contr_vat = cp.vat_number
    except Exception:
        pass

    placement_title = inv.placement.title if inv.placement else ""
    placement_id = str(inv.placement_id) if inv.placement_id else ""
    template_id = snap.get("template_id", "")
    series_prefix = snap.get("contractor_invoice_series_prefix", "") if not is_client else ""

    data = {
        "invoice_number": inv.invoice_number,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "status": inv.status,
        "invoice_type": "CLIENT INVOICE" if is_client else "CONTRACTOR INVOICE",
        "from_block": from_block,
        "to_block": to_block,
        "description": f"Consulting — {inv.contractor.full_name} — {inv.year}.{inv.month:02d}",
        "total_hours": inv.total_hours,
        "hourly_rate": inv.hourly_rate,
        "currency": inv.currency,
        "subtotal": inv.subtotal,
        "vat_rate_percent": inv.vat_rate_percent,
        "vat_amount": inv.vat_amount,
        "total_amount": inv.total_amount,
        "footer_text": f"Invoice {inv.invoice_number} | Generated by TimeHit Platform",
        "meta": {
            "title": f"Invoice {inv.invoice_number}",
            "author": "TimeHit Platform",
            "subject": f"{'Client' if is_client else 'Contractor'} invoice for {inv.contractor.full_name} — {inv.year}.{inv.month:02d}",
            "keywords": [
                inv.invoice_number, inv.status, inv.invoice_type,
                inv.currency, inv.client.company_name, inv.contractor.full_name,
                placement_title,
            ],
            # Invoice identifiers
            "InvoiceID": str(inv.id),
            "InvoiceNumber": inv.invoice_number,
            "InvoiceType": inv.invoice_type,
            "InvoiceStatus": inv.status,
            "InvoiceSeries": series_prefix,
            # Dates
            "IssueDate": str(inv.issue_date),
            "DueDate": str(inv.due_date) if inv.due_date else "",
            "Period": f"{inv.year}-{inv.month:02d}",
            # Amounts
            "Currency": inv.currency,
            "TotalHours": str(inv.total_hours),
            "HourlyRate": str(inv.hourly_rate),
            "Subtotal": str(inv.subtotal),
            "VATRate": str(inv.vat_rate_percent) if inv.vat_rate_percent else "",
            "VATAmount": str(inv.vat_amount) if inv.vat_amount else "",
            "TotalAmount": str(inv.total_amount),
            # Client
            "ClientID": str(inv.client_id),
            "ClientName": inv.client.company_name,
            "ClientCode": client_code,
            "ClientVAT": inv.client.vat_number if hasattr(inv.client, "vat_number") else "",
            # Contractor
            "ContractorID": str(inv.contractor_id),
            "ContractorName": inv.contractor.full_name,
            "ContractorCode": contr_code,
            "ContractorCompany": contr_company,
            "ContractorVAT": contr_vat,
            # Placement
            "PlacementID": placement_id,
            "PlacementTitle": placement_title,
            "PlacementStartDate": str(inv.placement.start_date) if inv.placement and inv.placement.start_date else "",
            "PlacementEndDate": str(inv.placement.end_date) if inv.placement and inv.placement.end_date else "open-ended",
            "PlacementStatus": inv.placement.status if inv.placement else "",
            "PlacementApprovalFlow": inv.placement.approval_flow if inv.placement else "",
            # Timesheet
            "TimesheetID": str(inv.timesheet_id) if inv.timesheet_id else "",
            "TimesheetPeriod": f"{inv.timesheet.year}-{inv.timesheet.month:02d}" if inv.timesheet else "",
            "TimesheetStatus": inv.timesheet.status if inv.timesheet else "",
            "TimesheetTotalHours": str(inv.timesheet.total_hours) if inv.timesheet else "",
            "TimesheetSubmittedAt": inv.timesheet.submitted_at.isoformat() if inv.timesheet and inv.timesheet.submitted_at else "",
            "TimesheetApprovedAt": inv.timesheet.approved_at.isoformat() if inv.timesheet and inv.timesheet.approved_at else "",
            # Template
            "TemplateID": template_id,
            # Generator
            "GeneratedBy": inv.generated_by.full_name if inv.generated_by else "",
            "GeneratedAt": inv.created_at.isoformat() if inv.created_at else "",
            "Platform": "TimeHit",
        },
    }

    # Last audit event IDs for all related entities
    from apps.audit.models import AuditLog
    audit_ids = {}
    for etype, eid in [
        ("invoice", inv.id),
        ("timesheet", inv.timesheet_id),
        ("placement", inv.placement_id),
        ("client", inv.client_id),
        ("contractor", inv.contractor_id),
    ]:
        if eid:
            last = AuditLog.objects.filter(entity_type=etype, entity_id=eid).order_by("-created_at").values_list("id", flat=True).first()
            if last:
                audit_ids[f"LastAudit_{etype}"] = str(last)
    data["meta"].update(audit_ids)

    # SHA-384 of all entity data (tamper-evidence)
    import hashlib, json, copy
    entity_snapshot = copy.deepcopy(data["meta"])  # freeze before generate_pdf mutates keywords
    entity_json = json.dumps(entity_snapshot, sort_keys=True, default=str)
    entity_hash = hashlib.sha384(entity_json.encode()).hexdigest()
    data["meta"]["EntitySHA384"] = entity_hash

    if not is_client:
        data["payment_block"] = snap.get("contractor_bank_name") or ""

    pdf_bytes = generate_pdf(data)

    # SHA-384 of the PDF file itself
    pdf_hash = hashlib.sha384(pdf_bytes).hexdigest()

    # Audit log: record frozen entity snapshot + both hashes
    from apps.audit.service import log_audit
    log_audit(
        entity_type="invoice",
        entity_id=inv.id,
        action="PDF_GENERATED",
        title=f"PDF generated for {inv.invoice_number}",
        user=inv.generated_by,
        data_after={
            "invoice_number": inv.invoice_number,
            "entity_sha384": entity_hash,
            "pdf_sha384": pdf_hash,
            "entity_snapshot": entity_snapshot,
        },
    )

    filename = f"{inv.invoice_number}.pdf"
    inv.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)


def _draw_watermark(c, w, h):
    from reportlab.lib.colors import Color
    c.saveState()
    c.setFont(FONT_BOLD, 120)
    c.setFillColor(Color(0.8, 0.1, 0.1, alpha=0.2))
    c.translate(w / 2, h / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "DRAFT")
    c.restoreState()


def generate_manual_invoice_pdf(invoice, watermark_draft=False) -> bytes:
    """Render a manual invoice PDF on-demand from stored data. Returns raw bytes (never persisted)."""
    from apps.control.models import AgencySettings

    inv = invoice
    snap = inv.billing_snapshot or {}

    settings_obj = AgencySettings.load()
    agency_tpl = settings_obj.default_client_invoice_template
    if agency_tpl:
        from_block = agency_tpl.billing_address or agency_tpl.company_name or "TimeHit Agency"
    else:
        from_block = "TimeHit Agency"

    to_lines = []
    if snap.get("client_company_name"):
        to_lines.append(snap["client_company_name"])
    if snap.get("client_billing_address"):
        to_lines.append(snap["client_billing_address"])
    if snap.get("client_country"):
        to_lines.append(snap["client_country"])
    if snap.get("client_vat_number"):
        to_lines.append(f"VAT: {snap['client_vat_number']}")
    if snap.get("client_registration_number"):
        to_lines.append(f"Reg: {snap['client_registration_number']}")
    to_block = "\n".join(to_lines)

    payment_lines = []
    if snap.get("bank_name"):
        payment_lines.append(f"Bank: {snap['bank_name']}")
    if snap.get("bank_account_iban"):
        payment_lines.append(f"IBAN: {snap['bank_account_iban']}")
    if snap.get("bank_swift_bic"):
        payment_lines.append(f"SWIFT: {snap['bank_swift_bic']}")
    payment_block = "\n".join(payment_lines)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setTitle(f"Invoice {inv.invoice_number}")
    c.setAuthor("TimeHit Platform")
    c.setCreator("TimeHit Platform / ReportLab PDF Engine")

    # Header
    c.setFont(FONT_BOLD, 18)
    c.drawString(25 * mm, h - 25 * mm, "INVOICE")
    c.setFont(FONT, 8)
    c.drawString(25 * mm, h - 32 * mm, f"No: {inv.invoice_number}")
    c.drawString(25 * mm, h - 37 * mm, f"Date: {inv.issue_date or ''}")
    c.drawString(25 * mm, h - 42 * mm, f"Due: {inv.due_date or ''}")
    c.setFont(FONT_BOLD, 8)
    c.drawRightString(w - 25 * mm, h - 25 * mm, str(inv.status))
    c.setFont(FONT, 7)
    c.drawRightString(w - 25 * mm, h - 32 * mm, "MANUAL CLIENT INVOICE")

    # From / To
    y = h - 55 * mm
    c.setFont(FONT_BOLD, 9)
    c.drawString(25 * mm, y, "From")
    _draw_multiline(c, 25 * mm, y - 5 * mm, from_block, size=8, line_height=4)

    c.setFont(FONT_BOLD, 9)
    c.drawString(110 * mm, y, "Bill To")
    _draw_multiline(c, 110 * mm, y - 5 * mm, to_block, size=8, line_height=4)

    # Line items table
    y = h - 100 * mm
    c.setFont(FONT_BOLD, 8)
    c.drawString(25 * mm, y, "Description")
    c.drawString(110 * mm, y, "Quantity")
    c.drawString(130 * mm, y, "Unit Price")
    c.drawRightString(w - 25 * mm, y, "Amount")
    c.line(25 * mm, y - 2 * mm, w - 25 * mm, y - 2 * mm)

    currency = inv.currency
    c.setFont(FONT, 8)
    for li in inv.line_items.all():
        y -= 6 * mm
        desc = li.description or ""
        if len(desc) > 60:
            desc = desc[:57] + "..."
        c.drawString(25 * mm, y, desc)
        c.drawString(110 * mm, y, _fmt(li.quantity))
        c.drawString(130 * mm, y, f"{_fmt(li.unit_price)} {currency}")
        c.drawRightString(w - 25 * mm, y, f"{_fmt(li.line_total)} {currency}")

    # Totals
    y -= 10 * mm
    c.line(110 * mm, y + 3 * mm, w - 25 * mm, y + 3 * mm)
    c.setFont(FONT, 8)
    c.drawString(110 * mm, y, "Subtotal")
    c.drawRightString(w - 25 * mm, y, f"{_fmt(inv.subtotal)} {currency}")
    if inv.vat_rate_percent:
        y -= 5 * mm
        c.drawString(110 * mm, y, f"VAT ({inv.vat_rate_percent}%)")
        c.drawRightString(w - 25 * mm, y, f"{_fmt(inv.vat_amount)} {currency}")
    y -= 6 * mm
    c.setFont(FONT_BOLD, 10)
    c.drawString(110 * mm, y, "Total")
    c.drawRightString(w - 25 * mm, y, f"{_fmt(inv.total_amount)} {currency}")

    # Payment details
    if payment_block:
        y -= 15 * mm
        c.setFont(FONT_BOLD, 8)
        c.drawString(25 * mm, y, "Payment Details")
        _draw_multiline(c, 25 * mm, y - 5 * mm, payment_block, font=FONT, size=7, line_height=3.5)

    # Footer
    c.setFont(FONT, 6)
    c.drawString(25 * mm, 15 * mm, f"Invoice {inv.invoice_number} | Generated by TimeHit Platform")

    if watermark_draft:
        _draw_watermark(c, w, h)

    c.save()
    buf.seek(0)
    return buf.read()
