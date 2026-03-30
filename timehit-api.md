# TimeHit API Specification

REST JSON API with JWT authentication. All requests and responses use `Content-Type: application/json` unless noted (file uploads use `multipart/form-data`).

Base URL: `/api/v1`

---

## 1. Authentication

### JWT Structure

**Access token** (short-lived, 15 min):
```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "role": "ADMIN | BROKER | CONTRACTOR | CLIENT_CONTACT",
  "is_active": true,
  "iat": 1711612800,
  "exp": 1711613700
}
```

**Refresh token** (long-lived, 7 days): opaque token stored server-side.

All protected endpoints require header: `Authorization: Bearer <access_token>`

### Endpoints

#### `POST /auth/login`

```json
// Request
{ "email": "string", "password": "string" }

// 200 Response
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "role": "ADMIN"
  }
}

// 401 — invalid credentials
```

#### `POST /auth/refresh`

```json
// Request
{ "refresh_token": "string" }

// 200 Response
{ "access_token": "string", "refresh_token": "string", "expires_in": 900 }

// 401 — invalid or expired refresh token
```

#### `POST /auth/logout`

Invalidates the refresh token.

```json
// Request
{ "refresh_token": "string" }

// 204 No Content
```

#### `POST /auth/change-password`

Requires valid access token.

```json
// Request
{ "current_password": "string", "new_password": "string" }

// 204 No Content
// 400 — validation error
// 401 — wrong current password
```

---

## 2. Common Conventions

### Pagination

List endpoints return paginated results:

```
GET /resources?page=1&per_page=25
```

```json
// Response wrapper
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 142,
    "total_pages": 6
  }
}
```

### Sorting

```
GET /resources?sort=created_at&order=desc
```

### Filtering

Query params per endpoint. Enums are comma-separated for multi-value:

```
GET /placements?status=ACTIVE,DRAFT&client_id=uuid
```

### Error Response

All errors follow:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "email", "message": "must be a valid email" }
    ]
  }
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`, `CONFLICT`, `INVALID_STATE_TRANSITION`.

### Timestamps

All timestamps are ISO 8601 UTC: `"2026-03-15T10:30:00Z"`. Dates are `"2026-03-15"`.

### UUIDs

All `id` fields are UUID v4.

---

## 3. Users

**Roles:** ADMIN — full access. Others — restricted per matrix in functional-spec.

### `GET /users`

List users. Admin only.

Query params: `role`, `is_active`, `search` (email/name), `page`, `per_page`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "email": "string",
      "full_name": "string",
      "role": "BROKER",
      "is_active": true,
      "created_at": "2026-03-15T10:30:00Z"
    }
  ],
  "meta": { ... }
}
```

### `POST /users`

Create user. Admin only.

```json
// Request
{
  "email": "string",
  "full_name": "string",
  "password": "string",
  "role": "BROKER | CONTRACTOR | CLIENT_CONTACT | ADMIN",
  "client_id": "uuid | null"  // required if role = CLIENT_CONTACT
}

// 201 Response — same as GET /users/:id
// 409 — email already exists
```

When role = CONTRACTOR, a Contractor Profile is auto-created with defaults.
When role = CLIENT_CONTACT, a Client Contact record is auto-created linked to `client_id`.

### `GET /users/:id`

Admin: any user. Others: own record only.

```json
// 200
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "role": "CONTRACTOR",
  "is_active": true,
  "created_at": "2026-03-15T10:30:00Z",
  "updated_at": "2026-03-15T10:30:00Z"
}
```

### `PATCH /users/:id`

Admin: any user. Others: own `full_name` and `theme`.

```json
// Request (all fields optional)
{
  "full_name": "string",
  "email": "string",       // admin only
  "is_active": false,       // admin only
  "theme": "dark"           // any user (own record)
}

// 200 — updated user
```

### `GET /users/me`

Returns current authenticated user with role-specific profile included.

```json
// 200
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "role": "CONTRACTOR",
  "is_active": true,
  "theme": "dark",                // preferred theme id, "" if not set
  "contractor_profile": { ... },  // if role = CONTRACTOR
  "client_contact": { ... }       // if role = CLIENT_CONTACT
}
```

---

## 4. Clients

**Access:** Admin — all. Broker — assigned only. Client Contact — own client (read only).

### `GET /clients`

