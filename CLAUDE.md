# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeHit is a recruitment/contracting agency platform. The agency places IT contractors at client companies and takes a margin on every hour worked. Core cycle: contractor logs hours -> hours approved -> two invoices generated automatically (one to client, one to contractor).

## Tech Stack

**Backend**: Python 3.11+, Django 5.2, DRF 3.17, SQLite, SimpleJWT, drf-spectacular, reportlab (PDF)
**Frontend**: Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, TanStack Query, Lucide icons
**Tests**: pytest + requests (backend API), Playwright (frontend E2E)

## Documentation

- `functional-spec.md` — Entity model (incl. InvoiceNotification), state machines, user flows, role-based access matrix, business rules, edge cases
- `timehit-api.md` — Full REST API spec (JWT auth, all endpoints incl. /timesheets/pending, /invoices/:id/notifications)
- `frontend-reqs.md` — Frontend spec: pages per role, navigation, components, contractor UX, attention buttons, rate confidentiality
- `frontend-tests-reqs.md` — Playwright E2E test plan
- `seriesgen.md` — Invoice series template engine: variables, counters, padding, rules, examples
- `backend-reqs.md` — Backend stack, project structure, seed data, implementation notes
- `req-populatedata.md` — Detailed seed data definition
- `reqs.md` / `questions.md` — Original requirements and clarified decisions

## Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py populate --clean    # full realistic data: 21 users, 6 clients, 11 placements, 36 timesheets, 62 invoices with PDFs
python manage.py seed                # minimal legacy test data (for API tests)
python manage.py runserver           # http://localhost:8000

# Frontend (requires Node 20+, use nvm)
cd frontend
npm install
npm run dev                          # http://localhost:3000

# Backend API tests (requires backend running + populated)
cd tests
pip install -r requirements.txt
pytest -v                            # 73 tests

# Frontend E2E tests (requires both backend + frontend running)
cd frontend-tests
npm install
npx playwright install chromium
npx playwright test                  # 54 tests in 12 files
```

## URLs

- Frontend: `http://localhost:3000`
- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`
- API base: `http://localhost:8000/api/v1/`
- Test users endpoint (public): `http://localhost:8000/api/v1/test-users`

## Project Layout

```
timehit3/
├── backend/
│   ├── config/                      # settings, urls, wsgi
│   ├── apps/
│   │   ├── authentication/          # login, refresh, logout, change-password
│   │   ├── users/                   # User model (AbstractBaseUser), pagination, exceptions, permissions, test-users endpoint
│   │   ├── clients/                 # Client, ClientContact, BrokerClientAssignment
│   │   ├── contractors/             # ContractorProfile
│   │   ├── placements/             # Placement (state machine, title field), PlacementDocument, flat /documents endpoint
│   │   ├── timesheets/             # Timesheet (state machine), TimesheetEntry, TimesheetAttachment, /pending endpoint
│   │   ├── invoices/               # Invoice, InvoiceNotification, InvoiceCorrectionLink, PDF generation
│   │   └── control/                # Control screen: overview, summary, CSV export
│   ├── media/                      # uploaded files + generated invoice PDFs
│   └── db.sqlite3
├── frontend/
│   ├── app/
│   │   ├── login/                  # login page with quick-login dropdown + last-user cookie
│   │   └── (authenticated)/        # sidebar + topbar layout, route guards
│   │       ├── page.tsx            # dashboard (admin/broker) or redirect to /timesheets (contractor)
│   │       ├── users/              # admin user management
│   │       ├── clients/            # client list + [id] detail
│   │       ├── contractors/        # contractor list + [id] detail
│   │       ├── placements/         # placement list + [id] detail (with create timesheet dialog)
│   │       ├── timesheets/         # timesheet list (with pending filter) + [id] detail (calendar + detailed view)
│   │       ├── invoices/           # invoice list + [id] detail (with notification history)
│   │       ├── documents/          # flat document listing
│   │       └── profile/            # contractor's own profile
│   ├── components/                 # layout, data-table, forms, shared
│   ├── lib/                        # api.ts (JWT in localStorage), auth-context, query-provider, utils
│   ├── hooks/                      # use-auth, use-api
│   └── types/                      # api.ts (all TypeScript interfaces)
├── tests/                           # Standalone backend API tests (pytest + requests)
├── frontend-tests/                  # Standalone Playwright E2E tests
└── *.md                             # requirement docs
```

