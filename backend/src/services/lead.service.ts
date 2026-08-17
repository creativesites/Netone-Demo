/**
 * Lead pipeline orchestrator.
 *
 *   inbound message → dedup → inbox (conversation + message) → AI GATEKEEPER
 *      ├─ not a lead  → stays in inbox only (no CRM, no auto-reply)
 *      └─ is a lead   → intelligence → qualification → Postgres → Bitrix24 (real)
 *                        → conversational agent (auto-reply + collect profile)
 *                        → enrich Bitrix when profile completes
 *
 * Every meaningful change is (a) persisted to Postgres, (b) mirrored to Firestore
 * for real-time UI, and (c) published on the in-process SSE bus (legacy fallback).
 */
import { randomUUID } from 'node:crypto';
import { bus } from '../events/bus.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { CollectedProfile, NormalizedLeadEvent, PipelineStep, Lead, LeadAnalysis, PurchaseIntent } from '../types.js';
import { classifyLead, converse } from './ai.service.js';
import { qualify } from './qualification.service.js';
import { computeDiscovery } from './discovery.service.js';
import { bitrix24Adapter } from '../adapters/crm/bitrix24.adapter.js';
import { getSettings, getQualificationRules } from '../db/settings.repo.js';
import {
  claimMessage,
  findLead,
  getLeadById,
  upsertLead,
  updateBitrix,
  updateCollected,
  updateQualification,
  recordEvent,
  getLeadEvents,
  getMetrics,
  listRecentLeads,
} from '../db/leads.repo.js';
import {
  upsertConversation,
  addMessage,
  updateConversationMeta,
  getRecentMessages,
  type Conversation,
} from '../db/conversations.repo.js';
import {
  mirrorConversation,
  mirrorMessage,
  mirrorLead,
  mirrorMetrics,
  mirrorPipelineStep,
  mirrorPipelineMeta,
} from '../firebase.js';

const STEP_DELAY_MS = Number(process.env.PIPELINE_STEP_DELAY_MS ?? 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Each pipeline step is deliberately paced (STEP_DELAY_MS) for the live demo
// animation, so a single message's full run can take several seconds end to
// end. A real customer sending two messages seconds apart — completely
// normal WhatsApp behavior — would otherwise let two processEvent() calls
// for the SAME contact run concurrently. Both would read the lead's
// bitrix_lead_id as still-null before either finished, and both would call
// crm.lead.add — a real, live-reproducible duplicate-Bitrix-lead bug, not
// just a theoretical one. Serializing by (channel, contact) forces the
// second message to wait for the first to fully land before it starts,
// closing the race without slowing down unrelated contacts at all.
const contactQueues = new Map<string, Promise<unknown>>();

function serializeByContact<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const tail = contactQueues.get(key) ?? Promise.resolve();
  const settled = tail.then(fn, fn);
  const marker = settled.then(
    () => undefined,
    () => undefined
  );
  contactQueues.set(key, marker);
  marker.finally(() => {
    if (contactQueues.get(key) === marker) contactQueues.delete(key);
  });
  return settled;
}

export async function processEvent(event: NormalizedLeadEvent): Promise<void> {
  return serializeByContact(`${event.channel}:${event.externalContactId}`, () => processEventInner(event));
}

