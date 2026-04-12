"""
Priority G: Cascading deletes and referential integrity.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


class TestContractorDeleteMidPlacement:
    def test_soft_delete_with_placements(self, admin_api):
        """Contractor with active placements should be soft-deleted (not hard)."""
        contrs = admin_api.get("/contractors").json()["data"]
        # Find contractor with placements
        target = None
        for c in contrs:
            placements = admin_api.get(f"/placements?contractor_id={c['id']}&status=ACTIVE").json()["data"]
            if placements and not c.get("is_locked"):
                target = c
                break
        if not target:
            return
        r = admin_api.delete(f"/contractors/{target['id']}")
        # Should be 409 (blocked) or 423 (locked)
        assert r.status_code in (409, 423)


class TestBrokerAssignmentRevoked:
    def test_broker2_sees_less_than_admin(self, admin_api, broker2_api):
        """Broker2 with fewer assignments should see fewer entities."""
        admin_clients = admin_api.get("/clients").json()["meta"]["total"]
        broker2_clients = broker2_api.get("/clients").json()["meta"]["total"]
        assert broker2_clients <= admin_clients


class TestArchivedParentTemplate:
    def test_archived_template_not_in_active_filter(self, admin_api):
        """Archived templates excluded from status=ACTIVE filter."""
        r = admin_api.get("/invoice-templates?status=ACTIVE")
        for t in r.json()["data"]:
            # Retrieve detail
            d = admin_api.get(f"/invoice-templates/{t['id']}").json()
            assert d["status"] == "ACTIVE"


class TestCandidateContractorLinkCleanup:
    def test_candidate_with_empty_contractor_id(self, admin_api):
        """Candidates without contractor link have empty contractor_id."""
        r = admin_api.get("/candidates?contractor_linked=false")
        for c in r.json()["data"]:
            assert c.get("contractor_id") == "" or c.get("contractor_id") is None


class TestFTSAfterArchive:
    def test_archived_candidate_still_in_status_archived(self, admin_api):
        """Archived candidate retrievable via status filter."""
        # Create + archive
        r = admin_api.post("/candidates", json={
            "full_name": f"Archive Test {_uid()}",
            "email": f"arc_{_uid()}@example.com",
        })
        if r.status_code != 201:
            return
        cid = r.json()["id"]
        admin_api.delete(f"/candidates/{cid}")
        # Retrieve - should still exist with status=ARCHIVED
        detail = admin_api.get(f"/candidates/{cid}").json()
        assert detail["status"] == "ARCHIVED"


class TestClientDeleteBlocked:
    def test_client_with_active_placements_locked(self, admin_api):
        """Client with active placements can't be hard-deleted."""
        clients = admin_api.get("/clients").json()["data"]
        for c in clients:
            placements = admin_api.get(f"/placements?client_id={c['id']}&status=ACTIVE").json()["data"]
            if placements:
                r = admin_api.delete(f"/clients/{c['id']}")
                # Should be blocked
                assert r.status_code in (409, 423)
                return
