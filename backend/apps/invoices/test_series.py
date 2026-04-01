"""Unit tests for invoice series template engine."""
from datetime import date
from .series_engine import validate_template, parse_variables, resolve_series, increment_counters


class TestValidation:
    def test_empty_template(self):
        assert validate_template("") == ["Template is required"]

    def test_no_counter(self):
        errs = validate_template("INV-{YYYY}{MM}")
        assert any("counter" in e.lower() for e in errs)

    def test_valid_template(self):
        assert validate_template("INV-{YYYY}{MM}-{COUNT_MONTH:3}") == []

    def test_unknown_variable(self):
        errs = validate_template("{BOGUS}-{COUNT}")
        assert any("Unknown" in e for e in errs)

    def test_excessive_padding(self):
        errs = validate_template("{COUNT:15}")
        assert any("Padding too large" in e for e in errs)

    def test_invalid_literal_chars(self):
        errs = validate_template("INV#{COUNT}")
        assert any("Invalid literal" in e for e in errs)

    def test_all_vars_valid(self):
        tpl = "{YYYY}{YY}{MM}{DD}{Q}{CLIENT}{CONTRACTOR}{COUNT}{COUNT_YEAR}{COUNT_MONTH}{COUNT_QUARTER}"
        assert validate_template(tpl) == []

    def test_literal_chars_allowed(self):
        assert validate_template("INV-/{COUNT}") == []
        assert validate_template("A.B_C-D/{COUNT}") == []


class TestParsing:
    def test_parse_simple(self):
        result = parse_variables("INV-{YYYY}-{COUNT:4}")
        assert len(result) == 2
        assert result[0] == {"name": "YYYY", "padding": 1}
        assert result[1] == {"name": "COUNT", "padding": 4}

    def test_parse_no_padding(self):
        result = parse_variables("{COUNT}")
        assert result[0]["padding"] == 1


class TestResolve:
    def test_date_vars(self):
        d = date(2026, 4, 1)
        result, _ = resolve_series("{YYYY}-{YY}-{MM}-{DD}-{Q}-{COUNT}", ref_date=d)
        assert result == "2026-26-04-01-2-1"

    def test_entity_vars(self):
        result, _ = resolve_series("{CLIENT}-{CONTRACTOR}-{COUNT}", client_code="ACME", contractor_code="JOHN")
        assert "ACME-JOHN-1" == result

    def test_missing_entity(self):
        result, _ = resolve_series("{CLIENT}-{COUNT}")
        assert result.startswith("XXXX-")

    def test_padding(self):
        result, _ = resolve_series("{COUNT:4}")
        assert result == "0001"

    def test_counter_increment(self):
        _, c1 = resolve_series("{COUNT}", counters={})
        assert c1["total"] == 1
        result, c2 = resolve_series("{COUNT:3}", counters=c1)
        assert result == "002"
        assert c2["total"] == 2

    def test_year_counter(self):
        d = date(2026, 4, 1)
        _, c = resolve_series("{COUNT_YEAR}", ref_date=d, counters={})
        assert c["year_2026"] == 1
        result, c2 = resolve_series("{COUNT_YEAR:3}", ref_date=d, counters=c)
        assert result == "002"

    def test_month_counter(self):
        d = date(2026, 4, 1)
        _, c = resolve_series("{COUNT_MONTH}", ref_date=d, counters={})
        assert c["month_2026-04"] == 1
        # Different month starts fresh
        d2 = date(2026, 5, 1)
        result, _ = resolve_series("{COUNT_MONTH}", ref_date=d2, counters=c)
        assert result == "1"

    def test_quarter_counter(self):
        d = date(2026, 4, 1)  # Q2
        _, c = resolve_series("{COUNT_QUARTER}", ref_date=d, counters={})
        assert c["quarter_2026-Q2"] == 1

    def test_dry_run(self):
        result, c = resolve_series("{COUNT:4}", counters={}, dry_run=True)
        assert result == "0001"
        assert c == {}  # counters unchanged

    def test_full_template(self):
        d = date(2026, 4, 15)
        result, _ = resolve_series(
            "INV-{YYYY}{MM}-{COUNT_MONTH:3}",
            ref_date=d, counters={},
        )
        assert result == "INV-202604-001"

    def test_complex_template(self):
        d = date(2026, 4, 1)
        result, _ = resolve_series(
            "{CLIENT}-{YY}-{COUNT_YEAR:4}",
            ref_date=d, client_code="ACME", counters={},
        )
        assert result == "ACME-26-0001"


class TestIncrementCounters:
    def test_multiple_counters(self):
        d = date(2026, 4, 1)
        tpl = "{COUNT}-{COUNT_YEAR}-{COUNT_MONTH}"
        c = increment_counters({}, tpl, d)
        assert c["total"] == 1
        assert c["year_2026"] == 1
        assert c["month_2026-04"] == 1

    def test_preserves_other_keys(self):
        d = date(2026, 4, 1)
        c = {"total": 5, "year_2025": 10}
        c2 = increment_counters(c, "{COUNT}", d)
        assert c2["total"] == 6
        assert c2["year_2025"] == 10  # untouched
