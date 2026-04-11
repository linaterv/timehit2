# Candidates Module — Requirements

## Overview

CRM-style candidate database with PDF CV storage and full-text search. Separate SQLite database (`candidates.sqlite3`), fully isolated from main TimeHit DB. Only link: optional UUID string references between `ContractorProfile.candidate_id` and `Candidate.contractor_id`.

Purpose: clients call and say "we need a Java dev with OpenShift and SpringBoot" — broker searches, finds matching candidates in seconds, proposes them.

## Tech Stack

- **Database:** Separate SQLite file (`candidates.sqlite3`) via Django multi-DB routing
- **Full-text search:** SQLite FTS5 with porter stemmer + unicode61 tokenizer
- **PDF extraction:** PyMuPDF (`pymupdf`)
- **File storage:** `media/candidates/{candidate_id}/`
- **Frontend:** Next.js pages under `/candidates`, search-first UX

## Data Model

### Candidate

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| full_name | string | Required |
| email | string | Optional |
| phone | string | Optional |
| country | string | Default "LT" |
| status | enum | AVAILABLE, PROPOSED, INTERVIEW, OFFERED, PLACED, UNAVAILABLE, ARCHIVED |
| skills | text | Comma-separated: "java, springboot, openshift, docker" |
| desired_rate | decimal | Optional — candidate's expected rate |
| desired_currency | string | Default "EUR" |
| source | string | Optional — where they came from: LinkedIn, referral, direct, job board, etc. |
| linkedin_url | URL | Optional — LinkedIn profile URL |
| notes | text | Free-form notes (also indexed in FTS) |
| contractor_id | UUID string | Optional — link to main DB ContractorProfile.user_id |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

### CandidateFile

Unified file storage for both CVs and activity attachments.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| candidate | FK → Candidate | Required |
| activity | FK → CandidateActivity | Nullable — null for standalone CVs |
| file | FileField | Stored in `media/candidates/{candidate_id}/` |
| original_filename | string | Original upload name |
| file_type | enum | CV, ATTACHMENT |
| extracted_text | text | Auto-extracted from PDFs, empty for non-PDFs |
| file_size | integer | Bytes |
| uploaded_at | datetime | Auto |

### CandidateActivity

CRM timeline — every interaction, status change, and note in one unified feed.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| candidate | FK → Candidate | Required |
| type | enum | See activity types below |
| text | text | Free-form description |
| old_value | string | For status changes — previous value |
| new_value | string | For status changes — new value |
| client_name | string | Optional — which client this activity relates to |
| created_by | string | User full name (string, not FK — cross-DB isolation) |
| created_at | datetime | Auto |

**Activity types:**

| Type | Auto/Manual | Description |
|---|---|---|
| NOTE | Manual | Broker adds a free-form note |
| STATUS_CHANGE | Auto | Candidate status changed |
| CV_UPLOADED | Auto | CV file uploaded |
| CV_REMOVED | Auto | CV file deleted |
| FILE_ATTACHED | Auto | Attachment added to activity |
| LINKED | Auto | Linked to contractor in main DB |
| UNLINKED | Auto | Unlinked from contractor |
| PROPOSED | Manual | Proposed to a client |
| REJECTED | Manual | Client or candidate rejected |
| INTERVIEW | Manual | Interview scheduled/completed |
| OFFER | Manual | Offer made |
| PLACED | Auto | Candidate placed (linked as contractor) |

### candidates_fts (FTS5 Virtual Table)

SQLite FTS5 virtual table — not a Django model, managed via raw SQL.

```sql
CREATE VIRTUAL TABLE candidates_fts USING fts5(
    candidate_id UNINDEXED,
    content,
    tokenize='porter unicode61'
);
```

| Column | Notes |
|---|---|
| candidate_id | UUID string, UNINDEXED (for joining, not searching) |
| content | Concatenation of all searchable text for this candidate |

**FTS content per candidate (rebuilt on any change):**

```
{full_name}
{email}
{phone}
{country}
{skills}
{notes}
{all activity texts}
{all file extracted_texts — CVs and attachments}
```

Everything is indexed. Search `kubernetes` finds it whether it's in a CV, a broker note, an activity attachment, or the skills field.

**Rebuild triggers:** FTS entry is rebuilt (DELETE + INSERT) whenever:
- Candidate profile updated (name, skills, notes, etc.)
- File uploaded or deleted
- Activity created

## Django Multi-DB Setup

### Database config

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    },
    'candidates': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'candidates.sqlite3',
    },
}
```

### Database router

```python
class CandidatesRouter:
    app_label = 'candidates'

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.app_label:
            return 'candidates'
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.app_label:
            return 'candidates'
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if obj1._meta.app_label == self.app_label and obj2._meta.app_label == self.app_label:
            return True
        return None

    def allow_migrate(self, db, app_label, **hints):
        if app_label == self.app_label:
            return db == 'candidates'
        return db == 'default'
