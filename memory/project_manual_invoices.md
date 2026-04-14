---
name: Manual invoices (shipped 2026-04-14)
description: Standalone client invoices (permanent-placement fee etc.) that bypass the timesheet flow. Shipped feature — reference only now, not in-flight.
type: project
---

Manual invoices = standalone CLIENT_INVOICE with `is_manual=true`, not tied to a timesheet or placement. Motivating use case: permanent-placement finder fee — one-off lump-sum sale, invoice IS the source of truth.

**Status:** Shipped 2026-04-14 by team `manual-invoices` (team-lead + be + ui), 28 pytest + 13 Playwright green, all invariants holding. `team-lead`, `be`, `ui` shut down.

**Why the feature exists:** Existing invoice flow only produces pairs from approved timesheets. One-off client bills (permanent hires, referral fees) needed a standalone record with no synthetic placement/timesheet fakery.

**How to apply when touching this code:** read `functional-spec.md` §2.11, §2.11a, §4.3a, §5, §6, §7.4, §8 and `timehit-api.md` §13 (`POST /invoices/manual`, `PATCH /invoices/:id`, extended list/detail, `/issue` + `/pdf` semantics). UI spec in `frontend-reqs.md` §9.

**Locked design decisions (the invariants future work must not violate):**
- Single client-only invoice (no contractor counterpart)
- Optional Client link (if linked, Broker must have `BrokerClientAssignment`; if null, either Admin or Broker)
- Optional `candidate_id` UUID — cross-DB, no FK (candidates live in a separate SQLite)
- ≥1 `InvoiceLineItem` (description, quantity, unit_price) with server-computed `line_total = qty × price`, `subtotal = Σ line_total`, `vat_amount = subtotal × vat_rate / 100`, `total = subtotal + vat_amount`
- **Nothing auto-generated on create:** user types `invoice_number` and `issue_date`; no counter is consumed
- **No auto-PDF on issue:** PDF rendered on-demand; DRAFT is watermarked "DRAFT" and not persisted; ISSUED/PAID render clean
- Bank / VAT / currency / terms prefill from `AgencySettings.default_client_invoice_template` but are fully editable on the form and snapshotted on save
- Manual invoices flow through `ISSUED → PAID | VOIDED` like auto — they MUST appear in Control screen "Invoices awaiting payment" and overdue counts (user explicitly: "invoice is like a document but don't forget to follow it in control mission")
- `PATCH /invoices/:id` only accepts DRAFT + `is_manual=true` (409 otherwise); `line_items` replaces the whole set

**Key files (reference):**
- Backend: `backend/apps/invoices/{models.py, serializers.py, views.py, pdf.py, urls.py}`, migration `0008_*`, `backend/apps/control/views.py`, `backend/apps/users/management/commands/populate.py` (seeds 3 manual invoices: overdue ISSUED / DRAFT no-client / PAID full lifecycle)
- Frontend: `frontend/types/api.ts`, `frontend/components/forms/manual-invoice-form.tsx`, `frontend/app/(authenticated)/invoices/{page.tsx, [id]/page.tsx}`
- Tests: `tests/test_invoices_manual.py` (28), `frontend-tests/manual-invoices.spec.ts` (13)
