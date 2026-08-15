# NetOne Lead Intelligence — Polish Plan & Progress Tracker

Living document. Updated after every phase so work can pick back up exactly
where it left off if a session ends mid-plan. Do not treat this as a
historical log — keep the **Status** table current and let `git log` be the
history.

Goal: take the repo from "polished technical POC" to a highly convincing,
production-minded CEO demo (Monday) and a coherent foundation for a real
NetOne implementation, without destabilizing what already works. Full
context for this plan: the CEO demo brief delivered 2026-08-15 (audit +
40-section spec covering business context, architecture preservation,
demo script, discovery questions, and documentation deliverables).

---

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Repository audit | ✅ Done |
| 1 | Reliability fixes found in audit | 🔲 Not started |
| 2 | Hero journey end-to-end verification | 🔲 Not started |
| 3 | Conversational flow improvements | 🔲 Not started |
| 4 | Knowledge-base correctness | 🔲 Not started |
| 5 | Qualification / scoring / risk / routing verification | 🔲 Not started |
| 6 | Bitrix create/update/enrichment verification | 🔲 Not started |
| 7 | Human handoff | 🔲 Not started |
| 8 | Management visibility (real-data analytics) | 🔲 Not started |
| 9 | Source/channel architecture (attribution fields) | 🔲 Not started |
| 10 | Persistence/realtime/error hardening + backend API auth | 🔲 Not started |
| 11 | Testing | 🔲 Not started |
| 12 | CEO-demo polish | 🔲 Not started |
| 13 | Documentation (`docs/*.md`) | 🔲 Not started |

Update the emoji + a one-line note per phase as work lands. Nothing later
than the first 🔲 should be started out of order unless explicitly noted.

---

## Phase 0 — Audit findings (source of truth for Phase 1+)

Full audit delivered to the user 2026-08-15. Key findings driving the next
phases:

**P0 — gatekeeper re-classifies every message in isolation, including
follow-ups from an already-open lead.** `classifyLead()` gets zero
conversation context. A bare reply like `"K4500"` scores `isLead:false` in
the deterministic fallback, and the real LLM has no guarantee of doing
better with no context. `existing` lead lookup happens *after* the isLead
gate in `lead.service.ts::processEvent`, so an existing lead gets no
protection. If this fires mid-conversation, Nia stops responding and the
conversation is marked `is_lead:false` — silently breaks the exact
multi-turn financing flow the demo is built around.
→ Fix: look up `existing` before the gate; skip the isLead filter entirely
when a lead already exists for this contact/channel.

**P1 — Bitrix24 doesn't receive the deterministic decision.**
`bitrix24Adapter.createLead/updateLead` are passed the AI's raw `analysis`
object; `statusFor(analysis.qualification)` uses the AI's own
non-deterministic guess, not `qual.qualification` / `lead.qualification_status`
from the rules engine. `collectedLines()` never includes employment,
monthly income, or credit risk — so the actual Bitrix CRM record (the
thing the demo script opens to "prove it's really in Bitrix") won't
reflect the credit-worthiness feature at all.
→ Fix: pass the persisted `lead` fields (deterministic) into the Bitrix
comment/status builder instead of `analysis`; add employment/income/credit
risk/score to the comment.

**P1 — backend REST API has no authentication of its own.** Clerk only
gates the frontend's page navigation; every backend route
(`/api/leads`, `/api/kb/*`, `/api/whatsapp/logout`, `/api/settings`) is
open to anyone who reaches the backend's public port. Only the
whatsapp→backend webhook has a shared-secret check.
→ Plan: opt-in shared-secret gate (env-var controlled, defaults to off so
it can never break the demo if misconfigured) in Phase 10. Documented as a
hard production requirement in `PRODUCTION-READINESS.md` regardless of
whether it lands before Monday.

**Missing — zero tests, no `docs/` folder, stale README/DEPLOYMENT, no
demo-data reset strategy.** Addressed in Phases 11 and 13.

**Partial — no human-handoff modeling.** Nia keeps auto-replying even
after a human sends a manual reply in the same conversation. Addressed in
Phase 7.

Full B–J audit categories (implemented / partial / CEO strengths /
weaknesses / files affected) are in the session transcript; this doc only
tracks what changes as a result.

---

## Phase log

### Phase 0 — Audit (✅ done, 2026-08-15)
Read the full repo fresh: whatsapp-service, all backend routes/services/
repos, config, firebase mirror, frontend Shell/pages/hooks, docker-compose,
READMEs, package.json scripts. No code changed. Findings above.

### Phase 1 — Reliability fixes (in progress)
Target: fix the P0 gatekeeper bug and the P1 Bitrix determinism/completeness
bug found in Phase 0. Verify both against a real local Postgres (not just
`tsc`) before marking done, matching the standard already set earlier this
project (the credit-risk "met" bug was only caught by an actual smoke test).

<!-- Append phase entries below as they complete. Keep each entry short:
what changed, how it was verified, commit hash. -->
