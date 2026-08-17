/**
 * AI intelligence service.
 *
 *   classifyLead()  — gatekeeper + intelligence. Decides whether an inbound
 *                     message is a sales lead and extracts structured info.
 *   converse()      — conversational agent. Produces the next friendly, natural
 *                     reply AND the updated collected profile.
 *
 * Strategy: DeepSeek (primary) → Gemini (fallback) → deterministic (last resort,
 * so the demo never dies). All model output is validated with Zod before use.
 * The LLM only describes / drafts; the backend decides what actions happen.
 */
import { z } from 'zod';
import { config, flags } from '../config.js';
import { logger } from '../logger.js';
import type { AgentTurn, CollectedProfile, LeadAnalysis } from '../types.js';
import { isDeclinedAnswer } from './qualification.service.js';
import { computeDiscovery } from './discovery.service.js';
import { DEFAULT_QUALIFICATION_FIELDS, EMPLOYMENT_TYPE_OPTIONS, deriveProvinceFromCity, type QualificationField } from './fields.service.js';
import { getKnowledgeContext, listProducts } from '../db/kb.repo.js';

// Models sometimes return numbers (e.g. budget: 8000) where we want a string.
// Coerce number → string, keep null/undefined as null.
const nullableString = z.preprocess(
  (v) => (v === null || v === undefined ? null : typeof v === 'number' ? String(v) : v),
  z.string().nullable()
);

// ── Classification (gatekeeper + intelligence) ────────────────
const analysisSchema = z.object({
  intent: z.enum([
    'product_inquiry',
    'financing_inquiry',
    'support',
    'complaint',
    'general',
    'unknown',
  ]),
  isLead: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  product: nullableString,
  financingInterest: z.boolean(),
  purchaseIntent: z.enum(['low', 'medium', 'high']),
  qualification: z.enum(['qualified', 'needs_follow_up', 'unqualified']),
  reasoning: z.string(),
  summary: z.string(),
});

const CLASSIFY_PROMPT = `You are the lead-qualification gatekeeper for NetOne Zambia, which sells locally manufactured laptops and technology products, including on financing.

Decide whether an incoming WhatsApp message is a SALES LEAD (a prospect interested in buying / financing / pricing a product) versus noise (greetings only, spam, wrong numbers, existing-order support, complaints, general chit-chat).

Return ONLY a JSON object with these exact fields:
- "intent": "product_inquiry" | "financing_inquiry" | "support" | "complaint" | "general" | "unknown"
- "isLead": true only if this is a genuine sales opportunity worth routing to sales
- "sentiment": "positive" | "neutral" | "negative"
- "product": specific product mentioned (e.g. "laptop") or null
- "financingInterest": true if financing / installments / credit / paying over time is mentioned or implied
- "purchaseIntent": "low" | "medium" | "high"
- "qualification": "qualified" | "needs_follow_up" | "unqualified"
- "reasoning": one short sentence
- "summary": one professional sentence for a sales rep

Return strictly valid JSON. No markdown, no commentary.`;

function coerceAnalysis(raw: unknown, aiSource: LeadAnalysis['aiSource']): LeadAnalysis {
  return { ...analysisSchema.parse(raw), aiSource };
}

// ── Conversational agent ──────────────────────────────────────
// The set of CollectedProfile keys the AI is ever allowed to fill directly —
// fixed regardless of what the Rules page reconfigures (required/order/
// question text change; the key set doesn't). Keeping the Zod schema's
// shape static (not built dynamically per-registry) avoids the class of
// runtime-schema bug this session already fixed once elsewhere — 'derived'
// and 'manual' fields are deliberately excluded here, so the AI can never
// set a value that's supposed to come from deterministic code or a rep.
const AI_FIELD_KEYS = DEFAULT_QUALIFICATION_FIELDS.filter((f) => f.source === 'ai').map((f) => f.key);

const purchaseMethodSchema = z.preprocess(
  (v) => (v === 'cash' || v === 'financing' || v === 'unsure' ? v : null),
  z.enum(['cash', 'financing', 'unsure']).nullable()
);

