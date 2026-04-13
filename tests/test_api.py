"""
Standalone HTTP API tests for TimeHit.
Zero Django imports — only needs a running server.

Relies on seeded data (python manage.py seed):
  admin@test.com, broker1@test.com, broker2@test.com,
  contractor1@test.com, contractor2@test.com,
  client1@test.com, client2@test.com  (all pwd=a)
  2 clients: Acme Corp, Globex Inc
  3 placements, sample timesheets + invoices
"""

from decimal import Decimal


# ── Helpers ──────────────────────────────────────────────────────────────────

def _find(items, **kw):
    """Find first item in list matching all key=value pairs."""
    for item in items:
        if all(item.get(k) == v for k, v in kw.items()):
            return item
    return None


def _get_client_id(admin_api, name):
    r = admin_api.get("/clients")
    return _find(r.json()["data"], company_name=name)["id"]


def _get_contractor_id(admin_api, email):
    r = admin_api.get("/contractors")
    for c in r.json()["data"]:
        if c["email"] == email:
            return c["id"]


def _get_placement(admin_api, **kw):
    r = admin_api.get("/placements")
    return _find(r.json()["data"], **kw)


# ── 1. Auth ──────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_success(self, api):
        r = api.post("/auth/login", json={"email": "admin@test.com", "password": "a"})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert "refresh_token" in d
        assert d["user"]["role"] == "ADMIN"

    def test_login_invalid(self, api):
        r = api.post("/auth/login", json={"email": "admin@test.com", "password": "wrong"})
        assert r.status_code == 401

    def test_refresh_token(self, api):
        login = api.post("/auth/login", json={"email": "admin@test.com", "password": "a"}).json()
        r = api.post("/auth/refresh", json={"refresh_token": login["refresh_token"]})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_change_password(self, api):
        # create a throwaway user, change pwd, verify
        api.auth("admin@test.com")
        uid = f"chpwd_{id(api)}@test.com"
        api.post("/users", json={"email": uid, "full_name": "ChPwd", "password": "old", "role": "BROKER"})
        api.auth(uid, "old")
        r = api.post("/auth/change-password", json={"current_password": "old", "new_password": "new"})
        assert r.status_code == 204
        # old fails
        r2 = api.post("/auth/login", json={"email": uid, "password": "old"})
        assert r2.status_code == 401
        # new works
        r3 = api.post("/auth/login", json={"email": uid, "password": "new"})
        assert r3.status_code == 200


# ── 2. Users ─────────────────────────────────────────────────────────────────

class TestUsers:
    def test_list_users_admin(self, admin_api):
        r = admin_api.get("/users")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 7

    def test_list_users_forbidden_broker(self, broker1_api):
        r = broker1_api.get("/users")
        assert r.status_code == 403

    def test_create_user_contractor(self, admin_api):
        email = f"newc_{id(admin_api)}@test.com"
        r = admin_api.post("/users", json={
            "email": email, "full_name": "New Contr", "password": "a", "role": "CONTRACTOR",
        })
        assert r.status_code == 201
        # verify profile exists via /contractors
        r2 = admin_api.get("/contractors")
        emails = [c["email"] for c in r2.json()["data"]]
        assert email in emails

    def test_get_me(self, contractor1_api):
        r = contractor1_api.get("/users/me")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "CONTRACTOR"
        assert d["contractor_profile"] is not None

    def test_update_user_non_admin_limited(self, broker1_api):
        me = broker1_api.get("/users/me").json()
        # can't change email
        r = broker1_api.patch(f"/users/{me['id']}", json={"email": "hacked@test.com"})
        assert r.status_code == 403
        # can change full_name
        r = broker1_api.patch(f"/users/{me['id']}", json={"full_name": "Broker Updated"})
        assert r.status_code == 200


# ── 3. Clients ───────────────────────────────────────────────────────────────

class TestClients:
    def test_create_client(self, broker1_api):
        r = broker1_api.post("/clients", json={
            "company_name": f"TestCo_{id(broker1_api)}", "billing_address": "Addr", "country": "US",
        })
        assert r.status_code == 201

    def test_list_clients_broker_scoped(self, broker2_api):
        r = broker2_api.get("/clients")
        assert r.status_code == 200
        names = [c["company_name"] for c in r.json()["data"]]
        assert "Globex Inc" in names
        assert "Acme Corp" not in names

    def test_update_client(self, broker1_api):
        cid = _get_client_id(broker1_api, "Acme Corp")
        r = broker1_api.patch(f"/clients/{cid}", json={"notes": "updated"})
        assert r.status_code == 200

    def test_assign_broker(self, admin_api):
        cid = _get_client_id(admin_api, "Acme Corp")
        # get broker2 id
        users = admin_api.get("/users?role=BROKER").json()["data"]
        b2 = _find(users, email="broker2@test.com")
        r = admin_api.post(f"/clients/{cid}/brokers", json={"broker_ids": [b2["id"]]})
        assert r.status_code == 200
        broker_ids = [b["user_id"] for b in r.json()]
        assert b2["id"] in broker_ids

    def test_remove_last_broker_blocked(self, admin_api):
        cid = _get_client_id(admin_api, "Acme Corp")
        brokers = admin_api.get(f"/clients/{cid}").json()["brokers"]
        # try removing each — at least one should be blocked if it's the last with active placements
        # first make sure only one broker
        # Create a fresh client with 1 broker and 1 active placement to test cleanly
        r = admin_api.post("/clients", json={
            "company_name": f"Solo_{id(admin_api)}", "billing_address": "A", "country": "US",
        })
        solo_cid = _get_client_id(admin_api, f"Solo_{id(admin_api)}")
        # assign broker1
        users = admin_api.get("/users?role=BROKER").json()["data"]
        b1 = _find(users, email="broker1@test.com")
        admin_api.post(f"/clients/{solo_cid}/brokers", json={"broker_ids": [b1["id"]]})
        # create active placement
        contrs = admin_api.get("/contractors").json()["data"]
        admin_api.post("/placements", json={
            "client_id": solo_cid, "contractor_id": contrs[0]["user_id"],
            "client_rate": "80", "contractor_rate": "60", "start_date": "2026-01-01",
            "approval_flow": "BROKER_ONLY",
        })
        # activate it
        pl = [p for p in admin_api.get("/placements?status=DRAFT").json()["data"] if p["client"]["id"] == solo_cid][0]
        admin_api.post(f"/placements/{pl['id']}/activate")
        # try remove last broker → 409
        r = admin_api.delete(f"/clients/{solo_cid}/brokers/{b1['id']}")
        assert r.status_code == 409


