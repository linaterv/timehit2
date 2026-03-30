# Frontend Requirements — TimeHit

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS** + **shadcn/ui** component library (professional, clean)
- **TanStack Query** (React Query) for API state management
- **next-auth** or custom JWT context for authentication
- API client auto-generated from `backend/openapi-schema.json` using **openapi-typescript-codegen** or **orval**
- **Playwright** for E2E tests

## Design System

### Brand
- Name: **TimeHit** (logo in sidebar header)
- Palette: neutral grays + single accent color (blue-600). Status colors: green=good, amber=warning, red=error
- Typography: Inter (system font stack fallback)
- No gradients, no shadows heavier than `shadow-sm`. White card backgrounds on gray-50 page background

### Layout
- **Sidebar navigation** (left, 240px, collapsible to icon-only 64px)
- **Top bar**: page title, breadcrumbs, user avatar dropdown (profile, logout)
- **Content area**: max-width 1280px, responsive down to 768px

### Tables
All list pages use the same table component:
- Column headers with sort toggles
- Filter row above table (dropdowns, search input, date pickers)
- Pagination bar at bottom (page / per_page from API meta)
- Row click navigates to detail
- Bulk select checkboxes where bulk actions exist

### Forms
- Right-side slide-over panel (Sheet) for create/edit — keeps context of the list
- Inline validation, error messages below fields
- Cancel and Save buttons at panel bottom

### Theme Persistence
- Theme selection saved to **localStorage** (immediate) AND **user profile on backend** (PATCH `/users/:id` with `{theme: "id"}`).
- On login: fetch `/users/me`, read `theme` field. If set, override localStorage and apply. If empty, use localStorage or default to "light".
- This ensures theme follows the user across devices.

### Date Format
- All visible dates use **YY.MM.DD** format (e.g. `26.03.29`) — `formatDate()` in `lib/utils.ts`.
- All year-month periods use **YY.MM** format (e.g. `26.03`) — `formatMonth()` in `lib/utils.ts`.
- Applies everywhere: table columns, detail pages, dialogs (create timesheet month list), timestamps.

### Rate Confidentiality (global rule)
Rates (`client_rate`, `contractor_rate`) and margin are **never shown** to Contractor or Client Contact roles — anywhere in the UI. The API returns null for these fields for those roles (defense in depth). Only Admin and Broker see rates and margin. This applies to: placement list, placement detail, timesheet detail header, control screen.

### Attention Buttons
Action buttons for **past month** timesheets that need contractor attention (MISSING or DRAFT) use a distinct alert style:
- Red-tinted background (`bg-red-50`), red text (`text-red-700`), red border (`border-red-300`)
- `CircleAlert` icon (lucide-react) displayed on **both sides** of the button text
- Text includes **"Late !"** prefix (e.g. "Late ! Create", "Late ! Edit")
- Used in: placements list (last month action), placements detail (last month action), timesheets list (past month rows)
- **Current month** buttons use standard blue brand color (`bg-brand-600`), no alert icons, no "Late !"
- Non-attention buttons (View, etc.) use standard gray styling with no icons

### Status Badges
Consistent colored badges throughout:
- DRAFT: gray
- ACTIVE/SUBMITTED: blue
- APPROVED/CLIENT_APPROVED/ISSUED: green
- PAID: emerald
- REJECTED: red
- VOIDED/CANCELLED/COMPLETED: gray-dark

---

## Navigation (Sidebar) Per Role

### ADMIN
| # | Label | Icon | Route |
|---|---|---|---|
| 1 | Dashboard | LayoutDashboard | `/` |
| 2 | Users | Users | `/users` |
| 3 | Clients | Building2 | `/clients` |
| 4 | Contractors | HardHat | `/contractors` |
| 5 | Placements | Briefcase | `/placements` |
| 6 | Timesheets | Clock | `/timesheets` |
| 7 | Invoices | FileText | `/invoices` |
| 8 | Documents | FolderOpen | `/documents` |
| 9 | Settings | Settings | `/settings` |

