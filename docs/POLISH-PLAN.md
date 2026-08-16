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
| 2 | Hero journey end-to-end verification | ✅ Done (real live test) |
| 3 | Conversational flow improvements | ✅ Done |
| 4 | Knowledge-base correctness | ✅ Done (real live test) |
| 5 | Qualification / scoring / risk / routing verification | ✅ Done (real live test) |
| 6 | Bitrix create/update/enrichment verification | ✅ Done (real live test) |
| 7 | Human handoff | ✅ Done (real live test) |
| 8 | Management visibility (real-data analytics) | ✅ Done (real live test) |
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

### Phase 2 — Hero journey end-to-end verification (✅ done, real user-provided transcript, 2026-08-15)
Instead of another synthetic scenario, the user supplied a real WhatsApp
transcript (Winston, 8 messages, financing inquiry → NEO Lite 14a → 6-12mo
financing → employment "police officer, sergeant" → income 8600 →
handoff). Reviewed against the fixed Phase 1 code, not re-run through the
pipeline (no code changes this phase — verification only):

- Confirmed the deterministic employment canonication correctly reads a
  real, informally-phrased answer ("I'm a police officer. A sergeant") as
  `civil_servant`, not a keyword-miss default.
- Confirmed Nia's product/financing suggestions (NEO Lite 14a at K5,500,
  6-12 month terms) are genuinely KB-grounded, not hallucinated, and stay
  consistent turn-to-turn.
