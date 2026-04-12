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

---

## Deep edge-case backlog (from 2026-04-12 analysis)

### Priority E — Numerical precision & VAT rounding

- [ ] **VAT rounding on fractional cents** — Invoice with subtotal 100.03 EUR, VAT 21% → verify vat_amount uses banker's rounding (21.01 not 21.006).
- [ ] **Sum-of-parts vs total drift** — Generate three invoices for partial hours same placement, then regenerate as one — totals must be identical (no cumulative rounding error).
- [ ] **Zero-rate placement** — Placement with contractor_rate=0.00 → generate invoice → vat_amount=0.00 (not None, no division error).
- [ ] **Fractional hours (0.33)** — Hours=0.33 × rate=100.00 → subtotal must be 33.00 stored with full decimal precision.
- [ ] **Negative rate rejection** — POST /placements with rate=-10.00 → 400. Test both rate fields.

### Priority F — Time & date edge cases

- [ ] **Feb 28 vs 29 leap year** — Add entry on day 29 of 2026-02 (non-leap, 28 days) → rejected. On 2024-02 → accepted.
- [ ] **Year wrap** — Placement spans 2025-12 to 2026-01 → timesheets for both exist with unique (placement, year, month) constraint.
- [ ] **Placement with future end_date** — start=2026-04-01, end=2026-12-31 → timesheet for 2027-01 should reject (past placement range).
- [ ] **Retrospective timesheet for archived month** — Create timesheet for 2025-06 (placement was active then, now completed) → should allow edits of past approved months per retrospective rule.
- [ ] **Invoice issue_date before placement start** — issue_date=2026-03-01 on placement starting 2026-04-01 → should reject or warn.
- [ ] **Timesheet for not-yet-active placement** — Placement activated 2026-06-15, try create timesheet for 2026-05 → should reject.

### Priority G — Cascading deletes & referential integrity

- [ ] **Contractor deleted mid-placement** — Delete contractor who has active placement + issued invoice → soft-delete (deactivate) preserving invoice readability.
- [ ] **Client contact removed as approver** — CLIENT_THEN_BROKER flow, remove contact → timesheets fall back to BROKER_ONLY behavior or raise clear error.
- [ ] **Broker loses client assignment** — Broker1 created 5 placements then admin revokes assignment → GET /placements returns 0 (broker scoped), but invoices they generated remain visible to admin.
- [ ] **Parent template archived, child still uses it** — Generate invoice using child template whose parent is ARCHIVED → should resolve billing via parent chain walk.
- [ ] **Candidate contractor_id points to deleted user** — Delete contractor who's linked to candidate → candidate.contractor_id becomes empty, no orphaned reference.
- [ ] **FTS index stale after candidate archive** — Archive candidate → search should either exclude OR indicate archived status in results.

### Priority H — Unicode & internationalization

- [ ] **Lithuanian diacritics** — Contractor full_name="Vilnius Čekaitė" → retrieved correctly, renders in PDF.
- [ ] **RTL company names** — Arabic/Hebrew company name → stored correctly.
- [ ] **Emoji in task_name** — "Build 🚀 Backend" → stored, retrieved, appears in PDF.
- [ ] **Very long name (256 chars)** — Rejected at serializer (max_length=255).
- [ ] **Unicode in FTS search** — Candidate with skills="Django/Python/中文" → search for "中文" finds them.

### Priority I — Boundary values

- [ ] **Zero hours timesheet invoicing** — Approve empty timesheet (confirm_zero) → generate invoice → subtotal=0.00, no division-by-zero in PDF.
- [ ] **24+ hours in single day** — Entry hours=25.00 → should reject at serializer (24.0 max per day per rules doc).
- [ ] **Pre-epoch date** — Timesheet year=2000 month=01 → accepted (Django DateField has no epoch limit).
- [ ] **Max decimal hours** — Hours=9999.99 → stored correctly, no overflow.

### Priority J — Concurrency

- [ ] **Concurrent invoice generation same timesheet** — Two parallel POST /invoices/generate with same timesheet_id → only one pair created, other returns error.
- [ ] **Race on contractor series counter** — 20 concurrent invoices for same contractor → all unique invoice_numbers (no duplicates from race).
- [ ] **Concurrent timesheet entry updates** — Two users bulk-upsert same timesheet → last write wins gracefully, no data corruption.
- [ ] **Lock during mutation** — User A opens edit form, User B locks entity, User A saves → A's save fails with 423.

### Priority K — Regressions from bug-reports/

- [ ] **Placement title renders (not em-dash)** — Placements list always shows title, fallback to "—" only when genuinely null.
- [ ] **Broker scope enforced on /placements** — Broker sees only assigned clients' placements (already tested but verify across all views).
- [ ] **Contractor creation auto-creates profile** — POST /users role=CONTRACTOR → ContractorProfile exists immediately; invoice generation doesn't fail.
- [ ] **Delete contractor with active placement blocked** — Already in test_entity_delete.py but verify message is actionable.
- [ ] **Open-ended placement saves with null end_date** — Referenced in `fixed-260411-023436` — regression test: POST placement with end_date=null → saves, stays null, doesn't default to today.
- [ ] **"Cannot save" generic error surfaced** — From `fixed-260411-041928` — when save fails, specific reason shown (not just "error"). Test invalid payload → 400 with details.

---

## Notes

**Priority letters continue alphabetically** from earlier A-D backlog. Sections E-K add 35 more deep test ideas on top of that 25, for **~60 total future tests** → potential grand total **~388 tests**.

**How to approach:** E-K tests are more specialized than P1-P4. Pick when:
- **E (precision):** After any invoice calculation/PDF change.
- **F (time):** Before year-end rollover (2026→2027 in real use).
- **G (cascading):** After schema changes to FK relationships.
- **H (unicode):** Before onboarding non-Latin clients.
- **I (boundaries):** During fuzz/hardening passes.
- **J (concurrency):** Under load testing or after race-condition bug reports.
- **K (regressions):** Each time a bug report is fixed — add its test before closing.

**Total test potential if all done:**
- Current: 328
- Priority A-D: +25 → 353
- Priority E-K: +35 → 388