```

### Cross-DB contractor link

Main DB side: add `candidate_id = CharField(max_length=36, blank=True, default="")` to `ContractorProfile`.

Candidates DB side: `contractor_id = CharField(max_length=36, blank=True, default="")` on `Candidate`.

Both are plain UUID strings — no real FK, no joins. Lookup by ID when rendering detail pages.

## PDF Text Extraction

Using PyMuPDF (`pip install pymupdf`):

```python
import fitz

def extract_text(file_path):
    doc = fitz.open(file_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text
```

- Extract on upload, store in `CandidateFile.extracted_text`
- If PDF yields empty text (scanned image), set `extracted_text = "[NO_TEXT_EXTRACTED]"` — can add OCR later
- Non-PDF files: leave `extracted_text` empty

## FTS Search

### Query syntax (exposed to user)

| Input | Behavior |
|---|---|
| `java springboot` | Matches candidates with both terms (implicit AND) |
| `java OR python` | Either term |
| `"senior developer"` | Exact phrase |
| `react*` | Prefix: reactjs, reactive, react-native |
| `recrui` | Auto-prefix: treated as `recrui*` — partial words work |
| `java NOT junior` | Exclude term |
| `java springboot openshift` | All three terms, ranked by relevance |

### Search API

`GET /candidates/search?q=java+springboot+openshift`

Returns ranked results with highlighted snippets:

```json
{
  "data": [
    {
      "id": "...",
      "full_name": "Alex Turner",
      "status": "AVAILABLE",
      "skills": "java, springboot, kubernetes",
      "desired_rate": "65.00",
      "desired_currency": "EUR",
      "country": "LT",
      "snippet": "...5 years of <b>Java</b> development with <b>SpringBoot</b> microservices on <b>OpenShift</b> clusters...",
      "rank": -12.5
    }
  ],
  "meta": { "total": 3, "query": "java springboot openshift" }
}
```

Snippets generated by FTS5 `snippet()` function with `<b>` highlight tags.

## API Endpoints

### Candidates CRUD

```
GET    /api/v1/candidates                              — list with filters
GET    /api/v1/candidates/search?q=java+springboot      — FTS search
POST   /api/v1/candidates                              — create candidate
GET    /api/v1/candidates/{id}                          — detail (includes file counts, latest activity)
PATCH  /api/v1/candidates/{id}                          — update (auto status change activity)
DELETE /api/v1/candidates/{id}                          — set status=ARCHIVED
```

**List filters:**
- `?status=AVAILABLE`
- `?country=LT`
- `?source=LinkedIn`
- `?search=keyword` (simple LIKE search, for when FTS is overkill)
- `?has_cv=true` (only candidates with at least one CV)
- `?contractor_linked=true|false`

### CV Import

```
POST   /api/v1/candidates/parse-cv                        — upload PDF, returns parsed fields (name, email, phone, skills, country, linkedin_url)
```

Supports regular CVs and LinkedIn-exported PDFs. Regex-based parsing with ~70 tech keyword recognition.

### Files

```
POST   /api/v1/candidates/{id}/files                    — upload file(s), multipart
                                                          body: file(s) + type (CV|ATTACHMENT) + optional activity_id
GET    /api/v1/candidates/{id}/files?type=CV             — list files, filterable by type
GET    /api/v1/candidates/{id}/files/{fid}/download      — download file
DELETE /api/v1/candidates/{id}/files/{fid}               — delete file, reindex FTS
```

### Activities (CRM timeline)

```
POST   /api/v1/candidates/{id}/activities               — create activity
                                                          multipart: type, text, client_name + 0..N file uploads
GET    /api/v1/candidates/{id}/activities                — list timeline (newest first, includes nested files)
```

### Contractor link

```
POST   /api/v1/candidates/{id}/link-contractor           — body: { contractor_id: "uuid" }
DELETE /api/v1/candidates/{id}/link-contractor            — unlink
```

Sets `candidate.contractor_id` and `contractor_profile.candidate_id` on both DBs.

## Frontend Pages

### /candidates — Search & List (search-first UX)

```
┌─────────────────────────────────────────────────┐
│  [🔍 Search candidates...                    ]  │  ← big prominent search bar
│                                                 │
│  Status: [All ▼]  Country: [All ▼]  Source: [▼] │  ← filters row
│  [ ] Has CV   [ ] Available only                │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Alex Turner          AVAILABLE    LT    │    │  ← result cards
│  │ java, springboot, kubernetes            │    │
│  │ "...5 years of **Java** with **Spring   │    │  ← FTS snippet (search mode)
│  │ Boot** microservices..."                │    │
│  │ 65 EUR/h  ·  2 CVs  ·  LinkedIn        │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ Mia Chen             PROPOSED     DE    │    │
│  │ react, typescript, nextjs               │    │
│  │ "...lead **React** frontend for..."     │    │
│  │ 70 EUR/h  ·  1 CV  ·  Referral          │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

- When search is empty: show regular list (most recent first)
- When search has text: show FTS ranked results with snippets
- Create Candidate button top-right

### /candidates/{id} — Detail Page

```
┌─────────────────────────────────────────────────┐
│  Alex Turner                        [Edit]      │
│  java, springboot, kubernetes                   │
│  alex@email.com · +370... · LT                  │
│  65 EUR/h · AVAILABLE · LinkedIn                │
│  Contractor: Alex Turner (linked) [Unlink]      │
│                                                 │
│  [ Profile ]  [ CVs (2) ]  [ Timeline (8) ]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Timeline tab:                                  │
│                                                 │
│  [Add Note]  [Log Activity ▼]                   │
│                                                 │
│  ● Apr 10 — PROPOSED (Jonas)                    │
│    "Proposed to TechVibe for Backend Dev,       │
│     65 EUR/h"                                   │
│    📎 techvibe-job-spec.pdf                     │
│                                                 │
│  ● Apr 8 — NOTE (Jonas)                         │
│    "Strong Java background, prefers remote.     │
│     Available from May."                        │
│                                                 │
│  ● Apr 5 — CV_UPLOADED (auto)                   │
│    "Uploaded alex-turner-cv-2026.pdf"            │
│                                                 │
│  ● Apr 5 — STATUS_CHANGE (auto)                 │
│    ARCHIVED → AVAILABLE                          │
│                                                 │
│  ● Mar 1 — REJECTED (Laura)                     │
│    "CloudBase passed — want someone with         │
│     more AWS experience"                        │
│    📎 cloudbase-feedback.pdf                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Sidebar nav

Add "Candidates" to the hamburger (More) menu with a search icon (e.g., `UserSearch` from Lucide).

## Access Control

- **ADMIN:** Full CRUD, all candidates
- **BROKER:** Full CRUD, all candidates (brokers are the primary users of this module)
- **CONTRACTOR:** No access
- **CLIENT_CONTACT:** No access

## File Layout

```
backend/apps/candidates/
├── __init__.py
├── models.py           # Candidate, CandidateFile, CandidateActivity
├── serializers.py
├── views.py            # CRUD + search + file upload + activities
├── urls.py
├── fts.py              # FTS5 helpers: create_table, rebuild_index, search
├── pdf.py              # PyMuPDF text extraction
├── router.py           # CandidatesRouter for multi-DB
├── admin.py
└── migrations/
    └── 0001_initial.py # Creates Django tables + FTS5 virtual table via RunSQL

media/candidates/       # PDF files stored here
    {candidate_id}/
        cv-alex-2026.pdf
        attachment-techvibe-spec.pdf
```

## Management Commands

```bash
python manage.py migrate --database=candidates    # create candidates DB tables
python manage.py rebuild_candidates_fts            # rebuild all FTS entries (maintenance)
python manage.py populate_candidates               # seed with demo data (optional)
```

## FTS Implementation Notes

### FTS5 table creation (in migration via RunSQL)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS candidates_fts USING fts5(
    candidate_id UNINDEXED,
    content,
    tokenize='porter unicode61'
);
```

### Index rebuild function

```python
def rebuild_fts(candidate):
    texts = [
        candidate.full_name or "",
        candidate.email or "",
        candidate.phone or "",
        candidate.country or "",
        candidate.skills or "",
        candidate.notes or "",
    ]
    for activity in candidate.activities.all():
        if activity.text:
            texts.append(activity.text)
    for f in candidate.files.all():
        if f.extracted_text:
            texts.append(f.extracted_text)

    content = "\n".join(texts)

    with connection.cursor() as c:
        c.execute("DELETE FROM candidates_fts WHERE candidate_id = %s", [str(candidate.id)])
        c.execute("INSERT INTO candidates_fts (candidate_id, content) VALUES (%s, %s)",
                  [str(candidate.id), content])
```

### Search function

```python
def search_candidates(query, limit=25):
    with connection.cursor() as c:
        c.execute("""
            SELECT candidate_id,
                   snippet(candidates_fts, 1, '<b>', '</b>', '...', 30) AS snippet,
                   rank
            FROM candidates_fts
            WHERE candidates_fts MATCH %s
            ORDER BY rank
            LIMIT %s
        """, [query, limit])
        return c.fetchall()
```

## Future Enhancements (not in scope now)

- OCR for scanned PDFs (Tesseract)
- Meilisearch for typo-tolerant search
- AI-powered skill extraction from CVs
- Candidate portal (self-service profile updates)
- Email integration (send proposals directly from timeline)
- Duplicate detection (same email/phone)
