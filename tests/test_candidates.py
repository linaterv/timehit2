"""
Candidates module API tests.
Covers: CRUD, filters, FTS search, files, activities, contractor link, parse-cv, access control.
Requires running server with populated data (python manage.py populate --clean).
"""

import io
import uuid


# ── Helpers ──────────────────────────────────────────────────────────────────

def _uid():
    return uuid.uuid4().hex[:8]


def _create_candidate(api, **overrides):
    """Create a candidate and return its data dict."""
    payload = {
        "full_name": "Test Candidate",
        "email": "",
        "country": "LT",
        "skills": "python, django",
    }
    payload.update(overrides)
    r = api.post("/candidates", json=payload)
    assert r.status_code == 201, f"Create candidate failed: {r.text}"
    return r.json()


def _cleanup(api, cid):
    api.delete(f"/candidates/{cid}")


def _make_pdf_bytes():
    """Minimal valid PDF for upload tests."""
    return (
        b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
        b"0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
    )


# ── 1. CRUD ──────────────────────────────────────────────────────────────────

class TestCandidatesCRUD:
    def test_list_candidates(self, admin_api):
        r = admin_api.get("/candidates")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1
        first = r.json()["data"][0]
        assert "full_name" in first
        assert "status" in first
        assert "cv_count" in first

    def test_create_candidate(self, broker1_api):
        email = f"crud_{_uid()}@example.com"
        d = _create_candidate(broker1_api,
            full_name="Test Candidate CRUD",
            email=email,
            phone="+37060000001",
            skills="python, django, rest",
            desired_rate="55.00",
            desired_currency="EUR",
            source="Referral",
        )
        assert d["full_name"] == "Test Candidate CRUD"
        assert d["email"] == email
        assert d["status"] == "AVAILABLE"
        assert d["country"] == "LT"
        _cleanup(broker1_api, d["id"])

    def test_retrieve_candidate_detail(self, admin_api):
        cid = admin_api.get("/candidates").json()["data"][0]["id"]
        r = admin_api.get(f"/candidates/{cid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == cid
        assert "files" in d
        assert "activities" in d
        assert "notes" in d

    def test_update_candidate(self, broker1_api):
        d = _create_candidate(broker1_api, full_name="Update Me", email=f"update_{_uid()}@example.com", skills="java")
        r = broker1_api.patch(f"/candidates/{d['id']}", json={
            "skills": "java, springboot, kubernetes",
            "desired_rate": "70.00",
        })
        assert r.status_code == 200
        assert "springboot" in r.json()["skills"]
        _cleanup(broker1_api, d["id"])

    def test_update_status_creates_activity(self, admin_api):
        d = _create_candidate(admin_api, full_name="Status Act Test", email=f"stat_{_uid()}@example.com")
        admin_api.patch(f"/candidates/{d['id']}", json={"status": "PROPOSED"})
        acts = admin_api.get(f"/candidates/{d['id']}/activities").json()["data"]
        status_acts = [a for a in acts if a["type"] == "STATUS_CHANGE"]
        assert len(status_acts) >= 1
        assert status_acts[0]["old_value"] == "AVAILABLE"
        assert status_acts[0]["new_value"] == "PROPOSED"
        _cleanup(admin_api, d["id"])

    def test_soft_delete_archives(self, broker1_api):
        d = _create_candidate(broker1_api, full_name="Delete Me", email=f"del_{_uid()}@example.com")
        r = broker1_api.delete(f"/candidates/{d['id']}")
        assert r.status_code == 204
        r2 = broker1_api.get(f"/candidates/{d['id']}")
        assert r2.status_code == 200
        assert r2.json()["status"] == "ARCHIVED"

    def test_duplicate_email_blocked(self, admin_api):
        email = f"dup_{_uid()}@example.com"
        d = _create_candidate(admin_api, full_name="Dup A", email=email)
        r2 = admin_api.post("/candidates", json={"full_name": "Dup B", "email": email})
        assert r2.status_code == 400
        _cleanup(admin_api, d["id"])

    def test_empty_email_allowed_multiple(self, admin_api):
        d1 = _create_candidate(admin_api, full_name="No Email 1", email="")
        d2 = _create_candidate(admin_api, full_name="No Email 2", email="")
        assert d1["id"] != d2["id"]
        _cleanup(admin_api, d1["id"])
        _cleanup(admin_api, d2["id"])


# ── 2. Filters ───────────────────────────────────────────────────────────────

class TestCandidatesFilters:
    def test_filter_by_status(self, admin_api):
        r = admin_api.get("/candidates?status=AVAILABLE")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["status"] == "AVAILABLE"

    def test_filter_by_country(self, admin_api):
        r = admin_api.get("/candidates?country=LT")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["country"] == "LT"

    def test_filter_contractor_linked(self, admin_api):
        r = admin_api.get("/candidates?contractor_linked=true")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["contractor_id"] != ""

    def test_filter_contractor_not_linked(self, admin_api):
        r = admin_api.get("/candidates?contractor_linked=false")
        assert r.status_code == 200
        for c in r.json()["data"]:
            assert c["contractor_id"] == ""

    def test_search_like(self, admin_api):
        r = admin_api.get("/candidates?search=Tomas")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1
        assert any("Tomas" in c["full_name"] for c in r.json()["data"])

    def test_sort_by_name_asc(self, admin_api):
        r = admin_api.get("/candidates?sort=full_name&order=asc")
        assert r.status_code == 200
        names = [c["full_name"] for c in r.json()["data"]]
        assert names == sorted(names)


# ── 3. FTS Search ────────────────────────────────────────────────────────────

class TestCandidatesFTSSearch:
    def test_search_returns_results(self, admin_api):
        r = admin_api.get("/candidates/search?q=java")
        assert r.status_code == 200
        d = r.json()
        assert d["meta"]["total"] >= 1
        assert d["meta"]["query"] == "java"
        first = d["data"][0]
        assert "snippet" in first
        assert "rank" in first

    def test_search_multi_term(self, admin_api):
        r = admin_api.get("/candidates/search?q=java+spring")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1

    def test_search_empty_query(self, admin_api):
        r = admin_api.get("/candidates/search?q=")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] == 0

    def test_search_no_results(self, admin_api):
        r = admin_api.get("/candidates/search?q=zzzznonexistent999")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] == 0

    def test_search_finds_by_skill(self, admin_api):
        # seeded candidates have skills like java, react, etc.
        r = admin_api.get("/candidates/search?q=react")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1


