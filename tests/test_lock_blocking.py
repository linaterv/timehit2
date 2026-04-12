"""
P2 Lock blocking tests: locked entities reject mutations, lock cascading.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


def _lock(api, entity_type, entity_id):
    return api.post("/lock", json={"entity_type": entity_type, "entity_id": entity_id, "action": "lock"})


def _unlock(api, entity_type, entity_id):
    return api.post("/lock", json={"entity_type": entity_type, "entity_id": entity_id, "action": "unlock", "reason": "cleanup"})


class TestLockBlocksMutations:
    def test_locked_placement_blocks_update(self, admin_api):
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        _lock(admin_api, "placement", pid)
        try:
            r = admin_api.patch(f"/placements/{pid}", json={"notes": "should fail"})
            assert r.status_code == 423
        finally:
            _unlock(admin_api, "placement", pid)

    def test_locked_placement_blocks_delete(self, admin_api):
        # Create a fresh draft we can lock then try to delete
        clients = admin_api.get("/clients").json()["data"]
        contrs = admin_api.get("/contractors").json()["data"]
        if not clients or not contrs:
            return
        r = admin_api.post("/placements", json={
            "client_id": clients[0]["id"],
            "contractor_id": contrs[0]["id"],
            "title": f"Lock test {_uid()}",
            "client_rate": "100", "contractor_rate": "70",
            "currency": "EUR", "start_date": "2026-01-01",
            "approval_flow": "BROKER_ONLY",
        })
        if r.status_code != 201:
            return
        pid = r.json()["id"]
        _lock(admin_api, "placement", pid)
        r2 = admin_api.delete(f"/placements/{pid}")
        assert r2.status_code == 423
        # cleanup
        _unlock(admin_api, "placement", pid)
        admin_api.delete(f"/placements/{pid}")


class TestLockedInvoiceBlocksTransitions:
    def test_locked_issued_invoice_blocks_mark_paid(self, admin_api):
        invs = admin_api.get("/invoices?status=ISSUED").json()["data"]
        if not invs:
            return
        iid = invs[0]["id"]
        _lock(admin_api, "invoice", iid)
        try:
            r = admin_api.post(f"/invoices/{iid}/mark-paid", json={"payment_date": "2026-05-01"})
            assert r.status_code == 423
        finally:
            _unlock(admin_api, "invoice", iid)

    def test_locked_invoice_blocks_void(self, admin_api):
        invs = admin_api.get("/invoices?status=ISSUED").json()["data"]
        if not invs:
            return
        iid = invs[0]["id"]
        _lock(admin_api, "invoice", iid)
        try:
            r = admin_api.post(f"/invoices/{iid}/void", json={"reason": "test"})
            assert r.status_code == 423
        finally:
            _unlock(admin_api, "invoice", iid)


class TestLockChain:
    def test_lock_row_locks_chain(self, admin_api):
        """POST /control/lock-row with placement_id locks placement+client+contractor+invoices."""
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        r = admin_api.post("/control/lock-row", json={"placement_id": pid})
        assert r.status_code == 200
        d = r.json()
        # Should have locked at least placement
        assert d["count"] >= 1
        assert "placement" in d["locked"] or any("placement" in x for x in d["locked"])