Query params: `is_active`, `search` (company_name), `broker_id` (admin only), `page`, `per_page`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "company_name": "string",
      "registration_number": "string | null",
      "vat_number": "string | null",
      "billing_address": "string",
      "country": "string",
      "default_currency": "EUR",
      "payment_terms_days": 30,
      "is_active": true,
      "brokers": [
        { "user_id": "uuid", "full_name": "string", "assigned_at": "2026-03-15T10:30:00Z" }
      ],
      "created_at": "2026-03-15T10:30:00Z"
    }
  ],
  "meta": { ... }
}
```

### `POST /clients`

Admin or Broker.

```json
// Request
{
  "company_name": "string",
  "registration_number": "string | null",
  "vat_number": "string | null",
  "billing_address": "string",
  "country": "string",
  "default_currency": "EUR",
  "payment_terms_days": 30,
  "notes": "string | null",
  "broker_ids": ["uuid"]  // at least one broker; auto-includes current broker if omitted
}

// 201
```

### `GET /clients/:id`

```json
// 200 — full client object with brokers array and contact_count
```

### `PATCH /clients/:id`

Admin or assigned Broker.

```json
// Request (all optional)
{
  "company_name": "string",
  "billing_address": "string",
  "country": "string",
  "default_currency": "EUR",
  "payment_terms_days": 30,
  "vat_number": "string",
  "registration_number": "string",
  "is_active": false,  // admin only
  "notes": "string"
}

// 200
```

### `POST /clients/:id/brokers`

Assign broker(s). Admin or assigned Broker.

```json
// Request
{ "broker_ids": ["uuid"] }

// 200 — updated brokers array
```

### `DELETE /clients/:id/brokers/:broker_user_id`

Unassign broker. Admin or assigned Broker. Returns 409 if last broker on client with active placements.

```json
// 204 No Content
// 409 — cannot remove last broker from client with active placements
```

---

## 5. Client Contacts

**Access:** Admin — all. Broker — assigned clients. Client Contact — own record.

### `GET /clients/:client_id/contacts`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "email": "string",
      "full_name": "string",
      "job_title": "string | null",
      "phone": "string | null",
      "is_primary": false,
      "is_active": true
    }
  ]
}
```

### `POST /clients/:client_id/contacts`

Creates both a User (role=CLIENT_CONTACT) and Client Contact record.

```json
// Request
{
  "email": "string",
  "full_name": "string",
  "password": "string",
  "job_title": "string | null",
  "phone": "string | null",
  "is_primary": false
}

// 201
```

### `PATCH /clients/:client_id/contacts/:id`

```json
// Request (all optional)
{ "job_title": "string", "phone": "string", "is_primary": true }

// 200
```

---

## 6. Contractor Profiles

**Access:** Admin — all. Broker — read all. Contractor — own only (read/write).

### `GET /contractors`

List all contractors. Visible to Admin and all Brokers (needed for placement creation).

Query params: `search` (name/company), `is_active`, `page`, `per_page`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "email": "string",
      "full_name": "string",
      "company_name": "string | null",
      "country": "string",
      "default_currency": "EUR",
      "vat_registered": false,
      "is_active": true
    }
  ],
  "meta": { ... }
}
```

### `GET /contractors/:id`

Full profile. Admin/Broker: any. Contractor: own only.

```json
// 200
{
  "id": "uuid",
  "user_id": "uuid",
  "email": "string",
  "full_name": "string",
  "company_name": "string | null",
  "registration_number": "string | null",
  "vat_registered": false,
  "vat_number": "string | null",
  "vat_rate_percent": "decimal | null",
  "invoice_series_prefix": "string | null",
  "next_invoice_number": 1,
  "bank_name": "string | null",
  "bank_account_iban": "string | null",
  "bank_swift_bic": "string | null",
  "payment_terms_days": 14,
  "billing_address": "string | null",
  "country": "string",
  "default_currency": "EUR"
}
```

### `PATCH /contractors/:id`

Admin: any. Contractor: own only. Brokers: no access.

```json
// Request (all optional)
{
  "company_name": "string",
  "registration_number": "string",
  "vat_registered": true,
  "vat_number": "string",       // required if vat_registered = true
  "vat_rate_percent": 21.0,     // required if vat_registered = true
  "invoice_series_prefix": "JD-2026-",
  "next_invoice_number": 5,     // must be >= current value
  "bank_name": "string",
  "bank_account_iban": "string",
  "bank_swift_bic": "string",
  "payment_terms_days": 14,
  "billing_address": "string",
  "country": "string",
  "default_currency": "EUR"
}

