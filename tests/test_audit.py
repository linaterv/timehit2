"""
Audit log tests.
Covers: global list, entity-specific logs, filters, detail view.
"""


class TestAuditLogs:
    def test_global_audit_log_admin(self, admin_api):
        r = admin_api.get("/audit-logs")
        assert r.status_code == 200
        d = r.json()
        assert "data" in d
        assert "meta" in d
        assert d["meta"]["total"] >= 1
        first = d["data"][0]
        assert "entity_type" in first
        assert "action" in first
        assert "title" in first
        assert "created_at" in first

    def test_global_audit_log_forbidden_broker(self, broker1_api):
        r = broker1_api.get("/audit-logs")
        assert r.status_code == 403

    def test_global_audit_log_forbidden_contractor(self, contractor1_api):
        r = contractor1_api.get("/audit-logs")
        assert r.status_code == 403

    def test_filter_by_entity_type(self, admin_api):
        r = admin_api.get("/audit-logs?entity_type=placement")
        assert r.status_code == 200
        for entry in r.json()["data"]:
            assert entry["entity_type"] == "placement"

    def test_filter_by_action(self, admin_api):
        r = admin_api.get("/audit-logs?action=CREATED")
        assert r.status_code == 200
        for entry in r.json()["data"]:
            assert entry["action"] == "CREATED"

    def test_audit_log_detail(self, admin_api):
        r = admin_api.get("/audit-logs")
        if not r.json()["data"]:
            return
        log_id = r.json()["data"][0]["id"]
        r2 = admin_api.get(f"/audit-logs/{log_id}")
        assert r2.status_code == 200
        assert r2.json()["id"] == log_id


class TestEntityAuditLogs:
    def test_placement_audit_log(self, admin_api):
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        r = admin_api.get(f"/placements/{pid}/audit-log")
        assert r.status_code == 200
        assert "data" in r.json()

    def test_timesheet_audit_log(self, admin_api):
        ts = admin_api.get("/timesheets").json()["data"]
        if not ts:
            return
        tid = ts[0]["id"]
        r = admin_api.get(f"/timesheets/{tid}/audit-log")
        assert r.status_code == 200
        assert "data" in r.json()

    def test_invoice_audit_log(self, admin_api):
        invs = admin_api.get("/invoices").json()["data"]
        if not invs:
            return
        iid = invs[0]["id"]
        r = admin_api.get(f"/invoices/{iid}/audit-log")
        assert r.status_code == 200
        assert "data" in r.json()

    def test_client_audit_log(self, admin_api):
        clients = admin_api.get("/clients").json()["data"]
        if not clients:
            return
        cid = clients[0]["id"]
        r = admin_api.get(f"/clients/{cid}/audit-log")
        assert r.status_code == 200
        assert "data" in r.json()

    def test_contractor_audit_log(self, admin_api):
        contrs = admin_api.get("/contractors").json()["data"]
        if not contrs:
            return
        cid = contrs[0]["id"]
        r = admin_api.get(f"/contractors/{cid}/audit-log")
        assert r.status_code == 200
        assert "data" in r.json()
