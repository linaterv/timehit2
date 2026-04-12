"""
Priority J: Concurrency tests using threading.
Verify atomic behavior for invoice generation and series counter.
"""

import threading
import uuid


def _uid():
    return uuid.uuid4().hex[:8]


class TestConcurrentInvoiceGen:
    def test_concurrent_generate_same_timesheet(self, admin_api, base_url):
        """Two parallel POST /invoices/generate with same timesheet -> only one pair succeeds."""
        import requests
        # Find an approved timesheet WITHOUT invoices yet — may not exist in seed data
        timesheets = admin_api.get("/timesheets?status=APPROVED").json()["data"]
        target_ts = None
        for ts in timesheets:
            invs = admin_api.get(f"/invoices?timesheet_id={ts['id']}").json()["data"]
            # only use if no non-voided invoices
            if not any(i["status"] != "VOIDED" for i in invs):
                target_ts = ts
                break
        if not target_ts:
            return  # no eligible timesheet

        token = admin_api.token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        results = []

        def generate():
            import requests
            r = requests.post(
                f"{base_url}/api/v1/invoices/generate",
                json={"timesheet_ids": [target_ts["id"]]},
                headers=headers,
            )
            results.append((r.status_code, r.json() if r.content else {}))

        t1 = threading.Thread(target=generate)
        t2 = threading.Thread(target=generate)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # One should succeed creating invoices, other should succeed with errors/blocked
        assert len(results) == 2
        # Verify no duplicate invoices created
        final_invs = admin_api.get(f"/invoices?timesheet_id={target_ts['id']}").json()["data"]
        # At most 2 invoices should exist (client+contractor pair), not 4
        non_voided = [i for i in final_invs if i["status"] != "VOIDED"]
        assert len(non_voided) <= 2


class TestConcurrentCounterIncrement:
    def test_sequential_invoice_numbers_unique(self, admin_api):
        """Verify that sequential invoice generations produce unique numbers (no race)."""
        invs = admin_api.get("/invoices?per_page=200").json()["data"]
        numbers = [i["invoice_number"] for i in invs if i.get("invoice_number")]
        assert len(numbers) == len(set(numbers)), "Duplicate invoice numbers found"


class TestConcurrentTimesheetEntryUpdates:
    def test_bulk_upsert_serialized(self, contractor1_api, base_url):
        """Two concurrent bulk-upserts to same timesheet: last-write-wins or serialized."""
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        if not ts:
            return
        tid = ts[0]["id"]
        token = contractor1_api.token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        results = []

        def upsert(hours):
            import requests
            r = requests.post(
                f"{base_url}/api/v1/timesheets/{tid}/entries/bulk-upsert",
                json={"entries": [{"date": "2026-03-25", "hours": str(hours), "task_name": "concurrent"}]},
                headers=headers,
            )
            results.append(r.status_code)

        t1 = threading.Thread(target=upsert, args=(4,))
        t2 = threading.Thread(target=upsert, args=(8,))
        t1.start(); t2.start()
        t1.join(); t2.join()
        # Both should succeed or one should fail gracefully
        assert all(s < 500 for s in results), f"Got 5xx: {results}"


class TestLockDuringMutation:
    def test_save_after_lock_fails(self, admin_api):
        """User opens edit, admin locks, user saves -> 423."""
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        # Lock
        admin_api.post("/lock", json={"entity_type": "placement", "entity_id": pid, "action": "lock"})
        try:
            # Attempt save
            r = admin_api.patch(f"/placements/{pid}", json={"notes": "during lock"})
            assert r.status_code == 423
        finally:
            admin_api.post("/lock", json={"entity_type": "placement", "entity_id": pid, "action": "unlock", "reason": "cleanup"})