async function processEventInner(event: NormalizedLeadEvent): Promise<void> {
  const correlationId = randomUUID();

  // ── 0. Dedup guard ─────────────────────────────────────
  if (!(await claimMessage(event.channel, event.externalMessageId))) {
    logger.info({ id: event.externalMessageId }, 'Duplicate message ignored');
    return;
  }

  // ── 1. Inbox: record conversation + inbound message ────
  // The exact channel-native address to reply to (e.g. a WhatsApp JID) — not
  // always a dialable phone number (WhatsApp LID privacy identifiers), so it
  // must be preserved verbatim rather than reconstructed from the phone field.
  const rawReplyAddress = typeof event.metadata?.remoteJid === 'string' ? event.metadata.remoteJid : null;
  let conv = await upsertConversation(event.channel, event.externalContactId, event.name, event.phone, rawReplyAddress);
  const inbound = await addMessage(conv.id, 'inbound', 'contact', event.message, event.externalMessageId);
  conv = { ...conv, last_message: event.message, last_direction: 'inbound', unread_count: conv.unread_count + 1 };
  await mirrorConversation(conv as unknown as Record<string, unknown>);
  await mirrorMessage(conv.id, inbound as unknown as Record<string, unknown>);

  // Announce the incoming event to the live dashboard.
  await mirrorPipelineMeta(correlationId, {
    correlationId,
    conversationId: conv.id,
    channel: event.channel,
    contact: { name: event.name, phone: event.phone },
    message: event.message,
    receivedAt: event.timestamp,
  });
  bus.publish({
    type: 'pipeline',
    data: {
      correlationId,
      conversationId: conv.id,
      channel: event.channel,
      contact: { name: event.name, phone: event.phone },
      message: event.message,
      receivedAt: event.timestamp,
      step: mkStep('message_received', 'Message received', 'ok', `via ${event.channel}`),
    },
  });
  await mirrorPipelineStep(correlationId, mkStep('message_received', 'Message received', 'ok', `via ${event.channel}`) as unknown as Record<string, unknown>);

  let leadId: number | null = null;
  try {
    await step(correlationId, 'contact_identified', 'Contact identified', 'ok', event.phone ?? '');

    // ── 2. Existing vs new ────────────────────────────────
    // Looked up BEFORE the gatekeeper on purpose: the gatekeeper classifies
    // this one message in complete isolation (no conversation history), so a
    // terse mid-conversation reply like "K4500" or "Lusaka" can easily score
    // isLead:false with nothing to contradict it. A contact who already has
    // an open lead must never be silently un-classified back to "not a lead"
    // by a single ambiguous follow-up — that would kill the conversation
    // (and the credit-worthiness flow this demo is built around) mid-flight.
    const existing = await findLead(event.channel, event.externalContactId);

    // ── 3. AI GATEKEEPER ─────────────────────────────────
    const { analysis: rawAnalysis, degraded } = await classifyLead(event.message, event.name);

    // Purchase intent, financing interest, and product must never regress
    // within an existing lead's conversation. classifyLead() reads only THIS
    // message with zero history, so a neutral reply (e.g. declining to share
    // a location, or "8600" with no product word in it) would otherwise read
    // as low-intent / product-less and silently overwrite real signal shown
    // earlier — tanking the score (and, for product, the "product identified"
    // criterion) and flipping the real Bitrix STATUS_ID to JUNK on an
    // actively-qualifying lead.
    const analysis: LeadAnalysis = existing
      ? {
          ...rawAnalysis,
          product: rawAnalysis.product ?? existing.product,
          purchaseIntent: maxPurchaseIntent(existing.purchase_intent, rawAnalysis.purchaseIntent),
          financingInterest: existing.financing_interest === true || rawAnalysis.financingInterest,
        }
      : rawAnalysis;

    if (!analysis.isLead && !existing) {
      await updateConversationMeta(conv.id, {
        is_lead: false,
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        ai_priority: 'low',
      });
      const filtered = await refreshConversation(conv.id);
      await mirrorConversation(filtered as unknown as Record<string, unknown>);
      await step(
        correlationId,
        'not_a_lead',
        'Filtered — not a sales lead',
        'info',
        `${analysis.intent} · kept in inbox only`
      );
      await mirrorPipelineMeta(correlationId, { outcome: 'filtered', isLead: false });
      await emitMetrics();
      logger.info({ conversationId: conv.id, intent: analysis.intent }, 'Non-lead message filtered');
      return;
    }

    await step(
      correlationId,
      'lead_detected',
      'Lead detected',
      'ok',
      degraded ? 'gatekeeper (fallback)' : `${analysis.intent}`
    );

    await step(
      correlationId,
      existing ? 'existing_lead' : 'new_lead_detected',
      existing ? 'Existing lead matched' : 'New lead detected',
      'ok'
    );

    await step(
      correlationId,
      'ai_analysis',
      degraded ? 'AI unavailable — deterministic fallback' : 'AI analysis completed',
      degraded ? 'info' : 'ok',
      degraded ? 'fallback' : `${analysis.intent} · ${analysis.purchaseIntent} intent`
    );

    // ── 4. Qualification & scoring (deterministic, configurable) ─
    // Score against what we already know: the existing collected profile, or a
    // fresh seed built from this first message, so the score is never computed
    // against empty data for a brand-new lead.
    // NOTE: collected.product is deliberately left null here even when the
    // gatekeeper found a generic mention (e.g. "laptop"). analysis.product is
    // a loose single-message read, not a confirmed specific product — seeding
    // it into collected.product would make missingFields() think "product"
    // is already answered, so the conversational agent would never bother
    // suggesting/confirming an actual model. The generic value still reaches
    // the lead card immediately via the top-level `product` column (set
    // below from analysis.product); collected.product stays the source of
    // truth for a real, customer-confirmed selection.
    const seedCollected: CollectedProfile = existing
      ? existing.collected
      : {
          name: event.name ?? null,
          product: null,
          financing: analysis.financingInterest ? 'interested' : null,
          budget: null,
          location: null,
          employment: null,
          monthlyIncome: null,
        };
    const rules = await getQualificationRules();
    const discovery = computeDiscovery(rules.fields, seedCollected);
    const qual = qualify(
      analysis,
      seedCollected,
      !!event.phone,
      rules,
      discovery.completionPercentage,
      existing?.converted_at ?? null
    );

    // ── 5. Persist lead ──────────────────────────────────
    let lead = await upsertLead(event, analysis, qual);
    leadId = lead.id;

    // Seed collected profile from what we already know (first message only).
    if (!existing) {
      lead = await updateCollected(lead.id, seedCollected, false);
    }

    await updateConversationMeta(conv.id, {
      is_lead: true,
      lead_id: lead.id,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      ai_priority: analysis.purchaseIntent,
    });
    conv = await refreshConversation(conv.id);
    await mirrorConversation(conv as unknown as Record<string, unknown>);

    await recordEvent(leadId, 'lead_persisted', 'ok', { analysis });
    await step(correlationId, 'lead_created', existing ? 'Lead updated' : 'Lead created', 'ok', `#${lead.id}`, leadId);
    await mirrorLead(lead as unknown as Record<string, unknown>);
    await emitLead(leadId, correlationId, lead);
    await emitMetrics();

    // ── 6. Bitrix24 CRM (create first time, enrich after) ─
    if (bitrix24Adapter.isConfigured()) {
      if (lead.bitrix_lead_id) {
        const ok = await bitrix24Adapter.updateLead(lead.bitrix_lead_id, lead, analysis);
        await step(
          correlationId,
          ok ? 'bitrix_updated' : 'bitrix_failed',
          ok ? 'Bitrix24 lead enriched' : 'Bitrix24 update failed',
          ok ? 'ok' : 'error',
          ok ? `Lead #${lead.bitrix_lead_id}` : 'retry pending',
          leadId
        );
      } else {
        const result = await bitrix24Adapter.createLead(lead, analysis);
        lead = await updateBitrix(leadId, result.status, result.crmLeadId ?? null);
        await recordEvent(leadId, 'bitrix_sync', result.ok ? 'ok' : 'error', {
          crmLeadId: result.crmLeadId,
          error: result.error,
        });
        await step(
          correlationId,
          result.ok ? 'bitrix_synced' : 'bitrix_failed',
          result.ok ? 'Bitrix24 synchronized' : 'Bitrix24 sync failed',
          result.ok ? 'ok' : 'error',
          result.ok ? `Lead #${result.crmLeadId}` : `${truncate(result.error ?? 'error')} — retry pending`,
          leadId
        );
      }
      await mirrorLead(lead as unknown as Record<string, unknown>);
      await emitLead(leadId, correlationId, lead);
      await emitMetrics();
    } else {
      await step(correlationId, 'bitrix_skipped', 'Bitrix24 not configured', 'info', 'set BITRIX24_WEBHOOK_URL', leadId);
    }

    await step(
      correlationId,
      'qualification_completed',
      'Qualification completed',
      'ok',
      qual.qualification.replace(/_/g, ' '),
      leadId
    );
    await step(
      correlationId,
      'follow_up_created',
      'Sales follow-up created',
      'ok',
      `${qual.assignedTo} · ${qual.nextAction}`,
      leadId
    );

    // ── 7. Conversational agent (auto-reply + collect) ───
    await runConversationalAgent(correlationId, conv, lead, analysis);

    logger.info({ leadId, correlationId }, 'Pipeline complete');
  } catch (err) {
    logger.error({ err: String(err), correlationId }, 'Pipeline error');
    await step(correlationId, 'pipeline_error', 'Processing error', 'error', truncate(String(err)), leadId);
    if (leadId) await recordEvent(leadId, 'pipeline_error', 'error', { error: String(err) });
  }
}

