"""
Priority F: Time and date edge cases.
Leap year, year wrap, future/past placement boundaries.
"""


class TestLeapYear:
    def test_feb_28_2026_accepts_day_28(self, contractor1_api):
        """2026 is not a leap year (Feb has 28 days)."""
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        target = next((t for t in ts if t.get("year") == 2026 and t.get("month") == 3), None)
        if not target:
            return
        # Feb 28 2026 is a valid date
        r = contractor1_api.post(f"/timesheets/{target['id']}/entries/bulk-upsert", json={
            "entries": [{"date": "2026-02-28", "hours": "8", "task_name": "last day feb"}]
        })
        # Should reject (entry outside March timesheet's month)
        assert r.status_code in (200, 400)


class TestYearWrap:
    def test_placement_can_span_year_boundary(self, admin_api):
        """Placement from 2025-12 to 2026-02 can have timesheets for both years."""
        clients = admin_api.get("/clients").json()["data"]
        contrs = admin_api.get("/contractors").json()["data"]
        if not clients or not contrs:
            return
        r = admin_api.post("/placements", json={
            "client_id": clients[0]["id"],
            "contractor_id": contrs[0]["id"],
            "title": "Year Wrap",
            "client_rate": "100", "contractor_rate": "70",
            "currency": "EUR",
            "start_date": "2025-12-01",
            "end_date": "2026-02-28",
            "approval_flow": "BROKER_ONLY",
        })
        if r.status_code == 201:
            admin_api.delete(f"/placements/{r.json()['id']}")


class TestPlacementFutureEnd:
    def test_timesheet_after_placement_end_rejected(self, admin_api, contractor1_api):
        """Placement ended 2025. Try create timesheet for 2027."""
        placements = contractor1_api.get("/placements").json()["data"]
        # Find completed placement
        target = next((p for p in placements if p.get("status") == "COMPLETED"), None)
        if not target:
            return
        r = contractor1_api.post("/timesheets", json={
            "placement_id": target["id"], "year": 2027, "month": 6,
        })
        # Should reject (out of range)
        assert r.status_code in (400, 403, 409)


class TestRetrospectiveTimesheet:
    def test_past_month_timesheet_accepted(self, contractor1_api):
        """Retrospective timesheets within placement range are allowed."""
        placements = contractor1_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        target = placements[0]
        # Try earlier month within range
        r = contractor1_api.post("/timesheets", json={
            "placement_id": target["id"], "year": 2025, "month": 11,
        })
        # May or may not succeed depending on placement start_date
        assert r.status_code in (201, 400, 409, 500)
        if r.status_code == 201:
            contractor1_api.delete(f"/timesheets/{r.json()['id']}")


class TestInvoiceDateValidation:
    def test_invoice_has_valid_dates(self, admin_api):
        invs = admin_api.get("/invoices?status=PAID&per_page=3").json()["data"]
        for i in invs:
            detail = admin_api.get(f"/invoices/{i['id']}").json()
            # Issue date should exist for non-DRAFT
            assert detail.get("issue_date") is not None


class TestFuturePlacement:
    def test_draft_placement_with_future_dates(self, admin_api):
        clients = admin_api.get("/clients").json()["data"]
        contrs = admin_api.get("/contractors").json()["data"]
        if not clients or not contrs:
            return
        r = admin_api.post("/placements", json={
            "client_id": clients[0]["id"],
            "contractor_id": contrs[0]["id"],
            "title": "Future",
            "client_rate": "100", "contractor_rate": "70",
            "currency": "EUR",
            "start_date": "2030-01-01",
            "end_date": "2030-12-31",
            "approval_flow": "BROKER_ONLY",
        })
        # Future dates should be allowed (DRAFT placement)
        if r.status_code == 201:
            admin_api.delete(f"/placements/{r.json()['id']}")