### BROKER
| # | Label | Icon | Route |
|---|---|---|---|
| 1 | Dashboard | LayoutDashboard | `/` |
| 2 | Clients | Building2 | `/clients` |
| 3 | Contractors | HardHat | `/contractors` |
| 4 | Placements | Briefcase | `/placements` |
| 5 | Timesheets | Clock | `/timesheets` |
| 6 | Invoices | FileText | `/invoices` |
| 7 | Documents | FolderOpen | `/documents` |

### CONTRACTOR
| # | Label | Icon | Route |
|---|---|---|---|
| 1 | My Timesheets | Clock | `/` |
| 2 | My Placements | Briefcase | `/placements` |
| 3 | My Invoices | FileText | `/invoices` |
| 4 | My Profile | UserCog | `/profile` |

### CLIENT_CONTACT
| # | Label | Icon | Route |
|---|---|---|---|
| 1 | Timesheets | Clock | `/` |
| 2 | Invoices | FileText | `/invoices` |
| 3 | Documents | FolderOpen | `/documents` |

---

## Pages

### 1. Login (`/login`)
- Email + password form, centered card on gray background
- "TimeHit" logo above
- On success: redirect to `/` (role-appropriate home)
- data-testid: `login-email`, `login-password`, `login-submit`

### 2. Dashboard / Control Screen (`/`) — ADMIN, BROKER
The primary operational view. Maps to `GET /control/overview` + `GET /control/summary`.

**Summary cards** (top row, 4 cards):
- Awaiting Approval (count, amber if > 0)
- Approved, No Invoice (count, amber)
- Unpaid Invoices (count)
- Issues (count, red if > 0)
- data-testid: `summary-awaiting`, `summary-no-invoice`, `summary-unpaid`, `summary-issues`

**Month selector** (center top): `< March 2026 >` arrows + dropdown
- data-testid: `month-selector`, `month-prev`, `month-next`

**Filters bar**: client, contractor, broker (admin only), timesheet status, invoice status, needs attention toggle
- data-testid: `filter-client`, `filter-contractor`, `filter-status`, `filter-attention`

**Table columns**: Client, Contractor, Rates, Hours, Margin, TS Status (badge), Invoice Status (badge), Flags (icon chips)
- Row actions dropdown: View Timesheet, Approve, Reject, Generate Invoices, View Placement
- Bulk action bar (visible when rows selected): "Generate Invoices" button, "Export CSV" button
- data-testid: `control-table`, `control-row-{id}`, `bulk-generate`, `bulk-export`

### 3. Users (`/users`) — ADMIN only
- Table: name, email, role (badge), placement (current/last for contractors/client contacts as "Client → Title"), active (dot), created
- Create/edit via slide-over: email, full_name, password, role dropdown, client_id (if CLIENT_CONTACT)
- data-testid: `users-table`, `user-create-btn`, `user-form`, `user-save`

### 4. Clients (`/clients`)
- Table: company name, country, brokers (comma-separated names), placements (2 most recent active as "Contractor → Title" + counts "N active / M inactive"), active (dot)
- Filters: search, is_active
- Default sort: company_name ascending
- data-testid: `clients-table`, `client-create-btn`

**Client Detail** (`/clients/[id]`):
- Header card: company info, edit button
- Tabs:
  - **Contacts** — table + add contact button
  - **Brokers** — list with assign/remove buttons
  - **Placements** — filtered placement table
  - **Billing Templates** — card list of CLIENT-type invoice templates. Create/edit via slide-over. Activate/archive/delete actions. Admin/broker can CRUD.
- data-testid: `client-detail`, `client-tab-contacts`, `client-tab-brokers`, `client-tab-placements`, `tab-templates`