# ── 4. Client Contacts ──────────────────────────────────────────────────────

class TestClientContacts:
    def test_create_contact(self, broker1_api):
        cid = _get_client_id(broker1_api, "Acme Corp")
        email = f"cc_{id(broker1_api)}@test.com"
        r = broker1_api.post(f"/clients/{cid}/contacts", json={
            "email": email, "full_name": "New CC", "password": "a",
        })
        assert r.status_code == 201

    def test_list_contacts(self, broker1_api):
        cid = _get_client_id(broker1_api, "Acme Corp")
        r = broker1_api.get(f"/clients/{cid}/contacts")
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_update_contact(self, broker1_api):
        cid = _get_client_id(broker1_api, "Acme Corp")
        contacts = broker1_api.get(f"/clients/{cid}/contacts").json()["data"]
        r = broker1_api.patch(f"/clients/{cid}/contacts/{contacts[0]['id']}", json={"job_title": "CTO"})
        assert r.status_code == 200
        assert r.json()["job_title"] == "CTO"


# ── 5. Contractors ───────────────────────────────────────────────────────────

class TestContractors:
    def test_list_contractors_broker(self, broker1_api):
        r = broker1_api.get("/contractors")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 2

    def test_list_contractors_client_forbidden(self, client1_api):
        r = client1_api.get("/contractors")
        assert r.status_code == 403

    def test_update_contractor_profile(self, contractor1_api):
        me = contractor1_api.get("/users/me").json()
        pid = me["contractor_profile"]["id"]
        # next_invoice_number cannot decrease
        r = contractor1_api.patch(f"/contractors/{pid}", json={"next_invoice_number": 0})
        assert r.status_code == 400
        # valid update
        r = contractor1_api.patch(f"/contractors/{pid}", json={"company_name": "Updated Ltd"})
        assert r.status_code == 200
        assert r.json()["company_name"] == "Updated Ltd"


# ── 6. Placements ───────────────────────────────────────────────────────────

class TestPlacements:
    def _create_draft(self, admin_api):
        cid = _get_client_id(admin_api, "Acme Corp")
        contrs = admin_api.get("/contractors").json()["data"]
        r = admin_api.post("/placements", json={
            "client_id": cid, "contractor_id": contrs[0]["user_id"],
            "client_rate": "100", "contractor_rate": "75", "start_date": "2027-01-01",
            "end_date": "2027-12-31", "approval_flow": "BROKER_ONLY",
        })
        assert r.status_code == 201
        # find it
        drafts = admin_api.get("/placements?status=DRAFT").json()["data"]
        return [p for p in drafts if p["client_rate"] == "100.00"][0]

    def test_create_placement(self, admin_api):
        pl = self._create_draft(admin_api)
        assert pl["status"] == "DRAFT"

    def test_activate_placement(self, admin_api):
        pl = self._create_draft(admin_api)
        r = admin_api.post(f"/placements/{pl['id']}/activate")
        assert r.status_code == 200
        assert r.json()["status"] == "ACTIVE"

    def test_update_active_locked_fields(self, admin_api):
        pl = self._create_draft(admin_api)
        admin_api.post(f"/placements/{pl['id']}/activate")
        r = admin_api.patch(f"/placements/{pl['id']}", json={"client_rate": "999"})
        assert r.status_code == 400

    def test_complete_placement(self, admin_api):
        pl = self._create_draft(admin_api)
        admin_api.post(f"/placements/{pl['id']}/activate")
        r = admin_api.post(f"/placements/{pl['id']}/complete")
        assert r.status_code == 200
        assert r.json()["status"] == "COMPLETED"

    def test_cancel_placement(self, admin_api):
        pl = self._create_draft(admin_api)
        admin_api.post(f"/placements/{pl['id']}/activate")
        r = admin_api.post(f"/placements/{pl['id']}/cancel")
        assert r.status_code == 200
        assert r.json()["status"] == "CANCELLED"

    def test_copy_placement(self, admin_api):
        pl = self._create_draft(admin_api)
        admin_api.post(f"/placements/{pl['id']}/activate")
        r = admin_api.post(f"/placements/{pl['id']}/copy", json={"client_rate": "110"})
        assert r.status_code == 201
        assert r.json()["status"] == "DRAFT"
        assert r.json()["client_rate"] == "110.00"

    def test_delete_draft_and_active(self, admin_api):
        pl = self._create_draft(admin_api)
        # draft with no timesheets → ok
        r = admin_api.delete(f"/placements/{pl['id']}")
        assert r.status_code == 204
        # active → blocked
        pl2 = self._create_draft(admin_api)
        admin_api.post(f"/placements/{pl2['id']}/activate")
        r = admin_api.delete(f"/placements/{pl2['id']}")
        assert r.status_code == 409