# ── 4. Files ─────────────────────────────────────────────────────────────────

class TestCandidatesFiles:
    def test_upload_cv(self, admin_api):
        d = _create_candidate(admin_api, full_name="File Test", email=f"file_{_uid()}@example.com")
        cid = d["id"]
        r = admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="cv.pdf", fields={"file_type": "CV"})
        assert r.status_code == 201
        files = r.json()
        assert len(files) == 1
        assert files[0]["file_type"] == "CV"
        assert files[0]["original_filename"] == "cv.pdf"
        _cleanup(admin_api, cid)

    def test_list_files(self, admin_api):
        d = _create_candidate(admin_api, full_name="List Files", email=f"lf_{_uid()}@example.com")
        cid = d["id"]
        admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="a.pdf", fields={"file_type": "CV"})
        admin_api.upload(f"/candidates/{cid}/files", b"text content", filename="note.txt", fields={"file_type": "ATTACHMENT"})
        r = admin_api.get(f"/candidates/{cid}/files")
        assert r.status_code == 200
        assert len(r.json()["data"]) == 2
        # filter by type
        r2 = admin_api.get(f"/candidates/{cid}/files?type=CV")
        assert len(r2.json()["data"]) == 1
        assert r2.json()["data"][0]["file_type"] == "CV"
        _cleanup(admin_api, cid)

    def test_delete_file(self, admin_api):
        d = _create_candidate(admin_api, full_name="Del File", email=f"df_{_uid()}@example.com")
        cid = d["id"]
        r = admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="del.pdf", fields={"file_type": "CV"})
        fid = r.json()[0]["id"]
        r2 = admin_api.delete(f"/candidates/{cid}/files/{fid}")
        assert r2.status_code == 204
        # verify gone
        r3 = admin_api.get(f"/candidates/{cid}/files")
        assert len(r3.json()["data"]) == 0
        _cleanup(admin_api, cid)

    def test_download_file(self, admin_api):
        d = _create_candidate(admin_api, full_name="DL File", email=f"dl_{_uid()}@example.com")
        cid = d["id"]
        r = admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="dl.pdf", fields={"file_type": "CV"})
        fid = r.json()[0]["id"]
        r2 = admin_api.get(f"/candidates/{cid}/files/{fid}/download")
        assert r2.status_code == 200
        assert len(r2.content) > 0
        _cleanup(admin_api, cid)

    def test_cv_upload_creates_activity(self, admin_api):
        d = _create_candidate(admin_api, full_name="CV Act", email=f"cva_{_uid()}@example.com")
        cid = d["id"]
        admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="cv.pdf", fields={"file_type": "CV"})
        acts = admin_api.get(f"/candidates/{cid}/activities").json()["data"]
        cv_acts = [a for a in acts if a["type"] == "CV_UPLOADED"]
        assert len(cv_acts) >= 1
        _cleanup(admin_api, cid)

    def test_cv_delete_creates_activity(self, admin_api):
        d = _create_candidate(admin_api, full_name="CV Del Act", email=f"cvd_{_uid()}@example.com")
        cid = d["id"]
        r = admin_api.upload(f"/candidates/{cid}/files", _make_pdf_bytes(), filename="cv.pdf", fields={"file_type": "CV"})
        fid = r.json()[0]["id"]
        admin_api.delete(f"/candidates/{cid}/files/{fid}")
        acts = admin_api.get(f"/candidates/{cid}/activities").json()["data"]
        rm_acts = [a for a in acts if a["type"] == "CV_REMOVED"]
        assert len(rm_acts) >= 1
        _cleanup(admin_api, cid)


