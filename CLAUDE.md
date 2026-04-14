# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeHit is a recruitment/contracting agency platform. The agency places IT contractors at client companies and takes a margin on every hour worked. Core cycle: contractor logs hours -> hours approved -> two invoices generated automatically (one to client, one to contractor).

## Tech Stack

**Backend**: Python 3.11+, Django 5.2, DRF 3.17, SQLite, SimpleJWT, drf-spectacular, reportlab (PDF)
**Frontend**: Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, TanStack Query, Lucide icons
**Tests**: pytest + requests (backend API), Playwright (frontend E2E)

## Memory

Persistent, file-based memory lives in `memory/` at the repo root. It is symlinked from `~/.claude/projects/-home-timehit-a-timehit2/memory/`, so Claude Code's auto-memory system reads and writes directly into the repo. `memory/MEMORY.md` is the index (auto-loaded into context); individual memory files are referenced from there.

Save new memories into `memory/` using the standard `user`/`feedback`/`project`/`reference` types. Do not duplicate content that already lives in this CLAUDE.md or in the requirement docs.

## Documentation

- `functional-spec.md` — Entity model (incl. InvoiceNotification), state machines, user flows, role-based access matrix, business rules, edge cases
- `timehit-api.md` — Full REST API spec (JWT auth, all endpoints incl. /timesheets/pending, /invoices/:id/notifications)
- `frontend-reqs.md` — Frontend spec: pages per role, navigation, components, contractor UX, attention buttons, rate confidentiality
- `frontend-tests-reqs.md` — Playwright E2E test plan
- `tests.md` — Full test catalog: every test in both suites, strategy, technology, run commands
- `seriesgen.md` — Invoice series template engine: variables, counters, padding, rules, examples
- `backend-reqs.md` — Backend stack, project structure, seed data, implementation notes
- `req-populatedata.md` — Detailed seed data definition
- `reqs.md` / `questions.md` — Original requirements and clarified decisions
- `candidate-reqs.md` — Candidate CRM module requirements (data model, FTS, API, UX)
- `candidate-implementation.md` — Candidate CRM implementation reference (architecture, endpoints, file layout)

## Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py populate --clean    # full realistic data: 21 users, 6 clients, 11 placements, 36 timesheets, 65 invoices (62 with PDFs, 3 manual)
python manage.py seed                # minimal legacy test data (for API tests)
python manage.py runserver           # http://localhost:8000

# Frontend (requires Node 20+, use nvm)
cd frontend
npm install
npm run dev                          # http://localhost:3000

# Backend API tests (requires backend running + populated)
cd tests
pip install -r requirements.txt
pytest -v                            # 297 tests across 28 files

# Frontend E2E tests (requires both backend + frontend running)
cd frontend-tests
npm install
npx playwright install chromium
npx playwright test                  # 138 tests in 30 files
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
│   │   ├── control/                # Control screen: overview, summary, CSV export
│   │   └── candidates/            # Candidate CRM (separate SQLite DB), FTS5 search, CV parsing, timeline
│   ├── media/                      # uploaded files + generated invoice PDFs + candidate CVs
│   ├── db.sqlite3
│   └── candidates.sqlite3          # separate DB for candidates module
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
│   │       ├── candidates/        # candidate CRM: search, list, create (with PDF import)
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

**See [`tests.md`](tests.md) for the full catalog (every test, what it verifies, how to run).**

### Backend API Tests — 297 tests across 28 files in `tests/`
| File | Tests | Coverage |
|---|---|---|
| `test_api.py` | 80 | Auth, users, clients, contractors, placements, timesheets, invoices, documents, control, rate confidentiality, contractor creation, PDF generation |
| `test_candidates.py` | 40 | CRUD, FTS search, files, activities, contractor link, parse-cv, access control |
| `test_invoice_templates.py` | 13 | CRUD + activate/archive lifecycle + delete rules |
| `test_audit.py` | 11 | Global log, entity-specific logs, filters, access control |
| `test_lock.py` | 7 | Lock/unlock with reason, lock-row, lock-all, unlocked entities |
| `test_settings_holidays.py` | 6 | Agency settings GET/PATCH, holidays endpoint |
| `test_entity_delete.py` | 6 | User/client/contractor delete with soft/hard logic |
| `test_client_files_activities.py` | 5 | Client file upload/list/delete + activities |
| `test_invoice_notifications.py` | 3 | Auto-created notifications on status transitions |
| `test_control_extra.py` | 3 | Past issues, repopulate access control |
| `test_timesheet_extra.py` | 2 | Withdraw flow |

### Playwright E2E Tests — 138 tests across 30 files in `frontend-tests/`
auth, sidebar, users, clients, contractors, placements, timesheets, invoices, dashboard, documents, rate-confidentiality, entity-links, timesheet-lifecycle, dashboard-check, dashboard-flags, candidates, brokers, settings, audit, plus 5 theme/screenshot specs.

## Key Domain Concepts

