# Test Coverage Backlog

Tests that **could** be added but aren't yet. Prioritized for impact. Companion doc to [`tests.md`](tests.md) (which catalogs what already exists).

Current coverage: **278 tests** (176 backend + 102 E2E). This backlog adds ~25-30 more.

---

## Priority 1 — Highest impact (billing/financial accuracy)

### Backend

- [ ] **Invoice corrective flow end-to-end** — POST /invoices/{id}/correct with body `{hourly_rate, total_hours, reason}` → verify (a) original status=CORRECTED, (b) new corrective invoice exists in DRAFT, (c) InvoiceCorrectionLink record created, (d) corrective inherits billing_snapshot from original.
- [ ] **Invoice generation duplicate prevention deeper** — Generate pair, void only the contractor invoice, try to regenerate → should still be blocked because client invoice is non-VOIDED. Then void the client too → regeneration should work.
- [ ] **Cross-currency bulk generation** — Bulk generate invoices for placements in EUR + USD + GBP → verify each invoice has correct currency, ControlSummaryView aggregates currency_breakdown correctly.
- [ ] **Series engine API: all variables** — POST /invoices/preview-series with templates exercising every variable: `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{Q}`, `{CLIENT}`, `{CONTRACTOR}`, `{COUNT}`, `{COUNT_YEAR:4}`, `{COUNT_MONTH:3}`, `{COUNT_QUARTER:3}`. 23 internal engine tests exist, but the API path is untested.
- [ ] **Series engine validation errors** — Templates with no counter, unknown variable, invalid chars, padding > 10 → all return 400 with descriptive error.
- [ ] **Sample PDF with parent template** — Template with parent_id → POST sample-pdf → verify parent's billing_address used when child is empty (parent inheritance walk).

### E2E

- [ ] **Invoice correction flow in UI** — Open ISSUED invoice → click Correct → fill form → confirm → verify original shows CORRECTED badge and new DRAFT invoice appears in list.
- [ ] **Series template live preview** — Edit invoice template → type `INV-{YYYY}{MM}-{COUNT_MONTH:3}` → verify live preview shows e.g. `INV-202604-001` without saving.

---

## Priority 2 — High impact (state machine integrity)

### Backend

- [ ] **Timesheet full reject→resubmit cycle** — SUBMITTED → reject(reason) → DRAFT (rejection_reason persisted) → edit entries → resubmit → goes back through full approval flow → verify rejection_reason cleared after second submit.
- [ ] **Timesheet CLIENT_THEN_BROKER reject at client step** — Client rejects from SUBMITTED → DRAFT → contractor resubmits → goes back through CLIENT_APPROVED → APPROVED.
- [ ] **Timesheet CLIENT_THEN_BROKER reject at broker step** — After CLIENT_APPROVED, broker rejects → returns to DRAFT → client must approve again on resubmit.
- [ ] **Withdraw from CLIENT_APPROVED** — Contractor withdraws after client approval but before broker approval → DRAFT.
- [ ] **Placement copy with no end_date** — Copy open-ended placement → new placement defaults start_date to today+1 (or another rule).
- [ ] **Placement copy with same-day end/start** — End date 2026-03-15 → copy → new start = 2026-03-16.
- [ ] **Locked entity blocks all mutations** — Lock placement → try update/delete/activate/complete → all return 423.
- [ ] **Locked invoice blocks status changes** — Lock issued invoice → try mark-paid → 423.
- [ ] **Lock cascades through chain** — Lock client → all placements/timesheets/invoices for that client also blocked.

### E2E

- [ ] **Timesheet rejection dialog** — Broker views SUBMITTED timesheet → click Reject → modal opens → enter reason → confirm → verify status returns to DRAFT and reason visible to contractor.
- [ ] **Timesheet resubmission** — Contractor sees rejected timesheet with reason → edits entries → resubmits → status goes through approval flow again.
- [ ] **Placement copy form** — DRAFT placement → Copy button → form pre-fills client/contractor with editable rates and adjusted dates → verify new DRAFT placement created.
- [ ] **Invoice PDF download from list** — Invoices list → click download icon on ISSUED invoice → verify PDF downloads.

---