// ── Conversational agent ────────────────────────────────────
async function runConversationalAgent(
  correlationId: string,
  conv: Conversation,
  lead: Lead,
  analysis: import('../types.js').LeadAnalysis
): Promise<void> {
  const settings = await getSettings();

  const recent = await getRecentMessages(conv.id, 12);
  const historyLines = recent
    .map((m) => `${m.direction === 'inbound' ? 'Prospect' : 'Nia'}: ${m.body}`)
    .join('\n');

  const rules = await getQualificationRules();
  const { turn } = await converse(historyLines, lead.collected, lead.collected.name ?? conv.contact_name, rules.fields);
  let updatedLead = await updateCollected(lead.id, turn.collected, turn.complete);

  // Re-score now that the conversation collected more of the profile — the
  // lead's score/qualification should visibly improve as fields fill in.
  const discovery = computeDiscovery(rules.fields, turn.collected);
  const qual = qualify(
    analysis,
    turn.collected,
    !!(conv.phone || conv.raw_reply_address),
    rules,
    discovery.completionPercentage,
    lead.converted_at ?? null
  );
  updatedLead = await updateQualification(lead.id, qual);
  await step(
    correlationId,
    'qualification_updated',
    'Qualification re-scored',
    'ok',
    `${qual.score}/100 · ${qual.qualification.replace(/_/g, ' ')}`,
    lead.id
  );
  await mirrorLead(updatedLead as unknown as Record<string, unknown>);

  // Keep Bitrix in sync with the freshest qualification/profile after EVERY
  // turn, not just once the whole profile is complete — otherwise Bitrix
  // lags a full turn behind what the dashboard already shows (a customer's
  // 2nd-to-last message could leave Bitrix on a stale, lower score/status
  // until the conversation fully wraps up). Runs regardless of the
  // auto-reply toggle: the CRM record should stay accurate even if we
  // chose not to also message the customer this turn.
  if (bitrix24Adapter.isConfigured() && updatedLead.bitrix_lead_id) {
    const ok = await bitrix24Adapter.updateLead(updatedLead.bitrix_lead_id, updatedLead, analysis);
    await step(
      correlationId,
      turn.complete ? 'profile_complete' : 'bitrix_enriched',
      turn.complete ? 'Lead profile complete' : 'Bitrix24 lead enriched',
      ok ? 'ok' : 'info',
      turn.complete ? 'all details collected · Bitrix24 enriched' : `${qual.score}/100 · Bitrix24 updated`,
      lead.id
    );
  }

  if (conv.handoff_active) {
    // A human agent already took over this conversation (sent a manual
    // reply) — the lead/qualification/Bitrix data above is still kept
    // current, but Nia must not also message the customer until a rep
    // explicitly hands it back. Two AI+human replies to the same message
    // would confuse the customer and undercut whatever the rep just said.
    await step(correlationId, 'auto_reply_skipped', 'Human agent handling — Nia paused for this chat', 'info', 'resume from the inbox', lead.id);
    await emitLead(lead.id, correlationId, updatedLead);
    return;
  }

  if (!settings.autoReplyEnabled) {
    await step(correlationId, 'auto_reply_skipped', 'Auto-reply off — reply not sent', 'info', 'toggle enabled in dashboard', lead.id);
    await emitLead(lead.id, correlationId, updatedLead);
    return;
  }

  // Send the reply over WhatsApp (best-effort) and record it in the inbox.
  // raw_reply_address (the exact JID) takes priority over phone — replying by
  // reconstructing a JID from a phone number fails for LID-identified contacts.
  const sent = await sendWhatsapp(conv.raw_reply_address ?? conv.phone ?? conv.external_contact_id, turn.reply);
  const outbound = await addMessage(conv.id, 'outbound', 'agent', turn.reply, null, sent ? 'sent' : 'failed');
  const refreshed = await refreshConversation(conv.id);
  await mirrorMessage(conv.id, outbound as unknown as Record<string, unknown>);
  await mirrorConversation(refreshed as unknown as Record<string, unknown>);
  await step(
    correlationId,
    'auto_reply_sent',
    sent ? 'Assistant replied' : 'Reply failed to send — WhatsApp unreachable',
    sent ? 'ok' : 'error',
    truncate(turn.reply, 60),
    lead.id
  );

  await emitLead(lead.id, correlationId, updatedLead);
}

