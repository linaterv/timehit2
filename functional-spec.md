# Functional Requirements Specification: IT Contracting Agency Platform

## 1. Glossary

| Term | Meaning |
|---|---|
| Placement | 1 contractor placed at 1 client at agreed rates. The central business object. |
| Broker | Agency employee managing a portfolio of clients and their placements. |
| Timesheet | Monthly record of daily hours for one placement. |
| Client Invoice | Invoice TO the client (at client rate). |
| Contractor Invoice | Invoice as payment TO the contractor (at contractor rate). |
| Margin | Client rate - contractor rate, per hour. |
| Control Screen | Operational dashboard for brokers/admins. |

---

## 2. Entity Model

### 2.1 User

| Field | Type | Notes |
|---|---|---|
| id | UUID | system-generated |
| email | string | unique, used for login |
| full_name | string | |
| role | enum | ADMIN, BROKER, CONTRACTOR, CLIENT_CONTACT |
| is_active | boolean | default true |
| theme | string | preferred theme id, default "" (uses browser localStorage or "light") |
| created_at / updated_at | timestamp | |

### 2.2 Client

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| company_name | string | |
| registration_number | string | optional |
| vat_number | string | optional |
| billing_address | text | required for invoicing |
| country | string | |
| default_currency | currency_code | default EUR |
| payment_terms_days | integer | optional, e.g. 30 |
| is_active | boolean | default true |
| notes | text | optional |

**Relationships:** has many Client Contacts, has many Placements, has many assigned Brokers (many-to-many).

### 2.3 Client Contact

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | FK -> User | role = CLIENT_CONTACT |
| client_id | FK -> Client | |
| job_title | string | optional |
| phone | string | optional |
| is_primary | boolean | default false |

### 2.4 Contractor Profile

Invoice settings that apply across ALL placements. Stored on profile, NOT per placement.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | FK -> User | role = CONTRACTOR |
| company_name | string | optional (if invoicing via company) |
| registration_number | string | optional |
| vat_registered | boolean | default false |
| vat_number | string | required if vat_registered |
| vat_rate_percent | decimal | required if vat_registered |
| invoice_series_prefix | string | e.g. "INV-", "JD-2026-" |
| next_invoice_number | integer | default 1, auto-increments |
| bank_name | string | optional |
| bank_account_iban | string | optional |
| bank_swift_bic | string | optional |
| payment_terms_days | integer | optional |
| billing_address | text | optional |
| country | string | |
| default_currency | currency_code | default EUR |

**Critical rule:** When a contractor invoice is generated, current profile values are snapshotted onto the invoice record so later edits don't alter issued invoices.

### 2.5 Broker-Client Assignment

| Field | Type | Notes |
|---|---|---|
| broker_user_id | FK -> User | role = BROKER |
| client_id | FK -> Client | |
| assigned_at | timestamp | |

### 2.6 Placement

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| client_id | FK -> Client | |
| contractor_id | FK -> User | role = CONTRACTOR |
| title | string | position/role title, e.g. "Backend Developer", "Cloud Architect" |
| client_rate | decimal | hourly rate billed to client |
| contractor_rate | decimal | hourly rate paid to contractor |
| currency | currency_code | default EUR |
| start_date | date | required |
| end_date | date | optional (null = open-ended) |
| status | enum | DRAFT, ACTIVE, COMPLETED, CANCELLED |
| approval_flow | enum | BROKER_ONLY, CLIENT_THEN_BROKER |
| require_timesheet_attachment | boolean | default false |
| client_can_view_invoices | boolean | default false |
| client_can_view_documents | boolean | default false |
| client_invoice_template | FK -> InvoiceTemplate | nullable, global CLIENT template to use for client invoices |
| notes | text | optional |

**Immutability rule:** Once ACTIVE, `client_rate`, `contractor_rate`, and `currency` are locked. To change rates, create a new placement (system offers "Copy Placement" action).

Same contractor CAN have multiple active placements with same client (different projects/rates). Overlapping date ranges allowed.

### 2.7 Placement Document

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| placement_id | FK -> Placement | |
| file_name | string | original name |
| file_path | string | storage path |
| file_size_bytes | integer | |
| mime_type | string | |
| label | string | optional, e.g. "NDA", "Contract" |
| uploaded_by_user_id | FK -> User | |
| uploaded_at | timestamp | |
| visible_to_client | boolean | default false, controls client visibility |
| visible_to_contractor | boolean | default false, controls contractor visibility |