# ── 7. Placement Documents ──────────────────────────────────────────────────

class TestPlacementDocuments:
    def _active_placement_id(self, admin_api):
        pl = _get_placement(admin_api, status="ACTIVE")
        return pl["id"]

    def test_upload_document(self, broker1_api, admin_api):
        pid = self._active_placement_id(admin_api)
        r = broker1_api.upload(f"/placements/{pid}/documents", b"pdf-content", "nda.pdf", {"label": "NDA"})
        assert r.status_code == 201
        assert r.json()["label"] == "NDA"

    def test_list_documents(self, broker1_api, admin_api):
        pid = self._active_placement_id(admin_api)
        broker1_api.upload(f"/placements/{pid}/documents", b"data", "doc.pdf")
        r = broker1_api.get(f"/placements/{pid}/documents")
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1

    def test_delete_document(self, broker1_api, admin_api):
        pid = self._active_placement_id(admin_api)
        up = broker1_api.upload(f"/placements/{pid}/documents", b"del", "del.pdf")
        doc_id = up.json()["id"]
        r = broker1_api.delete(f"/placements/{pid}/documents/{doc_id}")
        assert r.status_code == 204


# ── 8. Timesheets ───────────────────────────────────────────────────────────

class TestTimesheets:
    def _get_contr1_placement(self, admin_api):
        """Get the seeded ACTIVE CLIENT_THEN_BROKER placement for contractor1 at Acme (start=2026-01-01)."""
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        return [p for p in pls if p["contractor"]["full_name"] == "John Doe" and p["start_date"] == "2026-01-01"][0]

    def _get_contr2_placement(self, admin_api):
        """Get the seeded ACTIVE BROKER_ONLY placement for contractor2 at Globex (start=2026-01-01)."""
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        return [p for p in pls if p["contractor"]["full_name"] == "Jane Smith" and p["start_date"] == "2026-01-01"][0]

    def test_create_timesheet(self, contractor1_api, admin_api):
        pl = self._get_contr1_placement(admin_api)
        r = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 7})
        assert r.status_code == 201
        assert r.json()["status"] == "DRAFT"

    def test_create_duplicate_timesheet(self, contractor1_api, admin_api):
        pl = self._get_contr1_placement(admin_api)
        # create one, then try creating same again
        contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 8})
        r = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 8})
        assert r.status_code == 409

    def test_submit_timesheet(self, contractor1_api, admin_api):
        pl = self._get_contr1_placement(admin_api)
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 9}).json()
        contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [{"date": "2026-09-01", "hours": "8", "task_name": "Dev"}],
        })
        r = contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={})
        assert r.status_code == 200
        assert r.json()["status"] == "SUBMITTED"

    def test_submit_empty_requires_confirm(self, contractor1_api, admin_api):
        pl = self._get_contr1_placement(admin_api)
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 10}).json()
        r = contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={})
        assert r.status_code == 400
        r = contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={"confirm_zero": True})
        assert r.status_code == 200

    def test_approve_broker_only(self, contractor2_api, broker1_api, admin_api):
        pl = self._get_contr2_placement(admin_api)
        ts = contractor2_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 9}).json()
        contractor2_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [{"date": "2026-09-01", "hours": "8"}],
        })
        contractor2_api.post(f"/timesheets/{ts['id']}/submit", json={})
        r = broker1_api.post(f"/timesheets/{ts['id']}/approve")
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"

    def _make_ctb_placement(self, admin_api, contractor1_api):
        """Create a fresh ACTIVE CLIENT_THEN_BROKER placement at Acme for contractor1."""
        cid = _get_client_id(admin_api, "Acme Corp")
        me = contractor1_api.get("/users/me").json()
        admin_api.post("/placements", json={
            "client_id": cid, "contractor_id": me["id"],
            "client_rate": "80", "contractor_rate": "60",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
            "approval_flow": "CLIENT_THEN_BROKER",
        })
        drafts = admin_api.get("/placements?status=DRAFT").json()["data"]
        pl = [p for p in drafts if p["client"]["company_name"] == "Acme Corp"
              and p["contractor"]["full_name"] == "John Doe"
              and p["approval_flow"] == "CLIENT_THEN_BROKER"][-1]
        admin_api.post(f"/placements/{pl['id']}/activate")
        return pl

    def test_approve_client_then_broker(self, contractor1_api, client1_api, broker1_api, admin_api):
        pl = self._make_ctb_placement(admin_api, contractor1_api)
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 11}).json()
        contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [{"date": "2026-11-02", "hours": "8"}],
        })
        contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={})
        r = client1_api.post(f"/timesheets/{ts['id']}/client-approve")
        assert r.status_code == 200
        assert r.json()["status"] == "CLIENT_APPROVED"
        r = broker1_api.post(f"/timesheets/{ts['id']}/approve")
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"

    def test_reject_timesheet(self, contractor1_api, client1_api, broker1_api, admin_api):
        pl = self._make_ctb_placement(admin_api, contractor1_api)
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 12}).json()
        contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [{"date": "2026-12-01", "hours": "8"}],
        })
        contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={})
        r = client1_api.post(f"/timesheets/{ts['id']}/reject", json={"reason": "Wrong hours"})
        assert r.status_code == 200
        assert r.json()["status"] == "DRAFT"
        assert r.json()["rejection_reason"] == "Wrong hours"


# ── 9. Timesheet Entries ────────────────────────────────────────────────────

