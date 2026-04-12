"""
Past issues and repopulate endpoint tests.
"""


class TestPastIssues:
    def test_past_issues(self, admin_api):
        r = admin_api.get("/control/past-issues")
        assert r.status_code == 200
        d = r.json()
        # should be a list or dict with issues data
        assert isinstance(d, (list, dict))


class TestRepopulate:
    def test_repopulate_admin_only(self, broker1_api):
        r = broker1_api.post("/admin/repopulate", json={})
        assert r.status_code == 403

    def test_repopulate_contractor_forbidden(self, contractor1_api):
        r = contractor1_api.post("/admin/repopulate", json={})
        assert r.status_code == 403