## Priority 3 — Medium impact (data integrity, UX)

### Backend

- [ ] **TimesheetPendingView** — GET /timesheets/pending returns only MISSING/DRAFT for ACTIVE placements. Test contractor with no placements (empty list) and non-contractor (403).
- [ ] **Timesheet attachment download** — GET /timesheets/{id}/attachments/{pk}/download returns file with correct mime type.
- [ ] **Invoice PDF download missing file** — GET /invoices/{id}/download when pdf_file_path is null → 404.
- [ ] **Invoice template parent filter** — GET /invoice-templates?parent_id=... returns only children of that parent.
- [ ] **Pagination boundary** — GET /invoices?per_page=10000 → enforced max. GET /invoices?page=99999 → graceful empty result.
- [ ] **Timesheet entries on weekends/holidays** — Bulk upsert entries on Saturday/Sunday or holiday dates → verify no warnings raised at API level (UI-level warning is OK but backend must accept).
- [ ] **Bug-report endpoint** — POST /bug-report (public, no auth) with title+description+screenshot → verify file written to bug-reports/ dir.
- [ ] **Generate password edge cases** — Call /users/generate-password 100 times → verify all unique, all 8+ chars, all letters+digits.
- [ ] **Audit logging triggers** — After timesheet submit, verify audit_log entry exists with action=SUBMITTED, data_before/after captured. Repeat for placement activate, invoice issue, etc.

### E2E

- [ ] **Form validation errors** — Try to create placement without rates → verify field-level error messages appear inline.
- [ ] **Slide-over forms (create candidate, etc.)** — Open slide-over → cancel button closes without saving → reopen → verify form is reset.
- [ ] **Confirmation dialog cancel** — Click delete on draft invoice → confirm dialog opens → click Cancel → verify invoice still exists.
- [ ] **Toast notifications** — Successful save → verify toast appears with success message → fades after timeout.
- [ ] **Pagination in lists** — Invoices list with > 25 entries → click page 2 → URL updates → click back → page 1 data restored.
- [ ] **Multi-day entry warnings** — Enter 12+ hours on a single day in calendar grid → verify warning indicator.

---

## Priority 4 — Lower impact (cosmetic, edge-edge cases)

### Backend

- [ ] **CSV export columns** — GET /control/export → verify exact column order, headers, contractor names, hours, rates.
- [ ] **Holidays for all 8 countries** — Loop through DE/FI/GB/LT/LV/NL/PL/SE for 2026 → verify each returns at least 8 holidays.
- [ ] **Past issues filters** — GET /control/past-issues → verify it surfaces unresolved items only (not items already invoiced).
- [ ] **Duplicate invoice number prevention** — Two invoices generated concurrently for different placements → verify atomic increment prevents same invoice_number.

### E2E

- [ ] **Theme persistence across sessions** — Switch to Matrix theme → logout → login → verify Matrix theme still active (localStorage).
- [ ] **Mobile/responsive sidebar** — Resize viewport to 600px → sidebar collapses → hamburger button works.
- [ ] **Keyboard shortcuts** — Test any defined shortcuts (e.g. cmd+k for search).
- [ ] **Browser back button** — Navigate clients → detail → back → verify list state preserved.

---

## Notes

**Why these aren't already tested:**
- Many state machine edge paths (especially withdraw-after-client-approve, multi-cycle reject/resubmit) require careful state setup and weren't covered in the original 80-test suite.
- The invoice corrective flow is critical but complex (creates linked records across two models) — needs dedicated test.
- Frontend modal/slide-over/toast tests are tedious to write — coverage focused on happy paths.

**How to pick what to do next:**
1. Anything in **Priority 1** if you've changed invoice generation or template engine.
2. **Priority 2** if you've touched state machines (timesheet/placement/invoice transitions).
3. **Priority 3** for incremental coverage improvements during quiet periods.

**Estimated additions:**
- Priority 1: 8 tests (~6 backend, 2 E2E)
- Priority 2: 13 tests (~9 backend, 4 E2E)
- Priority 3: 15 tests (~9 backend, 6 E2E)
- Priority 4: 8 tests (~4 each)
- **Total potential: ~44 new tests → 322 grand total**