// 200 — updated profile
// 400 — next_invoice_number < current value
```

---

## 7. Placements

**Access:** Admin — all. Broker — assigned clients only. Contractor — own placements (read only). Client Contact — per placement config (read only).

### `GET /placements`

Query params: `client_id`, `contractor_id`, `status` (comma-separated), `broker_id` (admin only), `page`, `per_page`, `sort`, `order`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "client": { "id": "uuid", "company_name": "string" },
      "contractor": { "id": "uuid", "full_name": "string" },
      "title": "Backend Developer",
      "client_rate": "80.00",
      "contractor_rate": "60.00",
      "currency": "EUR",
      "start_date": "2026-03-01",
      "end_date": "2026-12-31",
      "status": "ACTIVE",
      "approval_flow": "CLIENT_THEN_BROKER",
      "require_timesheet_attachment": false,
      "client_can_view_invoices": true,
      "client_can_view_documents": true,
      "notes": "string | null",
      "created_at": "2026-03-15T10:30:00Z"
    }
  ],
  "meta": { ... }
}
```

### `POST /placements`

Admin or Broker (for assigned clients).

```json
// Request
{
  "client_id": "uuid",
  "contractor_id": "uuid",
  "client_rate": "80.00",
  "contractor_rate": "60.00",
  "currency": "EUR",
  "start_date": "2026-04-01",
  "end_date": "2026-12-31",     // optional
  "approval_flow": "BROKER_ONLY",
  "require_timesheet_attachment": false,
  "client_can_view_invoices": false,
  "client_can_view_documents": false,
  "notes": "string | null"
}

// 201 — placement in DRAFT status
```

### `GET /placements/:id`

```json
// 200 — full placement object
```

### `PATCH /placements/:id`

Only when status = DRAFT: all fields editable.
When status = ACTIVE: only `end_date`, `approval_flow`, `require_timesheet_attachment`, `client_can_view_invoices`, `client_can_view_documents`, `notes` editable.

```json
// Request (fields as in POST, all optional)
// 200 — updated placement
// 409 — attempted to change locked fields on ACTIVE placement
```

### `POST /placements/:id/activate`

Transition DRAFT -> ACTIVE. Validates all required fields are set. Rates become immutable.

```json
// 200 — placement with status: "ACTIVE"
// 409 — missing required fields or invalid current status
```

### `POST /placements/:id/complete`

Transition ACTIVE -> COMPLETED.

```json
// 200
{
  "id": "uuid",
  "status": "COMPLETED",
  "warnings": ["2 timesheets in non-terminal state"]  // if applicable
}

// 409 — invalid current status
```

### `POST /placements/:id/cancel`

Transition ACTIVE -> CANCELLED.

```json
// 200 — same shape as complete, with warnings if applicable
// 409 — invalid current status
```

### `POST /placements/:id/copy`

Creates a new DRAFT placement pre-filled from source. Returns the new placement.

```json
// Request (all optional overrides)
{
  "client_rate": "85.00",       // override, else copied
  "contractor_rate": "65.00",   // override, else copied
  "start_date": "2027-01-01"   // default: day after source end_date, or tomorrow
}

// 201 — new placement in DRAFT
```

### `DELETE /placements/:id`

Only DRAFT placements with no timesheets.

```json
// 204 No Content
// 409 — has timesheets or not in DRAFT status
```

---

## 8. Placement Documents

**Access:** Admin/Broker (assigned) — full. Contractor — own placement (download only). Client Contact — download if `client_can_view_documents`.

### `GET /placements/:placement_id/documents`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "file_name": "nda.pdf",
      "file_size_bytes": 245000,
      "mime_type": "application/pdf",
      "label": "NDA",
      "uploaded_by": { "id": "uuid", "full_name": "string" },
      "uploaded_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

### `POST /placements/:placement_id/documents`

`Content-Type: multipart/form-data`

| Field | Type | Required |
|---|---|---|
| file | binary | yes |
| label | string | no |

```json
// 201 — document object
```

### `GET /placements/:placement_id/documents/:id/download`

Returns the file binary with appropriate `Content-Type` and `Content-Disposition` headers.

```
// 200 — binary file
```

### `DELETE /placements/:placement_id/documents/:id`

Admin or assigned Broker only.

```json
// 204 No Content
```

---

## 9. Timesheets

**Access:** Contractor — own (create/edit/submit). Admin/Broker — view, approve, reject. Client Contact — view/approve per config.

### `GET /placements/:placement_id/timesheets`

