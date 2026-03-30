# Invoicing — Architecture & Reference

## Overview

Invoice generation produces a pair of invoices (CLIENT_INVOICE + CONTRACTOR_INVOICE) from an approved timesheet. Billing details are snapshotted at generation time so profile changes don't affect issued invoices.

---

## Invoice Template System

### Template Types (direction labels in UI)
- **CONTRACTOR** ("Contractor → Agency") — contractor sends invoice to agency. From=contractor, Bill To=agency.
- **CLIENT** ("Agency → Client") — agency sends invoice to client. From=agency, Bill To=client.

### Template Scoping
- **Global** — no contractor/client assigned. Created by admin in Settings. Shared with all.
- **Assigned** — owned by a specific contractor or client. Managed on contractor/client detail pages.

### Parent Linking ("Based on")
A contractor's own template can reference a global template as parent via `parent_id`. The parent's data prefills the read-only side of the A4 editor (e.g. agency billing address on the "Bill To" side for Contractor→Agency).

### Template Resolution (invoice generation)
```
resolve_template(type, contractor, client, placement):
  1. Placement-specific template
  2. Contractor + client scoped template
  3. Contractor's own default template
  4. Client default template
  5. Global shared template (no owner)
  6. Fallback: read from ContractorProfile / Client model directly
```

### Status Lifecycle
`DRAFT` → `ACTIVE` → `ARCHIVED`

Only ACTIVE templates are used in resolution. Only DRAFT/ARCHIVED can be deleted.

---

## InvoiceTemplate Model (`apps/invoices/models.py`)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| title | string | human-readable name |
| code | string | short stable reference (e.g. "LT", "EN", "DEFAULT") |
| template_type | enum | CONTRACTOR, CLIENT |
| status | enum | DRAFT, ACTIVE, ARCHIVED |
| contractor | FK User | nullable, owner for CONTRACTOR type |
| client | FK Client | nullable, owner for CLIENT type |
| placement | FK Placement | nullable, most specific scope |
| parent | FK self | nullable, links to global parent template |
| billing_address | text | full sender/recipient block (paste-friendly) |
| company_name | string | |
| registration_number | string | |
| country | string | |
| default_currency | string | |
| vat_registered | bool | nullable (null = inherit) |
| vat_number | string | |
| vat_rate_percent | decimal | |
| bank_name | text | full payment details block (paste-friendly) |
| bank_account_iban | string | |
| bank_swift_bic | string | |
| invoice_series_prefix | string | |
| next_invoice_number | int | nullable, atomic increment |
| payment_terms_days | int | nullable |
| is_default | bool | |

**Constraint:** unique(contractor, template_type) WHERE is_default=True AND status=ACTIVE.

---

## API Endpoints (`/api/v1/invoice-templates`)

| Method | Path | Notes |
|---|---|---|
| GET | `/invoice-templates` | List. Filters: template_type, contractor_id, client_id, status |
| POST | `/invoice-templates` | Create. Global templates: no contractor/client required |
| GET | `/invoice-templates/:id` | Detail (all fields) |
| PATCH | `/invoice-templates/:id` | Update. next_invoice_number can't decrease |
| DELETE | `/invoice-templates/:id` | Only DRAFT/ARCHIVED |
| POST | `/invoice-templates/:id/activate` | DRAFT → ACTIVE |
| POST | `/invoice-templates/:id/archive` | ACTIVE → ARCHIVED |

**Access control:**
- ADMIN: full CRUD on all templates
- BROKER: manage CLIENT templates for assigned clients
- CONTRACTOR: CRUD own + see global templates (for "Based on" dropdown)
- CLIENT_CONTACT: read-only on own client's templates (future)

---

## Invoice Generation Flow (`apps/invoices/views.py`)

1. For each approved timesheet, resolve CONTRACTOR and CLIENT templates via `resolve_template()`
2. If template found → snapshot billing data from template, use template's series/numbering
3. If no template → fallback to ContractorProfile/Client fields (backward compat)
4. `billing_snapshot` JSON includes `template_id` when template was used
5. `_next_contractor_number()` accepts template or profile — atomic F() increment
6. Agency numbering: `AGY-{year}-NNNN` (from `_next_agency_number()`)

### billing_snapshot keys
**Client invoice:** client_company_name, client_billing_address, client_vat_number, client_payment_terms_days
**Contractor invoice:** contractor_company_name, contractor_vat_number, contractor_bank_iban, contractor_bank_swift, contractor_bank_name, contractor_billing_address, contractor_payment_terms_days, contractor_invoice_series_prefix

---

## Invoice PDF Generation (`populate.py:generate_invoice_pdf`)

ReportLab A4 PDF with sections:
1. **Header** — "INVOICE" title, invoice number, issue date, due date, status
2. **From / To** — sender and recipient blocks from billing_snapshot
3. **Line Items** — description, hours, rate, amount
4. **Totals** — subtotal, VAT (if applicable), total
5. **Payment Details** (contractor invoices only) — bank, IBAN, SWIFT
6. **Footer** — invoice number + platform name

---

## Frontend — A4 Invoice Editor

Shared component: `components/shared/invoice-template-editor.tsx`

### Reused by:
- **Settings** (`/settings`) — admin global templates
- **Contractor detail** (`/contractors/[id]`) — Templates tab (admin)
- **Profile** (`/profile`) — Invoice Settings tab (contractor)

### Visual design:
- A4-proportioned white page (680px wide) matching PDF layout
- **Blue tint** = editable fields (saved to template)
- **Amber tint** = auto-filled at generation time (read-only)
- **Legend** above A4 page explains colors
- From/To are single **textareas** (paste full block)
- Payment details is a single **textarea**

### Editable sides depend on context:
| Context | From | Bill To | VAT | Bank |
|---|---|---|---|---|
| Admin global (Contractor→Agency) | amber (contractor) | **blue (agency)** | amber | amber |
| Admin global (Agency→Client) | **blue (agency)** | amber (client) | **blue** | n/a |
| Contractor's own template | **blue (contractor)** | amber (agency from parent) | **blue** | **blue** |

### Toolbar:
- Back button, title + code fields, type label, Default toggle
- "Based on" dropdown (global templates as parent)
- "Global — shared with all contractors/clients" badge (when no owner)
- Activate / Archive / Delete buttons, Save

---

## Future / TODO

- [ ] Parent inheritance: resolve empty fields from parent chain at generation time
- [ ] Placement-level template overrides
- [ ] Agency→Client templates with client-specific overrides
- [ ] PDF generation from templates (replace hardcoded PDF builder)
- [ ] Contractor self-service template creation from profile
- [ ] Template preview: render actual PDF preview from template data
- [ ] Migrate existing ContractorProfile/Client billing data into templates (management command)