### 5. Contractors (`/contractors`)
- Table: name, placement (current/last active as "Client → Title"), ends (active placement end date), status ("In Effect" green if active placement, "No Placement" gray otherwise)
- Filters: search, is_active
- data-testid: `contractors-table`

**Contractor Detail** (`/contractors/[id]`):
- Tabs: **Placements** (default tab, all roles), **Profile**, **Templates** (admin only, CONTRACTOR-type invoice templates, card list + slide-over CRUD)
- Placements tab: table of all contractor's placements (client, position, status badge, start, end) — clickable rows navigate to placement detail
- Profile tab: all fields. Editable by contractor (own) and admin
- Sections: Company Info, VAT Settings, Bank Details, Invoice Settings
- data-testid: `contractor-detail`, `contractor-edit-btn`, `contractor-save`

### 6. Contractor Profile (`/profile`) — CONTRACTOR only
Two subtabs: **Account** and **Invoice Settings**.

**Account tab:**
- Personal Info section: full name and email (read-only display)
- "Change Password" link opens a modal dialog: current password, new password, confirm new password. Calls `POST /auth/change-password`.
- Company Info section: company name, registration number, country, default currency (editable)

**Invoice Settings tab:**
- Card list of CONTRACTOR-type invoice templates for the logged-in contractor.
- Each card: name, status badge (DRAFT/ACTIVE/ARCHIVED), "Default" badge, company + prefix summary.
- Click card → slide-over with full form: name, is_default toggle, company info, VAT, bank, invoice series, payment terms.
- "New Template" button creates a DRAFT template.
- Slide-over actions: Activate (DRAFT→ACTIVE), Archive (ACTIVE→ARCHIVED), Delete (DRAFT/ARCHIVED only).
- Account tab Save button saves company info (PATCH to contractor profile). Template saves are per-template (PATCH to `/invoice-templates/:id`).
- data-testid: `profile-page`, `tab-account`, `tab-invoice`, `btn-change-password`, `pwd-dialog`, `btn-new-template`, `tpl-slideover`

### 7. Placements (`/placements`)
- Table: client, contractor, **title** (position), rates (admin/broker only — **hidden for contractor and client contact**), currency, dates, status (badge), approval flow
- Filters: client, contractor, status (multi-select). **Contractor view**: client and contractor filters hidden (they only see own). Status defaults to ACTIVE.
- **Contractor current-month action** (ACTIVE placements only): each row shows a quick-action button for the current month's timesheet status. Data fetched from `GET /timesheets/pending` and mapped to placement rows at runtime.
  - Two buttons per row (stacked), one for last month, one for current month:
    - **Last month** MISSING/DRAFT → **attention styling** (red `!` icons). Text: "Create Last Month TS" or "Edit Last Month TS"
    - **Current month** MISSING/DRAFT → **normal styling** (gray border). Text: "Create This Month TS" or "Edit This Month TS"
    - SUBMITTED/APPROVED/etc → no button for that month
- data-testid: `placements-table`, `placement-create-btn`

**Placement Detail** (`/placements/[id]`):
- Header card: status badge, rates (**admin/broker only — hidden for contractor/client**), dates, approval flow, action buttons (Activate / Complete / Cancel / Copy) — **admin/broker only, hidden for contractors**
- Tabs:
  - **Timesheets** — table of timesheets for this placement. Per-row actions: **"Edit"** button if DRAFT or REJECTED (navigates to timesheet detail for editing), **"View"** for all other statuses. **"Create Timesheet" button** (contractor only, on own ACTIVE placements): opens a dialog showing **all months** within the placement date range. Each month displays its current status (MISSING, DRAFT, SUBMITTED, APPROVED, etc.). Only **MISSING** months are selectable — others are shown but disabled/grayed so the contractor sees the full picture. Defaults to highlighting the current month if it's MISSING. **Future month warning**: amber note if selected month is after current month. On create: POSTs to `/placements/:id/timesheets`, navigates to detail. **Two fast action buttons** (contractor only, next to Create Timesheet): "Create/Edit This Month TS" (blue brand style) and "Create/Edit Last Month TS" (red alert style with `!` icons if MISSING/DRAFT). Only shown when the respective month needs action. data-testid: `ts-create-btn`, `ts-create-month`, `ts-create-submit`, `ts-create-future-warning`
  - **Documents** — file list with upload dropzone and download/delete buttons (**admin/broker only** can upload/delete; **contractor sees download only**)
  - **Settings** — edit non-locked fields (approval flow, attachment requirement, client visibility flags) — **admin/broker only, hidden for contractors**
