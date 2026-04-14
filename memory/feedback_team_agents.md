---
name: Team agents for TimeHit2
description: When and how to spawn the ui-engineer + backend-engineer team. Personas live in .claude/agents/; spawn rules and coordination protocol live in CLAUDE.md.
type: feedback
originSessionId: 0252c31f-2067-4001-8705-b9742c67405b
---
Two project-scoped personas are defined in `.claude/agents/`: `ui-engineer` (frontend/, frontend-tests/) and `backend-engineer` (backend/, tests/). Both use `model: opus`. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` is set globally so teams are available.

**Triage rule — BEFORE starting any multi-step task, ask "does this split cleanly across UI + backend?":**
- Yes, and both halves are more than trivial → `TeamCreate` + spawn both personas in one parallel Agent call. See the Team Agents section of `CLAUDE.md` for the exact protocol.
- No (single lane or tiny edit) → stay solo. Team coordination overhead isn't worth it.
- Research/exploration → use `Explore` subagent, not a team.

**Coordination protocol** (also in CLAUDE.md): the teammate introducing or changing an API contract messages the other via `SendMessage` BEFORE landing it. Req docs (`timehit-api.md`, `functional-spec.md`, `frontend-reqs.md`) get updated first, before either persona starts coding.

**Why:** User explicitly enabled teams and wants parallel UI/backend work on reasonable splits. They dislike ceremony, so the trigger bar is "clear two-lane split" — not "any multi-file task".

**How to apply:** When a feature request lands, do the UI+backend split check first. If it's a team task, don't do the work solo just because it feels faster — the user wanted the team pattern. Remember that auto-commit sweeps everything every 10 min, so teammates don't need to coordinate on commits.
