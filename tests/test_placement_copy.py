"""
P2 Placement copy tests: edge cases for end_date and same-day transitions.
"""

import uuid
from datetime import date, timedelta


def _uid():
    return uuid.uuid4().hex[:8]


def _get_contractor_id(api):
    contrs = api.get("/contractors").json()["data"]
    return contrs[0]["id"] if contrs else None


def _get_client_id(api):
    clients = api.get("/clients").json()["data"]
    return clients[0]["id"] if clients else None


class TestPlacementCopy:
    def test_copy_with_end_date(self, admin_api):
        """Copy placement with end_date -> new placement starts day after."""
        client_id = _get_client_id(admin_api)
        contractor_id = _get_contractor_id(admin_api)
        if not client_id or not contractor_id:
            return

        # Create a placement with specific end_date
        r = admin_api.post("/placements", json={
            "client_id": client_id,
            "contractor_id": contractor_id,
            "title": f"Copy Test {_uid()}",
            "client_rate": "100.00",
            "contractor_rate": "70.00",
            "currency": "EUR",
            "start_date": "2026-01-01",
            "end_date": "2026-03-15",
            "approval_flow": "BROKER_ONLY",
        })
        if r.status_code != 201:
            return
        pid = r.json()["id"]

        # Copy it
        r2 = admin_api.post(f"/placements/{pid}/copy", json={})
        assert r2.status_code == 201
        new_p = r2.json()
        # New start should be day after original end
        assert new_p["start_date"] == "2026-03-16"
        # cleanup
        admin_api.delete(f"/placements/{new_p['id']}")
        admin_api.delete(f"/placements/{pid}")

    def test_copy_open_ended_placement(self, admin_api):
        """Copy placement with no end_date -> new placement gets a sensible default."""
        client_id = _get_client_id(admin_api)
        contractor_id = _get_contractor_id(admin_api)
        if not client_id or not contractor_id:
            return

        r = admin_api.post("/placements", json={
            "client_id": client_id,
            "contractor_id": contractor_id,
            "title": f"Open End Copy {_uid()}",
            "client_rate": "100.00",
            "contractor_rate": "70.00",
            "currency": "EUR",
            "start_date": "2026-01-01",
            # no end_date
            "approval_flow": "BROKER_ONLY",
        })
        if r.status_code != 201:
            return
        pid = r.json()["id"]

        r2 = admin_api.post(f"/placements/{pid}/copy", json={})
        # Should succeed even without end_date
        assert r2.status_code == 201
        new_p = r2.json()
        # New start_date should be set to something reasonable
        assert "start_date" in new_p
        admin_api.delete(f"/placements/{new_p['id']}")
        admin_api.delete(f"/placements/{pid}")
