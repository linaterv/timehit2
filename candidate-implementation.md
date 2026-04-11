# Candidates Module — Implementation Reference

## What Was Built (2026-04-11)

Complete CRM-style candidate database with PDF CV storage, full-text search, and activity timeline. Fully isolated in a separate SQLite database.

## Architecture

### Separate Database

- **File:** `backend/candidates.sqlite3`
- **Router:** `apps.candidates.router.CandidatesRouter` — routes all `candidates` app_label models to `candidates` DB
- **Config:** `DATABASES["candidates"]` in `config/settings.py`, `DATABASE_ROUTERS` list
- **Migrations:** `python manage.py migrate --database=candidates`
- Main TimeHit DB (`db.sqlite3`) knows nothing about candidates tables and vice versa

### Full-Text Search (FTS5)

- **Virtual table:** `candidates_fts` created via `RunSQL` in migration `0001_initial.py`
- **Tokenizer:** `porter unicode61` — handles word stemming ("developing" matches "developer") and unicode characters
- **One entry per candidate** containing ALL searchable text concatenated:
  - `full_name + email + phone + country + skills + notes + all activity texts + all file extracted_texts`
- **Rebuilt** on every data change via `rebuild_fts(candidate)` in `fts.py`
- **Search function:** `search_candidates(query, limit)` returns `(candidate_id, snippet, rank)` tuples
- **Snippet highlighting:** FTS5 `snippet()` function wraps matches in `<b>` tags

### PDF Text Extraction

- **Library:** PyMuPDF (`pymupdf` package, imported as `fitz`)
- **Function:** `apps.candidates.pdf.extract_text(file_path)` 
- Extracts text from all PDF pages, returns concatenated text
- Returns `"[NO_TEXT_EXTRACTED]"` for scanned/image PDFs
- Returns `""` for non-PDF files
- Called automatically on every file upload

### Cross-DB Contractor Link