Simple upload/download/delete. No mandatory docs. No versioning or e-signatures. Per-document visibility: admin/broker toggles which roles can see each document. Contractors only see docs marked `visible_to_contractor`. Clients only see docs marked `visible_to_client` (and only if placement `client_can_view_documents` is enabled).

### 2.8 Timesheet

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| placement_id | FK -> Placement | |
| year | integer | e.g. 2026 |
| month | integer | 1-12 |
| status | enum | see state machines |
| total_hours | decimal | computed from entries |
| submitted_at | timestamp | nullable |
| approved_at | timestamp | nullable |
| approved_by_user_id | FK -> User | nullable |
| rejected_at | timestamp | nullable |
| rejected_by_user_id | FK -> User | nullable |
| rejection_reason | text | nullable |

**Unique constraint:** One timesheet per (placement_id, year, month). On rejection, the SAME record transitions back to DRAFT (not a new record).

### 2.9 Timesheet Entry

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| timesheet_id | FK -> Timesheet | |
| date | date | within month AND placement date range |
| hours | decimal | 0-24 |
| task_name | string | optional, free-text (ad-hoc) |
| notes | text | optional |

Multiple entries per day allowed (one per task). Sum of hours per day <= 24. Editable only when parent timesheet is DRAFT.

### 2.10 Timesheet Attachment

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| timesheet_id | FK -> Timesheet | |
| file_name / file_path / file_size_bytes / mime_type | | standard file fields |
| uploaded_by_user_id | FK -> User | |
| uploaded_at | timestamp | |

If `require_timesheet_attachment = true` on placement, at least one attachment required before submission.

### 2.11 Invoice

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| invoice_number | string | unique; auto-generated for timesheet-derived invoices, user-entered for manual invoices |
| invoice_type | enum | CLIENT_INVOICE, CONTRACTOR_INVOICE |
| is_manual | boolean | default false. When true, invoice was hand-created (e.g. permanent-find fee) and is not derived from a timesheet |
| timesheet_id | FK -> Timesheet | nullable; required for auto-generated, null for manual |
| placement_id | FK -> Placement | nullable; required for auto-generated, null for manual |
| client_id | FK -> Client | nullable; required for auto-generated, optional for manual (Admin-only when null) |
| contractor_id | FK -> User | nullable; required for auto-generated and for CONTRACTOR_INVOICE, null for manual |
| candidate_id | UUID | nullable; optional link to a CRM candidate (stored as plain UUID, no FK — candidates live in a separate DB) |
| year / month | integer | billing period; nullable for manual |
| currency | currency_code | from placement for auto-generated; user-entered for manual |
| hourly_rate | decimal | nullable for manual (manual uses line items instead of rate×hours) |
| total_hours | decimal | nullable for manual |
| subtotal | decimal | auto-generated: rate × hours. Manual: sum of line item line_totals |
| vat_rate_percent | decimal | nullable |
| vat_amount | decimal | nullable; manual: subtotal × vat_rate_percent / 100 |
| total_amount | decimal | subtotal + vat_amount |
| status | enum | DRAFT, ISSUED, PAID, VOIDED, CORRECTED |
| issue_date | date | user-entered for manual (not auto-today) |
| due_date | date | nullable, from payment terms |
| payment_date | date | nullable, broker-entered |
| payment_reference | string | nullable |
| payment_terms_days | integer | nullable; copied from AgencySettings or per-template default for manual |
| generated_by_user_id | FK -> User | creator |
| pdf_file_path | string | nullable; manual invoices do NOT auto-generate PDFs on issue. PDF is optional and on-demand |
| billing_snapshot | JSON | see snapshotted fields below. For manual without Client link, holds the hand-typed bill-to (name, address, country, VAT number) |