- Locked fields shown but grayed out when ACTIVE
- **Contractor view**: placement is read-only. No action buttons, no Settings tab, no document upload. Only Timesheets tab (with Create Timesheet) and Documents tab (download only). Detail fields: "End Client" (not "Client"), Position, Start/End dates. Hidden: Contractor field, Approval Flow, Rates. Placements list: single "Placement" column as "Client → Position" instead of separate columns.
- **Create Placement button** on placements list: **admin/broker only, hidden for contractors**
- data-testid: `placement-detail`, `placement-activate-btn`, `placement-complete-btn`, `placement-cancel-btn`, `placement-copy-btn`, `placement-tab-timesheets`, `placement-tab-documents`, `placement-tab-settings`

### 8. Timesheets (`/timesheets`)
- Table: placement (client + contractor + **title**), month/year, status (badge), hours, submitted, approved by
- Filters: year, month, status, placement
- **Contractor filter dropdown**: `Missing or not submitted` (default on first load), `Submitted`, `Approved`, `All`. If "Missing or not submitted" returns empty, auto-switch to "All".
  - "Missing or not submitted" uses `GET /timesheets/pending` — shows months needing action (MISSING or DRAFT)
  - Other filters use the standard `GET /timesheets` endpoint with status param
  - Rows are **not clickable** — each row has an explicit action button:
    - MISSING → "Create" button, DRAFT → "Edit" button — both with **attention styling** (red-tinted, `!` alert icons on both sides)
    - SUBMITTED/APPROVED/etc → "View" button (gray, no icons)
- **Admin/Broker**: standard filters (year, month, status, placement) — no "pending" filter
- Contractors see only their own. Clicking a row opens the timesheet.
- **"Create Timesheet" button** (contractor only): opens dialog to select placement (from own active placements) + year + month, then POSTs to `/placements/:placement_id/timesheets`. On success navigates to the new timesheet detail. Month defaults to **current month**. Can select any month within placement date range. **Future month warning** (amber, non-blocking). data-testid: `ts-create-btn`
- data-testid: `timesheets-table`, `ts-filter-dropdown`

**Timesheet Detail** (`/timesheets/[id]`):
- **Header layout**:
  - **Top row**: "Client → Position Title" (left, e.g. "TechVibe GmbH → Backend Developer"), contractor name shown as subtitle. Status badge + total hours + rates (right, rates admin/broker only)
  - **Bottom row**: `< Month Year >` navigation (left, fixed-width arrows always in same position), action buttons (right: Submit/Approve/Reject)