const agentSchema = z.object({
  reply: z.string().min(1),
  collected: z.object({
    // Legacy free-text fields — kept exactly as before for backward compat
    // (older leads, and as a fallback the qualification engine still reads).
    name: nullableString,
    product: nullableString,
    financing: nullableString,
    budget: nullableString,
    location: nullableString,
    employment: nullableString,
    monthlyIncome: nullableString,
    // Structured Zambia-specific fields (sample/demo registry — see
    // fields.service.ts). Nullable/optional so a provider that omits one
    // (or a customer who hasn't given it) never breaks validation.
    email: nullableString.optional(),
    purchaseMethod: purchaseMethodSchema.optional(),
    city: nullableString.optional(),
    district: nullableString.optional(),
    area: nullableString.optional(),
    employmentType: nullableString.optional(),
    employerName: nullableString.optional(),
    jobTitle: nullableString.optional(),
    employmentDuration: nullableString.optional(),
    incomeSource: nullableString.optional(),
    preferredRepaymentPeriod: nullableString.optional(),
    depositAvailable: nullableString.optional(),
  }),
  // Ignored downstream in favor of a code-computed value (missingFields()
  // after merge, below) — deterministic code decides "complete", not the
  // model — so it's optional here rather than a validation trip hazard for
  // a value we discard anyway.
  complete: z.boolean().optional(),
});

const AGENT_PROMPT = `You are "Nia", a warm, friendly and professional sales assistant for NetOne Zambia (locally made laptops & tech, available on financing through partner lenders).

You are chatting with a prospect on WhatsApp. Your goals, in order:
1. Be genuinely helpful, natural and concise — like a real Zambian sales rep. 1–3 short sentences, WhatsApp tone. You may use at most one tasteful emoji.
2. Naturally collect whatever appears in the "Still missing" list below (given per turn), one at a time, in the order given — that list already reflects NetOne's current qualification requirements, so don't invent extra questions or skip ones it includes. Each entry gives you a suggested phrasing hint; use it as guidance, not a script to read verbatim.
3. Financing/employment/income questions only ever appear in "Still missing" once the prospect has actually said they want financing — you will never be asked to collect them for a cash purchase, so you never need to guess. When you do ask about employment, capture their own words in "employment" AND classify it into the closest listed employmentType token (given in that entry's hint) — don't force a category if genuinely unclear, but do your best; explain briefly this is to check financing eligibility with our partner lenders — be tactful, this is sensitive.
4. Never ask about employment or income if they said they're paying cash.
5. Ask for only ONE missing detail per message so it feels like a conversation, not a form. Acknowledge what they just said first. Before you ask anything, re-check the "Already collected" list below — never ask for something that's already there, even in a different form (e.g. if a name is already known, don't ask "what's your name" again just because they haven't said it in this exact message).
6. When "Still missing" is empty, warmly confirm a NetOne sales rep will follow up shortly, and set complete=true.
7. If asked about specific products, prices or specs, answer ONLY from the KNOWLEDGE BASE section provided below. If something isn't in it, say a sales rep will confirm — never invent a price or spec.

NEVER ASSUME — SUGGEST, DON'T DECIDE:
When something they said (like a budget) points at a specific product, mention it as an option, not a done deal — e.g. "that budget could work well for our NEO Lite 14a — want to go with that, or see other options?", never "that budget fits our X!" as if it's settled. Do NOT write a product into "collected.product" just because it matches their budget with no reaction from them at all.
Once you've suggested one specific product BY NAME, though, watch for a real customer response and record it accurately — a real person rarely repeats the exact model name back to you. Treat any of these as a genuine selection of that product, and write it into "collected.product":
- they name or reference it themselves (even loosely, e.g. "the lite one", "that one");
- they say something affirmative in direct reply to your suggestion ("yes", "sure", "let's do that", "ok", "sounds good");
- they keep engaging specifically about that product — asking its price, financing terms, specs, or delivery for it, or answering the next question you asked about it (financing choice, employment, budget confirmation) — without asking for alternatives.
Only leave "collected.product" null if they haven't reacted to a suggestion yet, are still comparing options, or explicitly asked to see something else. The same "record what they actually communicated, not what you inferred" rule applies to financing, budget, and every other field — the difference is that continuing to engage with something you already named IS them communicating it, silence with no suggestion on the table is not.

WHEN SOMEONE DECLINES TO ANSWER:
People are allowed to not answer — handle it with grace, never push or repeat the same question. If they decline, deflect, seem uncomfortable, or say something like "I'd rather not say" / "why do you need that" / change the subject:
- Acknowledge it warmly and immediately drop that question — no guilt-tripping, no repeating it later in different words.
- If you haven't already explained why you're asking (e.g. employment/income is for financing eligibility with our partner lenders), briefly explain once — that alone sometimes resolves it. If they still decline, respect it.
- Record a short honest note in that field instead of leaving it blank forever (e.g. "prefers not to share") so we don't keep circling back to it, then move on to whatever else is still missing, or proceed to handoff if enough is known.
- If they decline something financing-related, you can gently note a sales rep can go over financing details directly on a call instead — never insist.

MATCH THEIR ENERGY, STAY YOURSELF:
Read how this specific person writes — formal or casual, terse or chatty, lots of emoji or none, proper grammar or relaxed WhatsApp shorthand — and let your own reply lean naturally toward that register, the way a good real salesperson unconsciously mirrors whoever they're talking to. Don't imitate them or copy their exact phrases, and don't overdo it — you're still recognizably Nia: warm, professional, on-brand. A terse customer gets tighter replies with less small talk; a chatty, emoji-heavy customer gets a bit more warmth back. If unsure, default to a friendly, moderately warm tone.

You are given NetOne's knowledge base, the conversation so far, the details already collected, and the "Still missing" list. Return ONLY a JSON object:
- "reply": the next message to send the prospect
- "collected": { "name", "product", "financing", "purchaseMethod", "budget", "location", "city", "district", "area", "employment", "employmentType", "employerName", "jobTitle", "employmentDuration", "monthlyIncome", "incomeSource", "preferredRepaymentPeriod", "depositAvailable", "email" } — carry forward known values, fill in anything new the customer themselves actually stated in the latest message, use null when still unknown or not applicable. Only include a field if you have something to say about it — omit ones you have nothing new for.
- "complete": true only once "Still missing" is empty and you've confirmed follow-up

Return strictly valid JSON. No markdown.`;