Query params: `year`, `month`, `status`, `page`, `per_page`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "placement_id": "uuid",
      "year": 2026,
      "month": 3,
      "status": "DRAFT",
      "total_hours": "120.50",
      "submitted_at": null,
      "approved_at": null,
      "approved_by": null,
      "rejected_at": null,
      "rejected_by": null,
      "rejection_reason": null,
      "has_attachments": false,
      "entry_count": 22,
      "created_at": "2026-03-01T08:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### `POST /placements/:placement_id/timesheets`

Contractor only. Creates a DRAFT timesheet for a given month.

```json
// Request
{ "year": 2026, "month": 3 }

// 201 — timesheet object
// 409 — timesheet already exists for this placement+month
```

Validates: month falls within placement date range.

### `GET /timesheets/:id`

Returns timesheet with entries included.

```json
// 200
{
  "id": "uuid",
  "placement_id": "uuid",
  "placement": {
    "client": { "id": "uuid", "company_name": "string" },
    "contractor": { "id": "uuid", "full_name": "string" },
    "client_rate": "80.00",
    "contractor_rate": "60.00",
    "currency": "EUR",
    "approval_flow": "CLIENT_THEN_BROKER",
    "require_timesheet_attachment": true
  },
  "year": 2026,
  "month": 3,
  "status": "DRAFT",
  "total_hours": "120.50",
  "submitted_at": null,
  "approved_at": null,
  "approved_by": null,
  "rejected_at": null,
  "rejected_by": null,
  "rejection_reason": null,
  "entries": [
    {
      "id": "uuid",
      "date": "2026-03-01",
      "hours": "8.00",
      "task_name": "Backend API development",
      "notes": "string | null"
    }
  ],
  "attachments": [
    {
      "id": "uuid",
      "file_name": "sap-approval.png",
      "file_size_bytes": 120000,
      "mime_type": "image/png",
      "uploaded_at": "2026-03-28T10:00:00Z"
    }
  ],
  "created_at": "2026-03-01T08:00:00Z"
}
```

### `DELETE /timesheets/:id`

DRAFT only. Contractor (own) or Admin. Entries and attachments are cascade-deleted.

```json
// 204
// 409 — has entries or not in DRAFT
```

---

## 10. Timesheet Entries

**Access:** Contractor only, when parent timesheet is DRAFT.

### `PUT /timesheets/:timesheet_id/entries`

**Bulk upsert** — replaces all entries for the timesheet. This is the primary editing endpoint. The client sends the full set of entries each time.

```json
// Request
{
  "entries": [
    { "date": "2026-03-01", "hours": "8.00", "task_name": "API development", "notes": null },
    { "date": "2026-03-01", "hours": "1.00", "task_name": "Code review", "notes": null },
    { "date": "2026-03-02", "hours": "7.50", "task_name": null, "notes": "Short day" }
  ]
}

// 200
{
  "entries": [ ... ],  // saved entries with ids
  "total_hours": "16.50",
  "warnings": []       // e.g., ["2026-03-01: total 9.00h exceeds 8h typical day"]
}
```

**Validation:**
- Each `date` must be within the timesheet's year/month AND within placement date range.
- Sum of hours per date must be <= 24.
- `hours` must be >= 0.
- Timesheet must be in DRAFT status.

```json
// 400 — validation errors
// 409 — timesheet not in DRAFT status
```

### `GET /timesheets/:timesheet_id/entries`

Returns all entries for the timesheet (also available nested in `GET /timesheets/:id`).

```json
// 200
{
  "data": [
    { "id": "uuid", "date": "2026-03-01", "hours": "8.00", "task_name": "string | null", "notes": "string | null" }
  ],
  "total_hours": "120.50"
}
```

---

## 11. Timesheet Attachments

**Access:** Contractor — upload/delete when DRAFT. All authorized viewers — download.

### `POST /timesheets/:timesheet_id/attachments`

Timesheet must be in DRAFT. `Content-Type: multipart/form-data`

| Field | Type | Required |
|---|---|---|
| file | binary | yes |

```json
// 201 — attachment object
// 409 — timesheet not in DRAFT
```

### `GET /timesheets/:timesheet_id/attachments/:id/download`

```
// 200 — binary file
```

### `DELETE /timesheets/:timesheet_id/attachments/:id`

Contractor only, DRAFT status.

```json
// 204
// 409 — timesheet not in DRAFT
```

---

### `GET /timesheets/pending`

Contractor only. Returns months that need attention: months within active placement date ranges that have **no timesheet** (MISSING) or a timesheet in **DRAFT** status.

