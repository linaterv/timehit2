"""
Invoice templates API tests.
Covers: CRUD, activate/archive, delete rules, filtering, access control.
Requires running server with populated data.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


def _create_template(api, **overrides):
    payload = {
        "title": f"Test Template {_uid()}",
        "code": _uid()[:6].upper(),
        "template_type": "CONTRACTOR",
        "company_name": "Test Co",
        "billing_address": "Test St 1",
        "country": "LT",
        "default_currency": "EUR",
    }
    payload.update(overrides)
    r = api.post("/invoice-templates", json=payload)
    assert r.status_code == 201, f"Create template failed: {r.text}"
    return r.json()


class TestInvoiceTemplatesCRUD:
    def test_list_templates(self, admin_api):
        r = admin_api.get("/invoice-templates")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1

    def test_create_template(self, admin_api):
        d = _create_template(admin_api, title="New Test Tpl", template_type="CLIENT")
        assert d["title"] == "New Test Tpl"
        assert d["template_type"] == "CLIENT"
        # verify status via retrieve (create serializer doesn't return status)
        detail = admin_api.get(f"/invoice-templates/{d['id']}").json()
        assert detail["status"] == "DRAFT"
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_retrieve_template(self, admin_api):
        tid = admin_api.get("/invoice-templates").json()["data"][0]["id"]
        r = admin_api.get(f"/invoice-templates/{tid}")
        assert r.status_code == 200
        assert r.json()["id"] == tid
        assert "company_name" in r.json()

    def test_update_template(self, admin_api):
        d = _create_template(admin_api)
        r = admin_api.patch(f"/invoice-templates/{d['id']}", json={"company_name": "Updated Co"})
        assert r.status_code == 200
        assert r.json()["company_name"] == "Updated Co"
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_filter_by_type(self, admin_api):
        r = admin_api.get("/invoice-templates?template_type=CLIENT")
        assert r.status_code == 200
        for t in r.json()["data"]:
            assert t["template_type"] == "CLIENT"

    def test_filter_by_status(self, admin_api):
        r = admin_api.get("/invoice-templates?status=ACTIVE")
        assert r.status_code == 200
        for t in r.json()["data"]:
            assert t["status"] == "ACTIVE"


class TestInvoiceTemplatesLifecycle:
    def test_activate_draft(self, admin_api):
        d = _create_template(admin_api)
        detail = admin_api.get(f"/invoice-templates/{d['id']}").json()
        assert detail["status"] == "DRAFT"
        r = admin_api.post(f"/invoice-templates/{d['id']}/activate")
        assert r.status_code == 200
        assert r.json()["status"] == "ACTIVE"
        # archive to clean up
        admin_api.post(f"/invoice-templates/{d['id']}/archive")
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_archive_active(self, admin_api):
        d = _create_template(admin_api)
        admin_api.post(f"/invoice-templates/{d['id']}/activate")
        r = admin_api.post(f"/invoice-templates/{d['id']}/archive")
        assert r.status_code == 200
        assert r.json()["status"] == "ARCHIVED"
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_activate_non_draft_fails(self, admin_api):
        d = _create_template(admin_api)
        admin_api.post(f"/invoice-templates/{d['id']}/activate")
        # try activate again from ACTIVE
        r = admin_api.post(f"/invoice-templates/{d['id']}/activate")
        assert r.status_code in (400, 409)
        admin_api.post(f"/invoice-templates/{d['id']}/archive")
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_archive_non_active_fails(self, admin_api):
        d = _create_template(admin_api)
        # still DRAFT
        r = admin_api.post(f"/invoice-templates/{d['id']}/archive")
        assert r.status_code in (400, 409)
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_delete_draft_ok(self, admin_api):
        d = _create_template(admin_api)
        r = admin_api.delete(f"/invoice-templates/{d['id']}")
        assert r.status_code == 204

    def test_delete_active_blocked(self, admin_api):
        d = _create_template(admin_api)
        admin_api.post(f"/invoice-templates/{d['id']}/activate")
        r = admin_api.delete(f"/invoice-templates/{d['id']}")
        assert r.status_code == 409
        # cleanup
        admin_api.post(f"/invoice-templates/{d['id']}/archive")
        admin_api.delete(f"/invoice-templates/{d['id']}")

    def test_delete_archived_ok(self, admin_api):
        d = _create_template(admin_api)
        admin_api.post(f"/invoice-templates/{d['id']}/activate")
        admin_api.post(f"/invoice-templates/{d['id']}/archive")
        r = admin_api.delete(f"/invoice-templates/{d['id']}")
        assert r.status_code == 204