- **Month navigation arrows** `< >` with fixed-width positioning. Navigate to previous/next month's timesheet within the same placement. Range limited to placement start_date..end_date. Arrows disabled (grayed) at boundaries. If the target month has an existing timesheet, navigate to it. If MISSING, create it on navigation. data-testid: `ts-month-prev`, `ts-month-next`
- **Action buttons in header** (not at bottom): Submit, Approve, Reject, Delete — shown based on role + status, positioned on the right side of the month nav row. **Delete** button (contractor, DRAFT only): deletes the timesheet and navigates back to timesheets list. Confirmation dialog before delete.
- **Calendar View** (default, all roles):
  - Monthly calendar grid (7 columns Mon-Sun, rows = weeks of the month)
  - Each day cell shows the date number and **total hours** for that day (sum of all entries)
  - Days outside placement range are grayed out
  - Weekends visually distinct (lighter background)
  - Days with 0 hours show empty cell, days with entries show hours (e.g. "8h")
  - Monthly total displayed below the calendar
  - **Editable in DRAFT mode** (contractor who owns the timesheet):
    - Day cells become input fields (number, step=0.25, e.g. 8, 7.5, 8.25)
    - If day has exactly **1 entry**: editing the cell updates that entry's hours
    - If day has **0 entries**: editing creates a new entry (blank task_name, blank notes)
    - If day has **multiple entries** (task splitting): cell shows total hours with a distinct indicator (e.g. striped/dotted border). Cell is **not editable** — tooltip/warning says "Multiple entries — use Detailed View to edit". User must switch to Detailed View.
    - **Save button** below calendar: bulk upserts all entries via PUT /entries/bulk_upsert. No auto-save.
    - Decimal hours accepted: 0.25 increments (7.5, 8.25, etc.)
  - data-testid: `ts-calendar`, `ts-calendar-day-{date}`, `ts-calendar-save`
- **"Detailed" toggle button**: switches from calendar view to full entry list showing all entries (date, task name, hours, notes) in a table — the expanded view for managing multiple entries per day, task names, and notes. Button toggles back to calendar.
  - data-testid: `ts-toggle-detailed`
- **Attachments section** (below grid):
  - Upload dropzone (contractor, DRAFT only)
  - File list with download/delete
  - data-testid: `attachment-upload`, `attachment-list`
- **Action buttons** (bottom bar, based on role + status):
  - Contractor: Submit (DRAFT), shows confirmation if zero hours. **Future month warning on submit**: if the timesheet month is after the current month, show a warning dialog "You are submitting a timesheet for a future month. Are you sure?" — allows proceeding. Saving entries for future months is allowed without warning.
  - Client Contact: Approve / Reject (SUBMITTED, CLIENT_THEN_BROKER flow)
  - Broker/Admin: Approve / Reject (SUBMITTED or CLIENT_APPROVED)
  - data-testid: `ts-submit-btn`, `ts-approve-btn`, `ts-reject-btn`
- **Rejection reason**: modal with textarea when rejecting
  - data-testid: `reject-modal`, `reject-reason`, `reject-confirm`

### 9. Invoices (`/invoices`)
- Table: invoice number, type (badge: CLIENT/CONTRACTOR), client, contractor, **placement title**, month, amount, currency, status (badge), dates
- **Contractor view**:
  - **List columns**: hide type, contractor, position, period, amount. Show single "Placement" column as "Client → Position".
  - **Filters**: placement dropdown (all clients from invoices + active placements as "Client → Position", default to first active) + year dropdown (years extracted from `issue_date`, not billing period; default to most recent). Backend uses `issue_year` param to filter by `issue_date__year`.
  - **Invoice detail**: hide type badge, amounts, period, details card, billing snapshot. Show: invoice number, status, client name, issue date, PDF download, notification history.
- Default sort: `updated_at` desc (admin/broker), `issue_date` desc (contractor)
- Filters: type, status, client, contractor, year, month
- Contractor sees only own contractor invoices. Client contact sees only client invoices if configured.
- data-testid: `invoices-table`

**Invoice Detail** (`/invoices/[id]`):
- Header: invoice number, type badge, status badge, amount large
- Details card: rates, hours, subtotal, VAT, total
- Billing snapshot card: client or contractor details as snapshotted
- **Contractor view**: hide type badge, hide amount in header, hide details card (rates, subtotal, VAT, total). Show: invoice number, status, client name, issue date, PDF download button, and **notification history** timeline.
- **Notification history** section: chronological list of invoice events (title, text, timestamp, who). Shown for all roles — filtered by visibility flags (contractor/client only see their flagged notifications). Displayed as a timeline below the invoice details.
- Action buttons (broker/admin):
  - Issue (DRAFT), Mark Paid (ISSUED, opens date input), Void (ISSUED/PAID, confirmation), Correct (ISSUED, opens form)
  - Download PDF