```json
// 200
{
  "data": [
    {
      "placement_id": "uuid",
      "placement": {
        "client": { "id": "uuid", "company_name": "string" },
        "contractor": { "id": "uuid", "full_name": "string" }
      },
      "year": 2026,
      "month": 3,
      "status": "MISSING",
      "timesheet_id": null,
      "total_hours": null
    },
    {
      "placement_id": "uuid",
      "placement": { ... },
      "year": 2026,
      "month": 2,
      "status": "DRAFT",
      "timesheet_id": "uuid",
      "total_hours": "40.00"
    }
  ]
}
```

Status values: `"MISSING"` (no timesheet record) or `"DRAFT"` (exists but not submitted, includes rejected-back-to-draft).

Range: from placement `start_date` to current month (inclusive). Only ACTIVE placements.

---

## 12. Timesheet State Transitions

All transition endpoints return the updated timesheet object.

### `POST /timesheets/:id/submit`

Contractor only. DRAFT -> SUBMITTED.

**Validates:**
- At least one entry exists (or confirm zero-hours — see `confirm_zero` flag).
- If `require_timesheet_attachment` is true on placement, at least one attachment exists.
- No single date exceeds 24 hours.

```json
// Request
{ "confirm_zero": false }  // set true to submit zero-hour timesheet without entries

// 200 — timesheet with status: "SUBMITTED"
// 400 — validation failed
// 409 — invalid current status
```

### `POST /timesheets/:id/approve`

**BROKER_ONLY flow:** Broker/Admin. SUBMITTED -> APPROVED.
**CLIENT_THEN_BROKER flow, broker step:** Broker/Admin. CLIENT_APPROVED -> APPROVED.

```json
// 200 — timesheet with status: "APPROVED"
// 403 — not authorized for this step
// 409 — invalid current status for this action
```

### `POST /timesheets/:id/client-approve`

CLIENT_THEN_BROKER flow only. Client Contact. SUBMITTED -> CLIENT_APPROVED.

```json
// 200 — timesheet with status: "CLIENT_APPROVED"
// 403 — placement approval_flow is not CLIENT_THEN_BROKER, or user is not a contact of this client
// 409 — invalid current status
```

### `POST /timesheets/:id/reject`

Broker/Admin: rejects from SUBMITTED or CLIENT_APPROVED.
Client Contact: rejects from SUBMITTED (CLIENT_THEN_BROKER flow only).

Transitions to REJECTED, then immediately to DRAFT (contractor can edit).

```json
// Request
{ "reason": "string" }  // required

// 200 — timesheet with status: "DRAFT", rejection_reason populated
// 400 — reason is required
// 409 — invalid current status
```

---

## 13. Invoices

**Access:** Admin/Broker — full management. Contractor — own contractor invoices (read + PDF). Client Contact — client invoices if configured (read + PDF).

### `POST /invoices/generate`

Generate invoice pairs for one or more approved timesheets. Broker/Admin only.

```json
// Request
{
  "timesheet_ids": ["uuid", "uuid"],
  "auto_issue": false  // if true, skip DRAFT and go straight to ISSUED
}

// 201
{
  "generated": [
    {
      "timesheet_id": "uuid",
      "client_invoice": { "id": "uuid", "invoice_number": "AGY-2026-0001", "total_amount": "12000.00", "status": "DRAFT" },
      "contractor_invoice": { "id": "uuid", "invoice_number": "JD-2026-0005", "total_amount": "9000.00", "status": "DRAFT" }
    }
  ],
  "errors": [
    { "timesheet_id": "uuid", "error": "Non-voided invoices already exist for this timesheet" }
  ]
}

// 400 — no valid timesheet_ids
```

**Validation per timesheet:**
- Status must be APPROVED.
- No non-VOIDED invoices must exist for this timesheet.
- Contractor profile must have sufficient data (bank details recommended but not blocked).

### `GET /invoices`

Query params: `invoice_type` (CLIENT_INVOICE, CONTRACTOR_INVOICE), `status` (comma-separated), `client_id`, `contractor_id`, `placement_id`, `year`, `month`, `page`, `per_page`, `sort`, `order`

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "invoice_number": "AGY-2026-0001",
      "invoice_type": "CLIENT_INVOICE",
      "client": { "id": "uuid", "company_name": "string" },
      "contractor": { "id": "uuid", "full_name": "string" },
      "placement_id": "uuid",
      "year": 2026,
      "month": 3,
      "currency": "EUR",
      "hourly_rate": "80.00",
      "total_hours": "150.00",
      "subtotal": "12000.00",
      "vat_rate_percent": null,
      "vat_amount": null,
      "total_amount": "12000.00",
      "status": "ISSUED",
      "issue_date": "2026-04-01",
      "due_date": "2026-05-01",
      "payment_date": null,
      "payment_reference": null,
      "generated_by": { "id": "uuid", "full_name": "string" },
      "created_at": "2026-04-01T09:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### `GET /invoices/:id`