// ── helpers ────────────────────────────────────────────────
const INTENT_RANK: Record<PurchaseIntent, number> = { low: 0, medium: 1, high: 2 };

/** Never let a fresh single-message read walk purchase intent back down. */
function maxPurchaseIntent(existing: PurchaseIntent | null, fresh: PurchaseIntent): PurchaseIntent {
  if (!existing) return fresh;
  return INTENT_RANK[existing] >= INTENT_RANK[fresh] ? existing : fresh;
}

function mkStep(key: string, label: string, status: PipelineStep['status'], detail?: string): PipelineStep {
  return { key, label, status, detail, at: new Date().toISOString() };
}

async function step(
  correlationId: string,
  key: string,
  label: string,
  status: PipelineStep['status'],
  detail?: string,
  leadId?: number | null
): Promise<void> {
  const s = mkStep(key, label, status, detail);
  if (leadId) await recordEvent(leadId, key, status === 'pending' ? 'info' : status, { label, detail });
  bus.publish({ type: 'pipeline', data: { correlationId, leadId: leadId ?? null, step: s } });
  await mirrorPipelineStep(correlationId, s as unknown as Record<string, unknown>);
  await sleep(STEP_DELAY_MS);
}

async function refreshConversation(id: number): Promise<Conversation> {
  const { getConversation } = await import('../db/conversations.repo.js');
  const c = await getConversation(id);
  return c as Conversation;
}

async function emitLead(leadId: number, correlationId: string, lead?: Lead): Promise<void> {
  const events = await getLeadEvents(leadId);
  const record = lead ?? (await getLeadById(leadId));
  bus.publish({ type: 'lead', data: { correlationId, lead: record, events } });
  if (record) await mirrorLead({ ...(record as unknown as Record<string, unknown>), events });
}

async function emitMetrics(): Promise<void> {
  const [metrics, recent] = await Promise.all([getMetrics(), listRecentLeads(20)]);
  bus.publish({ type: 'metrics', data: { metrics, recent } });
  await mirrorMetrics({ ...metrics, recent });
}

function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

async function sendWhatsapp(recipient: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.whatsappServiceUrl.replace(/\/+$/, '')}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ recipient, status: res.status, body: truncate(body, 200) }, 'WhatsApp send rejected');
    }
    return res.ok;
  } catch (err) {
    logger.warn({ err: String(err) }, 'WhatsApp send failed (service offline?)');
    return false;
  }
}
