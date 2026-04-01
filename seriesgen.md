# Invoice Series Template Engine

Users can define custom invoice number formats using a template string with variables enclosed in curly braces.

## Available Variables

### Date/Time
| Variable | Description | Example |
|---|---|---|
| `{YYYY}` | Full year | 2026 |
| `{YY}` | Short year | 26 |
| `{MM}` | Month, zero-padded | 01–12 |
| `{DD}` | Day, zero-padded | 01–31 |
| `{Q}` | Quarter | 1–4 |

### Entity Codes
| Variable | Description | Example |
|---|---|---|
| `{CLIENT}` | Client 4-letter code | ACME |
| `{CONTRACTOR}` | Contractor 4-letter code | ALTU |

### Counters
| Variable | Description | Resets |
|---|---|---|
| `{COUNT}` | Total invoice count | Never |
| `{COUNT_YEAR}` | Yearly counter | Each calendar year |
| `{COUNT_MONTH}` | Monthly counter | Each calendar month |
| `{COUNT_QUARTER}` | Quarterly counter | Each calendar quarter |

### Padding
Any counter variable supports zero-padding via colon notation:
- `{COUNT:4}` → `0001`, `0002` ... `9999`
- `{COUNT_YEAR:3}` → `001`, `002` ... `999`
- Default padding is 1 (no leading zeros)

### Literal Text
Any characters outside curly braces are literal. Supported: `A-Z a-z 0-9 - / . _`

## Rules

1. Template **must contain at least one counter variable**
2. Entity codes are 4 uppercase Latin letters (A–Z), auto-generated from entity names
3. Counter values are per-template scope (each InvoiceTemplate or ContractorProfile has its own counters)
4. Counter increments are **atomic** (uses `select_for_update` to prevent duplicates under concurrency)
5. Once an invoice number is generated, it is **immutable**
6. Template itself can be changed at any time — only affects future invoices
7. **Legacy support**: plain prefixes without `{VAR}` (e.g. `AT-2026-`) auto-append `{COUNT_YEAR:4}`
8. Counters stored as JSON on InvoiceTemplate/ContractorProfile: `{"total": N, "year_2026": N, "month_2026-04": N, "quarter_2026-Q2": N}`

## Example Templates

| Template | Example Output |
|---|---|
| `INV-{YYYY}{MM}-{COUNT_MONTH:3}` | INV-202604-001 |
| `{CLIENT}-{YY}-{COUNT_YEAR:4}` | ACME-26-0042 |
| `{YYYY}/{COUNT:5}` | 2026/00153 |
| `{CONTRACTOR}-{YY}{MM}{DD}-{COUNT:3}` | ALTU-260401-007 |
| `{CONTRACTOR}-{CLIENT}-{COUNT:5}` | ALTU-ACME-00153 |
| `{Q}Q{YY}-{COUNT_QUARTER:3}` | 2Q26-014 |
| `AT-2026-` (legacy) | AT-2026-0001 |

## API

### Preview (dry run)
```
POST /api/v1/invoices/preview-series
{
  "template": "INV-{YYYY}{MM}-{COUNT_MONTH:3}",
  "placement_id": "uuid"   // optional, resolves CLIENT/CONTRACTOR codes
}

→ { "valid": true, "preview": "INV-202604-001", "variables": [...], "errors": [] }
```

### Validation
Template strings are validated when saving InvoiceTemplate via `PATCH /invoice-templates/:id`. Errors returned if:
- No counter variable present
- Unknown variable name
- Invalid literal characters
- Padding > 10

## Implementation

- Engine: `backend/apps/invoices/series_engine.py`
- Tests: `backend/apps/invoices/test_series.py` (23 tests)
- Counter storage: `InvoiceTemplate.counters` and `ContractorProfile.counters` (JSONField)
- Generation: `_next_number()` in `backend/apps/invoices/views.py`