**Snapshotted fields** at generation/creation time (so later profile/client edits don't affect issued invoices):
- Contractor invoices (auto): company_name, vat_number, bank details, billing_address, payment_terms, series_prefix
- Client invoices (auto): client billing details
- Manual invoices: bill-to block (from Client's InvoiceTemplate if linked, else hand-typed), bank details (from AgencySettings default client InvoiceTemplate — prefilled but editable on the form)

**Invoice numbering:**
- Auto-generated client invoices: agency-controlled global sequence (e.g., "AGY-2026-0001")
- Auto-generated contractor invoices: contractor's own series prefix + next_invoice_number from profile, then increment
- **Manual invoices**: user types the invoice_number directly. System does NOT consume a counter, does NOT auto-suggest. Only constraint is the existing DB uniqueness on invoice_number

### 2.11a Invoice Line Item

Used only by manual invoices. Auto-generated invoices render a single logical line from `hourly_rate × total_hours` and do not populate this table.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| invoice_id | FK -> Invoice | |
| display_order | integer | ascending for UI order |
| description | text | free-form, e.g. "Permanent placement fee — John Doe" |
| quantity | decimal | default 1 |
| unit_price | decimal | |
| line_total | decimal | quantity × unit_price (computed, stored for stability) |

### 2.12 Invoice Notification

Audit log of events on an invoice. Separate model. Created automatically on status transitions.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| invoice_id | FK -> Invoice | |
| created_at | timestamp | when the event occurred |
| created_by | FK -> User | who triggered the event |
| title | string | e.g. "Invoice Created", "Invoice Issued", "Payment Received" |
| text | text | descriptive message |
| status | string | invoice status at time of event (DRAFT, ISSUED, PAID, VOIDED, CORRECTED) |
| visible_to_contractor | boolean | default false. Whether contractor can see this notification |
| visible_to_client | boolean | default false. Whether client contact can see this notification |

Auto-created on: invoice creation (DRAFT), issue (ISSUED), mark paid (PAID), void (VOIDED), correct (CORRECTED).

Visibility: Admin/Broker see all notifications. Contractor/Client Contact only see notifications where their respective `visible_to_*` flag is true.

### 2.13 Invoice Correction Link

| Field | Type | Notes |
|---|---|---|
| original_invoice_id | FK -> Invoice | |
| corrective_invoice_id | FK -> Invoice | |
| reason | text | optional |

### 2.14 Invoice Template

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| title | string | human-readable name, e.g. "Default", "German Entity" |
| code | string | short stable reference code, e.g. "LT", "EN", "DEFAULT". Unique per template_type. |
| template_type | enum | CONTRACTOR, CLIENT, AGENCY |
| status | enum | DRAFT, ACTIVE, ARCHIVED |
| contractor | FK -> User | nullable, owner for CONTRACTOR type |
| client | FK -> Client | nullable, owner for CLIENT type or scope |
| placement | FK -> Placement | nullable, most specific scope |
| parent | FK -> self | nullable, for nested/inherited templates (Phase 2) |
| company_name | string | |
| registration_number | string | |
| billing_address | text | |
| country | string | |
| default_currency | string | |
| vat_registered | boolean | nullable (null = inherit from parent) |
| vat_number | string | |
| vat_rate_percent | decimal | |
| bank_name | string | |
| bank_account_iban | string | |
| bank_swift_bic | string | |
| invoice_series_prefix | string | |
| next_invoice_number | integer | nullable |
| payment_terms_days | integer | nullable |
| is_default | boolean | marks the default template per type+owner |

**Constraint:** At most one default ACTIVE template per (contractor, template_type).

**Template Resolution** (invoice generation): placement-specific -> client-scoped -> default -> fallback to ContractorProfile/Client fields.

### 2.15 Agency Settings

Singleton model storing agency-wide defaults. Admin only.

| Field | Type | Notes |
|---|---|---|
| default_payment_terms_client_days | integer | default 30, applied to new placements |
| default_payment_terms_contractor_days | integer | default 35, applied to new placements |
| default_client_invoice_template | FK -> InvoiceTemplate | nullable, default CLIENT template for new placements |

### 2.16 Audit Log

Generic audit trail for tracking who did what to any entity. Entity-agnostic via `entity_type` + `entity_id`.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| entity_type | string | "timesheet", "placement", "invoice" — extensible, no enum |
| entity_id | UUID | references any entity |
| action | string | SUBMITTED, APPROVED, REJECTED, WITHDRAWN, ENTRIES_UPDATED, etc |
| title | string | human-readable summary |
| text | text | optional detail (e.g. rejection reason) |
| data_before | JSON | nullable, state snapshot before change |
| data_after | JSON | nullable, state snapshot after change |
| created_by | FK -> User | who performed the action |
| created_at | timestamp | when |
| visible_to_contractor | boolean | default true |
| visible_to_client | boolean | default true |

Attached to **Timesheets** and **Placements**. Timesheet events: create, submit, withdraw, approve, client_approve, reject, entries updated. Placement events: create, update, activate, complete, cancel, copy. Each stores full before/after snapshot. Displayed in a History tab on both timesheet and placement detail pages.

---

## 3. State Machines

### 3.1 Placement

```
DRAFT --[activate]--> ACTIVE --[complete]--> COMPLETED
                             --[cancel]----> CANCELLED
```

- DRAFT -> ACTIVE: rates, dates, contractor, client must be set. Rates become immutable.
- ACTIVE -> COMPLETED/CANCELLED: warn if open timesheets exist.

### 3.2 Timesheet (BROKER_ONLY flow)

```
DRAFT --[submit]--> SUBMITTED --[approve]--> APPROVED
                              --[reject]---> REJECTED --[edit]--> DRAFT
                              --[withdraw]-> DRAFT (contractor can withdraw before approval)
```

### 3.3 Timesheet (CLIENT_THEN_BROKER flow)

```
DRAFT --[submit]--> SUBMITTED --[client_approve]--> CLIENT_APPROVED --[broker_approve]--> APPROVED
                              --[client_reject]---> REJECTED --[edit]--> DRAFT
                              --[withdraw]--------> DRAFT (contractor can withdraw before any approval)
                                                    CLIENT_APPROVED --[broker_reject]--> REJECTED --[edit]--> DRAFT
```

### 3.4 Invoice

```
DRAFT --[issue]--> ISSUED --[mark_paid]--> PAID
                          --[void]-------> VOIDED
                          --[correct]----> CORRECTED (new invoice created)
DRAFT --[delete]--> (removed, DRAFT only)
PAID  --[void]---> VOIDED (mistake correction)
```

---

## 4. User Flows

### 4.1 Placement Creation

1. Admin/Broker creates client (if new), assigns broker(s).
2. Creates placement: select client, contractor, set rates, currency, dates, approval flow, attachment requirement, client visibility flags.
3. Created in DRAFT. Upload docs (optional). Activate when ready.
4. **Copy Placement**: pre-fills from existing placement, new start date = day after original's end date. Used for rate changes.

### 4.2 Timesheet Flow

1. Contractor navigates to placement, selects month -> creates/opens timesheet (DRAFT).
2. Enters daily hours with optional ad-hoc task names and notes.
3. Attaches files if required by placement.
4. Submits (validates: entries exist, attachment if required, no day > 24h).
5. **BROKER_ONLY**: broker approves/rejects.
6. **CLIENT_THEN_BROKER**: client approves/rejects -> if approved, broker confirms/rejects.
7. Rejection -> back to DRAFT with reason. Contractor edits and resubmits (goes through full approval again).

### 4.3 Invoice Generation (auto, from timesheet)

1. From control page, broker sees approved timesheets without invoices.
2. Selects one or multiple -> "Generate Invoices".
3. System creates TWO invoices per timesheet (client + contractor), both in DRAFT.
4. Broker reviews, marks as ISSUED -> PDF generated.
5. Payment: broker enters payment_date -> ISSUED -> PAID.
6. Void: ISSUED/PAID -> VOIDED (remains in system).
7. Correct: ISSUED -> CORRECTED, new corrective invoice created.
8. Re-generate: if both invoices VOIDED, generation available again for that timesheet.

### 4.3a Manual Invoice Creation (no timesheet)

Use case: one-off sales such as a **permanent-placement finder's fee**. The invoice is itself the source of truth — no placement, no timesheet, no contractor-side counterpart.

1. Admin or Broker clicks "Create Manual Invoice" on the Invoices list.
2. Form fields (all user-entered, nothing auto-generated):
   - `invoice_number` (unique), `issue_date`, `due_date` (or payment_terms_days → computed `due_date`)
   - `currency`, `vat_rate_percent`
   - `client_id` (optional) — if set, Broker must be assigned to that client; snapshot billing details from the client's `InvoiceTemplate`. If null, both Admin and Broker can create and user types bill-to (company, address, country, VAT number) directly
   - `candidate_id` (optional) — cross-DB UUID reference to a CRM candidate
   - Line items (≥1): `description`, `quantity`, `unit_price`
   - Bank details (prefilled from `AgencySettings.default_client_invoice_template`, all editable)
3. Computed on save: `subtotal = Σ line_total`, `vat_amount = subtotal × vat_rate_percent / 100`, `total_amount = subtotal + vat_amount`.
4. Saved `DRAFT` is editable (both header and line items). Transitioning to `ISSUED` freezes everything and locks the row (consistent with the existing lock flag).
5. **No PDF is auto-generated on issue.** PDF is optional and on-demand via the existing `GET /invoices/:id/pdf` endpoint.
6. `is_manual=true` invoices flow through `ISSUED → PAID | VOIDED` exactly like auto invoices, so payment tracking on the Control screen is unchanged: they count toward "invoices awaiting payment", overdue flags, and CSV export the same way auto invoices do.
7. Deletion: a `DRAFT` manual invoice may be deleted outright (no downstream state to preserve). Issued manual invoices are voided, never deleted.

---

## 5. Role-Based Access Matrix

| Action | Admin | Broker | Contractor | Client Contact |
|---|---|---|---|---|
| **Users** | | | | |
| Create/edit/deactivate users | YES | NO | NO | NO |
| Edit own profile | YES | YES | YES | YES |
| **Clients** | | | | |
| Create/edit client | YES | Assigned only | NO | NO |
| View client | YES | Assigned only | NO | Own client |
| **Contractor Profile** | | | | |
| Edit | YES | NO | Own only | NO |
| View | YES | YES (all) | Own only | NO |
| **Placements** | | | | |
| Create/edit/activate/complete/cancel | YES | Assigned clients | NO | NO |
| View | YES | Assigned clients | Own placements | Per config |
| **Documents** | | | | |
| Upload | YES | Assigned clients | NO | NO |
| Download | YES | Assigned clients | Own placements | If configured |
| Delete | YES | Assigned clients | NO | NO |
| **Timesheets** | | | | |
| Create/edit/submit | NO | NO | Own, DRAFT only | NO |
| View | YES | Assigned clients | Own only | Per config |
| Approve/reject (broker step) | YES | Assigned clients | NO | NO |
| Approve/reject (client step) | NO | NO | NO | If configured |
| **Invoices** | | | | |
| Generate/void/correct/mark paid | YES | Assigned clients | NO | NO |
| View client invoice | YES | Assigned clients | NO | If configured |
| View contractor invoice | YES | Assigned clients | Own only | NO |
| Create manual invoice (Client linked, in scope) | YES | Assigned clients | NO | NO |
| Create manual invoice (no Client linked) | YES | YES | NO | NO |
| Edit manual invoice while DRAFT | YES | Own (+ assigned-clients rule if client linked) | NO | NO |

**Broker visibility rule**: sees all contractors (needed for placement creation), but only clients assigned to them and everything underneath.

---

## 6. Control Screen

### Default View: Active Placements for Selected Month

| Column | Content |
|---|---|
| Placement | Client → Position (contractor subtitle) |
| Hours | Total hours from timesheet |
| Timesheet status | NOT_STARTED / DRAFT / SUBMITTED / CLIENT_APPROVED / APPROVED / REJECTED |
| Invoice status | NOT_GENERATED / DRAFT / ISSUED / PAID / VOIDED |
| Flags | Missing timesheet, missing attachment, approved but no invoice, missing bank details |
| Action | Contextual: Create TS / Edit TS / View TS / Generate Invoice |

### Filters

Month dropdown (last 18 months, defaults to last month), client, contractor, broker (admin only), "needs attention".

### Summary Counters (Header)

- Timesheets awaiting approval
- Approved timesheets without invoices
- Invoices awaiting payment (**includes manual invoices** — they are first-class here, not a separate bucket)
- Placements with missing info

### Manual invoices in Control

Manual invoices don't appear in the per-placement row (they aren't tied to one) but they DO appear in:
- Summary counter "Invoices awaiting payment" — manual `ISSUED` with `due_date < today` are overdue like any other.
- CSV export of the invoice list for the selected period (filtered by `issue_date`, not `year/month`, since manual invoices have null year/month).
- Standard `/invoices` list with the same filters (status, client, year, broker). A new `is_manual=true|false` filter toggle is available.

### Actions

- **Bulk**: generate invoices for multiple approved timesheets, export CSV.
- **Per row** (contextual): no timesheet → Create TS, DRAFT → Edit TS, SUBMITTED → View TS, APPROVED without invoice → Generate Invoice.

---

## 7. Business Rules & Edge Cases

1. **Rate immutability**: locked once ACTIVE. Copy placement for rate changes.
2. **Month boundaries**: if placement starts/ends mid-month, only those days are available for entry.
3. **Duplicate invoice prevention**: blocked if non-VOIDED invoices exist for timesheet. Re-enabled if all VOIDED.
4. **Invoice number sequence**: Template engine supports variables: `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{Q}`, `{CLIENT}`, `{CONTRACTOR}`, `{COUNT}`, `{COUNT_YEAR}`, `{COUNT_MONTH}`, `{COUNT_QUARTER}`. Padding via `{COUNT:4}` → `0001`. Legacy plain prefixes auto-append `{COUNT_YEAR:4}`. Counters stored as JSON on InvoiceTemplate/ContractorProfile. Never recycled. **Manual invoices bypass this engine — the user types `invoice_number` themselves and no counter is consumed.**
5. **Currency**: single currency per placement, no conversion. Different placements can use different currencies.
6. **Deletion rules**: Contractors and Clients can be deleted by Admin. **Cannot delete** if they have any ACTIVE placements (must complete/cancel first). If they have non-active placements or invoices, they are **soft-deleted** (deactivated, `is_active=false`). If no relations exist, they are **hard-deleted** (removed from database). DRAFT placements with no timesheets can be deleted. Invoices never deleted (VOIDED instead).
7. **Deactivated contractor**: can't log in, existing data stays, brokers can still process pending timesheets/invoices.
8. **Deactivated client contact**: if they were the approver, another contact must approve or broker switches to BROKER_ONLY flow.
9. **Overlapping placements**: same contractor + client allowed (different projects).
10. **Zero-hour timesheets**: allowed, warn before invoice generation.
11. **Retrospective timesheets**: allowed for past months within placement date range.
12. **Partial month overlap (old/new placement)**: both timesheets exist independently.
13. **Rate confidentiality**: Contractors and Client Contacts must NEVER see rates or margin. Contractors must not see client_rate. Client Contacts must not see contractor_rate. Neither role sees margin. This applies to all API responses (rates nulled at API level) and all UI views (rate fields hidden). Only Admin and Broker see rates and margin.

---

## 8. PDF Invoice Content

### Client Invoice

- Agency logo and details (system settings)
- Invoice number (agency series), issue date, due date
- Client company name, billing address, VAT number
- Reference: Placement ID, contractor name, billing month
- Line: "Consulting services - [Contractor Name] - [Month Year]", hours, rate, amount
- Subtotal, VAT (if applicable), total
- Agency bank details / payment instructions

### Contractor Invoice

- Contractor company/name and address (from profile)
- Invoice number (contractor series), issue date, due date
- Billed to: Agency name and address
- Reference: Placement ID, client name, billing month
- Line: hours, rate, amount
- Subtotal, VAT (if registered), total
- Contractor bank details

### Manual Client Invoice (on-demand only)

Manual invoices do NOT auto-generate a PDF on ISSUE. `GET /invoices/:id/pdf` will build one on request from the stored data:

- Agency logo and details (from `AgencySettings.default_client_invoice_template`)
- Invoice number, issue date, due date (all as entered by the user)
- Bill-to block (from linked Client's `InvoiceTemplate` snapshot if set, else from `billing_snapshot` fields entered by the user)
- Each `InvoiceLineItem` rendered as its own line: description, quantity, unit_price, line_total
- Subtotal, VAT, total
- Bank details (as stored on the invoice — snapshot of agency defaults, editable at creation time)

---

## 9. Out of Scope (Future)

- Email notifications
- Reporting dashboards
- Multi-rate (overtime/weekend)
- E-invoicing standards (Peppol, UBL)
- Document versioning / e-signatures
- Accounting integrations
- Audit log
- Mobile app / 2FA

---

## 10. Open Design Decisions

| Decision | Recommendation |
|---|---|
| Invoice DRAFT->ISSUED: auto on generation or explicit? | Explicit transition for safety. Bulk can offer "generate and issue". |
| Timesheet creation: auto per month or on-demand? | On-demand. Control screen flags "missing timesheet". |
| Agency invoice numbering: global or per-client? | Global sequence -- simpler. |
| Audit logging | At minimum log state transitions. Full audit recommended for financials. |