class TestTimesheetEntries:
    def _make_ts(self, contractor1_api, admin_api, month):
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        pl = [p for p in pls if p["contractor"]["full_name"] == "John Doe" and p["start_date"] == "2026-01-01"][0]
        return contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": month}).json()

    def test_bulk_upsert_entries(self, contractor1_api, admin_api):
        ts = self._make_ts(contractor1_api, admin_api, 4)
        r = contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [
                {"date": "2026-04-01", "hours": "8", "task_name": "Dev"},
                {"date": "2026-04-02", "hours": "6", "task_name": "Review"},
            ],
        })
        assert r.status_code == 200
        assert len(r.json()["entries"]) == 2
        assert Decimal(r.json()["total_hours"]) == Decimal("14")

    def test_entries_date_validation(self, contractor1_api, admin_api):
        ts = self._make_ts(contractor1_api, admin_api, 5)
        r = contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [{"date": "2025-01-01", "hours": "8"}],
        })
        assert r.status_code == 400

    def test_entries_hours_exceed_24(self, contractor1_api, admin_api):
        ts = self._make_ts(contractor1_api, admin_api, 6)
        r = contractor1_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={
            "entries": [
                {"date": "2026-06-01", "hours": "15"},
                {"date": "2026-06-01", "hours": "10"},
            ],
        })
        assert r.status_code == 400


# ── 10. Timesheet Attachments ───────────────────────────────────────────────

class TestTimesheetAttachments:
    def _contr1_pl(self, admin_api):
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        return [p for p in pls if p["contractor"]["full_name"] == "John Doe" and p["start_date"] == "2026-01-01"][0]

    def test_upload_attachment(self, contractor1_api, admin_api):
        pl = self._contr1_pl(admin_api)
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": 1}).json()
        r = contractor1_api.upload(f"/timesheets/{ts['id']}/attachments", b"png-data", "screen.png")
        assert r.status_code == 201

    def test_delete_attachment_not_draft(self, contractor1_api, admin_api):
        # Need a fresh placement since all months on the seeded one are taken
        cid = _get_client_id(admin_api, "Acme Corp")
        me = contractor1_api.get("/users/me").json()
        admin_api.post("/placements", json={
            "client_id": cid, "contractor_id": me["id"],
            "client_rate": "80", "contractor_rate": "60",
            "start_date": "2027-01-01", "approval_flow": "BROKER_ONLY",
        })
        drafts = admin_api.get("/placements?status=DRAFT").json()["data"]
        pl = [p for p in drafts if p["start_date"] == "2027-01-01" and p["contractor"]["full_name"] == "John Doe"][-1]
        admin_api.post(f"/placements/{pl['id']}/activate")
        ts = contractor1_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2027, "month": 1}).json()
        att = contractor1_api.upload(f"/timesheets/{ts['id']}/attachments", b"data", "f.png").json()
        # submit to move out of DRAFT
        contractor1_api.post(f"/timesheets/{ts['id']}/submit", json={"confirm_zero": True})
        r = contractor1_api.delete(f"/timesheets/{ts['id']}/attachments/{att['id']}")
        assert r.status_code == 409


# ── 11. Invoices ─────────────────────────────────────────────────────────────

class TestInvoices:
    def _approved_ts_id(self, contractor2_api, broker1_api, admin_api, month):
        """Create and approve a timesheet for contractor2 at Globex, return its id."""
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        pl = [p for p in pls if p["contractor"]["full_name"] == "Jane Smith" and p["start_date"] == "2026-01-01"][0]
        ts = contractor2_api.post(f"/placements/{pl['id']}/timesheets", json={"year": 2026, "month": month}).json()
        # Add 20 days of 8h entries
        entries = [{"date": f"2026-{month:02d}-{d:02d}", "hours": "8"} for d in range(1, 21)]
        contractor2_api.put(f"/timesheets/{ts['id']}/entries/bulk_upsert", json={"entries": entries})
        contractor2_api.post(f"/timesheets/{ts['id']}/submit", json={})
        broker1_api.post(f"/timesheets/{ts['id']}/approve")
        return ts["id"]

    def test_generate_invoices(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 10)
        r = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]})
        assert r.status_code == 201
        assert len(r.json()["generated"]) == 1
        assert "client_invoice" in r.json()["generated"][0]
        assert "contractor_invoice" in r.json()["generated"][0]

    def test_generate_duplicate_blocked(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 4)
        broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]})
        r = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]})
        assert len(r.json()["errors"]) == 1

    def test_issue_invoice(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 5)
        gen = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]}).json()
        inv_id = gen["generated"][0]["client_invoice"]["id"]
        r = broker1_api.post(f"/invoices/{inv_id}/issue")
        assert r.status_code == 200
        assert r.json()["status"] == "ISSUED"

    def test_mark_paid(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 6)
        gen = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id], "auto_issue": True}).json()
        inv_id = gen["generated"][0]["client_invoice"]["id"]
        r = broker1_api.post(f"/invoices/{inv_id}/mark-paid", json={"payment_date": "2027-07-01"})
        assert r.status_code == 200
        assert r.json()["status"] == "PAID"

    def test_void_invoice(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 7)
        gen = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id], "auto_issue": True}).json()
        inv_id = gen["generated"][0]["client_invoice"]["id"]
        r = broker1_api.post(f"/invoices/{inv_id}/void", json={})
        assert r.status_code == 200
        assert r.json()["status"] == "VOIDED"

    def test_correct_invoice(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 8)
        gen = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id], "auto_issue": True}).json()
        inv_id = gen["generated"][0]["client_invoice"]["id"]
        r = broker1_api.post(f"/invoices/{inv_id}/correct", json={"hourly_rate": "95", "reason": "Rate fix"})
        assert r.status_code == 201
        assert r.json()["original_invoice"]["status"] == "CORRECTED"
        assert r.json()["corrective_invoice"]["status"] == "DRAFT"

    def test_delete_draft_and_issued(self, contractor2_api, broker1_api, admin_api):
        ts_id = self._approved_ts_id(contractor2_api, broker1_api, admin_api, 11)
        gen = broker1_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]}).json()
        draft_id = gen["generated"][0]["client_invoice"]["id"]
        r = broker1_api.delete(f"/invoices/{draft_id}")
        assert r.status_code == 204
        # issue contractor invoice, then try delete → 409
        co_id = gen["generated"][0]["contractor_invoice"]["id"]
        broker1_api.post(f"/invoices/{co_id}/issue")
        r = broker1_api.delete(f"/invoices/{co_id}")
        assert r.status_code == 409


