# Test Suite Documentation

Comprehensive documentation of TimeHit2's test coverage. **394 tests across two suites:**

| Suite | Location | Count | Purpose |
|---|---|---|---|
| Backend API | `tests/` | 269 | HTTP-level integration tests against running Django server |
| Playwright E2E | `frontend-tests/` | 125 | Browser-based end-to-end tests of full stack |

**See [`tests-todo.md`](tests-todo.md)** for future test ideas beyond current coverage.

---

## Strategy

### Black-box, server-required testing
Both suites are **standalone test projects** that run against live services. They have no Django imports — they only need:
- Backend running on `http://localhost:8000` with populated data
- Frontend running on `http://localhost:3000` (E2E only)

This means tests verify the **actual deployed behavior** end-to-end including:
- Real HTTP serialization
- Real database transactions
- Real authentication/authorization middleware
- Real PDF generation
- Real FTS5 indexing on candidates DB

### Test data: `populate --clean`
All tests assume seeded data from `python manage.py populate --clean`:
- 27 users (admin, brokers, contractors, client contacts), all passwords = `a`
- 7 clients, 14 placements (mix of DRAFT/ACTIVE/COMPLETED/CANCELLED)
- 43 timesheets (mix of DRAFT/SUBMITTED/CLIENT_APPROVED/APPROVED/REJECTED/MISSING)
- 70 invoices, 9 documents, 12 candidates with PDF CVs

Tests that mutate state (create/update/delete) clean up after themselves where possible. Use `python manage.py populate --clean` between major test runs to reset.

### Unique-email pattern for create tests
Tests that create candidates/users use `uuid.uuid4().hex[:8]` to generate unique emails. This prevents flakiness when re-running tests against an already-modified DB.

### Role-based fixture pattern
Backend `conftest.py` provides one fixture per role:
`api`, `admin_api`, `broker1_api`, `broker2_api`, `contractor1_api`, `contractor2_api`, `client1_api`

Each is a pre-authenticated `Api` wrapper. This makes role-specific tests trivial.

### Rate confidentiality verification (multi-layer)
The most thorough coverage area — verified at **both** API level (fields nulled in serializers) and UI level (fields hidden via DOM checks). Critical because the platform handles real money and contractors/clients must NEVER see margin.

---

## Technology

### Backend tests (`tests/`)
| Tool | Version | Use |
|---|---|---|
| pytest | 9.0+ | Test runner with class-based grouping |
| requests | latest | HTTP client (no Django coupling) |
| pdfplumber | latest | PDF assertion (verify generated invoice content) |

**Run:** `cd tests && pytest -v` (against running backend on :8000)

### Playwright E2E (`frontend-tests/`)
| Tool | Version | Use |
|---|---|---|
| @playwright/test | latest | Browser automation framework |
| TypeScript | latest | Test code language |
| Chromium | bundled | Test browser |

**Run:** `cd frontend-tests && npx playwright test` (against backend on :8000 + frontend on :3000)

### Test selector strategy
- **Backend:** Path + role fixture + JSON assertions
- **Playwright:** `data-testid` attributes exclusively (`page.getByTestId("...")`) — survives styling changes, robust to text/i18n variations

---

## Backend Test Catalog (269 tests)

**Batch 3 (A-K priorities, 56 tests added):**
- `test_data_integrity.py` (7) — Billing snapshot immutability, total_hours recalc, date-range, FTS reindex, profile immunity, correction links
- `test_security.py` (7) — JWT expiry, cross-broker/contractor/client, rate confidentiality, duplicate emails
- `test_numerical_precision.py` (5) — VAT rounding, subtotal consistency, zero-rate, fractional hours, negative rate
- `test_time_edges.py` (6) — Leap year, year wrap, future/past placements, invoice date validation
- `test_cascading.py` (6) — Contractor delete, broker scope, archived templates, candidate cleanup, FTS archive
- `test_unicode.py` (5) — Lithuanian/Arabic/emoji/long strings/unicode FTS
- `test_boundary.py` (4) — Zero hours, 24+ hours, pre-epoch, max decimals
- `test_regressions.py` (7) — Bug-report regression coverage
- `test_concurrency.py` (4) — Concurrent invoice gen, series counter, entry updates, lock-during-mutation
- `test_misc_d.py` (5) — Large files, XSS, SQL, long strings, double-submit

**Batch 2 (P1-P4, 37 tests):**
- `test_invoice_extras.py` (12), `test_timesheet_state.py` (3), `test_placement_copy.py` (2), `test_lock_blocking.py` (5), `test_misc_backend.py` (11), `test_p4_misc.py` (4)