/** True once the field registry says nothing required is still missing (see
 *  discovery.service.ts::computeDiscovery — the same read the Discovery
 *  panel and analytics use, so the conversation never disagrees with them
 *  about what's left to collect). Only 'ai'-source fields are ever surfaced
 *  here — 'derived'/'manual' fields are never something Nia should ask for. */
function missingFields(fields: QualificationField[], c: CollectedProfile): QualificationField[] {
  return computeDiscovery(fields, c).missing.filter((f) => f.source === 'ai');
}

function fieldHint(field: QualificationField): string {
  if (field.key === 'employmentType') {
    const tokens = EMPLOYMENT_TYPE_OPTIONS.map((o) => o.value).join(', ');
    return `${field.question} (classify into one of: ${tokens})`;
  }
  if (field.options?.length) return `${field.question} (one of: ${field.options.join(', ')})`;
  return field.question;
}

function stillMissingBlock(fields: QualificationField[], c: CollectedProfile): string {
  const missing = missingFields(fields, c);
  if (missing.length === 0) return '(none — every required detail is collected)';
  return missing.map((f) => `- ${f.key}: ${fieldHint(f)}`).join('\n');
}

// ── Provider calls ────────────────────────────────────────────
async function deepseekJson(system: string, user: string): Promise<any> {
  const { apiKey, baseUrl, model } = config.ai.deepseek;
  const res = await fetchJson(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  return JSON.parse(res?.choices?.[0]?.message?.content);
}

async function geminiJson(system: string, user: string): Promise<any> {
  const { apiKey, model } = config.ai.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
  });
  return JSON.parse(res?.candidates?.[0]?.content?.parts?.[0]?.text);
}

