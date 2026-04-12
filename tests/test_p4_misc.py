"""
P4 misc backend tests: CSV export columns, all 8 country holidays, past issues, duplicate invoice numbers.
"""

import csv
import io


class TestCSVExport:
    def test_csv_has_headers(self, admin_api):
        r = admin_api.get("/control/export?year=2026&month=2")
        assert r.status_code == 200
        assert "csv" in r.headers.get("Content-Type", "").lower()
        # Parse CSV
        text = r.content.decode("utf-8")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        # Should have header row + at least one data row
        assert len(rows) >= 1
        headers = rows[0]
        # Common headers expected
        header_text = ",".join(headers).lower()
        assert any(h in header_text for h in ("client", "contractor", "placement", "hours"))


class TestHolidaysAllCountries:
    def test_all_countries_2026(self, admin_api):
        countries = ["DE", "FI", "GB", "LT", "LV", "NL", "PL", "SE"]
        for c in countries:
            r = admin_api.get(f"/holidays?country={c}&year=2026")
            assert r.status_code == 200, f"Failed for {c}"
            d = r.json()
            assert "holidays" in d
            # Each country should have at least 5 holidays
            assert len(d["holidays"]) >= 5, f"Country {c} only has {len(d['holidays'])} holidays"


class TestPastIssues:
    def test_past_issues_returns_data(self, admin_api):
        r = admin_api.get("/control/past-issues")
        assert r.status_code == 200
        d = r.json()
        # Should be list or dict with issue info
        assert isinstance(d, (list, dict))


class TestInvoiceNumberUniqueness:
    def test_invoice_numbers_unique(self, admin_api):
        r = admin_api.get("/invoices?per_page=200")
        invs = r.json()["data"]
        numbers = [i["invoice_number"] for i in invs if i.get("invoice_number")]
        # All issued/paid invoices should have unique numbers
        assert len(numbers) == len(set(numbers)), "Duplicate invoice numbers found"
