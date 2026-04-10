"""
Invoice series template engine.

Template syntax: literal text + {VARIABLE} or {VARIABLE:PADDING}
Example: "INV-{YYYY}{MM}-{COUNT_MONTH:3}" → "INV-202604-001"

Variables:
  Date:    YYYY, YY, MM, DD, Q
  Entity:  CLIENT, CONTRACTOR
  Counter: COUNT, COUNT_YEAR, COUNT_MONTH, COUNT_QUARTER
  Padding: {COUNT:4} → 0001
"""

import re
from datetime import date

VARIABLE_PATTERN = re.compile(r"\{(\w+)(?::(\d+))?\}")
LITERAL_PATTERN = re.compile(r"^[A-Za-z0-9\-/._]+$")

DATE_VARS = {"YYYY", "YY", "MM", "DD", "Q"}
ENTITY_VARS = {"CLIENT", "CONTRACTOR"}
COUNTER_VARS = {"COUNT", "COUNT_YEAR", "COUNT_MONTH", "COUNT_QUARTER"}
ALL_VARS = DATE_VARS | ENTITY_VARS | COUNTER_VARS


def validate_template(template: str) -> list[str]:
    """
    Validate a template string. Returns list of errors (empty = valid).
    """
    errors = []
    if not template:
        errors.append("Template is required")
        return errors

    # Check for at least one counter
    found_vars = set()
    for match in VARIABLE_PATTERN.finditer(template):
        var_name = match.group(1)
        found_vars.add(var_name)
        if var_name not in ALL_VARS:
            errors.append(f"Unknown variable: {{{var_name}}}")
        padding = match.group(2)
        if padding and int(padding) > 10:
            errors.append(f"Padding too large: {{{var_name}:{padding}}} (max 10)")

    # Counter vars are optional for client templates (duplicates auto-suffixed),
    # but recommended for contractor templates

    # Check literal parts
    literals = VARIABLE_PATTERN.sub("", template)
    if literals and not LITERAL_PATTERN.match(literals):
        bad = [c for c in literals if not re.match(r"[A-Za-z0-9\-/._]", c)]
        if bad:
            errors.append(f"Invalid literal characters: {''.join(set(bad))}")

    return errors


def parse_variables(template: str) -> list[dict]:
    """Return list of {name, padding} for all variables in template."""
    return [
        {"name": m.group(1), "padding": int(m.group(2)) if m.group(2) else 1}
        for m in VARIABLE_PATTERN.finditer(template)
    ]


def _quarter(month: int) -> int:
    return (month - 1) // 3 + 1


def _counter_key(var_name: str, ref_date: date) -> str:
    """Return the scope key for a counter variable."""
    if var_name == "COUNT":
        return "total"
    if var_name == "COUNT_YEAR":
        return f"year_{ref_date.year}"
    if var_name == "COUNT_MONTH":
        return f"month_{ref_date.year}-{ref_date.month:02d}"
    if var_name == "COUNT_QUARTER":
        return f"quarter_{ref_date.year}-Q{_quarter(ref_date.month)}"
    return "total"


def get_counter_value(counters: dict, key: str) -> int:
    """Get current counter value (0-based — next number is value+1)."""
    return counters.get(key, 0)


def increment_counters(counters: dict, template: str, ref_date: date) -> dict:
    """
    Increment all counter variables referenced in template.
    Returns updated counters dict (caller must save).
    """
    counters = dict(counters)  # shallow copy
    for m in VARIABLE_PATTERN.finditer(template):
        var_name = m.group(1)
        if var_name in COUNTER_VARS:
            key = _counter_key(var_name, ref_date)
            counters[key] = counters.get(key, 0) + 1
    return counters


def resolve_series(
    template: str,
    ref_date: date | None = None,
    client_code: str = "",
    contractor_code: str = "",
    counters: dict | None = None,
    dry_run: bool = False,
) -> tuple[str, dict]:
    """
    Resolve a template string to an invoice number.

    Args:
        template: Template string like "INV-{YYYY}{MM}-{COUNT_MONTH:3}"
        ref_date: Date for date variables (defaults to today)
        client_code: 4-letter client code
        contractor_code: 4-letter contractor code
        counters: Current counter dict from model
        dry_run: If True, don't increment counters (preview mode)

    Returns:
        (resolved_string, updated_counters)
    """
    if ref_date is None:
        ref_date = date.today()
    if counters is None:
        counters = {}

    # Increment counters first (so we use the NEW value)
    if not dry_run:
        new_counters = increment_counters(counters, template, ref_date)
    else:
        # For preview, show what the NEXT number would be
        new_counters = increment_counters(counters, template, ref_date)

    def replace_var(match):
        var_name = match.group(1)
        padding = int(match.group(2)) if match.group(2) else 1

        if var_name == "YYYY":
            return str(ref_date.year)
        if var_name == "YY":
            return str(ref_date.year)[-2:]
        if var_name == "MM":
            return f"{ref_date.month:02d}"
        if var_name == "DD":
            return f"{ref_date.day:02d}"
        if var_name == "Q":
            return str(_quarter(ref_date.month))
        if var_name == "CLIENT":
            return client_code or "XXXX"
        if var_name == "CONTRACTOR":
            return contractor_code or "XXXX"
        if var_name in COUNTER_VARS:
            key = _counter_key(var_name, ref_date)
            value = new_counters.get(key, 1)
            return str(value).zfill(padding)
        return match.group(0)

    result = VARIABLE_PATTERN.sub(replace_var, template)

    if dry_run:
        return result, counters  # return original counters unchanged
    return result, new_counters
