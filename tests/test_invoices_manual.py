"""
Manual invoice tests — POST /invoices/manual, PATCH /invoices/:id, issue+PDF, permissions, control counters.
Covers the full business logic specified in functional-spec §2.11a, §4.3a and timehit-api §13.
"""
import uuid


def _find_client(admin_api, name):
    r = admin_api.get("/clients")
    for c in r.json()["data"]:
        if c["company_name"] == name:
            return c["id"]
    return None


def _num(tag):
    """Unique invoice number per test run."""
    return f"MI-{tag}-{uuid.uuid4().hex[:8]}"


def _payload(**over):
    base = {
        "invoice_number": _num("BASE"),
        "issue_date": "2026-04-14",
        "due_date": "2026-05-14",
        "currency": "EUR",
        "vat_rate_percent": "21.00",
        "bill_to": {
            "company_name": "Acme Corp",
            "billing_address": "Street 1\nBerlin",
            "country": "DE",
            "vat_number": "DE123",
        },
        "bank": {"bank_name": "SEB", "bank_account_iban": "LT001", "bank_swift_bic": "CBVILT2X"},
        "line_items": [
            {"description": "Permanent placement fee", "quantity": "1", "unit_price": "8000.00"},
            {"description": "Onboarding support", "quantity": "2", "unit_price": "500.00"},
        ],
    }
    base.update(over)
    return base


class TestManualInvoiceCreate:
    def test_admin_create_without_client(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("NOCL")))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["is_manual"] is True
        assert body["status"] == "DRAFT"
        assert body["client"] is None
        assert body["contractor"] is None
        assert body["placement_id"] is None
        assert body["year"] is None
        assert body["month"] is None
        assert body["hourly_rate"] is None
        assert body["total_hours"] is None
        assert body["subtotal"] == "9000.00"
        assert body["vat_rate_percent"] == "21.00"
        assert body["vat_amount"] == "1890.00"
        assert body["total_amount"] == "10890.00"
        assert len(body["line_items"]) == 2
        assert body["line_items"][0]["line_total"] == "8000.00"
        assert body["line_items"][1]["line_total"] == "1000.00"
        assert body["billing_snapshot"]["client_company_name"] == "Acme Corp"
        assert body["billing_snapshot"]["bank_name"] == "SEB"

    def test_admin_create_with_client(self, admin_api):
        cid = _find_client(admin_api, "Acme Corp")
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("CL"), client_id=cid))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["client"]["id"] == cid
        assert body["billing_snapshot"]["client_company_name"]

    def test_admin_create_no_vat(self, admin_api):
        p = _payload(invoice_number=_num("NOVAT"))
        p["vat_rate_percent"] = None
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 201
        body = r.json()
        assert body["vat_rate_percent"] is None
        assert body["vat_amount"] is None
        assert body["total_amount"] == body["subtotal"]

    def test_empty_line_items_400(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("EMPTY"), line_items=[]))
        assert r.status_code == 400
        assert "line_items" in r.text.lower() or "validation" in r.text.lower()

    def test_missing_line_items_400(self, admin_api):
        p = _payload(invoice_number=_num("NOLI"))
        del p["line_items"]
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 400

    def test_duplicate_invoice_number_409(self, admin_api):
        num = _num("DUP")
        r1 = admin_api.post("/invoices/manual", json=_payload(invoice_number=num))
        assert r1.status_code == 201
        r2 = admin_api.post("/invoices/manual", json=_payload(invoice_number=num))
        assert r2.status_code == 409
        assert "already exists" in r2.text

    def test_payment_terms_computes_due_date(self, admin_api):
        p = _payload(invoice_number=_num("TERMS"))
        del p["due_date"]
        p["payment_terms_days"] = 14
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 201
        body = r.json()
        assert body["due_date"] == "2026-04-28"
        assert body["payment_terms_days"] == 14

    def test_zero_quantity_400(self, admin_api):
        p = _payload(invoice_number=_num("ZERO"))
        p["line_items"] = [{"description": "x", "quantity": "0", "unit_price": "100"}]
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 400

    def test_zero_price_400(self, admin_api):
        p = _payload(invoice_number=_num("ZP"))
        p["line_items"] = [{"description": "x", "quantity": "1", "unit_price": "0"}]
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 400

    def test_bill_to_required_when_no_client(self, admin_api):
        p = _payload(invoice_number=_num("NBTO"))
        del p["bill_to"]
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 400
        assert "bill_to" in r.text.lower()

    def test_bill_to_empty_company_when_no_client_400(self, admin_api):
        p = _payload(invoice_number=_num("NBT2"))
        p["bill_to"] = {"billing_address": "Somewhere"}  # no company_name
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 400

    def test_bill_to_override_with_client(self, admin_api):
        # bill_to present + client_id set → bill_to takes precedence in snapshot
        cid = _find_client(admin_api, "Acme Corp")
        p = _payload(invoice_number=_num("BTOV"), client_id=cid)
        p["bill_to"] = {"company_name": "OVERRIDE NAME", "billing_address": "Override Addr", "country": "XX", "vat_number": "XX999"}
        r = admin_api.post("/invoices/manual", json=p)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["billing_snapshot"]["client_company_name"] == "OVERRIDE NAME"
        assert body["billing_snapshot"]["client_country"] == "XX"