- **Candidate side:** `Candidate.contractor_id` — CharField(max_length=36), stores User UUID string
- **Main DB side:** `ContractorProfile.candidate_id` — CharField(max_length=36), stores Candidate UUID string
- Both are plain strings, not real foreign keys (can't do FK across SQLite databases)
- Link/unlink writes to both databases in separate `.save()` calls
- Migration: `contractors/0004_add_candidate_id.py`

## Data Models

### Candidate (`candidates` table)

| Field | Type | Default | Notes |
|---|---|---|---|
| id | UUID | auto | PK |
| full_name | CharField(255) | required | |
| email | CharField(255) | "" | |
| phone | CharField(50) | "" | |
| country | CharField(100) | "LT" | |
| status | CharField(20) | "AVAILABLE" | Choices: AVAILABLE, PROPOSED, INTERVIEW, OFFERED, PLACED, UNAVAILABLE, ARCHIVED |
| skills | TextField | "" | Comma-separated |
| desired_rate | Decimal(10,2) | null | |
| desired_currency | CharField(3) | "EUR" | |
| source | CharField(100) | "" | LinkedIn, Referral, etc. |
| notes | TextField | "" | |
| contractor_id | CharField(36) | "" | Link to main DB |
| created_at | DateTimeField | auto | |
| updated_at | DateTimeField | auto | |

### CandidateActivity (`candidate_activities` table)

CRM timeline — every interaction in one unified feed.

| Field | Type | Default | Notes |
|---|---|---|---|
| id | UUID | auto | PK |
| candidate | FK → Candidate | required | CASCADE |
| type | CharField(20) | required | See types below |
| text | TextField | "" | Free-form description |
| old_value | CharField(50) | "" | For status changes |
| new_value | CharField(50) | "" | For status changes |
| client_name | CharField(255) | "" | Which client this relates to |
| created_by | CharField(255) | "" | User name string (not FK) |
| created_at | DateTimeField | auto | |

**Activity types:** NOTE, STATUS_CHANGE, CV_UPLOADED, CV_REMOVED, FILE_ATTACHED, LINKED, UNLINKED, PROPOSED, REJECTED, INTERVIEW, OFFER, PLACED

**Auto-created activities:**
- STATUS_CHANGE: when candidate status is updated via PATCH
- CV_UPLOADED: when a CV file is uploaded
- CV_REMOVED: when a CV file is deleted
- LINKED/UNLINKED: when contractor link is created/removed
- ARCHIVED: when candidate is "deleted" (soft delete)

### CandidateFile (`candidate_files` table)

Unified file storage for CVs and activity attachments.

| Field | Type | Default | Notes |
|---|---|---|---|
| id | UUID | auto | PK |
| candidate | FK → Candidate | required | CASCADE |
| activity | FK → CandidateActivity | null | SET_NULL, null for standalone CVs |
| file | FileField | required | upload_to: `candidates/{candidate_id}/` |
| original_filename | CharField(255) | required | |
| file_type | CharField(20) | "CV" | CV or ATTACHMENT |
| extracted_text | TextField | "" | Auto-extracted from PDFs |
| file_size | IntegerField | 0 | Bytes |
| uploaded_at | DateTimeField | auto | |

## API Endpoints

### Candidates CRUD

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/candidates` | List with filters: status, country, source, search (LIKE), has_cv, contractor_linked, sort, order |
| GET | `/api/v1/candidates/search?q=java+springboot` | FTS5 full-text search, returns ranked results with snippets |
| POST | `/api/v1/candidates` | Create candidate |
| GET | `/api/v1/candidates/{id}` | Detail with all files and activities |
| PATCH | `/api/v1/candidates/{id}` | Update (auto-creates STATUS_CHANGE activity if status changed) |
| DELETE | `/api/v1/candidates/{id}` | Soft delete — sets status=ARCHIVED |

### Files

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/candidates/{id}/files?type=CV` | List files, filterable by type |
| POST | `/api/v1/candidates/{id}/files` | Upload file(s), multipart. Fields: file(s), file_type, activity_id |
| GET | `/api/v1/candidates/{id}/files/{fid}/download` | Download file |
| DELETE | `/api/v1/candidates/{id}/files/{fid}` | Delete file |

### Activities

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/candidates/{id}/activities` | List timeline (newest first, includes nested files) |
| POST | `/api/v1/candidates/{id}/activities` | Create activity, multipart. Fields: type, text, client_name, file(s) |

### Contractor Link

| Method | URL | Description |
|---|---|---|
| POST | `/api/v1/candidates/{id}/link-contractor` | Body: { contractor_id: "uuid" } — sets both sides |
| DELETE | `/api/v1/candidates/{id}/link-contractor` | Clears both sides |

## Frontend Pages

### /candidates — Search & List Page

- **Search bar:** Prominent at top, Enter or Search button triggers FTS search
- **Two modes:**
  - **List mode** (empty search): paginated list, most recent first, status filter
  - **Search mode** (has query): FTS ranked results with highlighted snippets via `dangerouslySetInnerHTML`
- **Candidate cards** show: name, status badge, country, skills tags, rate, CV count, source
- **Create Candidate** slide-over with: name, email, phone, country, skills, rate/currency, source
- Click card → navigate to detail page

### /candidates/[id] — Detail Page

**Header:** Name, status badge, skills tags, contact info, rate, source, contractor link

**Three tabs:**

1. **Profile** — View/edit all fields. Inline editing pattern (Edit button toggles form). Status dropdown auto-creates STATUS_CHANGE activity.

2. **CVs** — File list with upload/download/delete. Upload via hidden file input, multipart POST. Shows filename, size, date.

3. **Timeline** — CRM activity feed:
   - Activity form at top: type dropdown (Note/Proposed/Rejected/Interview/Offer), text area, client name field, file attachments
   - Feed below: chronological (newest first), each entry shows emoji icon by type, type label, client name, date, author, text, status change badges, attached files with download links

### Sidebar

"Candidates" added to hamburger (More) menu for both ADMIN and BROKER roles, using `UserSearch` icon from Lucide.

## File Layout

```
backend/apps/candidates/
├── __init__.py
├── models.py              # Candidate, CandidateActivity, CandidateFile
├── serializers.py         # List, Detail, Create, Update, File, Activity, SearchResult
├── views.py               # CandidateViewSet, CandidateFileViewSet, CandidateActivityViewSet, ContractorLinkView
├── urls.py                # Router + nested routes
├── fts.py                 # rebuild_fts, search_candidates, delete_fts
├── pdf.py                 # extract_text (PyMuPDF)
├── router.py              # CandidatesRouter (multi-DB)
├── management/commands/
│   └── (future: rebuild_candidates_fts.py, populate_candidates.py)
└── migrations/
    └── 0001_initial.py    # Models + FTS5 RunSQL

frontend/app/(authenticated)/candidates/
├── page.tsx               # Search & list page
└── [id]/
    └── page.tsx           # Detail page (Profile/CVs/Timeline tabs)
```

## Access Control

- **ADMIN:** Full access
- **BROKER:** Full access
- **CONTRACTOR:** No access
- **CLIENT_CONTACT:** No access

Uses existing `IsAdminOrBroker` permission class.

## Search Query Syntax

| Input | Behavior |
|---|---|
| `java springboot` | Both terms (implicit AND) |
| `java OR python` | Either term |
| `"senior developer"` | Exact phrase |
| `react*` | Prefix match |
| `java NOT junior` | Exclude term |

## Dependencies Added

- `pymupdf>=1.24,<2` in `backend/requirements.txt`

## Config Changes

- `config/settings.py`: Added `candidates` database, `DATABASE_ROUTERS`, `apps.candidates` to INSTALLED_APPS, `Candidates` tag to SPECTACULAR_SETTINGS
- `config/urls.py`: Added `apps.candidates.urls` include
- `contractors/models.py`: Added `candidate_id` field
- `components/layout/sidebar.tsx`: Added Candidates to ADMIN and BROKER hamburger menus

## CV Import / PDF Parsing

### Import from PDF (parse-cv endpoint)

`POST /api/v1/candidates/parse-cv` — multipart, accepts a PDF file.

Extracts candidate info using regex-based parser in `pdf.py`:
- **Name:** First name-like line (2-4 unicode words) in top 8 lines
- **Email:** First email pattern found
- **Phone:** International format (`+XXX...`)
- **LinkedIn URL:** `linkedin.com/in/...` pattern
- **Skills:** Matches against ~70 tech keywords found in text
- **Country:** Maps city/country names to ISO codes

### LinkedIn PDF Support

Detects LinkedIn-exported PDFs (start with "Contact" header) and uses specialized parser:
- **Name:** Line immediately before first `|` headline separator
- **Skills:** "Top Skills" section items (capped at 3, LinkedIn's format)
- **LinkedIn URL:** Reconstructed from split lines, cleaned of whitespace
- **Country:** From location line after headline
- **Email/Phone:** From Contact section

### Frontend Flow

1. Create Candidate slide-over has "Import from PDF" button
2. User selects PDF → POST to `/parse-cv` → fields prefilled
3. User reviews/edits → Save creates candidate + attaches PDF as CV

## Populate Data (12 candidates)

Integrated into `python manage.py populate --clean` via `_populate_candidates()`:

| Group | Candidates | Notes |
|---|---|---|
| Java Mid-Level | Tomas Kazlauskas (LT), Marta Nowak (PL), Erik Johansson (SE) | 4-5 years exp |
| Spring Boot + UI | Ieva Barkauskaite (LT/React), Lukas Petrauskas (LT/Angular), Agata Wisniewska (PL/Vue) | Full-stack |
| C/C++ Testers | Andrius Vasiliauskas (LT), Katarzyna Dabrowska (PL), Arvydas Rimkus (LT) | Embedded/telecom/automotive |
| Linked (with contractor profiles) | Darius Grigas (LT/Python), Olga Petrova (LT/.NET), Mindaugas Salna (LT/React) | Status: PLACED, pwd: `a` |

Each candidate gets a generated PDF CV with realistic work history, uploaded and FTS-indexed. Some have LinkedIn URLs.

## Audit Logging

All candidate actions logged to the generic `audit_logs` table (entity_type="candidate"):

| Action | Trigger |
|---|---|
| CREATED | New candidate created |
| UPDATED | Profile fields changed (with before/after diff) |
| ARCHIVED | Soft delete |
| FILE_UPLOADED | CV or attachment uploaded |
| FILE_DELETED | File removed |
| ACTIVITY_ADDED | Note/proposal/interview added to timeline |
| CONTRACTOR_LINKED | Linked to contractor profile |
| CONTRACTOR_UNLINKED | Unlinked from contractor |

## Email Uniqueness

`CandidateCreateSerializer` and `CandidateUpdateSerializer` validate email uniqueness (case-insensitive). Empty emails are allowed (multiple candidates without email).

## FTS Prefix Search

Search terms auto-get `*` suffix for prefix matching: `recrui` → `recrui*` matches "recruitment", "recruiting", etc.

## Bidirectional Contractor Link

- Candidate detail → "Linked to contractor" → View button navigates to contractor page
- Contractor detail → "View candidate profile" link when linked
- Contractor endpoint accepts both profile UUID and user UUID for lookup

## Not Yet Built

- `rebuild_candidates_fts` management command (maintenance reindex)
- OCR for scanned PDFs
- Duplicate detection
- Candidate portal (self-service)
