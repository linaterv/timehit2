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

Simple upload/download/delete. No mandatory docs. No versioning or e-signatures.

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
| invoice_number | string | unique; see numbering rules |
| invoice_type | enum | CLIENT_INVOICE, CONTRACTOR_INVOICE |
| timesheet_id | FK -> Timesheet | |
| placement_id | FK -> Placement | denormalized |
| client_id | FK -> Client | denormalized |
| contractor_id | FK -> User | denormalized |
| year / month | integer | billing period |
| currency | currency_code | from placement |
| hourly_rate | decimal | client_rate or contractor_rate |
| total_hours | decimal | from timesheet |
| subtotal | decimal | rate * hours |
| vat_rate_percent | decimal | nullable |
| vat_amount | decimal | nullable |
| total_amount | decimal | subtotal + vat |
| status | enum | DRAFT, ISSUED, PAID, VOIDED, CORRECTED |
| issue_date | date | |
| due_date | date | nullable, from payment terms |
| payment_date | date | nullable, broker-entered |
| payment_reference | string | nullable |
| generated_by_user_id | FK -> User | |
| pdf_file_path | string | nullable |

**Snapshotted fields** at generation time (so profile/client edits don't affect issued invoices):
- Contractor invoices: company_name, vat_number, bank details, billing_address, payment_terms, series_prefix
- Client invoices: client billing details

**Invoice numbering:**
- Client invoices: agency-controlled global sequence (e.g., "AGY-2026-0001")
- Contractor invoices: contractor's own series prefix + next_invoice_number from profile, then increment

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
```

### 3.3 Timesheet (CLIENT_THEN_BROKER flow)

```
DRAFT --[submit]--> SUBMITTED --[client_approve]--> CLIENT_APPROVED --[broker_approve]--> APPROVED
                              --[client_reject]---> REJECTED --[edit]--> DRAFT
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

### 4.3 Invoice Generation

1. From control page, broker sees approved timesheets without invoices.
2. Selects one or multiple -> "Generate Invoices".
3. System creates TWO invoices per timesheet (client + contractor), both in DRAFT.
4. Broker reviews, marks as ISSUED -> PDF generated.
5. Payment: broker enters payment_date -> ISSUED -> PAID.
6. Void: ISSUED/PAID -> VOIDED (remains in system).
7. Correct: ISSUED -> CORRECTED, new corrective invoice created.
8. Re-generate: if both invoices VOIDED, generation available again for that timesheet.

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

**Broker visibility rule**: sees all contractors (needed for placement creation), but only clients assigned to them and everything underneath.

---

## 6. Control Screen

### Default View: Active Placements for Selected Month

| Column | Content |
|---|---|
| Client | Company name |
| Contractor | Full name |
| Rates | Client / Contractor rate + currency |
| Margin | (client_rate - contractor_rate) * hours |
| Dates | Start - End |
| Timesheet status | NOT_STARTED / DRAFT / SUBMITTED / CLIENT_APPROVED / APPROVED / REJECTED |
| Invoice status | NOT_GENERATED / DRAFT / ISSUED / PAID / VOIDED |
| Flags | Missing timesheet, missing attachment, approved but no invoice, missing bank details |

### Filters

By client, contractor, broker (admin only), month/year, timesheet status, invoice status, "needs attention".

### Summary Counters (Header)

- Timesheets awaiting approval
- Approved timesheets without invoices
- Invoices awaiting payment
- Placements with missing info

### Actions

- **Bulk**: generate invoices for multiple approved timesheets, export CSV.
- **Per row**: view/approve/reject timesheet, generate invoices, view invoices, view placement.

---

## 7. Business Rules & Edge Cases

1. **Rate immutability**: locked once ACTIVE. Copy placement for rate changes.
2. **Month boundaries**: if placement starts/ends mid-month, only those days are available for entry.
3. **Duplicate invoice prevention**: blocked if non-VOIDED invoices exist for timesheet. Re-enabled if all VOIDED.
4. **Invoice number sequence**: never recycled. Contractor can adjust next_number upward only.
5. **Currency**: single currency per placement, no conversion. Different placements can use different currencies.
6. **Deletion rules**: Contractors can be deleted by Admin. If contractor has any relations (placements, invoices, or documents), they are **soft-deleted** (user deactivated, `is_active=false`). If no relations exist, they are **hard-deleted** (user + profile removed). DRAFT placements with no timesheets can be deleted. Invoices never deleted (VOIDED instead).
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