- Investigated an apparent ~29-hour gap between message 1 (14/8, 2:54pm)
  and message 2 (15/8, 8:05pm). User clarified this was **not a bug**: the
  first message predates the Phase 1 gatekeeper fix (when the system
  wasn't replying at all), and the customer simply continued the same old
  chat the next day once it started working — realistic end-user behavior,
  not a defect. No action needed; the sticky-lead lookup (Phase 1 fix)
  handles a same-contact conversation resuming after any real-world gap
  correctly by design.
- No code changes. This phase's output was confirming the Phase 1 fixes
  hold up against real (not synthetic) conversational data before moving
  on to Phase 3.

### Phase 3 — Conversational flow improvements (✅ done, verified live, 2026-08-15)
Three requested fixes, all in `ai.service.ts` (`AGENT_PROMPT` +
`converseDeterministic`) and `qualification.service.ts`:

1. **Nia no longer assumes a product decision from budget alone.** Prompt
   now instructs the agent to *suggest* a matching product and explicitly
   wait for the customer to confirm interest, never state "so you'll be
   getting the X" as a foregone conclusion from budget alone.
2. **Graceful, intelligent handling of declined/refused information.**
   New `isDeclinedAnswer()` in `qualification.service.ts` (phrase-based —
   see bug #1 below for why not single-word) detects refusals like "rather
   not say", "prefer not to", "none of your business", "keep that
   private". `converseDeterministic()` records a `'prefers not to share'`
   placeholder for the field being asked, acknowledges warmly once
   ("No problem at all, totally understand."), and moves the conversation
   on to the next field instead of re-asking or stalling.
   `evalCriterion()`'s employment branch now treats a decline as "answered"
   (`met: true`, so the flow doesn't loop) but contributes 0 score points
   and forces `credit_risk` to `'unknown'` rather than guessing. A new
   `nextAction` branch surfaces "Discuss financing eligibility directly —
   customer preferred not to share employment details" for a human rep.
3. **Personality mirroring.** `AGENT_PROMPT` now instructs the model to
   read the customer's register (formal/casual, terse/chatty, emoji use)
   from their messages and adapt tone accordingly, while keeping brand
   identity — mirror, not mimic. Verified qualitatively with two
   contrasting live conversations (casual/emoji-heavy vs. formal/complete-
   sentence customer personas) — Nia's replies were visibly distinct in
   register between the two but still recognizably on-brand.

**Two additional real bugs found and fixed during verification** (higher
demo-risk than the three requested items, since both are visible directly
in the live CRM record):

- **`'private'` false-positive in decline detection.** The original
  `DECLINE_PATTERNS` included the bare word `'private'` to catch "keep
  that private", but it also matched entirely ordinary answers like "I
  work at a private firm" — silently discarding a legitimate employment
  answer and forcing `credit_risk` to `'unknown'` when it should have been
  `'low'`. Found via a live smoke test using "I am formally employed as an
  accountant at a private firm." Fixed by switching every trigger to
  compound phrases only, and by deduplicating what had drifted into two
  independent copies (`ai.service.ts` and `qualification.service.ts`) into
  one exported `isDeclinedAnswer()`.
- **Bitrix `STATUS_ID` cratering to JUNK on an actively-qualifying lead.**
  Because `classifyLead()` reads only the single latest message with zero
  history, a neutral reply (e.g. declining to share a location) read as
  low purchase intent in isolation. Since `purchase_intent` and
  `financing_interest` were freshly overwritten every turn instead of
  carried forward, the qualification score — and the real Bitrix
  `STATUS_ID` field a sales rep or the CEO could see directly — visibly
  dropped mid-conversation for an actively engaged customer. Fixed with a
  sticky merge in `lead.service.ts`: `maxPurchaseIntent()` never lets
  purchase intent rank downward within an existing lead's conversation,
  and `financingInterest` is OR'd forward once seen. Also fixed a related
  gap while in this code: Bitrix sync was gated on `turn.complete`, so
  intermediate turns' re-scored qualification never reached Bitrix — only
  first-sync and final-sync did, leaving the CRM record up to one full
  turn stale. Sync is now unconditional every turn (regardless of the
  auto-reply toggle), with the step label distinguishing "profile
  complete" vs. "Bitrix24 enriched".

**Verification** (same methodology as Phase 1 — real local Postgres 16,
fake Bitrix/WhatsApp HTTP servers, real DeepSeek provider, two parallel
contact simulations: a casual/emoji-heavy "Casual Customer" and a
formal/complete-sentence "Formal Customer" who declines to share
location, then later gives full employment/income details):
- Casual Customer: replies matched the casual register (emoji, short
  sentences) throughout; no premature product assumption from budget.
- Formal Customer: declined the location question gracefully ("No worries
  at all, we can keep it simple! 😊 ... could you share your name?"),
  conversation continued without looping or breaking; final
  `qualification_status` correctly reached `"qualified"` / score 73 /
  `credit_risk: "low"` (pre-fix, this same scenario incorrectly landed on
  `"unqualified"` / score 30 due to the purchase-intent regression bug).
- Fake-Bitrix log confirmed final `STATUS_ID` for both contacts correctly
  reached `IN_PROCESS` (matching "qualified"), with intermediate turns'
  `crm.lead.update` calls no longer stale relative to the true DB state.
- No duplicate Bitrix leads created (one `crm.lead.add` per contact).
- `npx tsc --noEmit -p .` and `npm run build` clean in `backend/`.

**Backlog, not fixed this phase:** `ai_summary`/`ai_reasoning` can still
read slightly oddly out of context on later turns since they're generated
fresh per single message by the gatekeeper (same root cause class as the
purchase-intent issue, but lower demo-risk since it's descriptive copy,
not a score/status field). Candidate for a later Phase 3/5 refinement.

Test artifacts (`scratch-test-hero-journey.ts`, `scratch-fake-services.mjs`,
`scratch-test-phase3.ts`, test Postgres role/db) removed after
verification — nothing test-only committed.

### Phase 3.1 — Product tracking on the lead card (✅ done, verified live, 2026-08-15)
User-reported: the product doesn't show on the lead card. Root cause was
two independent bugs in how the "product" field flows from chat to the
dashboard, both in the same family as the Phase 3 sticky-intent bug:

1. **The lead card's `product` column got clobbered on almost every
   turn.** `leads.product` (what `RecentLeads`/`LeadDetail` actually
   render) was written on every message from `analysis.product` — the AI
   gatekeeper's read of *only that single message*, in isolation. Since
   most turns don't literally repeat the product name (e.g. "8600",
   "I'm a police officer"), `analysis.product` was `null` on most turns,
   and `leads.repo.ts::upsertLead` unconditionally overwrote the column
   with that `null` — so a product picked up on message 1 was gone by
   message 2. Fixed with the same COALESCE pattern already used for
   `name`/`phone`: `product = COALESCE(EXCLUDED.product, leads.product)`,
   plus a sticky merge in `lead.service.ts` (`analysis.product =
   rawAnalysis.product ?? existing.product`) so the "product identified"
   scoring criterion stopped wobbling the score down mid-conversation too.
2. **The generic gatekeeper guess was blocking real product detection.**
   `collected.product` (the conversational agent's deterministic,
   KB-grounded field) was seeded at lead creation with the gatekeeper's
   generic read (e.g. `"laptop"`). Since that made `missingFields()`
   think "product" was already answered, Nia never felt obligated to
   suggest/confirm a specific model — the field stayed stuck on `"laptop"`
   forever instead of narrowing to e.g. `"NEO Lite 14a"`. Fixed by leaving
   `collected.product` null at seed time (the generic value still reaches
   the card immediately via the top-level column fix above) so the
   conversational agent stays responsible for landing on a real,
   customer-confirmed model.
3. **Broadened what counts as a real product confirmation.** The Phase 3
   rule required the customer to literally name/confirm a product before
   `collected.product` could be written — too strict for how real
   customers talk (they say "yes", "let's do financing for that", or just
   keep answering follow-up questions about the suggested product, not
   "yes I'll take the NEO Lite 14a"). `AGENT_PROMPT` now recognizes
   continued engagement with a *specifically-named* suggestion (direct
   affirmatives, asking about price/terms for it, answering the next
   question about it) as a real selection, while still refusing to invent
   a product from budget alone with zero reaction, or from a
   still-comparing / explicitly-declined customer.

**Verification** (same real-Postgres + fake-Bitrix/WhatsApp + live DeepSeek
harness): re-ran the Winston transcript from Phase 2 through the fixed
pipeline. `leads.product` stayed populated every turn ("laptop" from
message 1, no drops to null); `collected.product` correctly stayed null
until message 4 ("Yes let's do financing... I'm in kabwe" — his real
confirmation of the previously-suggested NEO Lite 14a), then held
"NEO Lite 14a" through the rest of the conversation. Score climbed
monotonically (45→50→60→70→90→100) instead of wobbling down. Bitrix
`COMMENTS` correctly showed the "Collected profile: Product" line
transition from "—" to "NEO Lite 14a" and never revert; one `crm.lead.add`
+ eleven `crm.lead.update` calls, no duplicates; final `STATUS_ID`
`IN_PROCESS`. A second "wanderer" persona (asks about laptops generally,
never reacts to or accepts a specific suggestion) confirmed the broadened
confirmation rule doesn't over-fire: `collected.product` correctly stayed
null the whole conversation while the card still showed the generic
"laptop" interest.

Test artifacts removed after verification, test Postgres role/db dropped,
service stopped — nothing test-only committed.

### Leads UI — clickable leads, leads table, single-lead page (✅ done, 2026-08-16)
User-requested, not a numbered phase but landed between Phase 3 and 4:

- Every lead is now clickable. `RecentLeads` rows and the dashboard's
  "Current Lead" panel both link through to `/leads/[id]` instead of being
  static.
- New `/leads` page: a searchable/filterable table (name, phone, product,
  location search; qualification-status filter) of every lead, each row
  linking to its detail page.
- New `/leads/[id]` page: reuses `LeadDetail` + `Timeline`, adds a
  "Collected profile" checklist and the original inbound message.
- "Export to Excel" on `/leads` is a dependency-free CSV (Excel opens it
  natively) rather than the `xlsx` npm package — `xlsx` carries two
  unpatched high-severity CVEs (prototype pollution, ReDoS) with no fix
  available; not worth adding for a write-only use case when a
  zero-dependency alternative exists. CSV cells are guarded against
  formula injection (leading `=`/`+`/`-`/`@`) since the export includes
  customer-provided text.
- Backend: `/api/leads` accepts an optional `?limit=` (default 50, capped
  at 1000) so the leads table can pull more than the dashboard's usual 50.

**Verification:** clean `tsc` and production build for both new routes.
Real Chromium browser screenshots were not obtainable in this sandbox — a
reproducible Chromium↔localhost networking issue specific to this
environment (confirmed via extensive isolation testing to be unrelated to
the app: the same backend API and static assets loaded fine via
Playwright, a minimal chunked-transfer test server loaded fine, and the
Next.js dev server's own access log showed it correctly answering
Playwright's requests with `200` — the reset happens on the response
delivery back to that one browser process, not in the app). Verified
instead via: real seeded leads (through the actual pipeline, real
DeepSeek) confirmed correct via the backend API; full SSR HTML for both
routes inspected directly and confirmed correct — nav "Leads" item active,
search box, qualification filter, all 8 table columns, Export button,
back-link — across many repeated real requests with zero server errors in
the dev log.

### Phase 4 — Knowledge-base correctness (✅ done, verified live, 2026-08-16)
Read `kb.repo.ts`, `kb.ts` routes, `ProductsTab`/`DocumentsTab`, and how
`getKnowledgeContext()` feeds `ai.service.ts::converse()`. Findings:

- **Already correct:** `getKnowledgeContext()` queries products/documents
  live from Postgres on every single conversational turn — no caching
  layer anywhere, so an admin edit/delete is reflected on the very next
  message. Verified live (real DeepSeek): added a fictional product ("NEO
  UltraSlim Z9", K47,321, distinctive specs no model could know from
  training) via the KB API, asked Nia about it — she quoted the exact
  price and specs. Asked about a product that doesn't exist in the KB —
  she correctly declined to invent a price/spec and deferred to a sales
  rep, per the prompt's rule 7. Deleted the product, asked again — the
  price was no longer quoted at all. All three behaviors correct.
- **Bug found and fixed:** `POST /api/kb/documents`' simulated ingestion
  pipeline flips a new document from `ingesting` → `indexed` via an
  in-memory `setTimeout` (2.5–4.5s later). If the backend process restarts
  inside that window — plausible during a live demo where the backend
  might get restarted — the document is orphaned at `ingesting` forever
  (no persisted job survives a restart), silently excluded from
  `getKnowledgeContext()` with no way to recover except deleting and
  re-adding it. Fixed with `kb.repo.ts::healStuckIngestion()`, called once
  at server startup: sweeps any document still `ingesting` to `indexed`
  (safe since ingestion has no real processing/failure risk — it's
  simulated). Verified live: inserted a document directly at `ingesting`
  (bypassing the route's timeout, simulating a restart mid-ingestion),
  confirmed it stayed stuck until `healStuckIngestion()` ran, then
  confirmed it flipped to `indexed` and immediately appeared in
  `getKnowledgeContext()`.
- Reviewed `ProductsTab`/`DocumentsTab` CRUD UI — straightforward,
  correctly wired to the backend, no correctness issues found.

Test artifacts (test Postgres role/db) removed after verification.

### Phase 5 — Qualification / scoring / risk / routing verification (✅ done, verified live, 2026-08-16)
Read `qualification.service.ts` in full end to end. Found and fixed one
real, live-reproducible bug:

- **Cash customers were misrouted to the Financing Sales Desk and got a
  permanent phantom "request employment" next action.** The `wantsFinancing`
  check (used for both Bitrix routing/`assignedTo` and the score/next-action
  logic) was `collected.financing && !isNegativeAnswer(collected.financing)`.
  `isNegativeAnswer()` only recognizes words like "no"/"none"/"unemploy" —
  it doesn't recognize "cash" as meaning *not* wanting financing, since
  "cash" isn't grammatically negative. So a customer who explicitly said
  "cash" was silently treated as `wantsFinancing: true`. That flipped
  `assignedTo` to "Financing Sales Desk" instead of "Sales Team", and since
  `employment` is a required, weighted scoring criterion, a cash customer
  (who Nia correctly never asks about employment — see rule 4 of
  `AGENT_PROMPT`) could never satisfy it, so `nextAction` permanently read
  "Request employment / credit risk and continue qualification" even after
  the conversation was otherwise fully complete and handed to a rep.
  The exact same buggy pattern existed independently in
  `ai.service.ts::missingFields()`'s own `wantsFinancing` tri-state,
  meaning the conversational agent's own "still missing" list had the same
  blind spot (lower practical risk there since `AGENT_PROMPT` rule 4
  explicitly tells the model never to ask when cash was stated, but the
  deterministic fallback path — used when both AI providers are down —
  would have followed the buggy "still missing" list literally and asked
  anyway).
  Fixed with one new shared, exported `wantsFinancingAnswer()` in
  `qualification.service.ts` (cash/upfront/outright keywords → false,
  declined → null/unknown, negative-answer words → false, anything else →
  true) used consistently by both files, and `evalCriterion()`'s employment
  case now scores full marks / "met" when the customer's own confirmed
  answer is cash — never blocking the score or the next-action message for
  a sale that was never going to need credit underwriting.
- Reviewed the rest of the scoring/tier/routing logic (thresholds,
  employment-weight → credit-risk tier mapping, Customer Care routing for
  complaints/support, financing-declined next-action branch from Phase 3)
  — all correct, no further issues found.

**Verification:** pure-function unit tests first (no AI needed — this is
deterministic logic) confirmed the bug and the fix across 6 scenarios
(wants financing, financing + declined employment, financing not yet
known, cash, declined the cash/financing question itself, unemployed +
wants financing) — all now route/score/message correctly, with zero
regressions to the financing-customer paths. Then verified live (real
Postgres, real DeepSeek) with a genuine cash-purchase conversation: final
`assigned_to: "Sales Team"`, `next_action: "Call customer to close the
sale"`, `collected.employment: null` (never asked, as expected).

### Phase 6 — Bitrix create/update/enrichment verification (✅ done, verified live, 2026-08-16)
Bitrix create/update/enrichment logic itself was already heavily verified
in Phases 1 and 3 (deterministic STATUS_ID, score/credit-risk/employment
lines in the CRM comment, one-turn-lag fix). This phase's review found one
new, real, live-reproducible bug in how leads *reach* that logic:

- **Concurrent messages from the same contact could create duplicate
  Bitrix leads.** Each pipeline step is deliberately paced
  (`PIPELINE_STEP_DELAY_MS`, default 400ms) for the live demo animation, so
  a single message's full run can take several seconds end to end. Nothing
  serialized `processEvent()` calls per contact, so a real customer sending
  two WhatsApp messages a couple of seconds apart — completely normal
  behavior — could let two `processEvent()` calls for the *same* contact
  run concurrently. Both would read the lead's `bitrix_lead_id` as
  still-null before either had finished persisting it, and both would call
  `crm.lead.add` — two separate Bitrix leads for one customer, a real risk
  during a live demo if messages come in close together while narrating.
  Fixed with `serializeByContact()` in `lead.service.ts`: an in-memory
  per-`(channel, externalContactId)` async queue (self-cleaning — no
  unbounded growth) that makes a second message for the same contact wait
  for the first to fully land before it starts. Unrelated contacts are
  completely unaffected — no global bottleneck.
- Reviewed `assignLead()` in `bitrix24.adapter.ts`: defined on the adapter
  interface but never called from anywhere — the computed `assignedTo`
  ("Sales Team" / "Financing Sales Desk" / "Customer Care") is currently
  informational only (shown in the CRM comment and the dashboard), not
  wired to Bitrix's real per-team `ASSIGNED_BY_ID`. Every lead uses the
  single static `BITRIX24_ASSIGNED_BY_ID` env var regardless of routing
  decision. Not fixed — doing so needs real Bitrix user/queue IDs per team
  from NetOne, which nobody has supplied; noted as a `PRODUCTION-READINESS.md`
  item for Phase 13, not a bug in what exists today.
- Reviewed retry/self-heal behavior: a failed `crm.lead.add` leaves
  `bitrix_lead_id` null, so the very next message for that contact retries
  creation automatically (no separate retry queue needed); a failed
  `crm.lead.update` is retried the same way on the next turn. Both already
  correct, no changes needed.

**Verification:** reproduced the race live — fired two messages for the
same contact truly concurrently (not sequentially awaited) against a real
Postgres + fake Bitrix server, with realistic (non-zero) step delays. Before
reasoning through the fix this was confirmed exploitable by code inspection
(both reads happen before either write completes); after the fix, the fake
Bitrix server's request log showed exactly one `crm.lead.add` for the
contact despite the two concurrent messages, with the second message's
data (budget) correctly merged into the same lead.

### Phase 7 — Human handoff (✅ done, verified live, 2026-08-16)
Phase 0 audit finding: "Nia keeps auto-replying even after a human sends a
manual reply in the same conversation." Confirmed true — the only
auto-reply gate was the dashboard-wide `autoReplyEnabled` toggle; nothing
was scoped per conversation, and a human's manual reply
(`POST /api/conversations/:id/send`) and Nia's own auto-replies were even
stored with the identical `sender: 'agent'`, indistinguishable in the
inbox UI. Implemented real per-conversation handoff:

- **Schema:** `conversations.handoff_active` (bool) + `handoff_at`
  (timestamp), added via the existing idempotent `ALTER TABLE ADD COLUMN
  IF NOT EXISTS` pattern.
- **Backend:** sending a manual reply now automatically sets
  `handoff_active = true` for that conversation (`inbox.ts`). New
  `POST /api/conversations/:id/handoff { active }` lets a rep explicitly
  hand a chat back to Nia (or take it over without sending a message
  first). `lead.service.ts::runConversationalAgent` now checks
  `conv.handoff_active` before sending Nia's reply — the lead's
  qualification/score/Bitrix sync still updates every turn either way
  (that data stays valuable to the rep), only the *auto-reply message* is
  suppressed while a human is handling the chat.
- **Message attribution:** `messages.sender` gained a `'human'` value
  distinct from `'agent'` (Nia) — a manual reply now records as `'human'`
  instead of silently reusing `'agent'`. The inbox UI shows "Sales rep" vs.
  "Nia · AI assistant" on each outbound bubble, an amber "Human handling
  this chat" banner with a "Resume AI" button while handed off, and a
  small "Human" badge in the conversation list for quick scanning.
- The footer hint under the manual-reply box now reflects handoff state
  instead of a static line.

**Verification (real Postgres, real DeepSeek):** message 1 to a fresh
contact got a normal Nia auto-reply (`handoff_active: false`). Simulated a
rep taking over — `handoff_active` flipped to `true`. Message 2 from the
same customer produced **zero** additional Nia replies (auto-reply message
count stayed unchanged) while qualification/collected-profile data still
updated normally. Explicitly resumed (`handoff_active: false`) and message
3 correctly got a fresh Nia auto-reply again (message count incremented).

Test artifacts (fake Bitrix/WhatsApp servers, test Postgres role/db)
removed after verification for all three phases.

### Bug fix — Export to Excel button on the leads page (✅ done, 2026-08-16)
User-reported: clicking "Export to Excel" on `/leads` did nothing. Two real
bugs in `exportLeadsToExcel()`:

1. The "Score" column used `(l.score ?? '') as string` — `as string` is a
   compile-time-only TypeScript assertion, it does not convert the value
   at runtime. `l.score` is a `number`, so `csvCell()` then called
   `.replace()` on an actual number primitive — numbers don't have that
   method, so it threw an uncaught `TypeError` immediately, before ever
   reaching the download code. Since virtually every real lead has a
   non-null score, this broke the export for almost every lead in the
   system, with zero visible error to the user (just a console exception
   nobody was looking at). Fixed with a real `String()` conversion.
2. `URL.revokeObjectURL(url)` was called synchronously in the same tick as
   `a.click()` — a well-documented race in several browsers (Firefox
   especially) where revoking the object URL can beat the browser to
   actually starting the download, silently failing it with no error.
   Deferred the cleanup (`removeChild` + `revokeObjectURL`) with
   `setTimeout` so the download has a chance to start first.

Verified with a Node-side smoke test (minimal `document`/`Blob`/`URL`
stubs) using a realistic lead with a numeric score: the bug's failure mode
is proven directly by JS type semantics (numbers have no `.replace`), and
the fixed version completes without throwing, clicks the anchor, and
defers cleanup correctly.

### Phase 8 — Management visibility / real-data analytics (✅ done, verified live, 2026-08-16)
The dashboard's only management-facing numbers were 4 today-only snapshot
tiles (`MetricsRow`). Built a dedicated `/analytics` page with real,
live-computed aggregates — nothing mocked:

- **Backend:** new `getAnalytics(days)` in `leads.repo.ts` — one
  `Promise.all` of 6 SQL aggregate queries (totals + conversion rate +
  avg score + Bitrix sync breakdown; daily lead volume via
  `generate_series` so zero-lead days show as real gaps, not skipped
  dates; qualification breakdown; top-8 product breakdown; credit-risk
  distribution; channel breakdown). New `GET /api/analytics?days=` route
  (default 14, capped at 90).
- **Frontend:** new `/analytics` page + `Analytics` nav item. Stat tiles
  (total leads, conversion rate, avg score, synced-to-CRM, plus the
  qualified/follow-up/unqualified split) and 4 charts: a daily-volume bar
  chart with a hover tooltip, and three ranked horizontal breakdown bars
  (qualification, credit risk, top products, channel). No new charting
  dependency — hand-rolled SVG/Tailwind bars, consistent with the rest of
  the app's existing hand-rolled components. Followed the dataviz skill's
  core rules: single hue for magnitude-only series (daily volume, product,
  channel), the app's already-established status colors reused (not
  reinvented) for the two genuinely-categorical breakdowns (qualification,
  credit risk) with every row direct-labeled by name so identity never
  depends on color alone, one axis only, thin/rounded bars with spacers,
  hover tooltip on the time-series chart.
- Every failed-Bitrix-sync count surfaces a visible warning banner on the
  page itself, not just a number to notice.

**Verification:** seeded 6 leads with known, hand-picked values (3
qualified/2 needs-follow-up/1 unqualified; scores 85/72/55/20/45/90; mixed
credit risk; 2 products; whatsapp+facebook channels; synced/pending/failed
Bitrix statuses) directly into a real Postgres instance and asserted every
computed number against hand-calculated expected values — total leads,
conversion rate (50%), average score (61, correctly rounded), Bitrix
synced/pending/failed counts, per-product and per-channel counts, and the
daily-volume series' zero-filled gap days — all correct. Then verified the
real HTTP route and the actual page's server-rendered HTML against the
same seeded data (all stat tiles, chart section headers, and figures
present and correct), plus a regression check that `/leads`, `/`, and
`/inbox` still render cleanly. `tsc` and `npm run build` clean throughout.
Test artifacts (seeded rows, test Postgres role/db) removed after
verification.