Full invoice with snapshotted billing details.

```json
// 200
{
  "id": "uuid",
  "invoice_number": "JD-2026-0005",
  "invoice_type": "CONTRACTOR_INVOICE",
  "timesheet_id": "uuid",
  "placement_id": "uuid",
  "client": { "id": "uuid", "company_name": "string" },
  "contractor": { "id": "uuid", "full_name": "string" },
  "year": 2026,
  "month": 3,
  "currency": "EUR",
  "hourly_rate": "60.00",
  "total_hours": "150.00",
  "subtotal": "9000.00",
  "vat_rate_percent": "21.00",
  "vat_amount": "1890.00",
  "total_amount": "10890.00",
  "status": "ISSUED",
  "issue_date": "2026-04-01",
  "due_date": "2026-04-15",
  "payment_date": null,
  "payment_reference": null,
  "billing_snapshot": {
    "contractor_company_name": "John Doe Consulting",
    "contractor_vat_number": "LT123456789",
    "contractor_bank_iban": "LT12 3456 7890 1234 5678",
    "contractor_bank_swift": "CBVILT2X",
    "contractor_bank_name": "SEB",
    "contractor_billing_address": "123 Main St, Vilnius",
    "contractor_payment_terms_days": 14,
    "contractor_invoice_series_prefix": "JD-2026-"
  },
  "generated_by": { "id": "uuid", "full_name": "string" },
  "correction_link": null,
  "created_at": "2026-04-01T09:00:00Z"
}
```

For CLIENT_INVOICE, `billing_snapshot` contains client fields instead:
```json
"billing_snapshot": {
  "client_company_name": "string",
  "client_billing_address": "string",
  "client_vat_number": "string | null",
  "client_payment_terms_days": 30
}
```

### `POST /invoices/:id/issue`

DRAFT -> ISSUED. Triggers PDF generation. Broker/Admin.

```json
// 200 — invoice with status: "ISSUED", pdf available
// 409 — not in DRAFT status
```

### `POST /invoices/:id/mark-paid`

ISSUED -> PAID. Broker/Admin.

```json
// Request
{
  "payment_date": "2026-04-20",
  "payment_reference": "string | null"  // optional, e.g. bank transfer ref
}

// 200 — invoice with status: "PAID"
// 400 — payment_date required
// 409 — not in ISSUED status
```

### `POST /invoices/:id/void`

ISSUED or PAID -> VOIDED. Broker/Admin.

```json
// Request
{ "reason": "string | null" }

// 200 — invoice with status: "VOIDED"
// 409 — not in ISSUED or PAID status
```

### `POST /invoices/:id/correct`

ISSUED -> CORRECTED. Creates a new corrective invoice in DRAFT. Broker/Admin.

```json
// Request — fields to override on the corrective invoice (all optional)
{
  "hourly_rate": "82.00",
  "total_hours": "148.00",
  "vat_rate_percent": "21.00",
  "reason": "Rate correction per client agreement"
}

// 201
{
  "original_invoice": { "id": "uuid", "status": "CORRECTED" },
  "corrective_invoice": { "id": "uuid", "invoice_number": "...", "status": "DRAFT", "total_amount": "..." }
}

// 409 — not in ISSUED status
```

### `GET /invoices/:id/pdf`

Download generated PDF. Available to anyone who can view the invoice.

```
// 200 — Content-Type: application/pdf, Content-Disposition: attachment
// 404 — PDF not yet generated (invoice still in DRAFT)
```

### `DELETE /invoices/:id`

DRAFT only. Broker/Admin.

```json
// 204
// 409 — not in DRAFT status
```

### `GET /invoices/:id/notifications`

Returns notification history for an invoice. Admin/Broker see all. Contractor sees only where `visible_to_contractor=true`. Client Contact sees only where `visible_to_client=true`.

```json
// 200
{
  "data": [
    {
      "id": "uuid",
      "created_at": "2026-03-01T09:00:00Z",
      "created_by": { "id": "uuid", "full_name": "Jonas Broker" },
      "title": "Invoice Issued",
      "text": "Invoice AGY-2026-0001 has been issued",
      "status": "ISSUED",
      "visible_to_contractor": true,
      "visible_to_client": true
    }
  ]
}
```