- Correction link shown if exists (links to original or corrective)
- data-testid: `invoice-detail`, `invoice-issue-btn`, `invoice-paid-btn`, `invoice-void-btn`, `invoice-correct-btn`, `invoice-pdf-btn`

**Generate Invoices modal** (from Dashboard or standalone):
- Select approved timesheets (checkbox list)
- "Auto-issue" toggle
- Generate button, shows results (generated + errors)
- data-testid: `generate-modal`, `generate-submit`, `generate-auto-issue`

### 10. Documents (`/documents`) — ADMIN, BROKER, CLIENT_CONTACT
Aggregated view of all placement documents the user has access to.

- **Admin**: all documents across all placements
- **Broker**: documents from assigned clients' placements
- **Client Contact**: documents from placements where `client_can_view_documents=true`
- Table: file name, label, placement (client + contractor), uploaded by, date, size
- Filters: client, contractor, placement, label
- Actions: download per file. Admin/Broker can also delete.
- data-testid: `documents-table`, `document-download-{id}`, `document-delete-{id}`

### 11. Settings (`/settings`) — ADMIN only

Subtabs within the settings page:

**Invoice Templates** (default subtab):
- Card list of all invoice templates (all types: CONTRACTOR, CLIENT, AGENCY).
- Each card: title, code (mono), template_type badge, status badge, is_default badge, owner name, company summary.
- Filters: template_type dropdown, status dropdown.
- "New Template" button → opens A4 editor.
- Click card → opens A4 invoice-shaped editor (replaces list view).

**A4 Invoice Editor** (template detail view):
- Toolbar above: back button, editable title + code, type selector ("For Contractor" / "For Client" / "Agency", locked after creation), default toggle, status actions (Activate/Archive/Delete), Save button.
- A4-proportioned page matching the actual PDF invoice layout:
  - **Header**: "INVOICE" title, preview invoice number (from series prefix + next number), date/due date placeholders.
  - **From / To**: left side = single paste-friendly **textarea** (blue tint) for entire sender block (company, reg code, VAT, address — user pastes full block). Right side = amber placeholder block for recipient (auto-filled at generation).
  - **Line Items table**: placeholder row with editable currency field.
  - **Totals**: subtotal, editable VAT rate, total — all with currency.
  - **Payment Details** (contractor type only): editable bank name, IBAN, SWIFT.
  - **Footer bar**: VAT registered toggle, series prefix, next invoice number, payment terms — all inline editable.
  - **Footer**: preview invoice number + platform name.
- **Visual distinction**: editable fields have **blue tint** background + brand-colored border. Auto-filled placeholders have **amber/yellow tint** + dashed border. A **legend** above the A4 page explains both styles.
- data-testid: `settings-page`, `tab-invoice-templates`, `btn-new-template`

---

## Shared Components

| Component | Purpose | data-testid |
|---|---|---|
| `Sidebar` | Navigation, collapsible | `sidebar`, `sidebar-toggle` |
| `TopBar` | Page title, breadcrumbs, user menu | `topbar`, `user-menu` |
| `DataTable` | Sortable, filterable, paginated table | `{name}-table` |
| `SlideOver` | Create/edit forms | `{name}-form` |
| `StatusBadge` | Colored status pill | `status-{value}` |
| `ConfirmDialog` | Destructive action confirmation | `confirm-dialog`, `confirm-yes`, `confirm-no` |
| `MonthPicker` | Year-month selector | `month-selector` |
| `FileUpload` | Drag-and-drop upload area | `file-upload` |

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # root layout (sidebar + topbar)
│   ├── login/page.tsx
│   ├── page.tsx                # dashboard (control screen)
│   ├── users/
│   │   └── page.tsx
│   ├── clients/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── contractors/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── placements/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── timesheets/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── invoices/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── profile/page.tsx
│   └── documents/page.tsx
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/                 # Sidebar, TopBar, UserMenu
│   ├── data-table/             # DataTable, filters, pagination
│   ├── forms/                  # SlideOver, form fields
│   └── shared/                 # StatusBadge, ConfirmDialog, MonthPicker, FileUpload
├── lib/
│   ├── api/                    # generated API client from OpenAPI schema
│   ├── auth.ts                 # JWT token management, auth context
│   └── utils.ts                # formatters (currency, dates)
├── hooks/
│   ├── use-auth.ts
│   └── use-api.ts              # TanStack Query wrappers per resource
├── types/                      # generated from OpenAPI schema
├── e2e/                        # Playwright tests (see below)
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Auth Flow

