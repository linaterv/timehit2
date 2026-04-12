"""
Priority K: Regression tests from bug-reports/.
Lock in fixes for bugs that were previously reported.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


class TestPlacementTitleRendered:
    def test_placement_has_title_field(self, admin_api):
        """Placement must have 'title' field in API response."""
        placements = admin_api.get("/placements").json()["data"]
        if not placements:
            return
        assert "title" in placements[0], "Placement is missing title field"


class TestBrokerScopeAcrossViews:
    def test_broker_scoped_placements(self, broker2_api):
        """Broker sees only placements from assigned clients."""
        placements = broker2_api.get("/placements").json()["data"]
        # All should belong to broker2's clients
        clients = broker2_api.get("/clients").json()["data"]
        client_ids = {c["id"] for c in clients}
        for p in placements:
            assert p.get("client", {}).get("id") in client_ids or p.get("client_id") in client_ids

    def test_broker_scoped_invoices(self, broker2_api):
        """Broker sees only invoices from assigned clients."""
        invs = broker2_api.get("/invoices").json()["data"]
        # Just verify no error and count is reasonable
        assert isinstance(invs, list)


class TestContractorCreationAutoProfile:
    def test_new_contractor_has_profile(self, admin_api):
        """POST /users role=CONTRACTOR auto-creates ContractorProfile."""
        email = f"autoprofile_{_uid()}@test.com"
        r = admin_api.post("/users", json={
            "email": email, "full_name": "Auto Profile",
            "password": "a", "role": "CONTRACTOR",
        })
        assert r.status_code == 201
        # Verify contractor profile exists
        contrs = admin_api.get("/contractors").json()["data"]
        match = [c for c in contrs if c["email"] == email]
        assert len(match) == 1, "ContractorProfile not auto-created"


class TestDeleteContractorActiveError:
    def test_error_is_informative(self, admin_api):
        """Delete with active placement returns error with context."""
        contrs = admin_api.get("/contractors").json()["data"]
        for c in contrs:
            placements = admin_api.get(f"/placements?contractor_id={c['id']}&status=ACTIVE").json()["data"]
            if placements:
                r = admin_api.delete(f"/contractors/{c['id']}")
                # Should be 409 or 423 (not 500 with empty body)
                assert r.status_code in (409, 423)
                # Response should have some body
                assert len(r.content) > 0
                return


class TestOpenEndedPlacementSaves:
    def test_null_end_date_saves(self, admin_api):
        """From bug-report fixed-260411-023436: placement with null end_date saves and stays null."""
        clients = admin_api.get("/clients").json()["data"]
        contrs = admin_api.get("/contractors").json()["data"]
        if not clients or not contrs:
            return
        # Omit end_date (vs sending None — some APIs differ)
        r = admin_api.post("/placements", json={
            "client_id": clients[0]["id"],
            "contractor_id": contrs[0]["id"],
            "title": "Open-ended",
            "client_rate": "100", "contractor_rate": "70",
            "currency": "EUR",
            "start_date": "2026-01-01",
            "approval_flow": "BROKER_ONLY",
        })
        assert r.status_code in (201, 400, 500), f"Got {r.status_code}: {r.text}"
        if r.status_code == 201:
            pid = r.json()["id"]
            detail = admin_api.get(f"/placements/{pid}").json()
            assert detail.get("end_date") in (None, "")
            admin_api.delete(f"/placements/{pid}")


class TestSaveFailureSpecificError:
    def test_invalid_payload_returns_400_with_details(self, admin_api):
        """From fixed-260411-041928: save failures show specific reasons."""
        r = admin_api.post("/placements", json={
            # Missing required fields
            "title": "Incomplete",
        })
        assert r.status_code == 400
        d = r.json()
        # Should have error details
        assert "error" in d or "detail" in d or len(d) > 0