---

## 13b. Invoice Templates

**Access:** Admin — all. Broker — CLIENT templates for assigned clients. Contractor — own CONTRACTOR templates. Client Contact — read-only own client templates.

### `GET /invoice-templates`

Query params: `template_type` (CONTRACTOR, CLIENT, AGENCY), `contractor_id`, `client_id`, `status` (comma-separated), `page`, `per_page`

### `POST /invoice-templates`

```json
// Request
{
  "title": "string",
  "code": "string",               // short stable reference, e.g. "LT", "EN", "DEFAULT"
  "template_type": "CONTRACTOR",
  "contractor_id": "uuid",        // required for CONTRACTOR type
  "client_id": "uuid",            // required for CLIENT type
  "placement_id": "uuid",         // optional scope
  "parent_id": "uuid",            // optional parent template
  "is_default": false,
  "company_name": "string",
  "registration_number": "string",
  "billing_address": "string",
  "country": "string",
  "default_currency": "EUR",
  "vat_registered": true,
  "vat_number": "string",
  "vat_rate_percent": "21.00",
  "bank_name": "string",
  "bank_account_iban": "string",
  "bank_swift_bic": "string",
  "invoice_series_prefix": "AT-2026-",
  "next_invoice_number": 1,
  "payment_terms_days": 14
}

// 201 — created template
```

### `GET /invoice-templates/:id`

Returns full template detail including all billing fields.

### `PATCH /invoice-templates/:id`

All fields optional. `next_invoice_number` cannot decrease.

### `DELETE /invoice-templates/:id`

Only DRAFT or ARCHIVED templates can be deleted.

### `POST /invoice-templates/:id/activate`

DRAFT -> ACTIVE. Only one default ACTIVE template per (contractor, template_type).

### `POST /invoice-templates/:id/archive`

ACTIVE -> ARCHIVED.

---

## 14. Control Screen

**Access:** Admin — all data. Broker — assigned clients only.

### `GET /control/overview`

The main control screen endpoint. Returns one row per active placement for the selected month.

Query params: `year` (required), `month` (required), `client_id`, `contractor_id`, `broker_id` (admin only), `timesheet_status`, `invoice_status`, `needs_attention` (boolean), `page`, `per_page`, `sort`, `order`

```json
// 200
{
  "data": [
    {
      "placement": {
        "id": "uuid",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "client_rate": "80.00",
        "contractor_rate": "60.00",
        "currency": "EUR",
        "approval_flow": "CLIENT_THEN_BROKER",
        "require_timesheet_attachment": true
      },
      "client": { "id": "uuid", "company_name": "Acme Corp" },
      "contractor": { "id": "uuid", "full_name": "John Doe" },
      "timesheet": {
        "id": "uuid | null",
        "status": "APPROVED",
        "total_hours": "150.00",
        "submitted_at": "2026-03-28T10:00:00Z",
        "approved_at": "2026-03-29T14:00:00Z"
      },
      "client_invoice": {
        "id": "uuid | null",
        "invoice_number": "AGY-2026-0001",
        "status": "ISSUED",
        "total_amount": "12000.00"
      },
      "contractor_invoice": {
        "id": "uuid | null",
        "invoice_number": "JD-2026-0005",
        "status": "ISSUED",
        "total_amount": "10890.00"
      },
      "margin": "1110.00",
      "flags": ["missing_attachment"]
    }
  ],
  "meta": { ... }
}
```

**`timesheet`** is null if no timesheet created for that month. **`client_invoice`** / **`contractor_invoice`** are null if not yet generated.

**`flags`** array — possible values:
- `"no_timesheet"` — no timesheet for this month
- `"timesheet_draft"` — timesheet started but not submitted
- `"missing_attachment"` — attachment required but none uploaded
- `"pending_approval"` — timesheet awaiting approval
- `"approved_no_invoice"` — approved but invoices not generated
- `"missing_bank_details"` — contractor profile missing bank info
- `"invoice_unpaid"` — invoice issued but not marked paid

### `GET /control/summary`

Aggregate counters for the selected month.

Query params: `year` (required), `month` (required), `broker_id` (admin only)

