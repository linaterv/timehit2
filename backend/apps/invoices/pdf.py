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
        "description": f"Consulting — Sample Contractor — {MONTH_NAMES[today.month]} {today.year}",
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
        from_block = snap.get("agency_billing_address") or snap.get("agency_company_name") or "TimeHit Agency"
        to_block = "\n".join(filter(None, [
            snap.get("client_company_name", ""),
            snap.get("client_billing_address", ""),
            f"VAT: {snap['client_vat_number']}" if snap.get("client_vat_number") else "",
        ]))
    else:
        from_block = "\n".join(filter(None, [
            snap.get("contractor_company_name", inv.contractor.full_name),
            str(snap.get("contractor_billing_address", ""))[:60],
            f"VAT: {snap['contractor_vat_number']}" if snap.get("contractor_vat_number") else "",
        ]))
        to_block = "TimeHit Agency"

    data = {
        "invoice_number": inv.invoice_number,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "status": inv.status,
        "invoice_type": "CLIENT INVOICE" if is_client else "CONTRACTOR INVOICE",
        "from_block": from_block,
        "to_block": to_block,
        "description": f"Consulting — {inv.contractor.full_name} — {MONTH_NAMES[inv.month]} {inv.year}",
        "total_hours": inv.total_hours,
        "hourly_rate": inv.hourly_rate,
        "currency": inv.currency,
        "subtotal": inv.subtotal,
        "vat_rate_percent": inv.vat_rate_percent,
        "vat_amount": inv.vat_amount,
        "total_amount": inv.total_amount,
        "footer_text": f"Invoice {inv.invoice_number} | Generated by TimeHit Platform",
    }

    if not is_client:
        data["payment_block"] = "\n".join(filter(None, [
            f"Bank: {snap.get('contractor_bank_name', '')}",
            f"IBAN: {snap.get('contractor_bank_iban', '')}",
            f"SWIFT: {snap.get('contractor_bank_swift', '')}",
        ]))

    pdf_bytes = generate_pdf(data)
    filename = f"{inv.invoice_number}.pdf"
    inv.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)
