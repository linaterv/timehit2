# Test Coverage Backlog

Tests that **could** be added but aren't yet. Companion doc to [`tests.md`](tests.md).

**Current coverage: 394 tests** (269 backend + 125 E2E).

All previous P1-P4 and A-K backlog items have been implemented. See commits:
- `0658345` — P1-P4 batch (50 tests)
- `7ba3315` — A/B/E/F/G/H/I/K batch (47 tests)
- `0975810` — Concurrency + resilience (9 tests)
- `8ae1bf3` — Deep E2E (8 tests)

---

## Next backlog ideas (not yet implemented)

### Priority L — Visual regression

- [ ] **Screenshot baseline per page per theme** — HitHunter, Matrix, Barbie, Metal, Fallout, Aloha × key pages. Detect unintended visual drift.
- [ ] **PDF visual regression** — Generate sample invoice PDF, compare against baseline (pixel diff or structured text diff).
- [ ] **Font rendering** — Ensure Fira Code (Matrix), Metamorphous (Metal) render correctly. Compare font ids in computed styles.

### Priority M — Accessibility (a11y)

- [ ] **axe-core scan per page** — Playwright + @axe-core/playwright on login, dashboard, placement detail, timesheet detail, invoice detail. Assert zero critical violations.
- [ ] **Keyboard-only navigation** — Tab through login → sidebar → detail page. All interactive elements reachable.
- [ ] **ARIA labels on icon-only buttons** — Every button with just an icon has accessible name.
- [ ] **Color contrast** — Automated WCAG AA check per theme.
- [ ] **Screen reader landmarks** — `<main>`, `<nav>`, `<aside>` present.

### Priority N — Performance

- [ ] **Dashboard load time** — Benchmark GET /control/overview time for month with 100+ placements. Flag if > 500ms.
- [ ] **FTS search latency** — Query candidates FTS against 10k-candidate dataset, p95 < 100ms.
- [ ] **Invoice PDF generation benchmark** — Sequential 100 invoice PDFs < 60s total.
- [ ] **Payload size limits** — GET /invoices?per_page=100 response size < 500KB.
- [ ] **N+1 query detection** — Assert list endpoints use select_related/prefetch_related (count queries ≤ constant).

### Priority O — Deploy & config hygiene

- [ ] **Settings.py secrets not hardcoded** — Scan for SECRET_KEY, DATABASE passwords in checked-in code.
- [ ] **Migrations idempotent** — Apply all migrations forward, then backward, then forward — DB schema unchanged.
- [ ] **populate --clean is safe** — Runs twice back-to-back without error or duplicate data.
- [ ] **Feature flag coverage** — If feature flags exist, test both states per flag.
- [ ] **Healthcheck endpoint** — GET /api/healthz returns 200.

### Priority P — Documentation accuracy

- [ ] **Swagger schema has all endpoints** — Compare discovered routes vs /api/schema/ output. Missing endpoints flagged.
- [ ] **All fields documented** — Every serializer field has `help_text` or docstring.
- [ ] **Example payloads work** — Copy/paste from Swagger examples → actual API call succeeds.
- [ ] **README commands work** — Each command in CLAUDE.md executes without error on clean checkout.

---

## Notes

**Total test potential if all L-P done:** ~20 more tests → **~414 grand total**.

**Priority L** (visual regression) is high-leverage for UI-heavy apps but requires baseline management.

**Priority M** (a11y) is essential for public/enterprise use; axe-core integration is quick.

**Priority N** (performance) needs a larger test dataset than `populate --clean` produces.

**Priority O** (deploy) and **P** (docs) are hygiene — pay off during audits and onboarding.

**How to pick next:**
1. **Shipping to enterprise / public?** Start with **M** (a11y) and **O** (deploy hygiene).
2. **Data growing?** Do **N** (performance) before users notice.
3. **Frequent UI churn?** Do **L** (visual regression) to catch unintended changes.
4. **Onboarding new engineers?** Do **P** (docs accuracy).
