"""
Timesheet withdraw and extra tests.
Covers: withdraw (SUBMITTED → DRAFT), edge cases.
"""


def _find(items, **kw):
    for item in items:
        if all(item.get(k) == v for k, v in kw.items()):
            return item
    return None


class TestTimesheetWithdraw:
    def test_withdraw_submitted(self, admin_api, contractor1_api):
        # Find contractor1's active placement
        placements = contractor1_api.get("/placements").json()["data"]
        active = [p for p in placements if p["status"] == "ACTIVE"]
        if not active:
            return
        pid = active[0]["id"]
        # Create timesheet for a month that doesn't exist yet
        r = contractor1_api.post("/timesheets", json={
            "placement_id": pid, "year": 2026, "month": 12,
        })
        if r.status_code != 201:
            # month might already exist, try to find it
            return
        tid = r.json()["id"]
        # Add an entry so we can submit
        contractor1_api.post(f"/timesheets/{tid}/entries/bulk-upsert", json={
            "entries": [{"date": "2026-12-01", "hours": "8", "task_name": "test"}]
        })
        # Submit
        r2 = contractor1_api.post(f"/timesheets/{tid}/submit")
        assert r2.status_code == 200
        assert r2.json()["status"] == "SUBMITTED"
        # Withdraw
        r3 = contractor1_api.post(f"/timesheets/{tid}/withdraw")
        assert r3.status_code == 200
        assert r3.json()["status"] == "DRAFT"
        # Cleanup — delete the draft timesheet
        contractor1_api.delete(f"/timesheets/{tid}")

    def test_withdraw_not_submitted_fails(self, contractor1_api):
        placements = contractor1_api.get("/placements").json()["data"]
        active = [p for p in placements if p["status"] == "ACTIVE"]
        if not active:
            return
        pid = active[0]["id"]
        r = contractor1_api.post("/timesheets", json={
            "placement_id": pid, "year": 2026, "month": 11,
        })
        if r.status_code != 201:
            return
        tid = r.json()["id"]
        # Withdraw from DRAFT should fail
        r2 = contractor1_api.post(f"/timesheets/{tid}/withdraw")
        assert r2.status_code in (400, 409)
        # Cleanup
        contractor1_api.delete(f"/timesheets/{tid}")