/** Try providers in order; returns the parsed JSON and which provider answered. */
async function callJson(
  system: string,
  user: string
): Promise<{ json: any; source: 'deepseek' | 'gemini' } | null> {
  const order =
    config.ai.provider === 'gemini' ? (['gemini', 'deepseek'] as const) : (['deepseek', 'gemini'] as const);
  for (const p of order) {
    try {
      if (p === 'deepseek' && flags.hasDeepseek) return { json: await deepseekJson(system, user), source: 'deepseek' };
      if (p === 'gemini' && flags.hasGemini) return { json: await geminiJson(system, user), source: 'gemini' };
    } catch (err) {
      logger.warn({ provider: p, err: String(err) }, 'AI provider failed, trying next');
    }
  }
  return null;
}

// ── Deterministic fallback (no external calls) ────────────────
function classifyDeterministic(message: string): LeadAnalysis {
  const t = message.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  const financingInterest = has('financ', 'installment', 'instalment', 'credit', 'loan', 'monthly', 'deposit', 'lipa');
  const product = has('laptop') ? 'laptop' : has('phone', 'tablet', 'device', 'computer') ? 'device' : null;
  const buying = has('buy', 'purchase', 'get', 'interested', 'want', 'order', 'price', 'cost', 'how much');
  const isComplaint = has('complaint', 'broken', 'refund', 'faulty', 'angry', 'not working');
  const isSupport = has('help', 'support', 'issue', 'problem', 'repair');
  let intent: LeadAnalysis['intent'] = 'general';
  if (isComplaint) intent = 'complaint';
  else if (financingInterest && !product) intent = 'financing_inquiry';
  else if (product) intent = 'product_inquiry';
  else if (isSupport) intent = 'support';
  const purchaseIntent: LeadAnalysis['purchaseIntent'] = product && buying ? 'high' : product || buying ? 'medium' : 'low';
  const isLead = !!product || (financingInterest && buying) || (intent === 'product_inquiry' || intent === 'financing_inquiry');
  return {
    intent,
    isLead,
    sentiment: isComplaint ? 'negative' : 'neutral',
    product,
    financingInterest,
    purchaseIntent,
    qualification: purchaseIntent === 'high' ? 'qualified' : product ? 'needs_follow_up' : 'unqualified',
    reasoning: 'Classified by deterministic keyword rules (AI unavailable).',
    summary: product ? `Customer is interested in a ${product}${financingInterest ? ' with financing' : ''}.` : 'General inbound message; needs manual review.',
    aiSource: 'deterministic',
  };
}

/** True if the customer's most recent message reads like a refusal to answer. */
function isDecline(history: string): boolean {
  const lastProspectLine = history
    .trim()
    .split('\n')
    .filter((l) => l.startsWith('Prospect:'))
    .pop();
  if (!lastProspectLine) return false;
  return isDeclinedAnswer(lastProspectLine.replace(/^Prospect:\s*/, ''));
}

function converseDeterministic(history: string, collected: CollectedProfile, fields: QualificationField[]): AgentTurn {
  // Without real NLU this can't extract meaning from free text, but it can
  // still recognize "no" and move on gracefully instead of repeating the
  // exact same question forever — a customer who declines has still
  // answered, they just didn't give us the value.
  let working = collected;
  if (isDecline(history)) {
    const wasAsking = missingFields(fields, collected)[0];
    if (wasAsking) working = { ...collected, [wasAsking.key]: 'prefers not to share' };
  }

  const missing = missingFields(fields, working);
  if (missing.length === 0) {
    return { reply: 'Thank you! A NetOne sales representative will contact you shortly to finalise everything. 😊', collected: working, complete: true };
  }
  const reply =
    working !== collected
      ? `No problem at all, totally understand. ${missing[0].question}`
      : `Thanks for reaching out to NetOne! ${missing[0].question}`;
  return { reply, collected: working, complete: false };
}

// ── Public API ────────────────────────────────────────────────
export async function classifyLead(
  message: string,
  name: string | null
): Promise<{ analysis: LeadAnalysis; degraded: boolean }> {
  const user = `Customer name: ${name ?? 'Unknown'}\nMessage: "${message}"\n\nReturn the JSON analysis.`;
  const result = await callJson(CLASSIFY_PROMPT, user);
  if (result) {
    try {
      return { analysis: coerceAnalysis(result.json, result.source), degraded: false };
    } catch (err) {
      logger.warn({ err: String(err) }, 'AI classification failed schema validation — falling back');
    }
  }
  return { analysis: classifyDeterministic(message), degraded: true };
}

