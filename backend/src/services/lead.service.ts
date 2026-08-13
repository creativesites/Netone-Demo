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
import type { CollectedProfile, NormalizedLeadEvent, PipelineStep, Lead } from '../types.js';
import { classifyLead, converse } from './ai.service.js';
import { qualify } from './qualification.service.js';
import { bitrix24Adapter } from '../adapters/crm/bitrix24.adapter.js';
import { getSettings } from '../db/settings.repo.js';
import {
  claimMessage,
  findLead,
  getLeadById,
  upsertLead,
  updateBitrix,
  updateCollected,
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

export async function processEvent(event: NormalizedLeadEvent): Promise<void> {
  const correlationId = randomUUID();

  // ── 0. Dedup guard ─────────────────────────────────────
  if (!(await claimMessage(event.channel, event.externalMessageId))) {
    logger.info({ id: event.externalMessageId }, 'Duplicate message ignored');
    return;
  }

  // ── 1. Inbox: record conversation + inbound message ────
  let conv = await upsertConversation(event.channel, event.externalContactId, event.name, event.phone);
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

    // ── 2. AI GATEKEEPER ─────────────────────────────────
    const { analysis, degraded } = await classifyLead(event.message, event.name);

    if (!analysis.isLead) {
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

    // ── 3. Existing vs new ───────────────────────────────
    const existing = await findLead(event.channel, event.externalContactId);
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

    // ── 4. Qualification (deterministic) ─────────────────
    const qual = qualify(analysis);

    // ── 5. Persist lead ──────────────────────────────────
    let lead = await upsertLead(event, analysis, qual);
    leadId = lead.id;

    // Seed collected profile from what we already know (first message only).
    if (!existing) {
      const seed: CollectedProfile = {
        name: event.name ?? null,
        product: analysis.product ?? null,
        financing: analysis.financingInterest ? 'interested' : null,
        budget: null,
        location: null,
      };
      lead = await updateCollected(lead.id, seed, false);
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

  const { turn } = await converse(historyLines, lead.collected, lead.collected.name ?? conv.contact_name);
  const updatedLead = await updateCollected(lead.id, turn.collected, turn.complete);
  await mirrorLead(updatedLead as unknown as Record<string, unknown>);

  if (!settings.autoReplyEnabled) {
    await step(correlationId, 'auto_reply_skipped', 'Auto-reply off — reply not sent', 'info', 'toggle enabled in dashboard', lead.id);
    return;
  }

  // Send the reply over WhatsApp (best-effort) and record it in the inbox.
  const sent = await sendWhatsapp(conv.phone ?? conv.external_contact_id, turn.reply);
  const outbound = await addMessage(conv.id, 'outbound', 'agent', turn.reply, null);
  const refreshed = await refreshConversation(conv.id);
  await mirrorMessage(conv.id, outbound as unknown as Record<string, unknown>);
  await mirrorConversation(refreshed as unknown as Record<string, unknown>);
  await step(
    correlationId,
    'auto_reply_sent',
    sent ? 'Assistant replied' : 'Reply queued (WhatsApp offline)',
    sent ? 'ok' : 'info',
    truncate(turn.reply, 60),
    lead.id
  );

  // Once every detail is captured, enrich the Bitrix lead with the full profile.
  if (turn.complete && bitrix24Adapter.isConfigured() && updatedLead.bitrix_lead_id) {
    const ok = await bitrix24Adapter.updateLead(updatedLead.bitrix_lead_id, updatedLead, analysis);
    await step(
      correlationId,
      'profile_complete',
      'Lead profile complete',
      ok ? 'ok' : 'info',
      'all details collected · Bitrix24 enriched',
      lead.id
    );
    await mirrorLead(updatedLead as unknown as Record<string, unknown>);
  }
  await emitLead(lead.id, correlationId, updatedLead);
}

// ── helpers ────────────────────────────────────────────────
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
    return res.ok;
  } catch (err) {
    logger.warn({ err: String(err) }, 'WhatsApp send failed (service offline?)');
    return false;
  }
}
