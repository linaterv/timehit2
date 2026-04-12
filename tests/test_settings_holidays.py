"""
Agency settings and holidays tests.
Covers: GET/PATCH settings, access control, holidays endpoint.
"""


class TestAgencySettings:
    def test_get_settings_admin(self, admin_api):
        r = admin_api.get("/agency-settings")
        assert r.status_code == 200
        d = r.json()
        assert "default_payment_terms_client_days" in d
        assert "default_payment_terms_contractor_days" in d

    def test_patch_settings_admin(self, admin_api):
        r = admin_api.get("/agency-settings")
        original = r.json()
        r2 = admin_api.patch("/agency-settings", json={
            "default_payment_terms_client_days": 45,
        })
        assert r2.status_code == 200
        assert r2.json()["default_payment_terms_client_days"] == 45
        # restore
        admin_api.patch("/agency-settings", json={
            "default_payment_terms_client_days": original["default_payment_terms_client_days"],
        })

    def test_patch_settings_forbidden_broker(self, broker1_api):
        r = broker1_api.patch("/agency-settings", json={"default_payment_terms_client_days": 99})
        assert r.status_code == 403

    def test_patch_settings_forbidden_contractor(self, contractor1_api):
        r = contractor1_api.patch("/agency-settings", json={"default_payment_terms_client_days": 99})
        assert r.status_code == 403


class TestHolidays:
    def test_holidays_list_countries(self, admin_api):
        r = admin_api.get("/holidays")
        assert r.status_code == 200
        d = r.json()
        assert "countries" in d
        assert len(d["countries"]) >= 1

    def test_holidays_for_country_year(self, admin_api):
        r = admin_api.get("/holidays?country=LT&year=2026")
        assert r.status_code == 200
        d = r.json()
        assert d["country"] == "LT"
        assert d["year"] == 2026
        assert "holidays" in d
        assert len(d["holidays"]) >= 1
        # holidays is a list of {date, name} objects
        dates = [h["date"] for h in d["holidays"]]
        assert "2026-01-01" in dates
