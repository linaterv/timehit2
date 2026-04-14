---
name: TimeHit2 primary project
description: IT Contracting Agency Platform — the user's main project. Django+Next.js stack in /home/timehit/a/timehit2. Deployed on server with nginx gate auth.
type: project
originSessionId: d705df01-9b95-483c-9147-be885cf637fe
---
TimeHit2 is the user's primary project and focus. It is an IT Contracting Agency Platform located at `/home/timehit/a/timehit2`.

**Stack:** Django 5.2/DRF backend (Python 3.12, venv at backend/venv), Next.js 16.2/React 19/TypeScript/Tailwind v4 frontend, SQLite (main) + SQLite (candidates), JWT auth, ReportLab PDFs, PyMuPDF for CV text extraction.

**Running services:**
- Django backend: port 8000, started with `source backend/venv/bin/activate && python manage.py runserver 0.0.0.0:8000`
- Next.js frontend: port 3000, started with `npx next dev --port 3000 --hostname 0.0.0.0`
- Both run as nohup background processes (logs at /tmp/django.log and /tmp/nextjs.log)

**Seed data:** loaded via `python manage.py populate --clean` (realistic dataset) or `python manage.py seed` (minimal, for API tests). Exact counts drift between runs — check the DB or CLAUDE.md for current figures. All passwords: `a`

**Key users:** admin@timehit.com (Admin), jonas@timehit.com (Broker), dev.alex@mail.com (Contractor), anna@techvibe.com (Client Contact)

**Tests:** pytest API suite in `tests/` (run with `pytest -v`), Playwright E2E in `frontend-tests/` (run with `npx playwright test`). Counts drift — see `tests.md` for the live catalog and `tests-todo.md` for backlog.

**Candidates module (built 2026-04-11):**
- Separate SQLite DB (`candidates.sqlite3`) with Django multi-DB routing (`apps.candidates.router.CandidatesRouter`)
- Models: Candidate, CandidateActivity (CRM timeline), CandidateFile (CVs + attachments)
- FTS5 full-text search across all candidate content (name, skills, notes, CV text, activity text)
- PDF text extraction via PyMuPDF on upload
- Cross-DB link: `ContractorProfile.candidate_id` ↔ `Candidate.contractor_id` (UUID strings, not real FK)
- Requirements doc: `candidate-reqs.md`
- Frontend: /candidates (search-first), /candidates/[id] (Profile/CVs/Timeline tabs)

**Sidebar structure (2026-04-11):**
- Main nav: Dashboard, Clients, Contractors, Placements, Timesheets, Invoices
- Hamburger "More" menu: Candidates, Brokers, Users, Documents, Audit, Settings

**Dashboard features:**
- 5 summary cards: Timesheet Issues (first card), No Invoice, Unpaid Invoices, Invoice Not Sent, Issues
- Broker column in table showing responsible broker(s)
- Filters: Month, Client, Contractor, Broker, Needs Attention, Flags dropdown

**Themes with backgrounds/sidebar characters:**
- HitHunter (renamed from VS Code Light), Matrix, Barbie, Metal, Fallout, Aloha — all have bg images and sidebar characters
- Sidebar characters use `position: absolute; pointer-events: none; opacity: 0.4` to not block hamburger menu

**Brokers page:** `/brokers` list + `/brokers/[id]` detail with tabs (Details, Clients). Full CRUD, client assignment.

**Settings page:** Has "Repopulate Database" danger button (admin only, hostname-gated to v1ln.l.dedikuoti.lt / localhost).

**Why:** This is the user's main work — all tasks should be considered in context of this project.

**How to apply:** When the user asks for work, default to this project context. The repo has comprehensive docs in markdown files at the root.