## Test Coverage

### Backend API Tests (73 tests in `tests/test_api.py`)
| Group | Tests | Coverage |
|---|---|---|
| Auth | 4 | login, refresh, change-password |
| Users | 5 | CRUD, /me, role restrictions |
| Clients | 5 | CRUD, broker assign/remove, scoping |
| Client Contacts | 3 | CRUD |
| Contractors | 3 | list, forbidden, profile update |
| Placements | 7 | CRUD, activate/complete/cancel/copy, locked fields |
| Placement Documents | 3 | upload, list, delete |
| Timesheets | 7 | create, duplicate, submit, approve (both flows), reject |
| Timesheet Entries | 3 | bulk upsert, date validation, 24h limit |
| Timesheet Attachments | 2 | upload, delete-on-non-draft |
| Invoices | 7 | generate pair, duplicate blocked, issue, mark-paid, void, correct, delete |
| Documents | 7 | admin list, broker scoped, contractor empty, filter by client/label/date/search |
| Control Screen | 3 | overview, summary, CSV export |
| Rate Confidentiality | 13 | contractor can't see rates on placements/timesheets/invoices, client can't see rates, broker CAN see rates everywhere |
| Role Access | 3 | contractor own placements, own invoices, client configured |

### Playwright E2E Tests (54 tests in 12 files in `frontend-tests/`)
auth, sidebar, users, clients, contractors, placements, timesheets, invoices, dashboard, documents, rate-confidentiality, timesheet-lifecycle

## Key Domain Concepts

- **Placement** = 1 contractor at 1 client at agreed rates. Has a `title` field (position, e.g. "Backend Developer"). Rates immutable once ACTIVE.
- **Timesheet** = monthly hours for one placement. Approval flow configurable per placement (BROKER_ONLY or CLIENT_THEN_BROKER). Calendar view default, detailed view toggle.
- **Invoice** = always generated in pairs (client + contractor) from approved timesheet. Billing details snapshotted. PDFs generated. Has notification history (InvoiceNotification).
- **Roles**: ADMIN (full), BROKER (assigned clients, all contractors), CONTRACTOR (own data, restricted view), CLIENT_CONTACT (configurable per placement).

## State Machines

- **Placement**: DRAFT -> ACTIVE -> COMPLETED|CANCELLED
- **Timesheet (BROKER_ONLY)**: DRAFT -> SUBMITTED -> APPROVED|REJECTED(->DRAFT)
- **Timesheet (CLIENT_THEN_BROKER)**: DRAFT -> SUBMITTED -> CLIENT_APPROVED -> APPROVED|REJECTED(->DRAFT)
- **Invoice**: DRAFT -> ISSUED -> PAID|VOIDED|CORRECTED; PAID -> VOIDED

## Populate Data Users (all pwd=`a`)

