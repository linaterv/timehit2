# Invoice Templates — Requirements & Architecture

## Problem

Billing data (company info, bank, VAT, series prefix, numbering) lives directly on `ContractorProfile` and `Client` models — each entity gets exactly **one** set of billing settings. We need **multiple invoice templates** per user, with hierarchy and scoping.

## Requirements

1. Each contractor, client, broker, and the agency itself can have **multiple** invoice templates.
2. An invoice template holds all settings needed for PDF generation: company address, bank details, VAT, sender info, invoice series/numbering rules, payment terms.
3. Templates are scoped: a template can be the user's default, specific to a client, or specific to a placement.
4. Templates support **parent→child nesting** (child inherits missing fields from parent). Nesting is Phase 2.
5. Each template has: **type** (CONTRACTOR, CLIENT, AGENCY), **status** (DRAFT, ACTIVE, ARCHIVED), and references to parent template, client, contractor, placement.
6. Invoice generation resolves the most specific ACTIVE template and snapshots from it (falling back to current ContractorProfile/Client if no template exists).

---

## InvoiceTemplate Model

```
InvoiceTemplate
├── id (UUID)
├── name (string)                     — "Default", "German Entity", "TechVibe EUR"
├── template_type (enum)              — CONTRACTOR | CLIENT | AGENCY
├── status (enum)                     — DRAFT | ACTIVE | ARCHIVED
│
├── contractor (FK User, nullable)    — owner for CONTRACTOR type
├── client (FK Client, nullable)      — owner for CLIENT type, or scope for CONTRACTOR
├── placement (FK Placement, nullable)— most specific scope
├── parent (FK self, nullable)        — for inherited/nested templates
│
├── company_name
├── registration_number
├── billing_address
├── country
├── default_currency
│
├── vat_registered (bool, nullable)   — null = inherit from parent
├── vat_number
├── vat_rate_percent
│
├── bank_name
├── bank_account_iban
├── bank_swift_bic
│
├── invoice_series_prefix
├── next_invoice_number (int, nullable)
│
├── payment_terms_days (int, nullable)
│
├── is_default (bool)                 — marks the default template per type+owner
├── created_at, updated_at
│
└── Constraint: unique(contractor, template_type) WHERE is_default=True AND status=ACTIVE
```

**Type meanings:**
- **CONTRACTOR** — contractor's billing/company/bank/VAT/series settings (used as "From" on contractor invoices)
- **CLIENT** — client's billing address and payment terms (used as "Bill To" on client invoices)
- **AGENCY** — the agency's own entity info (used as "From" on client invoices; currently hardcoded as "TimeHit Agency" + `AGY-{year}-NNNN`)

---

## Template Resolution

When generating an invoice, resolve the most specific ACTIVE template:

```
resolve_template(type, contractor, client, placement):
  1. Placement-specific:  type + placement=X + status=ACTIVE
  2. Client-scoped:       type + contractor=X + client=Y + no placement + status=ACTIVE
  3. Default:             type + contractor=X + no client + no placement + is_default + status=ACTIVE
  4. Fallback:            Read from ContractorProfile / Client model directly
```

Fallback ensures **zero breaking changes** when no templates exist yet.

**Parent inheritance** (Phase 2): when resolved template has empty fields, walk up `parent` chain:
```
resolve_field(template, field):
  while template:
    if template.field is set → return it
    template = template.parent
  return None
```

---

## Changes to Invoice Generation

Current flow (`apps/invoices/views.py`):
- Reads billing data from `ContractorProfile` / `Client`
- Snapshots into `billing_snapshot` JSON on Invoice
- Uses `_next_contractor_number(profile)` for numbering

New flow:
1. Call `resolve_template(CONTRACTOR, contractor, client, placement)`
2. If template found → snapshot from template, use template's series/numbering (atomic F() increment on template)
3. If no template → fallback to current ContractorProfile/Client logic
4. `billing_snapshot` keeps same JSON keys + adds `"template_id"` for audit trail

---

## API Endpoints

```
GET    /api/v1/invoice-templates              — List (filter: template_type, contractor_id, client_id, status)
POST   /api/v1/invoice-templates              — Create
GET    /api/v1/invoice-templates/:id          — Detail
PATCH  /api/v1/invoice-templates/:id          — Update
DELETE /api/v1/invoice-templates/:id          — Delete (DRAFT/ARCHIVED only)
POST   /api/v1/invoice-templates/:id/activate — DRAFT → ACTIVE
POST   /api/v1/invoice-templates/:id/archive  — ACTIVE → ARCHIVED
```

**Access control:**
- ADMIN: full CRUD on all templates
- BROKER: manage CLIENT templates for assigned clients
- CONTRACTOR: CRUD own CONTRACTOR templates only
- CLIENT_CONTACT: read-only on own client's templates (future)

**Validation:**
- CONTRACTOR type requires `contractor` FK
- CLIENT type requires `client` FK
- `is_default=True` + `status=ACTIVE` unique per contractor+type
- `next_invoice_number` cannot decrease
- If `placement` set, validate contractor/client match the placement

---

## Migration Strategy