### File: `tests/test_api.py` (80 tests)

#### TestAuth (4 tests)
| Test | What it verifies |
|---|---|
| `test_login_success` | POST /auth/login returns access+refresh tokens and user role for valid credentials |
| `test_login_invalid` | Wrong password returns 401 |
| `test_refresh_token` | POST /auth/refresh exchanges refresh token for new access token |
| `test_change_password` | POST /auth/change-password works; old password fails afterward |

#### TestUsers (5 tests)
| Test | What it verifies |
|---|---|
| `test_list_users_admin` | Admin lists all users (>= 7) |
| `test_list_users_forbidden_broker` | Broker gets 403 on /users |
| `test_create_user_contractor` | Admin creates CONTRACTOR; ContractorProfile auto-created |
| `test_get_me` | GET /users/me returns current user with contractor profile |
| `test_update_user_non_admin_limited` | Non-admin can't change email; can change full_name |

#### TestClients (5 tests)
| Test | What it verifies |
|---|---|
| `test_create_client` | Broker creates client |
| `test_list_clients_broker_scoped` | Broker sees only assigned clients |
| `test_update_client` | Broker updates client notes |
| `test_assign_broker` | Admin assigns brokers to client |
| `test_remove_last_broker_blocked` | Cannot remove last broker if active placements exist (409) |

#### TestClientContacts (3 tests)
Create/list/update CLIENT_CONTACT users for a client.

