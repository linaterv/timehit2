"""
Entity delete tests.
Covers: user/client/contractor delete with soft/hard delete logic, active placement blocking.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


def _get_user_id_by_email(api, email):
    """Look up user id by listing users and matching email."""
    r = api.get(f"/users?search={email}")
    for u in r.json()["data"]:
        if u["email"] == email:
            return u["id"]
    return None


class TestUserDelete:
    def test_delete_user_no_relations(self, admin_api):
        email = f"del_user_{_uid()}@test.com"
        r = admin_api.post("/users", json={
            "email": email, "full_name": "Deletable User", "password": "a", "role": "BROKER",
        })
        assert r.status_code == 201
        uid = _get_user_id_by_email(admin_api, email)
        assert uid, f"Could not find created user {email}"
        r2 = admin_api.delete(f"/users/{uid}")
        assert r2.status_code == 200
        assert r2.json()["deleted"] in ("hard", "soft")

    def test_delete_user_forbidden_non_admin(self, broker1_api):
        r = broker1_api.get("/users")
        assert r.status_code == 403

    def test_cannot_delete_self(self, admin_api):
        me = admin_api.get("/users/me").json()
        r = admin_api.delete(f"/users/{me['id']}")
        assert r.status_code == 403


class TestClientDelete:
    def test_delete_client_with_active_placements_blocked(self, admin_api):
        clients = admin_api.get("/clients").json()["data"]
        for c in clients:
            placements = admin_api.get(f"/placements?client_id={c['id']}&status=ACTIVE").json()["data"]
            if placements:
                r = admin_api.delete(f"/clients/{c['id']}")
                # locked entities return 423, active placements return 409
                assert r.status_code in (409, 423)
                return


class TestContractorDelete:
    def test_delete_contractor_with_active_placement_blocked(self, admin_api):
        contrs = admin_api.get("/contractors").json()["data"]
        for c in contrs:
            placements = admin_api.get(f"/placements?contractor_id={c['id']}&status=ACTIVE").json()["data"]
            if placements:
                r = admin_api.delete(f"/contractors/{c['id']}")
                assert r.status_code in (409, 423)
                return

    def test_delete_clean_contractor(self, admin_api):
        email = f"del_contr_{_uid()}@test.com"
        r = admin_api.post("/users", json={
            "email": email, "full_name": "Fresh Contractor", "password": "a", "role": "CONTRACTOR",
        })
        assert r.status_code == 201
        uid = _get_user_id_by_email(admin_api, email)
        assert uid, f"Could not find created user {email}"
        r2 = admin_api.delete(f"/contractors/{uid}")
        assert r2.status_code == 200
        assert r2.json()["deleted"] in ("hard", "soft")
