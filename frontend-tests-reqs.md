# Frontend E2E Test Requirements — Playwright

## Stack

- **Playwright** with TypeScript
- Tests live in `frontend-tests/` — a **standalone directory** at the project root, completely independent from `frontend/`
- Own `package.json`, own `node_modules`, own `tsconfig.json` — no imports from `frontend/`
- Only dependency on frontend is the URL (`http://localhost:3000`)
- Requires both backend (`http://localhost:8000`) and frontend (`http://localhost:3000`) running with seeded data

## Setup

```bash
cd frontend-tests
npm install
npx playwright install chromium
```

## Structure

```
frontend-tests/
├── package.json            # only deps: @playwright/test, typescript
├── tsconfig.json
├── playwright.config.ts    # baseURL: http://localhost:3000
├── helpers.ts              # login helpers, common utilities
├── auth.spec.ts
├── sidebar.spec.ts
├── users.spec.ts
├── clients.spec.ts
├── contractors.spec.ts
├── placements.spec.ts
├── timesheets.spec.ts
├── invoices.spec.ts
├── dashboard.spec.ts
└── documents.spec.ts
```

`playwright.config.ts`:
- `baseURL`: `http://localhost:3000`
- `testDir`: `./`
- `testMatch`: `*.spec.ts`
- Single browser: Chromium (add others later)
- No `webServer` — assumes backend + frontend already running

## Test Helpers

`helpers.ts`:
- `login(page, email, password)` — fills login form, submits, waits for redirect to `/`
- `loginAs.admin(page)`, `loginAs.broker1(page)`, `loginAs.contractor1(page)`, `loginAs.client1(page)` — shortcuts with seeded credentials (all pwd=`a`)
- All helpers use `data-testid` locators exclusively (`page.getByTestId(...)`)

## Test Files + Scenarios (38 tests across 10 files)

### 1. `e2e/auth.spec.ts` — Authentication (4 tests)
- `test('login with valid credentials')` — fill email+password, submit, verify redirect to `/`, sidebar visible
- `test('login with invalid credentials')` — wrong password, verify error message shown, stays on `/login`
- `test('logout')` — login, click user menu, click logout, verify redirect to `/login`
- `test('unauthenticated redirect')` — navigate to `/clients` without login, verify redirect to `/login`

### 2. `e2e/sidebar.spec.ts` — Role-based Navigation (4 tests)
- `test('admin sees 8 nav items')` — login as admin, verify sidebar has: Dashboard, Users, Clients, Contractors, Placements, Timesheets, Invoices, Documents
- `test('broker sees 7 nav items')` — login as broker1, verify no "Users" link
- `test('contractor sees 4 nav items')` — login as contractor1, verify: My Timesheets, My Placements, My Invoices, My Profile
- `test('client contact sees 3 nav items')` — login as client1, verify: Timesheets, Invoices, Documents

### 3. `e2e/users.spec.ts` — User Management (3 tests)
- `test('admin lists users')` — login as admin, navigate to `/users`, verify table has rows with seeded users
- `test('admin creates contractor user')` — click Create User, fill form (email, name, password, role=CONTRACTOR), save, verify new row in table
- `test('broker cannot access users page')` — login as broker1, navigate to `/users`, verify "Access Denied" or redirect

### 4. `e2e/clients.spec.ts` — Client CRUD (5 tests)
- `test('broker creates client')` — click Create Client, fill form, save, verify new row in table
- `test('broker edits client')` — click on Acme Corp, click Edit, change company name, save, verify updated
- `test('client detail shows tabs')` — click on client, verify Contacts/Brokers/Placements tabs render
- `test('assign broker to client')` — go to client detail, Brokers tab, assign broker2, verify appears in list
- `test('broker2 only sees assigned clients')` — login as broker2, go to `/clients`, verify only Globex Inc visible (not Acme Corp)

### 5. `e2e/contractors.spec.ts` — Contractor Profiles (3 tests)
- `test('broker lists all contractors')` — login as broker1, go to `/contractors`, verify both contractors visible
- `test('contractor edits own profile')` — login as contractor1, go to `/profile`, change company name, save, verify updated
- `test('client contact cannot access contractors')` — login as client1, verify no Contractors nav item, direct navigation to `/contractors` shows nothing