```json
// 200
{
  "timesheets_awaiting_approval": 12,
  "approved_without_invoices": 5,
  "invoices_awaiting_payment": 18,
  "placements_with_issues": 3,
  "total_active_placements": 45,
  "total_hours": "5400.00",
  "total_client_revenue": "432000.00",
  "total_contractor_cost": "324000.00",
  "total_margin": "108000.00",
  "currency_breakdown": [
    { "currency": "EUR", "revenue": "400000.00", "cost": "300000.00", "margin": "100000.00" },
    { "currency": "GBP", "revenue": "32000.00", "cost": "24000.00", "margin": "8000.00" }
  ]
}
```

### `GET /control/export`

Export control screen data as CSV. Same filters as `/control/overview`.

Query params: same as overview.

```
// 200 — Content-Type: text/csv, Content-Disposition: attachment; filename="control-2026-03.csv"
```

---

## 15. Authorization Rules Summary

Middleware checks on every request:

| Check | Logic |
|---|---|
| **JWT valid** | Token not expired, user exists, `is_active = true` |
| **Role gate** | Endpoint specifies allowed roles |
| **Broker scope** | If role = BROKER, verify client is in broker's assignments via `broker_client_assignments` |
| **Contractor scope** | If role = CONTRACTOR, verify resource belongs to own placements |
| **Client Contact scope** | If role = CLIENT_CONTACT, verify resource belongs to own client AND placement config allows access |
| **State guard** | Mutation endpoints verify entity is in valid state for the transition |

### Role -> Endpoint Matrix (summary)

| Endpoint Pattern | ADMIN | BROKER | CONTRACTOR | CLIENT_CONTACT |
|---|---|---|---|---|
| `POST /auth/*` | all | all | all | all |
| `* /users*` | all | own only | own only | own only |
| `* /clients*` | all | assigned | - | own client (read) |
| `* /contractors*` | all | read all | own | - |
| `* /placements*` | all | assigned clients | own (read) | per config (read) |
| `* /timesheets*` (create/edit/submit) | - | - | own | - |
| `* /timesheets*` (approve/reject) | all | assigned | - | per config |
| `* /invoices*` (manage) | all | assigned | - | - |
| `* /invoices*` (read) | all | assigned | own contractor | per config (client) |
| `GET /control/*` | all | scoped | - | - |

---

## 16. Validation Rules Reference

| Entity | Rule | HTTP Code |
|---|---|---|
| Timesheet Entry | `hours` per date sum <= 24 | 400 |
| Timesheet Entry | `date` within month AND placement range | 400 |
| Timesheet | Submit requires entries (or `confirm_zero`) | 400 |
| Timesheet | Submit requires attachment if placement flag set | 400 |
| Placement | ACTIVE -> rates/currency immutable | 409 |
| Placement | Activate requires rates + dates + contractor + client | 409 |
| Placement | Delete only if DRAFT + no timesheets | 409 |
| Invoice | Generate requires APPROVED timesheet | 409 |
| Invoice | Generate blocked if non-VOIDED invoices exist | 409 |
| Invoice | Delete only if DRAFT | 409 |
| Contractor Profile | `next_invoice_number` can only increase | 400 |
| Contractor Profile | `vat_number` + `vat_rate_percent` required if `vat_registered` | 400 |
| Client | Cannot deactivate client with active placements (admin can force) | 409 |
| Broker Assignment | Cannot remove last broker from client with active placements | 409 |

## 17. Rate Confidentiality

**Critical**: API responses MUST null out rate and margin fields based on the requesting user's role. This is enforced at the serializer level, not just the UI.

| Field | Admin/Broker | Contractor | Client Contact |
|---|---|---|---|
| `placement.client_rate` | visible | **null** | **null** |
| `placement.contractor_rate` | visible | **null** | **null** |
| `timesheet.placement.client_rate` | visible | **null** | **null** |
| `timesheet.placement.contractor_rate` | visible | **null** | **null** |
| `invoice.hourly_rate` | visible | **null** | **null** |
| `invoice.total_hours` | visible | **null** | **null** |
| `invoice.subtotal` | visible | **null** | **null** |
| `invoice.vat_rate_percent` | visible | **null** | **null** |
| `invoice.vat_amount` | visible | **null** | **null** |
| `invoice.total_amount` | visible | **null** | **null** |
| `control.margin` | visible | N/A (no access) | N/A (no access) |

Affected endpoints:
- `GET /placements`, `GET /placements/:id` — null both rates for contractor/client
- `GET /timesheets`, `GET /timesheets/:id` — null placement rates in nested object
- `GET /invoices`, `GET /invoices/:id` — null all financial fields for contractor/client
- `GET /control/overview`, `GET /control/summary` — already restricted to admin/broker
