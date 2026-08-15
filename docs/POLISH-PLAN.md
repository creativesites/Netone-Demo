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
| 1 | Reliability fixes found in audit | ✅ Done |
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

### Phase 1 — Reliability fixes (✅ done, 2026-08-15)
Fixed both P0/P1 findings from Phase 0:

1. **Gatekeeper bug**: `findLead()` now runs *before* the isLead gate in
   `lead.service.ts::processEvent`, and the gate only filters brand-new
   contacts (`!analysis.isLead && !existing`). An existing lead's
   conversation can never be silently reclassified back to "not a lead" by
   an ambiguous single-message reply.
2. **Bitrix determinism/completeness bug**: `bitrix24.adapter.ts` now
   builds `STATUS_ID` from `lead.qualification_status` (the persisted,
   deterministic decision) instead of the AI's raw `analysis.qualification`.
   The CRM comment gained a "Qualification (NetOne rules engine)" block
   (score, qualification, credit-risk indicator with an explicit "NOT a
   loan approval" disclaimer per the brief, next action) plus
   employment/monthly-income lines that were previously missing entirely.

**Verification** (not just `tsc`/build — an actual run against a real
local Postgres + fake Bitrix/WhatsApp HTTP servers, using the real
DeepSeek provider so the test reflects real model behavior, not a
hand-picked deterministic case):
- Simulated the exact hero conversation (6 messages: initial financing
  interest → short follow-up replies with no purchase-intent keywords,
  e.g. "For work purposes", "I'm a civil servant", "About K4500",
  "Lusaka") against the same contact.
- The real DeepSeek classifier did in fact score some of those replies in
  isolation as non-leads (e.g. "No sales opportunity; message appears to
  be a location mention" for "Lusaka" alone) — confirming the bug was
  real, not theoretical.
- `conversation.is_lead` stayed `true` across all 6 messages (asserted
  after every message; the old code would have flipped it to `false` on
  message 2). Nia kept responding naturally throughout, using real
  product names from the knowledge base.
- Inspected the actual Bitrix payloads sent: `STATUS_ID` tracked the
  deterministic qualification tier; the final comment included
  `Employment: civil servant`, `Monthly income: About K4500`, and
  `Financing eligibility indicator: Low risk (indicator only — NOT a loan
  approval; requires financing-partner verification)`.
- No duplicate Bitrix lead created across 6 messages (one `crm.lead.add`,
  five `crm.lead.update`, same `crmLeadId` throughout) — dedup/upsert
  intact.

**Backlog item surfaced, not fixed now (out of scope for Phase 1):**
`purchaseIntent` (and therefore part of the score) is re-derived from only
the *latest* single message on every turn, so the score can wobble down
when a reply is a short factual answer with no purchase language of its
own (e.g. dropped 73→60 after "Lusaka"). Not a bug — qualify() is working
exactly as designed — but worth smoothing in Phase 3 (conversational flow)
or Phase 5 (scoring), e.g. by carrying forward the highest purchase-intent
seen in the conversation rather than only the latest message's.

Test artifacts (`scratch-*.mjs/.ts`, test Postgres role/db) were removed
after verification — nothing test-only was committed.

Commit: (see git log — "Fix gatekeeper mid-conversation bug + make Bitrix24
reflect the deterministic decision").

### Phase 2 — Hero journey end-to-end verification
Not started. Builds on Phase 1's verification harness — next step is
running the equivalent scenario through the real WhatsApp bridge (not just
`processEvent` directly) to confirm the outbound reply path, delivery
status, and dashboard real-time updates all hold up too.
