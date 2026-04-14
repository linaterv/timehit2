---
name: Auto-commit cron for TimeHit2
description: 10-min intelligent Claude-powered auto-commit cron for this repo — defaults are locked, don't re-ask
type: feedback
originSessionId: 0252c31f-2067-4001-8705-b9742c67405b
---
Every 10 min, `/home/timehit/bin/timehit2-autocommit.sh` runs via user crontab. The script does a fast `git status` gate and, if there's pending work, spawns a headless `claude -p` (Opus, effort max, `--permission-mode bypassPermissions`) that reviews the diff, patches any md files that have drifted from the diff, stages + commits with a specific summary, and pushes. A SessionStart hook in `~/.claude/settings.json` re-installs the crontab line if missing. Logs to `/tmp/timehit2-autocommit.log`.

**Settled defaults — do NOT re-ask:**
- Commit message format: `autoCommit: <specific one-line summary>` — the `autoCommit:` prefix tags these so the user can filter them in log.
- Scope: this repo only. Stage everything not `.gitignore`d, excluding binaries (`.jar`, `.zip`, `.class`, `.exe`, `.tar.gz`, `.pyc`, `.so`, `.db-journal`, etc.) and files >5MB.
- Push to `origin main` after every commit. On rejection: one `pull --rebase`, retry, then abort without force.
- Fires regardless of in-progress state. The `autoCommit:` prefix makes this visible.
- Md-drift review happens inline — only updates md files whose drift is directly caused by the current diff. No speculative doc rewrites.
- Model/effort: Opus + effort max (user explicitly chose this for intelligence).

**Why:** User dislikes ceremony and explicitly rejected being re-asked about scope/message/push options. Wants the commit loop to be "Claude Code intelligent, not just commit".

**How to apply:** If the user asks to change cadence, message, scope, push, model, or the md-review behavior, edit the script / cron / hook in place. Don't prompt them about the existing defaults. If auto-commits produce new noise (plugin log dirs, build artifacts), proactively add to `.gitignore` instead of asking.