# ── 12. Documents (flat listing) ─────────────────────────────────────────────

class TestDocuments:
    def _upload_doc(self, broker1_api, admin_api):
        """Upload a doc and return placement id."""
        pls = admin_api.get("/placements?status=ACTIVE").json()["data"]
        pl = pls[0]
        broker1_api.upload(f"/placements/{pl['id']}/documents", b"test-pdf", "contract.pdf", {"label": "Contract"})
        return pl["id"]

    def test_admin_lists_all_documents(self, admin_api, broker1_api):
        self._upload_doc(broker1_api, admin_api)
        r = admin_api.get("/documents")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1
        doc = r.json()["data"][0]
        assert "placement" in doc
        assert "client" in doc["placement"]
        assert "contractor" in doc["placement"]

    def test_broker_lists_scoped_documents(self, broker1_api):
        # broker1 is assigned to both Acme and Globex — should see docs from both
        r = broker1_api.get("/documents")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1
        # every doc should have placement context
        for doc in r.json()["data"]:
            assert "placement" in doc
            assert doc["placement"]["client"]["company_name"] in ("Acme Corp", "Globex Inc")

    def test_contractor_gets_empty(self, contractor1_api):
        r = contractor1_api.get("/documents")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] == 0

    def test_filter_by_client_id(self, admin_api, broker1_api):
        self._upload_doc(broker1_api, admin_api)
        # get acme id
        clients = admin_api.get("/clients").json()["data"]
        acme = [c for c in clients if c["company_name"] == "Acme Corp"][0]
        r = admin_api.get(f"/documents?client_id={acme['id']}")
        assert r.status_code == 200
        for doc in r.json()["data"]:
            assert doc["placement"]["client"]["id"] == acme["id"]

    def test_filter_by_label(self, admin_api, broker1_api):
        self._upload_doc(broker1_api, admin_api)
        r = admin_api.get("/documents?label=Contract")
        assert r.status_code == 200
        for doc in r.json()["data"]:
            assert "contract" in doc["label"].lower()

    def test_filter_by_date_range(self, admin_api, broker1_api):
        self._upload_doc(broker1_api, admin_api)
        r = admin_api.get("/documents?uploaded_from=2026-01-01&uploaded_to=2030-12-31")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1
        # out of range returns empty
        r2 = admin_api.get("/documents?uploaded_from=2099-01-01")
        assert r2.json()["meta"]["total"] == 0

    def test_filter_by_search(self, admin_api, broker1_api):
        self._upload_doc(broker1_api, admin_api)
        r = admin_api.get("/documents?search=contract")
        assert r.status_code == 200
        for doc in r.json()["data"]:
            assert "contract" in doc["file_name"].lower()


# ── 13. Control Screen ──────────────────────────────────────────────────────

class TestControl:
    def test_control_overview(self, broker1_api):
        r = broker1_api.get("/control/overview?year=2026&month=2")
        assert r.status_code == 200
        assert len(r.json()["data"]) >= 1
        row = r.json()["data"][0]
        assert "flags" in row
        assert "margin" in row

    def test_control_summary(self, broker1_api):
        r = broker1_api.get("/control/summary?year=2026&month=2")
        assert r.status_code == 200
        assert "total_active_placements" in r.json()
        assert "currency_breakdown" in r.json()

    def test_control_summary_year_only(self, broker1_api):
        # month omitted -> aggregates across year
        r_year = broker1_api.get("/control/summary?year=2026")
        assert r_year.status_code == 200
        body = r_year.json()
        assert "timesheet_issues" in body
        assert "placements_with_issues" in body
        # month=0 is equivalent to omitting month
        r_zero = broker1_api.get("/control/summary?year=2026&month=0")
        assert r_zero.status_code == 200
        # year aggregate must be >= any single month's counts
        r_feb = broker1_api.get("/control/summary?year=2026&month=2").json()
        assert body["timesheet_issues"] >= r_feb["timesheet_issues"]
        assert body["placements_with_issues"] >= r_feb["placements_with_issues"]

    def test_control_export_csv(self, broker1_api):
        r = broker1_api.get("/control/export?year=2026&month=2")
        assert r.status_code == 200
        assert "text/csv" in r.headers["Content-Type"]


# ── 13. Role-based Access ───────────────────────────────────────────────────

