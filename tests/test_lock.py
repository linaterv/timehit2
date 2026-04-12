"""
Lock/unlock entity tests.
Covers: lock, unlock with reason, unlocked entities view, lock-row, lock-all.
"""


class TestLockUnlock:
    def test_lock_placement(self, admin_api):
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        r = admin_api.post("/lock", json={
            "entity_type": "placement",
            "entity_id": pid,
            "action": "lock",
        })
        assert r.status_code == 200
        assert r.json()["is_locked"] is True
        # unlock to restore state
        admin_api.post("/lock", json={
            "entity_type": "placement",
            "entity_id": pid,
            "action": "unlock",
            "reason": "Test cleanup",
        })

    def test_unlock_requires_reason(self, admin_api):
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        admin_api.post("/lock", json={"entity_type": "placement", "entity_id": pid, "action": "lock"})
        r = admin_api.post("/lock", json={
            "entity_type": "placement",
            "entity_id": pid,
            "action": "unlock",
        })
        assert r.status_code == 400
        # cleanup
        admin_api.post("/lock", json={
            "entity_type": "placement", "entity_id": pid,
            "action": "unlock", "reason": "cleanup",
        })

    def test_lock_client(self, admin_api):
        clients = admin_api.get("/clients").json()["data"]
        if not clients:
            return
        cid = clients[0]["id"]
        r = admin_api.post("/lock", json={"entity_type": "client", "entity_id": cid, "action": "lock"})
        assert r.status_code == 200
        admin_api.post("/lock", json={"entity_type": "client", "entity_id": cid, "action": "unlock", "reason": "test"})

    def test_invalid_action(self, admin_api):
        r = admin_api.post("/lock", json={"entity_type": "placement", "entity_id": "fake", "action": "nope"})
        assert r.status_code == 400


class TestUnlockedEntities:
    def test_unlocked_entities_view(self, admin_api):
        r = admin_api.get("/control/unlocked")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d


class TestLockRow:
    def test_lock_row(self, admin_api):
        placements = admin_api.get("/placements?status=ACTIVE").json()["data"]
        if not placements:
            return
        pid = placements[0]["id"]
        r = admin_api.post("/control/lock-row", json={"placement_id": pid})
        assert r.status_code == 200
        assert "locked" in r.json()
        assert r.json()["count"] >= 1


class TestLockAll:
    def test_lock_all(self, admin_api):
        r = admin_api.post("/control/lock-all", json={})
        assert r.status_code == 200
        assert "locked_count" in r.json()