**Phase 1 — Add model + dual-read (no breaking changes):**
- Add InvoiceTemplate model + migration
- Add CRUD API endpoints
- Modify GenerateInvoicesView: resolve_template() with fallback to current logic
- All 73 backend tests + 54 Playwright tests pass unchanged

**Phase 2 — Data migration:**
- Management command `migrate_billing_to_templates`:
  - For each ContractorProfile → create ACTIVE default CONTRACTOR template
  - For each Client → create ACTIVE default CLIENT template
- Update `populate` command to create sample templates

**Phase 3 — Remove fallback (future):**
- Remove fallback path in resolve_template()
- Deprecate billing fields on ContractorProfile/Client

---

## Frontend Changes

**Profile page** (`profile/page.tsx`) — "Invoice Settings" tab:
- Replace current inline form with template card list
- Each card: name, status badge, "Default" badge, edit/delete
- Click card → slide-over with full form (same fields as current)
- "New Template" button → creates DRAFT

**Contractor detail** (`contractors/[id]/page.tsx`) — admin view:
- Add "Templates" tab with same card list + slide-over pattern

**Client detail** (`clients/[id]/page.tsx`) — admin/broker view:
- Add "Billing Templates" tab for CLIENT-type templates

---

## Files to Modify

| File | Change |
|---|---|
| `backend/apps/invoices/models.py` | Add InvoiceTemplate model |
| `backend/apps/invoices/serializers.py` | Add template serializers |
| `backend/apps/invoices/views.py` | Add ViewSet, resolve_template(), update GenerateInvoicesView |
| `backend/apps/invoices/urls.py` | Register template routes |
| `frontend/types/api.ts` | Add InvoiceTemplate types |
| `frontend/app/(authenticated)/profile/page.tsx` | Template manager on Invoice Settings tab |
| `frontend/app/(authenticated)/contractors/[id]/page.tsx` | Templates tab |
| `frontend/app/(authenticated)/clients/[id]/page.tsx` | Billing Templates tab |

---

## TODO — Atomic Steps

### Phase 1: Backend Model & API

- [x] **1. Add InvoiceTemplate model** — Add model class to `apps/invoices/models.py` with all fields, enums, Meta, constraint. Run `makemigrations` + `migrate`.
- [x] **2. Add template serializers** — In `apps/invoices/serializers.py`: InvoiceTemplateListSerializer, InvoiceTemplateDetailSerializer, InvoiceTemplateCreateSerializer, InvoiceTemplateUpdateSerializer. Include validation (type↔FK, next_invoice_number can't decrease, placement matches contractor/client).
- [x] **3. Add InvoiceTemplateViewSet** — In `apps/invoices/views.py`: ViewSet with list/create/retrieve/update/destroy + `activate` and `archive` actions. Access control per role. Filter by template_type, contractor_id, client_id, status.
- [x] **4. Register URL routes** — In `apps/invoices/urls.py`: `router.register("invoice-templates", views.InvoiceTemplateViewSet)`.
- [x] **5. Add resolve_template()** — In `apps/invoices/views.py` (or new `template_resolver.py`): resolution function with placement → client → default → fallback chain.
- [x] **6. Wire into GenerateInvoicesView** — Modify `post()` to call `resolve_template()` for contractor and client side. If template found → snapshot from it + use its numbering. If not → existing fallback. Add `template_id` to billing_snapshot.
- [x] **7. Run existing backend tests** — Verify all 73 tests pass unchanged (fallback path exercised, no templates exist yet).

### Phase 2: Data Migration & Populate

- [x] **8. Update populate command** — After creating ContractorProfiles and Clients, also create default ACTIVE InvoiceTemplates for each. Copy billing fields from profile/client.
- [ ] **9. (SKIPPED) Create migrate_billing_to_templates command** — Management command that creates templates from existing ContractorProfile + Client data for production use.

### Phase 3: Frontend — TypeScript Types

- [x] **10. Add InvoiceTemplate types** — In `frontend/types/api.ts`: add InvoiceTemplateType, InvoiceTemplateStatus, InvoiceTemplate interface.

### Phase 4: Frontend — Profile Page Template Manager

- [x] **11. Profile "Invoice Settings" tab — template list** — Replace current inline form with a list of template cards (name, status badge, default badge). Add "New Template" button.
- [x] **12. Profile — template edit slide-over** — Click a template card → opens slide-over with full form (same fields: company, VAT, bank, series, payment terms). Save = PATCH, delete = DELETE.
- [x] **13. Profile — activate/archive actions** — Status transition buttons in slide-over: "Activate" (DRAFT→ACTIVE), "Archive" (ACTIVE→ARCHIVED).

### Phase 5: Frontend — Admin Pages

- [x] **14. Contractor detail — Templates tab** — Add tab to `contractors/[id]/page.tsx` showing CONTRACTOR templates for that user. Same card list + slide-over. Admin can CRUD.
- [x] **15. Client detail — Billing Templates tab** — Add tab to `clients/[id]/page.tsx` showing CLIENT templates for that client. Admin/broker can CRUD.

### Phase 6: Verify

- [x] **16. Build + test** — `npm run build`, run 73 backend tests, run 54 Playwright tests. Manual test: create template → generate invoice → verify billing_snapshot uses template data → verify PDF.