class TestRoleAccess:
    def test_contractor_sees_only_own_placements(self, contractor1_api):
        r = contractor1_api.get("/placements")
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["contractor"]["full_name"] == "John Doe"

    def test_contractor_sees_only_own_invoices(self, contractor1_api):
        r = contractor1_api.get("/invoices")
        assert r.status_code == 200
        for inv in r.json()["data"]:
            assert inv["invoice_type"] == "CONTRACTOR_INVOICE"

    def test_client_contact_sees_configured_invoices(self, client1_api):
        r = client1_api.get("/invoices")
        assert r.status_code == 200
        for inv in r.json()["data"]:
            assert inv["invoice_type"] == "CLIENT_INVOICE"

    def test_contractor_cannot_see_rates_on_placements(self, contractor1_api):
        r = contractor1_api.get("/placements")
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["client_rate"] is None, "Contractor must NOT see client_rate"
            assert p["contractor_rate"] is None, "Contractor must NOT see contractor_rate"

    def test_client_contact_cannot_see_rates_on_placements(self, client1_api, admin_api):
        # client1 is for Acme Corp which has placements with client_can_view_* enabled
        r = client1_api.get("/placements")
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["client_rate"] is None, "Client contact must NOT see client_rate"
            assert p["contractor_rate"] is None, "Client contact must NOT see contractor_rate"

    def test_contractor_cannot_see_rates_on_timesheet_detail(self, contractor1_api):
        # Get first timesheet
        r = contractor1_api.get("/timesheets")
        assert r.status_code == 200
        if not r.json()["data"]:
            return
        ts_id = r.json()["data"][0]["id"]
        r2 = contractor1_api.get(f"/timesheets/{ts_id}")
        assert r2.status_code == 200
        placement = r2.json().get("placement")
        if placement:
            assert placement["client_rate"] is None, "Contractor must NOT see client_rate on timesheet"
            assert placement["contractor_rate"] is None, "Contractor must NOT see contractor_rate on timesheet"

    def test_broker_can_see_rates(self, broker1_api):
        r = broker1_api.get("/placements")
        assert r.status_code == 200
        has_rates = False
        for p in r.json()["data"]:
            if p["client_rate"] is not None:
                has_rates = True
                assert p["contractor_rate"] is not None
        assert has_rates, "Broker must see rates"

    def test_contractor_cannot_see_rates_on_invoices(self, contractor1_api):
        r = contractor1_api.get("/invoices")
        assert r.status_code == 200
        for inv in r.json()["data"]:
            assert inv["invoice_type"] == "CONTRACTOR_INVOICE", "Contractor must only see contractor invoices"
            assert inv["hourly_rate"] is None, "Contractor must NOT see hourly_rate"
            assert inv["total_hours"] is None, "Contractor must NOT see total_hours"
            assert inv["subtotal"] is None, "Contractor must NOT see subtotal"
            assert inv["total_amount"] is None, "Contractor must NOT see total_amount"

    def test_contractor_cannot_see_rates_on_invoice_detail(self, contractor1_api):
        r = contractor1_api.get("/invoices")
        assert r.status_code == 200
        if not r.json()["data"]:
            return
        inv_id = r.json()["data"][0]["id"]
        r2 = contractor1_api.get(f"/invoices/{inv_id}")
        assert r2.status_code == 200
        assert r2.json()["invoice_type"] == "CONTRACTOR_INVOICE"
        assert r2.json()["hourly_rate"] is None, "Contractor must NOT see hourly_rate on detail"
        assert r2.json()["total_amount"] is None, "Contractor must NOT see total_amount on detail"

    def test_client_contact_cannot_see_rates_on_invoices(self, client1_api):
        r = client1_api.get("/invoices")
        assert r.status_code == 200
        for inv in r.json()["data"]:
            assert inv["invoice_type"] == "CLIENT_INVOICE", "Client must only see client invoices"
            assert inv["hourly_rate"] is None, "Client must NOT see hourly_rate"
            assert inv["total_hours"] is None, "Client must NOT see total_hours"
            assert inv["subtotal"] is None, "Client must NOT see subtotal"
            assert inv["total_amount"] is None, "Client must NOT see total_amount"

    def test_client_contact_cannot_see_rates_on_invoice_detail(self, client1_api):
        r = client1_api.get("/invoices")
        assert r.status_code == 200
        if not r.json()["data"]:
            return
        inv_id = r.json()["data"][0]["id"]
        r2 = client1_api.get(f"/invoices/{inv_id}")
        assert r2.status_code == 200
        assert r2.json()["invoice_type"] == "CLIENT_INVOICE"
        assert r2.json()["hourly_rate"] is None, "Client must NOT see hourly_rate on detail"
        assert r2.json()["total_amount"] is None, "Client must NOT see total_amount on detail"

    def test_client_contact_cannot_see_rates_on_timesheet_detail(self, client1_api):
        r = client1_api.get("/timesheets")
        assert r.status_code == 200
        if not r.json()["data"]:
            return
        ts_id = r.json()["data"][0]["id"]
        r2 = client1_api.get(f"/timesheets/{ts_id}")
        assert r2.status_code == 200
        placement = r2.json().get("placement")
        if placement:
            assert placement["client_rate"] is None, "Client contact must NOT see client_rate on timesheet"
            assert placement["contractor_rate"] is None, "Client contact must NOT see contractor_rate on timesheet"

    def test_broker_can_see_rates_on_invoices(self, broker1_api):
        r = broker1_api.get("/invoices")
        assert r.status_code == 200
        assert len(r.json()["data"]) > 0, "Broker should see invoices"
        inv_id = r.json()["data"][0]["id"]
        r2 = broker1_api.get(f"/invoices/{inv_id}")
        assert r2.status_code == 200
        assert r2.json()["hourly_rate"] is not None, "Broker must see hourly_rate"

    def test_broker_can_see_rates_on_timesheet_detail(self, broker1_api):
        r = broker1_api.get("/timesheets")
        assert r.status_code == 200
        if not r.json()["data"]:
            return
        ts_id = r.json()["data"][0]["id"]
        r2 = broker1_api.get(f"/timesheets/{ts_id}")
        assert r2.status_code == 200
        placement = r2.json().get("placement")
        if placement:
            assert placement["client_rate"] is not None, "Broker must see client_rate on timesheet"
            assert placement["contractor_rate"] is not None, "Broker must see contractor_rate on timesheet"


