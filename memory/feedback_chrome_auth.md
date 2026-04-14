---
name: Chrome basic auth popup broken
description: Chrome 146+ does not show basic auth popup — must use cookie-based login page instead of nginx auth_basic alone
type: feedback
originSessionId: 2f4f865b-34a6-4772-a52e-6e650b122f24
---
Chrome 146 on Windows does not show the native basic auth popup when nginx returns 401 with WWW-Authenticate header. The user sees a raw "401 Authorization Required" page with no way to enter credentials.

**Why:** Tested extensively — the header is correct but Chrome won't prompt. Possibly a Chrome 146 behavioral change.

**How to apply:** Never rely on browser basic auth popups. Always use a cookie-based login page approach:
1. Serve a login form at a dedicated path (e.g. `/gate`)
2. Login form POSTs credentials via fetch to `/auth-check` (which uses nginx auth_basic)
3. On success, `/auth-check` sets an HttpOnly cookie
4. All other locations check for the cookie, redirect to `/gate` if missing
5. The `/auth-check` must use `error_page 401 =403` to suppress WWW-Authenticate header (otherwise Chrome shows a dialog on failed fetch too)
6. Cannot use `return 200` with `auth_basic` in same location block — `return` runs before access phase, bypassing auth. Use `try_files` with a static file instead.
