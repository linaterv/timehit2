---
name: Workflow rules for features and commits
description: When asked for a feature update reqs first; when user confirms a change commit it automatically
type: feedback
originSessionId: 29bb7048-4ae9-4fb9-8515-045407cad29b
---
Two workflow rules:

1. **Feature requests → update docs first.** When the user asks for a feature or bug fix, update the relevant requirement docs (functional-spec, frontend-reqs, etc.) before implementing code. This aligns with the CLAUDE.md process rules.

2. **User confirms a change → commit automatically.** When the user confirms a change works (e.g. "looks good", "it works", screenshot confirmation), create a git commit without being asked.

**Why:** User prefers action over ceremony. They don't want to separately ask for commits after already confirming the work is done.

**How to apply:** After implementing a change and getting user confirmation, immediately run the commit flow (git status, diff, log, then commit). For features, always check and update markdown docs before touching code.
