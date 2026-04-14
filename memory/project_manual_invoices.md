---
name: Manual invoices feature
description: In-flight feature — standalone client invoices (e.g. permanent-placement finder fee) that bypass the timesheet flow. Specs are drafted; implementation dispatched to a team.
type: project
---

Manual invoices = standalone CLIENT_INVOICE with `is_manual=true`, not tied to a timesheet or placement. Use case named by the user: permanent-placement finder fee (one-off lump-sum sale, invoice is the source of truth).

**Why:** The existing invoice flow only produces pairs from approved timesheets. TimeHit needs to record one-off client bills (e.g. permanent hires, referral fees) with the invoice itself as the primary record — no synthetic placement/timesheet fakery.

**How to apply:** Before touching invoice code, read `functional-spec.md` §2.11, §2.11a, §4.3a, §5, §6, §7.4, §8 and `timehit-api.md` §13 (new `POST /invoices/manual`, `PATCH /invoices/:id`, extended list/detail). UI spec is in `frontend-reqs.md` §9.

**Locked design decisions (from 2026-04-14 conversation):**
- Single client-only invoice (no contractor counterpart)
- Optional link to Client (if linked, Broker restricted to assigned clients; if null, Admin or Broker both allowed)
- Optional `candidate_id` UUID (cross-DB; no FK since candidates live in a separate SQLite)
- Multiple line items (description, quantity, unit_price) — new `InvoiceLineItem` table
- User types `invoice_number` + `issue_date` themselves; no counter is consumed; no auto-PDF on ISSUE
- PDF is on-demand only (DRAFT watermarked)
- Bank / VAT / currency / terms prefill from `AgencySettings.default_client_invoice_template` but are fully editable on the form
- Manual invoices flow through `ISSUED → PAID | VOIDED` like auto — they MUST show up in Control screen "Invoices awaiting payment" and overdue counts (user explicitly flagged this — "invoice is like a document but don't forget to follow it in control mission")

**Dispatched team:** `team-lead` + `backend-engineer` + `ui-engineer` under team slug `manual-invoices`. Backend defines the endpoint first; UI wires against the spec in parallel.
