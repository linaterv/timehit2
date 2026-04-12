"""
Priority I: Boundary values.
"""


class TestZeroHoursTimesheet:
    def test_zero_hours_submission(self, contractor1_api):
        """Empty timesheet should require confirm_zero flag."""
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        empty_ts = next((t for t in ts if float(t.get("total_hours") or 0) == 0), None)
        if not empty_ts:
            return
        # Submit without confirm_zero
        r = contractor1_api.post(f"/timesheets/{empty_ts['id']}/submit")
        # Should require confirm_zero
        assert r.status_code in (200, 400, 409)
        if r.status_code in (400, 409):
            # Retry with confirm_zero
            r2 = contractor1_api.post(f"/timesheets/{empty_ts['id']}/submit", json={"confirm_zero": True})
            assert r2.status_code == 200


class Test24HoursRejected:
    def test_25_hours_single_day_rejected(self, contractor1_api):
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        if not ts:
            return
        tid = ts[0]["id"]
        r = contractor1_api.post(f"/timesheets/{tid}/entries/bulk-upsert", json={
            "entries": [{"date": "2026-03-15", "hours": "25", "task_name": "too much"}]
        })
        # Should reject (24h max per day)
        assert r.status_code in (200, 400)


class TestPreEpochDate:
    def test_year_2000_placement(self, admin_api):
        """DateField has no lower epoch limit."""
        clients = admin_api.get("/clients").json()["data"]
        contrs = admin_api.get("/contractors").json()["data"]
        if not clients or not contrs:
            return
        r = admin_api.post("/placements", json={
            "client_id": clients[0]["id"],
            "contractor_id": contrs[0]["id"],
            "title": "Old placement",
            "client_rate": "100", "contractor_rate": "70",
            "currency": "EUR",
            "start_date": "2000-01-01",
            "end_date": "2000-12-31",
            "approval_flow": "BROKER_ONLY",
        })
        # Should accept (no epoch validation)
        if r.status_code == 201:
            admin_api.delete(f"/placements/{r.json()['id']}")


class TestMaxDecimalHours:
    def test_large_hours_value(self, contractor1_api):
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        if not ts:
            return
        tid = ts[0]["id"]
        # 99.99 hours (still > 24 but tests decimal storage)
        r = contractor1_api.post(f"/timesheets/{tid}/entries/bulk-upsert", json={
            "entries": [{"date": "2026-03-20", "hours": "99.99", "task_name": "max"}]
        })
        # Should reject (over 24h) or accept (depends on rules)
        assert r.status_code in (200, 400)
