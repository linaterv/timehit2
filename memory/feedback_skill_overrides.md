---
name: Skill activation overrides for TimeHit2
description: When to SKIP or FORCE superpowers skills in this repo. Check before invoking any skill — these overrides beat the skill's own trigger rules.
type: feedback
---

Rules for superpower-skill activation on this project. Check these before invoking any skill.

1. **Skip `brainstorming`** for clear, narrow asks — single-file edits, explicit "add X button / fix Y typo / rename Z". Use only when the request is genuinely ambiguous or open-ended ("how should we approach...", "what do you think about...").
2. **Skip `writing-plans` / `executing-plans`** unless the task spans >3 files or clearly multi-session. User prefers direct action over planning ceremony.
3. **Skip `using-git-worktrees`** — user works on `main` directly and commits forward. No worktrees unless explicitly requested.
4. **Skip the formal `verification-before-completion` skill invocation** for small changes — but ALWAYS run the actual verification (tests, dev server, manual browser check) before claiming done. Never skip the substance, only the ceremony.
5. **Use `systematic-debugging`** only when a direct check doesn't yield the cause within 2-3 probes. For obvious bugs, fix directly.
6. **Keep using** `test-driven-development` for non-trivial backend business logic (state machines, invoice math, permissions). Skip for UI polish / styling tweaks.
7. **Auto-commit after confirmation** (per `feedback_workflow.md`) — don't wait to be asked.

**Why:** User has explicitly preferred action over ceremony (`feedback_workflow.md`). Ceremony skills slow narrow tasks and add zero value when the path is obvious. But the *discipline* behind each skill still applies inline — verify, test, think before acting.

**How to apply:** Before invoking any superpower skill, scan this list. If a rule says skip: don't invoke the skill, but *do* apply its underlying discipline in the response. If the rule says force: invoke even when you'd otherwise skip.
