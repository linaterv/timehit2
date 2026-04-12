# Test Coverage Backlog

Tests that **could** be added but aren't yet. Companion doc to [`tests.md`](tests.md).

**Current coverage: 328 tests** (213 backend + 115 E2E). All original P1-P4 items from the first backlog have been implemented — see commit `0658345`.

---

## Completed ✅

**P1-P4 backlog from 2026-04-12 session** — 50 tests added across 10 new files:
- `test_invoice_extras.py` (12), `test_timesheet_state.py` (3), `test_placement_copy.py` (2), `test_lock_blocking.py` (5), `test_misc_backend.py` (11), `test_p4_misc.py` (4)
- `invoice-correction.spec.ts` (2), `timesheet-rejection.spec.ts` (3), `ui-misc.spec.ts` (6), `ui-extras.spec.ts` (4)

---

## Still pending (next backlog)

### Priority A — Data integrity (would catch real bugs)

- [ ] **Billing snapshot immutability** — After invoice ISSUED, edit the ContractorProfile (bank_iban, vat_number) → generate invoice PDF again → verify PDF uses snapshot values, not current profile values.
- [ ] **Timesheet total_hours recalculation** — Add entries totaling 160h → submit → change one entry to 8h → verify total_hours updates correctly (not stale).
- [ ] **Placement date-range enforcement on timesheet entries** — Create entry outside placement.start_date..end_date → should be rejected with specific error.
- [ ] **FTS reindex on candidate CV deletion** — Upload CV with "kubernetes" in text → search finds it → delete CV → search no longer returns that candidate.
- [ ] **Invoice series counter atomic increment under load** — Fire 20 concurrent invoice generations → verify no duplicate invoice_numbers (stress test atomicity).
- [ ] **Contractor profile update doesn't affect issued invoices** — Issue invoice → change contractor bank_iban → retrieve issued invoice → verify billing_snapshot still has old iban.
- [ ] **InvoiceCorrectionLink record** — After correction, verify `original_invoice_id` and `corrective_invoice_id` link exists via some endpoint (if exposed).

### Priority B — Security & permissions edge cases

- [ ] **JWT expiry handling** — Use expired token → 401 → refresh flow → verify new access token works.
- [ ] **Broker tries to access other broker's clients** — broker2 tries to GET/PATCH client assigned only to broker1 → 403 or empty.
- [ ] **Contractor tries to see another contractor's invoices** — GET /invoices/{id} of another contractor → 404 or 403.
- [ ] **Client contact tries to approve another client's timesheet** — 403.
- [ ] **Rate confidentiality via /control/export** — Contractor's CSV export should never contain rates (if endpoint accessible to them at all).
- [ ] **User create blocks duplicate case-insensitive email** — Create "ADMIN@test.com" when "admin@test.com" exists → 400.

### Priority C — Frontend polish

- [ ] **Dashboard filter combinations** — Apply month+broker+client filter simultaneously → verify all three apply to summary counters and table rows.
- [ ] **Contractor profile edit** — Change VAT settings → verify UI updates without reload.
- [ ] **Calendar grid weekend visual distinction** — Weekend cells should render with different styling.
- [ ] **Invoice generation from dashboard bulk** — Select multiple rows → "Generate All" button → verify invoices for all selected appear.
- [ ] **Login redirect preserves target** — Navigate to `/invoices/123` unauthenticated → redirected to login → after login → return to `/invoices/123`.
- [ ] **Audit log click-through** — Click an audit entry → navigate to the entity detail page.
- [ ] **Candidate parse-cv with real LinkedIn PDF** — Upload an actual LinkedIn-exported CV → verify name/skills/country extracted correctly.

### Priority D — Observability & resilience

- [ ] **API returns 500 gracefully** — Simulate DB error (e.g. lock a table briefly) → verify frontend shows friendly error, not raw 500.
- [ ] **File upload size limit** — Upload 100MB file → verify rejected with clear error.
- [ ] **Malicious input in free-text fields** — Script tag, SQL chars, long strings → verify stored safely, not rendered as HTML.
- [ ] **Concurrent timesheet submit** — Two tabs submit same timesheet → second attempt handled gracefully.
- [ ] **Network disconnect during save** — Mock offline → save → verify error surfaced to user, no data loss.

---

## Notes

**Why these aren't tested yet:**
- Priority A: concurrency/atomicity tests are genuinely hard without a load-generator framework.
- Priority B: would need additional seed data (second client contact, isolated broker).
- Priority C: most are UI-heavy and depend on specific component behavior.
- Priority D: typically requires mocking at the network layer (Playwright `route.fulfill`).

**Estimated effort:**
- Priority A: 7 tests (~5 backend, 2 E2E) — ~2 hours
- Priority B: 6 backend tests — ~1 hour
- Priority C: 7 E2E tests — ~2 hours
- Priority D: 5 mixed tests — ~2 hours (complex)
- **Total potential: ~25 more → 353 grand total**