# ── 5. Activities ────────────────────────────────────────────────────────────

class TestCandidatesActivities:
    def test_create_note(self, broker1_api):
        d = _create_candidate(broker1_api, full_name="Note Test", email=f"note_{_uid()}@example.com")
        cid = d["id"]
        r = broker1_api.upload(f"/candidates/{cid}/activities", b"", filename="", fields={
            "type": "NOTE",
            "text": "Strong Java background, available from May",
        })
        assert r.status_code == 201
        assert r.json()["type"] == "NOTE"
        assert "Java" in r.json()["text"]
        _cleanup(broker1_api, cid)

    def test_create_proposed_with_client(self, broker1_api):
        d = _create_candidate(broker1_api, full_name="Propose Test", email=f"prop_{_uid()}@example.com")
        cid = d["id"]
        r = broker1_api.upload(f"/candidates/{cid}/activities", b"", filename="", fields={
            "type": "PROPOSED",
            "text": "Proposed for backend position",
            "client_name": "TechVibe GmbH",
        })
        assert r.status_code == 201
        assert r.json()["type"] == "PROPOSED"
        assert r.json()["client_name"] == "TechVibe GmbH"
        _cleanup(broker1_api, cid)

    def test_list_activities_newest_first(self, admin_api):
        d = _create_candidate(admin_api, full_name="Timeline Test", email=f"tl_{_uid()}@example.com")
        cid = d["id"]
        admin_api.upload(f"/candidates/{cid}/activities", b"", filename="", fields={"type": "NOTE", "text": "First"})
        admin_api.upload(f"/candidates/{cid}/activities", b"", filename="", fields={"type": "NOTE", "text": "Second"})
        acts = admin_api.get(f"/candidates/{cid}/activities").json()["data"]
        assert len(acts) >= 2
        # newest first (default ordering)
        dates = [a["created_at"] for a in acts]
        assert dates == sorted(dates, reverse=True)
        _cleanup(admin_api, cid)

    def test_activity_with_file_attachment(self, admin_api):
        d = _create_candidate(admin_api, full_name="Act File Test", email=f"af_{_uid()}@example.com")
        cid = d["id"]
        r = admin_api.upload(f"/candidates/{cid}/activities", b"job spec content", filename="spec.txt", fields={
            "type": "PROPOSED",
            "text": "Proposed to CloudBase",
            "client_name": "CloudBase Inc",
        })
        assert r.status_code == 201
        act = r.json()
        assert len(act["files"]) == 1
        assert act["files"][0]["file_type"] == "ATTACHMENT"
        _cleanup(admin_api, cid)


