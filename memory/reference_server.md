---
name: Server and infrastructure details
description: Production server — hostname, SSL, nginx cookie-based gate auth, service setup, GitHub SSH
type: reference
originSessionId: 2f4f865b-34a6-4772-a52e-6e650b122f24
---
**Server:** `v1ln.l.dedikuoti.lt` (Ubuntu 24.04, IPv6: 2a02:7b40:d418:66b3::1)

**SSL:** Let's Encrypt via certbot (nginx plugin), auto-renewal timer, cert expires 2026-07-09

**Nginx auth (cookie-based gate):**
- Config: `/etc/nginx/sites-available/app` (symlinked to sites-enabled)
- Login page: `/etc/nginx/login.html` served at `/gate` path
- Auth check: `/auth-check` endpoint uses htpasswd + sets cookie
- Auth OK file: `/etc/nginx/auth-ok.txt`
- Credentials: user=timehit, pwd=UkrainaIranas2026!, stored in `/etc/nginx/.htpasswd`
- Cookie token: `74b82fc3294d6ec51b7fdd0151fb754b137e8ea3645aa5c4f785882a1954f42e` (24h expiry)
- Auth denied returns 403 (not 401) to avoid Chrome basic auth popup issues
- `/gate` and `/auth-check` are nginx-served; everything else proxied to Next.js (port 3000)
- Port 80 redirects to HTTPS, IPv4+IPv6 listeners on both 80 and 443

**GitHub:** SSH key (ed25519) added to `linaterv` account. Repo: `git@github.com:linaterv/timehit2.git`

**Installed tools:**
- Node.js (via nodesource), Python 3.12, certbot, apache2-utils (htpasswd)
- Playwright + Chromium installed at /home/timehit/a/ (npm project with playwright dependency)

**File layout:**
- `/home/timehit/a/` — working directory
- `/home/timehit/a/timehit2/` — main project (git repo)
- `/home/timehit/a/api/` and `/home/timehit/a/frontend/` — old hello-world test apps (killed, can be deleted)
- `/home/timehit/a/test-auth.mjs` — Playwright auth test script for nginx gate