### Main users (populate command)
| email | role | notes |
|---|---|---|
| admin@timehit.com | ADMIN | Sarah Admin |
| admin2@timehit.com | ADMIN | Mark Director |
| jonas@timehit.com | BROKER | TechVibe, NordSoft, MediCorp |
| laura@timehit.com | BROKER | CloudBase, NordSoft |
| peter@timehit.com | BROKER | CloudBase |
| dev.alex@mail.com | CONTRACTOR | Alex Turner, AT Consulting, placement at TechVibe (Backend Developer) |
| dev.mia@mail.com | CONTRACTOR | Mia Chen, MC Digital Ltd, placement at TechVibe (Frontend Lead) |
| dev.oscar@mail.com | CONTRACTOR | Oscar Petrov, freelancer, placement at CloudBase (Cloud Architect) |
| dev.nina@mail.com | CONTRACTOR | Nina Kowalski, NK Solutions, placement at NordSoft (Data Engineer) |
| dev.sam@mail.com | CONTRACTOR | Sam Rivera, freelancer, placement at MediCorp (Security Consultant) |
| anna@techvibe.com | CLIENT_CONTACT | TechVibe GmbH |
| bob@cloudbase.io | CLIENT_CONTACT | CloudBase Inc |
| carla@nordsoft.se | CLIENT_CONTACT | NordSoft AB |
| dave@medicorp.de | CLIENT_CONTACT | MediCorp AG |

### Legacy test users (also created by populate, for API/Playwright tests)
| email | role |
|---|---|
| admin@test.com | ADMIN |
| broker1@test.com | BROKER (Acme Corp + Globex Inc) |
| broker2@test.com | BROKER (Globex Inc) |
| contractor1@test.com | CONTRACTOR (John Doe, Acme Corp) |
| contractor2@test.com | CONTRACTOR (Jane Smith, Globex Inc) |
| client1@test.com | CLIENT_CONTACT (Acme Corp) |
| client2@test.com | CLIENT_CONTACT (Globex Inc) |

## Critical Business Rules

- **Rate confidentiality**: Contractors and Client Contacts NEVER see rates or margin. Enforced at API level (nulled in serializers) AND UI level (hidden). Only Admin/Broker see rates.
- **Contractor restrictions**: Read-only placements. No document upload. No action buttons (activate/complete/cancel/copy). No Settings tab. Client labeled "End Client".
- Rates + currency locked once placement is ACTIVE (create new placement for rate changes)
- One timesheet per (placement, year, month) — rejection reuses the same record
- Contractor can delete DRAFT timesheets (with confirmation if entries exist)
- Invoice generation blocked if non-VOIDED invoices exist for that timesheet
- Contractor invoice numbering uses contractor's own series prefix; numbers never recycled
- Broker scope: can only see/edit clients assigned to them via broker_client_assignments
- All invoice billing details are snapshotted at generation time (profile changes don't alter issued invoices)
- JWT tokens stored in localStorage (survives page refresh)
- Frontend uses Next.js rewrites to proxy `/api/*` to backend — no CORS needed

## Contractor UX Design Decisions

- **Placements list**: defaults to ACTIVE, hides client/contractor/approval flow columns. Shows "Client → Position" single column. Two action buttons per row: "Create/Edit Last Month TS" (red alert with "Late !") and "Create/Edit This Month TS" (blue brand).
- **Timesheets list**: filter dropdown (Missing or not submitted / Submitted / Approved / All). "Missing" is default, auto-falls-back to "All" if empty. Past month actions show red "Late !" alerts. Current month shows normal blue buttons.
- **Timesheet detail**: Calendar month grid (default view, editable for DRAFT), Detailed view toggle. Month nav arrows `< >`. Delete button for DRAFT. Header shows "Client → Position" with contractor subtitle.
- **Invoices list**: shows only Invoice #, Placement (Client → Position), Status, Issue Date. Filters: client placement dropdown + year. No amounts shown.
- **Invoice detail**: hides type badge, amounts, details card, billing snapshot, period. Shows notification history timeline.
- **Create Timesheet dialog**: shows all months in placement range with their current status. Only MISSING months selectable. Current month highlighted.
- **Login page**: Quick-login dropdown populated from `/test-users`. Remembers last user via cookie.

## Process Rules

When the user reports a bug or requests a feature:
1. **Clarify** until requirement is fully understood
2. **Update docs first** (functional-spec, timehit-api, frontend-reqs, frontend-tests-reqs as needed)
3. **Then implement** the code changes

Use `temp_python.py` or `temp_sh.sh` in project root for ad-hoc scripts (fewer approval prompts).
