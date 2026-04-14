---
name: Candidates FTS architecture
description: Candidates module uses separate SQLite DB with FTS5 — key technical details for future work
type: project
originSessionId: d705df01-9b95-483c-9147-be885cf637fe
---
The Candidates module is fully isolated in a separate SQLite database.

**Database:** `candidates.sqlite3` — routed via `apps.candidates.router.CandidatesRouter` in `DATABASE_ROUTERS`.

**FTS5 setup:** Virtual table `candidates_fts` with porter stemmer + unicode61 tokenizer. One entry per candidate containing ALL searchable text (name, email, skills, notes, activity texts, CV extracted texts). Rebuilt on every change via `apps.candidates.fts.rebuild_fts(candidate)`.

**Migrations:** Run with `python manage.py migrate --database=candidates`. The FTS5 table is created via `RunSQL` in `0001_initial.py`.

**Key files:**
- `backend/apps/candidates/fts.py` — rebuild_fts, search_candidates, delete_fts (uses `connections["candidates"]`)
- `backend/apps/candidates/pdf.py` — PyMuPDF text extraction
- `backend/apps/candidates/router.py` — multi-DB router

**Cross-DB link:** Both sides store UUID strings (`ContractorProfile.candidate_id` and `Candidate.contractor_id`). No real FK. The link/unlink view writes to both DBs separately.

**Future migration to PostgreSQL:** Only `fts.py` (~30 lines) needs rewriting to use Django's `django.contrib.postgres.search`. Everything else is standard ORM.

**Why:** This architecture was chosen to keep candidates completely isolated from the main business DB while using zero additional infrastructure.

**How to apply:** When modifying candidates, always call `rebuild_fts()` after any data change. When running migrations, remember `--database=candidates` for candidates-app migrations.