### 6. `e2e/placements.spec.ts` — Placement Lifecycle (5 tests)
- `test('create placement in DRAFT')` — login as broker1, create placement for Acme Corp + contractor, verify status=DRAFT in table
- `test('activate placement')` — go to draft placement detail, click Activate, verify status changes to ACTIVE
- `test('active placement locks rates')` — verify rate fields are grayed out / non-editable on active placement
- `test('copy placement')` — on active placement, click Copy, verify new DRAFT created with pre-filled fields
- `test('complete placement')` — click Complete on active placement, verify status=COMPLETED

### 7. `e2e/timesheets.spec.ts` — Timesheet Full Cycle (6 tests)
- `test('contractor creates timesheet')` — login as contractor1, go to active placement's timesheets tab (or via `/timesheets`), create timesheet for a month, verify DRAFT
- `test('contractor adds time entries')` — on draft timesheet, add entries (date, hours, task), verify total updates
- `test('contractor submits timesheet')` — click Submit, verify status changes to SUBMITTED
- `test('client approves timesheet')` — login as client1, find the submitted timesheet, click Approve, verify CLIENT_APPROVED
- `test('broker approves timesheet')` — login as broker1, find CLIENT_APPROVED timesheet, click Approve, verify APPROVED
- `test('reject and resubmit')` — submit a timesheet, login as broker/client, reject with reason, verify DRAFT + rejection reason shown, contractor can edit and resubmit

### 8. `e2e/invoices.spec.ts` — Invoice Lifecycle (5 tests)
- `test('generate invoice pair')` — login as broker1, open Generate Invoices modal, select approved timesheet, generate, verify 2 invoices created (client + contractor)
- `test('issue invoice')` — go to draft invoice, click Issue, verify ISSUED
- `test('mark invoice paid')` — on issued invoice, click Mark Paid, enter date, verify PAID
- `test('void invoice')` — on issued invoice, click Void, confirm, verify VOIDED
- `test('correct invoice')` — on issued invoice, click Correct, fill new rate, verify original=CORRECTED and new DRAFT created

### 9. `e2e/dashboard.spec.ts` — Control Screen (4 tests)
- `test('dashboard shows summary cards')` — login as admin, verify 4 summary cards visible (awaiting, no-invoice, unpaid, issues)
- `test('dashboard table shows placements')` — verify control table has rows with client, contractor, status badges, flags
- `test('month navigation works')` — click prev/next month, verify table data changes
- `test('bulk generate invoices from dashboard')` — select rows with approved timesheets, click bulk Generate, verify invoices created

### 10. `e2e/documents.spec.ts` — Documents (3 tests)
- `test('admin sees all documents')` — login as admin, go to `/documents`, verify table has documents
- `test('filter documents by client')` — select client filter, verify only that client's documents shown
- `test('contractor sees no documents in flat list')` — login as contractor1, navigate to `/documents`, verify empty or no access

## data-testid Reference (used in all tests)

```
login-email, login-password, login-submit
sidebar, sidebar-toggle, nav-{label}
topbar, user-menu
{resource}-table, {resource}-table-row-{id}
{resource}-create-btn, {resource}-form, {resource}-form-save
status-{VALUE}
placement-detail, placement-activate-btn, placement-complete-btn, placement-cancel-btn, placement-copy-btn
placement-tab-timesheets, placement-tab-documents, placement-tab-settings
entry-grid, entry-row-{date}, entry-hours-{date}, entry-add
ts-submit-btn, ts-approve-btn, ts-reject-btn
reject-modal, reject-reason, reject-confirm
attachment-upload, attachment-list
invoice-detail, invoice-issue-btn, invoice-paid-btn, invoice-void-btn, invoice-correct-btn, invoice-pdf-btn
generate-modal, generate-submit, generate-auto-issue
summary-awaiting, summary-no-invoice, summary-unpaid, summary-issues
control-table, bulk-generate, bulk-export
documents-table, document-download-{id}, document-delete-{id}
month-selector, month-prev, month-next
confirm-dialog, confirm-yes, confirm-no
file-upload
contractor-detail, contractor-edit-btn, contractor-save
client-detail, client-tab-contacts, client-tab-brokers, client-tab-placements
```

## Test Execution

```bash
# Terminal 1: backend
cd backend && python manage.py runserver

# Terminal 2: frontend
cd frontend && npm run dev

# Terminal 3: run tests
cd frontend-tests && npx playwright test

# Run specific file
cd frontend-tests && npx playwright test auth.spec.ts

# Run with UI
cd frontend-tests && npx playwright test --ui

# Run headed (see browser)
cd frontend-tests && npx playwright test --headed
```