class TestManualInvoicePermissions:
    def test_broker_create_no_client_ok(self, broker1_api):
        r = broker1_api.post("/invoices/manual", json=_payload(invoice_number=_num("BR-NC")))
        assert r.status_code == 201, r.text

    def test_broker_create_with_assigned_client_ok(self, broker1_api):
        cid = _find_client(broker1_api, "Acme Corp")
        assert cid is not None
        r = broker1_api.post("/invoices/manual", json=_payload(invoice_number=_num("BR-AC"), client_id=cid))
        assert r.status_code == 201, r.text

    def test_broker_create_unassigned_client_403(self, base_url, admin_api):
        # peter@timehit.com is assigned to CloudBase only — Acme Corp is out of scope for him
        from conftest import Api
        peter = Api(base_url)
        peter.auth("peter@timehit.com")
        acme_id = _find_client(admin_api, "Acme Corp")
        r = peter.post("/invoices/manual", json=_payload(invoice_number=_num("BR-UN"), client_id=acme_id))
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_contractor_forbidden(self, contractor1_api):
        r = contractor1_api.post("/invoices/manual", json=_payload(invoice_number=_num("CNTR")))
        assert r.status_code == 403

    def test_client_contact_forbidden(self, client1_api):
        r = client1_api.post("/invoices/manual", json=_payload(invoice_number=_num("CC")))
        assert r.status_code == 403


class TestManualInvoicePatch:
    def test_patch_draft_ok(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("PCH")))
        assert r.status_code == 201
        iid = r.json()["id"]
        new_num = _num("PCH-NEW")
        r2 = admin_api.patch(f"/invoices/{iid}", json={"invoice_number": new_num, "currency": "USD"})
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["invoice_number"] == new_num
        assert body["currency"] == "USD"

    def test_patch_replaces_line_items(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("RLI")))
        iid = r.json()["id"]
        new_items = [{"description": "Just one thing", "quantity": "3", "unit_price": "1000"}]
        r2 = admin_api.patch(f"/invoices/{iid}", json={"line_items": new_items})
        assert r2.status_code == 200
        body = r2.json()
        assert len(body["line_items"]) == 1
        assert body["line_items"][0]["line_total"] == "3000.00"
        assert body["subtotal"] == "3000.00"

    def test_patch_issued_409(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("IS-PCH")))
        iid = r.json()["id"]
        admin_api.post(f"/invoices/{iid}/issue")
        r2 = admin_api.patch(f"/invoices/{iid}", json={"invoice_number": _num("IS-PCH-X")})
        assert r2.status_code == 409

    def test_patch_auto_invoice_409(self, admin_api):
        # find a non-manual (auto) invoice
        r = admin_api.get("/invoices?is_manual=false")
        data = r.json()["data"]
        if not data:
            return
        iid = data[0]["id"]
        r2 = admin_api.patch(f"/invoices/{iid}", json={"invoice_number": _num("SHOULD-REJ")})
        assert r2.status_code == 409

    def test_patch_duplicate_number_409(self, admin_api):
        num_a = _num("PCHDUP-A")
        num_b = _num("PCHDUP-B")
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=num_a))
        assert r.status_code == 201
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=num_b))
        assert r.status_code == 201
        iid_b = r.json()["id"]
        r2 = admin_api.patch(f"/invoices/{iid_b}", json={"invoice_number": num_a})
        assert r2.status_code == 409