1. Login page posts to `/api/v1/auth/login`, stores `access_token` + `refresh_token` in memory (not localStorage for security) + httpOnly cookie for refresh
2. Auth context provides `user` object (id, email, role, full_name) from token decode or `/users/me`
3. On 401: auto-refresh using refresh_token. If refresh fails: redirect to `/login`
4. Route guards in layout: redirect unauthenticated users to `/login`, redirect by role to appropriate home
5. Sidebar + pages conditionally render based on `user.role`

---

## Playwright Testability Rules

Every interactive element must have a `data-testid` attribute. Convention:

```
{resource}-table          # list table
{resource}-create-btn     # create button
{resource}-form           # slide-over form
{resource}-save           # form save button
{resource}-row-{id}       # table row by entity id
{resource}-detail         # detail page container
{action}-btn              # action buttons: activate, approve, reject, submit, etc.
{filter}-filter           # filter inputs
confirm-dialog            # confirmation modal
confirm-yes / confirm-no  # confirm buttons
```

### Key E2E Test Scenarios (Playwright)

1. **Login flow**: login as each role, verify correct sidebar items visible
2. **Admin user CRUD**: create broker user, verify appears in list
3. **Client CRUD**: broker creates client, edits it, assigns another broker
4. **Placement lifecycle**: create placement → activate → complete. Verify locked fields
5. **Timesheet full cycle**: contractor creates timesheet → adds entries → submits → client approves → broker approves
6. **Invoice generation**: from dashboard, select approved timesheets → generate → issue → mark paid
7. **Role isolation**: contractor cannot see other contractors' data, broker cannot see unassigned clients
8. **Responsive**: sidebar collapses on mobile, tables scroll horizontally

---

## API Integration Notes

- Generate TypeScript API client from `backend/openapi-schema.json` at build time
- **API proxy**: Next.js `rewrites` in `next.config.ts` proxies `/api/` to the Django backend. This avoids CORS entirely — the browser only talks to the Next.js server.
  ```ts
  // next.config.ts
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*` },
    ];
  }
  ```
  - `BACKEND_URL` env var (server-side only, no `NEXT_PUBLIC_` prefix) defaults to `http://localhost:8000`
  - All frontend API calls use relative paths (`/api/v1/...`) — the proxy handles the rest
- All API calls go through a single `apiClient` instance that handles:
  - Base URL: empty string (relative paths, proxy handles routing)
  - JWT injection from auth context
  - Auto-refresh on 401
  - Error normalization to `{code, message, details}` format
- TanStack Query keys follow pattern: `[resource, filters]` e.g. `["placements", {status: "ACTIVE"}]`
- Mutations invalidate relevant query keys on success

## Backend Endpoint Additions Needed

The `/documents` page requires a flat document listing endpoint that doesn't exist yet:

- `GET /api/v1/documents` — list all placement documents the user has access to
  - Admin: all documents
  - Broker: documents from assigned clients' placements
  - Client Contact: documents from placements where `client_can_view_documents=true`
  - Query params: `client_id`, `contractor_id`, `placement_id`, `label`, `page`, `per_page`
  - Response: same shape as placement documents but with `placement` nested object (client + contractor names)