# ── 6. Contractor Link ──────────────────────────────────────────────────────

class TestCandidatesContractorLink:
    def _get_contractor_user_id(self, api, email="contractor1@test.com"):
        r = api.get("/contractors")
        for c in r.json()["data"]:
            if c["email"] == email:
                return c["id"]
        return None

    def test_link_contractor(self, admin_api):
        d = _create_candidate(admin_api, full_name="Link Test", email=f"link_{_uid()}@example.com")
        cid = d["id"]
        contr_id = self._get_contractor_user_id(admin_api)
        assert contr_id, "contractor1@test.com not found"
        r = admin_api.post(f"/candidates/{cid}/link-contractor", json={"contractor_id": contr_id})
        assert r.status_code == 200
        # verify candidate side
        detail = admin_api.get(f"/candidates/{cid}").json()
        assert detail["contractor_id"] == contr_id
        # verify activity
        acts = admin_api.get(f"/candidates/{cid}/activities").json()["data"]
        linked_acts = [a for a in acts if a["type"] == "LINKED"]
        assert len(linked_acts) >= 1
        # unlink to clean up
        admin_api.delete(f"/candidates/{cid}/link-contractor")
        _cleanup(admin_api, cid)

    def test_unlink_contractor(self, admin_api):
        d = _create_candidate(admin_api, full_name="Unlink Test", email=f"unlink_{_uid()}@example.com")
        cid = d["id"]
        contr_id = self._get_contractor_user_id(admin_api)
        admin_api.post(f"/candidates/{cid}/link-contractor", json={"contractor_id": contr_id})
        r = admin_api.delete(f"/candidates/{cid}/link-contractor")
        assert r.status_code == 204
        detail = admin_api.get(f"/candidates/{cid}").json()
        assert detail["contractor_id"] == ""
        acts = admin_api.get(f"/candidates/{cid}/activities").json()["data"]
        unlinked_acts = [a for a in acts if a["type"] == "UNLINKED"]
        assert len(unlinked_acts) >= 1
        _cleanup(admin_api, cid)

    def test_link_missing_contractor_id(self, admin_api):
        d = _create_candidate(admin_api, full_name="Link Err", email=f"lerr_{_uid()}@example.com")
        r = admin_api.post(f"/candidates/{d['id']}/link-contractor", json={})
        assert r.status_code == 400
        _cleanup(admin_api, d["id"])


# ── 7. Parse CV ──────────────────────────────────────────────────────────────

class TestCandidatesParseCv:
    def test_parse_cv_returns_fields(self, admin_api):
        # Create a simple PDF with text that the parser can extract
        # The endpoint just needs a PDF file — parsing extracts what it can
        r = admin_api.upload("/candidates/parse-cv", _make_pdf_bytes(), filename="cv.pdf")
        assert r.status_code == 200
        d = r.json()
        # response should have the parsed field keys even if empty
        for key in ("full_name", "email", "phone", "skills", "country"):
            assert key in d, f"Missing key: {key}"

    def test_parse_cv_no_file(self, admin_api):
        r = admin_api.post("/candidates/parse-cv")
        assert r.status_code == 400


# ── 8. Access Control ────────────────────────────────────────────────────────

class TestCandidatesAccessControl:
    def test_contractor_forbidden(self, contractor1_api):
        r = contractor1_api.get("/candidates")
        assert r.status_code == 403

    def test_contractor_forbidden_create(self, contractor1_api):
        r = contractor1_api.post("/candidates", json={"full_name": "Nope"})
        assert r.status_code == 403

    def test_client_forbidden(self, client1_api):
        r = client1_api.get("/candidates")
        assert r.status_code == 403

    def test_client_forbidden_search(self, client1_api):
        r = client1_api.get("/candidates/search?q=java")
        assert r.status_code == 403

    def test_admin_allowed(self, admin_api):
        r = admin_api.get("/candidates")
        assert r.status_code == 200

    def test_broker_allowed(self, broker1_api):
        r = broker1_api.get("/candidates")
        assert r.status_code == 200