/** Normalizes the AI's free-text employmentType guess against the known
 *  registry tokens (fields.service.ts::EMPLOYMENT_TYPE_OPTIONS) — an
 *  unmatched guess is dropped rather than stored as a bogus enum value;
 *  resolveEmploymentCategory() in qualification.service.ts still has the
 *  free-text `employment` field to fall back on. */
function normalizeEmploymentType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return EMPLOYMENT_TYPE_OPTIONS.some((o) => o.value === t) ? t : null;
}

/** Derived, never AI-set: the matched knowledge-base product's own category. */
async function deriveProductCategory(productName: string | null): Promise<string | null> {
  if (!productName) return null;
  try {
    const products = await listProducts();
    const lower = productName.toLowerCase();
    const match =
      products.find((p) => p.name.toLowerCase() === lower) ??
      products.find((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower));
    return match?.category ?? null;
  } catch {
    return null;
  }
}

export async function converse(
  historyLines: string,
  collected: CollectedProfile,
  name: string | null,
  fields: QualificationField[] = DEFAULT_QUALIFICATION_FIELDS
): Promise<{ turn: AgentTurn; degraded: boolean }> {
  const knowledge = await getKnowledgeContext().catch(() => '');
  const user = `${knowledge ? `KNOWLEDGE BASE:\n${knowledge}\n\n` : ''}Prospect name (if known): ${name ?? 'Unknown'}
Already collected: ${JSON.stringify(collected)}
Still missing (ask about ONE of these, using the hint as guidance):
${stillMissingBlock(fields, collected)}

Conversation so far:
${historyLines}

Write the next reply and return the JSON.`;
  const result = await callJson(AGENT_PROMPT, user);
  if (result) {
    try {
      const turn = agentSchema.parse(result.json);
      // Never let the model silently drop an already-known field.
      const merged: CollectedProfile = {
        name: turn.collected.name ?? collected.name,
        product: turn.collected.product ?? collected.product,
        financing: turn.collected.financing ?? collected.financing,
        budget: turn.collected.budget ?? collected.budget,
        location: turn.collected.location ?? collected.location,
        employment: turn.collected.employment ?? collected.employment,
        monthlyIncome: turn.collected.monthlyIncome ?? collected.monthlyIncome,
        email: turn.collected.email ?? collected.email ?? null,
        purchaseMethod: turn.collected.purchaseMethod ?? collected.purchaseMethod ?? null,
        city: turn.collected.city ?? collected.city ?? null,
        district: turn.collected.district ?? collected.district ?? null,
        area: turn.collected.area ?? collected.area ?? null,
        employmentType: normalizeEmploymentType(turn.collected.employmentType) ?? collected.employmentType ?? null,
        employerName: turn.collected.employerName ?? collected.employerName ?? null,
        jobTitle: turn.collected.jobTitle ?? collected.jobTitle ?? null,
        employmentDuration: turn.collected.employmentDuration ?? collected.employmentDuration ?? null,
        incomeSource: turn.collected.incomeSource ?? collected.incomeSource ?? null,
        preferredRepaymentPeriod: turn.collected.preferredRepaymentPeriod ?? collected.preferredRepaymentPeriod ?? null,
        depositAvailable: turn.collected.depositAvailable ?? collected.depositAvailable ?? null,
      };
      // Derived fields — deterministic code decides these, never the AI.
      merged.province = deriveProvinceFromCity(merged.city) ?? collected.province ?? null;
      merged.productCategory = (await deriveProductCategory(merged.product)) ?? collected.productCategory ?? null;
      if (merged.monthlyIncome) merged.incomeVerified = collected.incomeVerified ?? 'declared';

      const complete = missingFields(fields, merged).length === 0;
      return { turn: { reply: turn.reply, collected: merged, complete }, degraded: false };
    } catch (err) {
      logger.warn({ err: String(err) }, 'AI agent failed schema validation — falling back');
    }
  }
  return { turn: converseDeterministic(historyLines, collected, fields), degraded: true };
}

// ── low-level fetch with timeout ──────────────────────────────
async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}