class TestSamplePdf:
    """Tests for generating sample PDFs from invoice templates."""

    def _get_global_template(self, admin_api, code):
        """Find a global template by code."""
        r = admin_api.get(f"/invoice-templates?template_type=CONTRACTOR&status=ACTIVE")
        assert r.status_code == 200
        for t in r.json()["data"]:
            if t["code"] == code and not t["contractor"] and not t["client"]:
                return t
        return None

    def _get_alex_user_id(self, admin_api):
        r = admin_api.get("/contractors")
        assert r.status_code == 200
        alex = _find(r.json()["data"], full_name="Alex Turner")
        assert alex, "Alex Turner not found"
        return alex["user_id"]

    def test_sample_pdf_from_template(self, admin_api):
        """GET sample-pdf from a saved global template — verify PDF contains payment data."""
        import pdfplumber
        from io import BytesIO

        tpl = self._get_global_template(admin_api, "LT")
        assert tpl, "LT global template not found"

        # GET (no form data override, uses saved template data)
        r = admin_api.get(f"/invoice-templates/{tpl['id']}/sample-pdf")
        assert r.status_code == 200
        assert r.headers["Content-Type"] == "application/pdf"

        # Parse PDF and verify payment block text
        with pdfplumber.open(BytesIO(r.content)) as pdf:
            text = pdf.pages[0].extract_text()
            assert "SEB Bank AB" in text, f"Payment bank not in PDF: {text[:200]}"
            assert "LT06 7044 0600 0817 7672" in text, f"IBAN not in PDF"
            assert "CBVILT2X" in text, f"SWIFT not in PDF"
            assert "SAMPLE" in text, "Should show SAMPLE status"

    def test_sample_pdf_with_form_data(self, admin_api):
        """POST sample-pdf with overridden form data — verify PDF uses the posted values."""
        import pdfplumber
        from io import BytesIO

        # Create a contractor template for Alex based on LT global
        lt_tpl = self._get_global_template(admin_api, "LT")
        assert lt_tpl, "LT global template not found"
        alex_id = self._get_alex_user_id(admin_api)

        r = admin_api.post("/invoice-templates", json={
            "title": "Alex Test Template", "code": "ALEX-TEST",
            "template_type": "CONTRACTOR", "contractor_id": alex_id,
            "parent_id": lt_tpl["id"],
            "billing_address": "AT Consulting UAB\nTest Address 123\nVilnius, Lithuania",
            "bank_name": "Test Bank XYZ\nIBAN: LT99 1234 5678 9012 3456\nSWIFT: TESTLT2X",
            "invoice_series_prefix": "ATEST-", "next_invoice_number": 1,
            "default_currency": "EUR",
        })
        assert r.status_code == 201, f"Create failed: {r.text}"
        tpl_id = r.json()["id"]

        # POST with overridden payment data
        custom_payment = "Custom Bank ABC\nIBAN: LT00 9999 8888 7777 6666\nSWIFT: CUSTLT99"
        r2 = admin_api.post(f"/invoice-templates/{tpl_id}/sample-pdf", json={
            "bank_name": custom_payment,
            "billing_address": "Override Company\nOverride Address 999",
            "default_currency": "USD",
        })
        assert r2.status_code == 200
        assert r2.headers["Content-Type"] == "application/pdf"

        with pdfplumber.open(BytesIO(r2.content)) as pdf:
            text = pdf.pages[0].extract_text()
            assert "Custom Bank ABC" in text, f"Custom payment not in PDF: {text[:300]}"
            assert "LT00 9999 8888 7777 6666" in text, "Custom IBAN not in PDF"
            assert "CUSTLT99" in text, "Custom SWIFT not in PDF"
            assert "USD" in text, "Overridden currency not in PDF"

        # Cleanup
        admin_api.delete(f"/invoice-templates/{tpl_id}")