#### TestContractors (3 tests)
List as broker (sees all), forbidden as client_contact, contractor updates own profile (next_invoice_number can't decrease).

#### TestPlacements (7 tests)
Create DRAFT, activate to ACTIVE, locked rate fields after ACTIVE, complete, cancel, copy (pre-fills fields), delete blocked on ACTIVE (409).

#### TestPlacementDocuments (3 tests)
Upload, list, delete documents on a placement.

#### TestTimesheets (7 tests)
Create, prevent duplicate per (placement,year,month), submit, empty submission requires confirm, BROKER_ONLY approval flow, CLIENT_THEN_BROKER flow, rejection returns to DRAFT with reason.

#### TestTimesheetEntries (3 tests)
Bulk upsert entries, date validation (must be in month), 24h/day max validation.

#### TestTimesheetAttachments (2 tests)
Upload PNG attachment, delete blocked when not DRAFT (409).

#### TestInvoices (7 tests)
Generate pair (client+contractor), prevent duplicate generation, issue (DRAFT→ISSUED), mark paid, void, correct (creates new DRAFT corrective), delete only DRAFT.

#### TestDocuments (7 tests)
Admin sees all, broker sees scoped, contractor sees empty, filter by client_id/label/date_range/search.

#### TestControl (3 tests)
GET /control/overview returns placements with flags+margin, /summary returns counts+currency_breakdown, /export returns CSV.

#### TestRoleAccess (13 tests) — Rate Confidentiality
Verifies contractors/client_contacts NEVER see rates on placements list, placement detail, timesheet detail, invoice list, or invoice detail. Verifies brokers DO see rates everywhere.

#### TestSamplePdf (2 tests)
GET sample PDF from invoice template, POST sample PDF with overridden form data — verified with pdfplumber.

#### TestContractorCreation (4 tests)
Generate password endpoint (memorable, 8+ chars), uniqueness, contractor creation auto-creates ContractorProfile + DRAFT InvoiceTemplate, duplicate email rejected.

#### TestInvoiceGeneration (1 test)
End-to-end: generate from approved March timesheet, verify both PDFs exist with billing_snapshot.

---

### File: `tests/test_candidates.py` (40 tests)

#### TestCandidatesCRUD (8 tests)
| Test | What it verifies |
|---|---|
| `test_list_candidates` | GET /candidates returns paginated list with cv_count, status |
| `test_create_candidate` | Broker creates candidate with all fields |
| `test_retrieve_candidate_detail` | GET /candidates/{id} returns full detail with files+activities+notes |
| `test_update_candidate` | PATCH updates skills and rate |
| `test_update_status_creates_activity` | Status change auto-creates STATUS_CHANGE activity with old/new |
| `test_soft_delete_archives` | DELETE sets status=ARCHIVED (record still retrievable) |
| `test_duplicate_email_blocked` | Second candidate with same email returns 400 |
| `test_empty_email_allowed_multiple` | Multiple candidates without email allowed |

#### TestCandidatesFilters (6 tests)
Filter by status, country, contractor_linked=true/false, search (LIKE), sort by name asc.

#### TestCandidatesFTSSearch (5 tests)
| Test | What it verifies |
|---|---|
| `test_search_returns_results` | GET /candidates/search?q=java returns ranked results with snippets |
| `test_search_multi_term` | Multi-term FTS query works (java+spring) |
| `test_search_empty_query` | Empty query returns 0 results gracefully |
| `test_search_no_results` | Nonexistent term returns 0 results |
| `test_search_finds_by_skill` | Searches across skills field |

#### TestCandidatesFiles (6 tests)
Upload CV (PDF), list with type filter, delete file, download file, CV upload auto-creates CV_UPLOADED activity, CV delete auto-creates CV_REMOVED activity.

#### TestCandidatesActivities (4 tests)
Create NOTE activity, create PROPOSED with client_name, list newest-first ordering, activity with file attachment.

#### TestCandidatesContractorLink (3 tests)
Link to contractor (sets both DBs + creates LINKED activity), unlink (clears both + creates UNLINKED), missing contractor_id returns 400.

#### TestCandidatesParseCv (2 tests)
POST /candidates/parse-cv returns parsed fields (name/email/phone/skills/country), no file returns 400.

#### TestCandidatesAccessControl (6 tests)
Contractor and client_contact get 403 on list/create/search; admin and broker allowed.

---

### File: `tests/test_invoice_templates.py` (13 tests)

#### TestInvoiceTemplatesCRUD (6 tests)
List, create (CONTRACTOR/CLIENT type), retrieve detail, update fields, filter by template_type, filter by status.

#### TestInvoiceTemplatesLifecycle (7 tests)
| Test | What it verifies |
|---|---|
| `test_activate_draft` | DRAFT → ACTIVE transition |
| `test_archive_active` | ACTIVE → ARCHIVED transition |
| `test_activate_non_draft_fails` | Activating ACTIVE template returns 400/409 |
| `test_archive_non_active_fails` | Archiving DRAFT returns 400/409 |
| `test_delete_draft_ok` | DELETE on DRAFT works |
| `test_delete_active_blocked` | DELETE on ACTIVE blocked (409) |
| `test_delete_archived_ok` | DELETE on ARCHIVED works |

---

### File: `tests/test_invoice_notifications.py` (3 tests)
List notifications on ISSUED/PAID invoices (auto-created on transitions), contractor sees only visible_to_contractor=true entries.

---

### File: `tests/test_audit.py` (11 tests)

#### TestAuditLogs (6 tests)
Global audit log (admin only, broker/contractor get 403), filter by entity_type, filter by action, detail view.

#### TestEntityAuditLogs (5 tests)
GET audit log for placement, timesheet, invoice, client, contractor — verifies endpoint exists and returns wrapped data.

---

### File: `tests/test_lock.py` (7 tests)

#### TestLockUnlock (4 tests)
| Test | What it verifies |
|---|---|
| `test_lock_placement` | POST /lock locks a placement; is_locked=true returned |
| `test_unlock_requires_reason` | Unlock without reason returns 400 |
| `test_lock_client` | Lock client works |
| `test_invalid_action` | Invalid action (not lock/unlock) returns 400 |

#### TestUnlockedEntities (1 test)
GET /control/unlocked returns total count and entities at risk.

#### TestLockRow (1 test)
POST /control/lock-row locks all entities in placement chain (placement+client+contractor+invoices).

#### TestLockAll (1 test)
POST /control/lock-all bulk-locks all unlocked entities.

---

### File: `tests/test_settings_holidays.py` (6 tests)

#### TestAgencySettings (4 tests)
GET settings (admin), PATCH settings (admin only — broker/contractor get 403).

#### TestHolidays (2 tests)
GET /holidays returns country list, GET /holidays?country=LT&year=2026 returns holiday dates (verifies 2026-01-01 present).

---

### File: `tests/test_timesheet_extra.py` (2 tests)
Withdraw SUBMITTED timesheet → DRAFT, withdraw from DRAFT fails (400/409).

---

### File: `tests/test_entity_delete.py` (6 tests)

#### TestUserDelete (3 tests)
Delete user with no relations (hard or soft), broker forbidden from /users entirely, admin can't delete self (403).

#### TestClientDelete (1 test)
Delete client with active placements blocked (409 or 423 if locked).

#### TestContractorDelete (2 tests)
Delete contractor with active placements blocked (409/423), delete fresh contractor (no relations) works.

---

### File: `tests/test_client_files_activities.py` (5 tests)
Upload client file, list, delete; create activity, list activities.

---

### File: `tests/test_control_extra.py` (3 tests)
GET /control/past-issues returns issue scan, POST /admin/repopulate forbidden for broker and contractor.

---

## Playwright E2E Catalog (125 tests)

**Batch 3 (C/D deep UX, 8 tests):**
- `ui-deep.spec.ts` (8) — Dashboard filters, profile refresh, calendar weekends, bulk gen, login redirect target, audit clicks, 404 graceful, offline recovery

**Batch 2 (P1-P4, 13 tests):**
- `invoice-correction.spec.ts` (2) — Correction flow, series live preview
- `timesheet-rejection.spec.ts` (3) — Rejection modal, placement copy, PDF download button
- `ui-misc.spec.ts` (6) — Page smoke tests, slide-over, toast, theme persist, responsive, back button
- `ui-extras.spec.ts` (4) — Confirm dialog, pagination, entry warnings, escape key

### File: `frontend-tests/auth.spec.ts` (4 tests)
Login with valid creds (sidebar visible), invalid creds (stays on /login with error), logout (returns to /login), unauthenticated /clients redirects to /login.

### File: `frontend-tests/sidebar.spec.ts` (4 tests)
Admin sees 10 nav items, broker sees 7, contractor sees 4 (My Timesheets/Placements/Invoices/Profile), client_contact sees 3.

### File: `frontend-tests/users.spec.ts` (3 tests)
Admin lists users, sees user details, broker cannot access /users.

### File: `frontend-tests/clients.spec.ts` (5 tests)
Broker lists clients, navigates to detail, detail has sections, broker2 sees only assigned (Globex), admin sees all.

### File: `frontend-tests/contractors.spec.ts` (5 tests)
Broker lists all contractors, contractor sees own profile, admin creates contractor with autogen password then deletes, contractor edits own company name, client_contact has no Contractors nav.

### File: `frontend-tests/placements.spec.ts` (6 tests)
Broker lists placements, placement detail, contractor sees only own, statuses visible, admin creates placement with position then deletes, multiple statuses visible.

### File: `frontend-tests/timesheets.spec.ts` (6 tests)
Contractor sees timesheets on home, views detail, broker sees all timesheets, statuses visible, client_contact sees configured timesheets, detail shows info.

### File: `frontend-tests/invoices.spec.ts` (5 tests)
Broker sees invoices, statuses visible, detail shows amounts, contractor sees own, admin sees all.

### File: `frontend-tests/dashboard.spec.ts` (5 tests)
Admin dashboard content, month selector functional, broker dashboard, generate invoice for Demo DevOps from dashboard, contractor home content.

### File: `frontend-tests/documents.spec.ts` (4 tests)
Admin sees documents page, broker sees scoped, admin uploads/edits/deletes doc on placement, contractor has no Documents nav.

### File: `frontend-tests/rate-confidentiality.spec.ts` (7 tests)
Broker sees rates everywhere, contractor doesn't on placements list/detail, contractor doesn't on timesheet detail, broker sees on placement detail, broker sees on timesheet detail, client_contact doesn't see rates.

### File: `frontend-tests/entity-links.spec.ts` (13 tests)
All entity references (client/contractor/placement) on dashboard, clients list, placements list, placement detail, timesheets list, timesheet detail, invoices list, invoice detail, documents list — all rendered as clickable links to their respective detail pages. Plus deep-link to ?tab=placements activates correct tab.

### File: `frontend-tests/timesheet-lifecycle.spec.ts` (5 tests, serial)
End-to-end timesheet flow: Alex creates March timesheet from placement → adds entries → submits → Anna (client) approves → Jonas (broker) gives final approval.

### File: `frontend-tests/dashboard-check.spec.ts` (1 test)
Dashboard current month screenshot.

### File: `frontend-tests/dashboard-flags.spec.ts` (1 test)
Click "Awaiting Approval" card filters timesheets by pending_approval.

### File: `frontend-tests/barbie-theme.spec.ts` (1 test)
Barbie theme screenshot.

### File: `frontend-tests/fallout-theme.spec.ts` (1 test)
Fallout theme screenshot.

### File: `frontend-tests/matrix-theme.spec.ts` (1 test)
Matrix theme screenshot.

### File: `frontend-tests/metal-theme.spec.ts` (1 test)
Metal theme screenshot.

### File: `frontend-tests/login-logout-screenshots.spec.ts` (1 test)
Login/logout flow with visual regression screenshots.

---

### File: `frontend-tests/candidates.spec.ts` (8 tests)
| Test | What it verifies |
|---|---|
| `admin sees candidates page` | /candidates renders with search bar |
| `broker sees candidates page` | Broker has access |
| `candidates list shows seeded data` | Names from populate visible |
| `search candidates by skill` | Search "java" returns matches |
| `search with no results` | Nonexistent term returns empty |
| `click candidate navigates to detail` | Clicking candidate opens detail page |
| `candidate detail shows tabs` | Profile/CVs/Timeline tabs visible |
| `contractor cannot access candidates` | Shows "Admin access required" |
| `client contact cannot access candidates` | Same denial |

### File: `frontend-tests/brokers.spec.ts` (5 tests)
Admin sees /brokers page, list shows seeded brokers (Jonas/Laura/Peter), click broker navigates to detail, detail shows clients tab, contractor cannot access.

### File: `frontend-tests/settings.spec.ts` (5 tests)
Admin sees /settings page, page has tabs, repopulate button visible for admin, contractor blocked, broker blocked.

### File: `frontend-tests/audit.spec.ts` (4 tests)
Admin sees /audit page, log entries visible, contractor blocked, broker blocked.

---

## Running Tests

### Setup (one-time)
```bash
# Backend deps
cd backend && pip install -r requirements.txt && python manage.py migrate

# Tests deps
cd tests && pip install -r requirements.txt

# Playwright deps
cd frontend-tests && npm install && npx playwright install chromium
```

### Before each test run (fresh DB)
```bash
cd backend && python manage.py populate --clean
```

### Backend API tests
```bash
# Need backend running on :8000
cd tests
pytest -v                                  # all 176 tests
pytest test_candidates.py -v               # one file
pytest test_api.py::TestAuth -v            # one class
pytest test_api.py::TestAuth::test_login_success -v   # one test
pytest -k "rate_confidentiality" -v        # by keyword
```

### Playwright E2E tests
```bash
# Need backend on :8000 AND frontend on :3000
cd frontend-tests
npx playwright test                         # all 102 tests
npx playwright test candidates.spec.ts      # one file
npx playwright test --ui                    # interactive UI mode
npx playwright test --headed                # see browser
npx playwright test --reporter=list         # cleaner output
```

### Run both suites
```bash
# Terminal 1: backend
cd backend && source venv/bin/activate && python manage.py runserver 0.0.0.0:8000

# Terminal 2: frontend
cd frontend && npx next dev --port 3000

# Terminal 3: tests
cd backend && python manage.py populate --clean
cd ../tests && pytest -v
cd ../frontend-tests && npx playwright test
```

---

## Coverage Summary

| Area | Backend | Playwright | Total |
|---|---|---|---|
| Auth & sessions | 4 | 4 | 8 |
| Users | 5 | 3 | 8 |
| Clients | 5 + 3 contacts + 5 files/activities | 5 | 23 |
| Contractors | 3 | 5 | 8 |
| Placements | 7 + 3 docs | 6 | 16 |
| Timesheets | 7 + 3 entries + 2 attach + 2 withdraw | 6 + 5 lifecycle | 25 |
| Invoices | 7 + 13 templates + 3 notifications + 2 PDF + 1 generation | 5 | 31 |
| Documents | 7 | 4 | 11 |
| Control / dashboard | 3 + 3 extra + 7 lock + 6 settings | 5 + 1 + 1 | 26 |
| Audit | 11 | 4 | 15 |
| Candidates | 40 | 8 | 48 |
| Brokers (admin page) | 0 | 5 | 5 |
| Settings page | 0 | 5 | 5 |
| Rate confidentiality | 13 | 7 | 20 |
| Entity links | 0 | 13 | 13 |
| Role access (sidebar) | 0 | 4 | 4 |
| Themes / screenshots | 0 | 5 | 5 |
| Entity delete | 6 | 0 | 6 |
| **TOTAL** | **176** | **102** | **278** |

---

## Maintenance Notes

- **State pollution:** Tests that create entities use unique IDs (uuid) and clean up. If a test fails mid-way, leftover data may cause subsequent failures. Run `populate --clean` to reset.
- **Lock-all test:** `test_lock_all` locks all entities. Following tests that expect unlocked state will fail until repopulate. This is why `populate --clean` is recommended before each full run.
- **Date sensitivity:** Seed data is anchored to March 2026 ("current month"). If tests reference month-relative state, they may need updates as time moves forward.
- **Server must be running:** Both suites assume live services. There's no Django test client or in-memory DB — this is intentional (catches real serialization, transaction, and middleware bugs).
- **Playwright timeouts:** Default test timeout is 30s. Tests use explicit `waitForTimeout(2000)` in some places to allow API requests to complete after navigation.