class TestManualInvoiceIssueAndPDF:
    def test_issue_manual_no_pdf_file(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("ISS")))
        iid = r.json()["id"]
        r2 = admin_api.post(f"/invoices/{iid}/issue")
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["status"] == "ISSUED"

    def test_pdf_draft_watermarked(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("PDF-D")))
        iid = r.json()["id"]
        import requests
        resp = requests.get(f"{admin_api.base}/invoices/{iid}/pdf", headers=admin_api._headers())
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/pdf"
        assert len(resp.content) > 1000
        # DRAFT PDF uses an ExtGState for watermark alpha — a detail absent from clean PDFs
        assert b"gRLs0" in resp.content or b"ExtGState" in resp.content

    def test_pdf_issued_clean(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("PDF-I")))
        iid = r.json()["id"]
        admin_api.post(f"/invoices/{iid}/issue")
        import requests
        resp = requests.get(f"{admin_api.base}/invoices/{iid}/pdf", headers=admin_api._headers())
        assert resp.status_code == 200
        assert resp.headers.get("content-type") == "application/pdf"
        assert len(resp.content) > 1000
        # Clean (no watermark): ExtGState not present
        # (reportlab only emits gRLs0 when we use the alpha watermark)
        assert b"gRLs0" not in resp.content


class TestManualInvoiceListFilters:
    def test_is_manual_filter(self, admin_api):
        admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("FLT")))
        r = admin_api.get("/invoices?is_manual=true")
        assert r.status_code == 200
        data = r.json()["data"]
        assert len(data) >= 1
        assert all(x["is_manual"] is True for x in data)

    def test_is_manual_false_filter(self, admin_api):
        r = admin_api.get("/invoices?is_manual=false")
        assert r.status_code == 200
        data = r.json()["data"]
        assert all(x["is_manual"] is False for x in data)

    def test_candidate_id_filter(self, admin_api):
        cand = str(uuid.uuid4())
        admin_api.post("/invoices/manual", json=_payload(invoice_number=_num(f"CAND"), candidate_id=cand))
        r = admin_api.get(f"/invoices?candidate_id={cand}")
        assert r.status_code == 200
        data = r.json()["data"]
        assert len(data) == 1
        assert data[0]["candidate_id"] == cand


class TestManualInvoiceDelete:
    def test_delete_draft_manual_ok(self, admin_api):
        r = admin_api.post("/invoices/manual", json=_payload(invoice_number=_num("DEL")))
        iid = r.json()["id"]
        r2 = admin_api.delete(f"/invoices/{iid}")
        assert r2.status_code == 204
        r3 = admin_api.get(f"/invoices/{iid}")
        assert r3.status_code == 404


class TestManualInvoiceControlCounters:
    def test_overdue_manual_counted_in_summary(self, admin_api):
        from datetime import date, timedelta
        past = date.today() - timedelta(days=60)
        due = date.today() - timedelta(days=30)
        r = admin_api.post("/invoices/manual", json=_payload(
            invoice_number=_num("OVERDUE"),
            issue_date=str(past),
            due_date=str(due),
        ))
        assert r.status_code == 201, r.text
        iid = r.json()["id"]
        r2 = admin_api.post(f"/invoices/{iid}/issue")
        assert r2.status_code == 200
        summary = admin_api.get(f"/control/summary?year={past.year}&month={past.month}")
        assert summary.status_code == 200
        assert summary.json()["invoices_awaiting_payment"] >= 1

    def test_csv_export_includes_manual(self, admin_api):
        from datetime import date
        r = admin_api.post("/invoices/manual", json=_payload(
            invoice_number=_num("CSV"),
            issue_date=str(date.today()),
        ))
        iid = r.json()["id"]
        admin_api.post(f"/invoices/{iid}/issue")
        import requests
        y, m = date.today().year, date.today().month
        resp = requests.get(f"{admin_api.base}/control/export?year={y}&month={m}", headers=admin_api._headers())
        assert resp.status_code == 200
        assert "manual" in resp.text
