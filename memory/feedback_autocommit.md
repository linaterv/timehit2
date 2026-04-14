---
name: Auto-commit cron for TimeHit2
description: Existing 10-min auto-commit cron for this repo — defaults are locked, don't re-ask
type: feedback
originSessionId: 0252c31f-2067-4001-8705-b9742c67405b
---
Every 10 min, `/home/timehit/bin/timehit2-autocommit.sh` runs via user crontab and does `git add -A && git commit -m "extraCOMMIT + INSIGHTS"` in `/home/timehit/a/timehit2`. A SessionStart hook in `~/.claude/settings.json` reinstalls the cron line if missing.

**Settled defaults — do NOT re-ask:**
- Commit message is the literal string `extraCOMMIT + INSIGHTS`
- Scope: this repo only, `git add -A` (everything — including noise like `.remember/logs/`)
- Local commits only, no push
- Fires regardless of in-progress state (user explicitly said "despite of state")

**Why:** User dislikes ceremony and explicitly rejected being re-asked about scope/message/push options. Defaults above were chosen and approved.

**How to apply:** If the user asks to change cadence, message, scope, or push behavior, edit the script / cron / hook in place. Don't prompt them about the existing defaults. If auto-commits produce noise (e.g. plugin log dirs), proactively add to `.gitignore` instead of asking.