- **Placement** = 1 contractor at 1 client at agreed rates. Has a `title` field (position, e.g. "Backend Developer"). Rates immutable once ACTIVE.
- **Timesheet** = monthly hours for one placement. Approval flow configurable per placement (BROKER_ONLY or CLIENT_THEN_BROKER). Calendar view default, detailed view toggle.
- **Invoice** = always generated in pairs (client + contractor) from approved timesheet. Billing details snapshotted. PDFs generated. Has notification history (InvoiceNotification).
- **Candidate** = potential contractor in CRM pipeline. Separate SQLite DB with FTS5 search. Has CVs (PDF with auto-text extraction), activity timeline, and optional link to ContractorProfile. Statuses: AVAILABLE → PROPOSED → INTERVIEW → OFFERED → PLACED. Import from PDF auto-parses name/email/phone/skills/country (supports both regular CVs and LinkedIn PDF exports).
- **Roles**: ADMIN (full), BROKER (assigned clients, all contractors, all candidates), CONTRACTOR (own data, restricted view), CLIENT_CONTACT (configurable per placement).

## State Machines

- **Placement**: DRAFT -> ACTIVE -> COMPLETED|CANCELLED
- **Timesheet (BROKER_ONLY)**: DRAFT -> SUBMITTED -> APPROVED|REJECTED(->DRAFT)
- **Timesheet (CLIENT_THEN_BROKER)**: DRAFT -> SUBMITTED -> CLIENT_APPROVED -> APPROVED|REJECTED(->DRAFT)
- **Invoice**: DRAFT -> ISSUED -> PAID|VOIDED|CORRECTED; PAID -> VOIDED
- **Candidate**: AVAILABLE -> PROPOSED -> INTERVIEW -> OFFERED -> PLACED|UNAVAILABLE|ARCHIVED

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

## Team Agents

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` is set globally — multi-agent teams are available. Three project-scoped personas live in `.claude/agents/`:

- **`ui-engineer`** — owns `frontend/` and `frontend-tests/` (Next.js/React/Tailwind/Playwright)
- **`backend-engineer`** — owns `backend/` and `tests/` (Django/DRF/pytest/FTS)
- **`team-lead`** — full-stack reviewer/coordinator. Updates reqs docs, distributes tasks to ui/be via `TaskCreate` with `owner`, advises on design tradeoffs, reviews diffs against business rules + state machines. Codes only for small cross-cutting fixes or reqs/doc edits.

### When to spawn a team (vs. solo)

Spawn a team whenever the work **cleanly splits across UI and backend** and both halves take more than a trivial edit. Typical triggers:
- New feature that needs a new endpoint + new page/component/dialog
- Schema change that propagates to API response + UI types + tests on both sides
- Cross-cutting refactor touching serializers and the components that consume them

Stay solo when:
- Single-file edit, typo, CSS tweak, doc update
- Backend-only (migration, pytest fix, admin command) or frontend-only (layout, Tailwind polish, a11y fix)
- Exploratory/research question — use `Explore` subagent, not a full team

### How to spawn the team

1. **Create the team**: `TeamCreate({ team_name: "<short-slug>", description: "<one-line goal>" })`. Slug examples: `feat-export-csv`, `fix-invoice-pdf`.
2. **Update reqs docs first** (per Process Rules above) — functional-spec / timehit-api / frontend-reqs as relevant. Do this before spawning so both teammates start from the same source of truth.
3. **Spawn teammates in parallel** — one Agent call per persona, in a **single message with multiple tool uses**:
   - `Agent({ subagent_type: "ui-engineer", name: "ui", team_name: "<slug>", prompt: "<scoped UI task>" })`
   - `Agent({ subagent_type: "backend-engineer", name: "be", team_name: "<slug>", prompt: "<scoped backend task>" })`
   - For larger features where ongoing review/coordination helps, also spawn `Agent({ subagent_type: "team-lead", name: "lead", team_name: "<slug>", prompt: "own reqs updates, task breakdown, and review" })`. Skip for small or single-lane work.
4. **Split the work reasonably** — each teammate's prompt should state its own deliverable, the API contract they share, and who messages whom first (usually backend first if the contract is new).
5. **Coordination rule**: the teammate that changes or introduces a contract (endpoint, field, permission) messages the other via `SendMessage` BEFORE landing the change. The receiver acks, then both proceed against the agreed contract.
6. **Monitor**: when teammates go idle they're waiting for input — that's normal, not an error. Review `TaskList`, assign follow-ups via `TaskUpdate { owner: "ui" | "be" }`.
7. **Shutdown**: when the feature is done, `SendMessage` each teammate with `{ type: "shutdown_request" }`, then `TeamDelete`.

### What NOT to do

- Don't spawn a team for solo-scope work. The coordination overhead eats the savings.
- Don't let teammates cross lanes (UI agent editing Django, backend agent editing React). If a lane edit is needed, message the other teammate to do it.
- Don't skip updating req docs before spawning — both teammates read them and will drift if they're stale.
- Don't manually run `git commit`. Auto-commit sweeps everything every 10 min with an `autoCommit:` prefix.
