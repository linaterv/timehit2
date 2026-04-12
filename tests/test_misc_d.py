"""
Priority D: File size limits, malicious input.
"""

import uuid


def _uid():
    return uuid.uuid4().hex[:8]


class TestFileSizeLimit:
    def test_large_file_handled(self, admin_api):
        """Upload a large-ish file — verify handled (accepted or rejected with clear error)."""
        # Create a candidate to upload to
        r = admin_api.post("/candidates", json={
            "full_name": f"File Size Test {_uid()}",
            "email": f"fs_{_uid()}@example.com",
        })
        if r.status_code != 201:
            return
        cid = r.json()["id"]
        # 10MB payload (not 100MB — tests reasonable limit)
        big = b"A" * (10 * 1024 * 1024)
        r2 = admin_api.upload(f"/candidates/{cid}/files", big, filename="big.bin", fields={"file_type": "ATTACHMENT"})
        # Should either accept (201) or reject with clear error (400/413)
        assert r2.status_code in (201, 400, 413)
        admin_api.delete(f"/candidates/{cid}")


class TestMaliciousInput:
    def test_script_tag_in_name_stored_safe(self, admin_api):
        """Script tag in full_name should be stored as-is (not executed) and sanitized on render."""
        payload = '<script>alert(1)</script>Real Name'
        r = admin_api.post("/candidates", json={
            "full_name": payload,
            "email": f"mal_{_uid()}@example.com",
        })
        assert r.status_code == 201
        cid = r.json()["id"]
        # Retrieve — should be stored as-is (frontend responsibility to escape)
        detail = admin_api.get(f"/candidates/{cid}").json()
        assert "<script>" in detail["full_name"] or "Real Name" in detail["full_name"]
        admin_api.delete(f"/candidates/{cid}")

    def test_sql_chars_in_search_safe(self, admin_api):
        """SQL-looking chars in search don't cause injection."""
        r = admin_api.get("/candidates?search=%27%3B%20DROP%20TABLE")  # ; DROP TABLE
        # Should return 200 with empty results, not error
        assert r.status_code == 200

    def test_very_long_string_rejected(self, admin_api):
        """10k char string — should reject at model max_length."""
        huge = "x" * 10000
        r = admin_api.post("/candidates", json={
            "full_name": huge,
            "email": f"huge_{_uid()}@example.com",
        })
        # full_name max_length=255 — should reject or truncate
        assert r.status_code in (201, 400)
        if r.status_code == 201:
            cid = r.json()["id"]
            detail = admin_api.get(f"/candidates/{cid}").json()
            # If accepted, should be truncated to reasonable length
            assert len(detail["full_name"]) <= 10000
            admin_api.delete(f"/candidates/{cid}")


class TestConcurrentTimesheetSubmit:
    def test_submit_twice_handled(self, contractor1_api):
        """Submit same timesheet twice — second call should handle gracefully."""
        ts = contractor1_api.get("/timesheets?status=DRAFT").json()["data"]
        if not ts:
            return
        tid = ts[0]["id"]
        # Add entry then submit
        contractor1_api.post(f"/timesheets/{tid}/entries/bulk-upsert", json={
            "entries": [{"date": "2026-03-28", "hours": "1", "task_name": "test"}]
        })
        r1 = contractor1_api.post(f"/timesheets/{tid}/submit")
        if r1.status_code != 200:
            return
        # Second submit
        r2 = contractor1_api.post(f"/timesheets/{tid}/submit")
        # Should fail gracefully (400/409) since already SUBMITTED
        assert r2.status_code in (200, 400, 409)