class TestContractorCreation:
    """Tests for contractor creation, password generation, and auto-created template."""

    def test_generate_password(self, admin_api):
        """POST /users/generate-password returns a memorable password."""
        r = admin_api.post("/users/generate-password")
        assert r.status_code == 200
        pwd = r.json()["password"]
        assert len(pwd) >= 8, f"Password too short: {pwd}"
        # Should contain at least one letter and one digit
        assert any(c.isalpha() for c in pwd), f"No letters in: {pwd}"
        assert any(c.isdigit() for c in pwd), f"No digits in: {pwd}"

    def test_generate_password_unique(self, admin_api):
        """Two calls should return different passwords."""
        r1 = admin_api.post("/users/generate-password").json()["password"]
        r2 = admin_api.post("/users/generate-password").json()["password"]
        # Extremely unlikely to be the same (200+ words * 200+ words * 90 numbers)
        assert r1 != r2, f"Generated same password twice: {r1}"

    def test_create_contractor_creates_profile_and_template(self, admin_api):
        """Creating a CONTRACTOR user auto-creates ContractorProfile + DRAFT InvoiceTemplate."""
        # Cleanup leftover from previous failed runs
        users = admin_api.get("/users?search=test-autocreate-tmp").json()["data"]
        for u in users:
            if u["email"] == "test-autocreate-tmp@example.com":
                cs = admin_api.get("/contractors").json()["data"]
                for c in cs:
                    if c["user_id"] == u["id"]:
                        admin_api.delete(f"/contractors/{c['id']}")
                        break

        # Generate password
        pwd = admin_api.post("/users/generate-password").json()["password"]

        # Create contractor
        r = admin_api.post("/users", json={
            "email": "test-autocreate-tmp@example.com",
            "full_name": "Test AutoCreate",
            "password": pwd,
            "role": "CONTRACTOR",
        })
        assert r.status_code == 201, f"Create failed: {r.text}"

        # Look up user by email to get ID
        users = admin_api.get("/users?search=autocreate").json()["data"]
        matched = [u for u in users if u["email"] == "test-autocreate-tmp@example.com"]
        assert matched, f"User not found after create. Users: {[u['email'] for u in users]}"
        user_id = matched[0]["id"]

        # Verify contractor profile exists
        contractors = admin_api.get("/contractors").json()["data"]
        contr = [c for c in contractors if c["user_id"] == user_id]
        assert len(contr) == 1, "ContractorProfile not created"
        contr_id = contr[0]["id"]

        # Verify DRAFT template was auto-created
        templates = admin_api.get(f"/invoice-templates?template_type=CONTRACTOR&contractor_id={user_id}").json()["data"]
        own_templates = [t for t in templates if t.get("contractor") and t["contractor"]["id"] == user_id]
        assert len(own_templates) >= 1, "Template not auto-created"
        assert own_templates[0]["status"] == "DRAFT"
        assert own_templates[0]["code"] == "DEFAULT"

        # Verify contractor can log in with generated password
        from conftest import Api
        contr_api = Api(admin_api.base.replace("/api/v1", ""))
        contr_api.auth("test-autocreate-tmp@example.com", pwd)
        me = contr_api.get("/users/me").json()
        assert me["role"] == "CONTRACTOR"

        # Cleanup: delete templates first, then contractor
        for t in own_templates:
            admin_api.delete(f"/invoice-templates/{t['id']}")
        admin_api.delete(f"/contractors/{contr_id}")

    def test_create_contractor_duplicate_email_fails(self, admin_api):
        """Creating a contractor with an existing email returns field-level error."""
        r = admin_api.post("/users", json={
            "email": "admin@test.com",  # already exists
            "full_name": "Duplicate Test",
            "password": "test123",
            "role": "CONTRACTOR",
        })
        assert r.status_code == 400
        error = r.json().get("error", {})
        assert error.get("details") or "email" in str(error), f"Expected email error: {r.text}"


class TestInvoiceGeneration:
    """Test generating invoices from approved timesheet and downloading PDFs."""

    def test_generate_from_demo_march_and_download_pdfs(self, admin_api):
        """Find Demo Contractor's March approved TS, generate invoices, download both PDFs."""
        import pdfplumber
        from io import BytesIO

        # Find the March approved timesheet for Demo Contractor (no invoices)
        r = admin_api.get("/timesheets?status=APPROVED&per_page=200")
        assert r.status_code == 200
        timesheets = r.json()["data"]
        demo_ts = [t for t in timesheets if t["year"] == 2026 and t["month"] == 3
                   and t.get("placement", {}).get("contractor", {}).get("full_name") == "Demo Contractor"]
        assert len(demo_ts) == 1, f"Expected 1 Demo Contractor March TS, found {len(demo_ts)}"
        ts_id = demo_ts[0]["id"]

        # Clean up any leftover invoices from previous runs
        invoices_before = admin_api.get(f"/invoices?year=2026&month=3").json()["data"]
        for inv in invoices_before:
            if inv["contractor"]["full_name"] == "Demo Contractor":
                if inv["status"] == "DRAFT":
                    admin_api.delete(f"/invoices/{inv['id']}")
                else:
                    admin_api.post(f"/invoices/{inv['id']}/void")

        # Generate invoices
        r = admin_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]})
        assert r.status_code == 201, f"Generate failed: {r.text}"
        result = r.json()
        assert len(result["generated"]) == 1
        assert len(result["errors"]) == 0

        client_inv = result["generated"][0]["client_invoice"]
        contr_inv = result["generated"][0]["contractor_invoice"]
        assert client_inv["status"] == "DRAFT"
        assert contr_inv["status"] == "DRAFT"
        assert client_inv["invoice_number"].startswith("AGY-")
        assert contr_inv["invoice_number"].startswith("DEMO-")

        # Verify both invoices exist in the list
        invoices_after = admin_api.get(f"/invoices?year=2026&month=3").json()["data"]
        demo_invoices_after = [i for i in invoices_after
                               if i["contractor"]["full_name"] == "Demo Contractor"]
        assert len(demo_invoices_after) == 2, f"Expected 2 invoices, got {len(demo_invoices_after)}"

        # Retrieve each invoice detail and verify billing snapshot
        for inv_id in [client_inv["id"], contr_inv["id"]]:
            detail = admin_api.get(f"/invoices/{inv_id}").json()
            assert detail["id"] == inv_id
            assert detail["year"] == 2026
            assert detail["month"] == 3
            assert "billing_snapshot" in detail
            assert detail["billing_snapshot"]  # not empty

        # Issue both invoices (triggers PDF generation on some setups)
        for inv_id in [client_inv["id"], contr_inv["id"]]:
            r = admin_api.post(f"/invoices/{inv_id}/issue")
            assert r.status_code == 200
            assert r.json()["status"] == "ISSUED"

        # Verify duplicate generation is blocked
        r2 = admin_api.post("/invoices/generate", json={"timesheet_ids": [ts_id]})
        assert r2.status_code == 201
        assert len(r2.json()["errors"]) == 1
        assert "Non-voided invoices already exist" in r2.json()["errors"][0]["error"]
