/**
 * Lead pipeline orchestrator.
 *
 *   NormalizedLeadEvent → dedup → identify contact → AI intelligence →
 *   qualification (deterministic) → persist → Bitrix24 CRM → follow-up
 *
 * Every step is (a) persisted to lead_events and (b) published to the SSE bus so
 * the dashboard lights up in real time. A small pacing delay makes each step
 * visibly "pop" during the live demo without faking any of the real work.
 */
import { randomUUID } from 'node:crypto';
import { bus } from '../events/bus.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { NormalizedLeadEvent, PipelineStep, Lead } from '../types.js';
import { analyzeLead } from './ai.service.js';
import { qualify } from './qualification.service.js';
import { bitrix24Adapter } from '../adapters/crm/bitrix24.adapter.js';
import {
  claimMessage,
  findLead,
  upsertLead,
  updateBitrix,
  recordEvent,
  getLeadEvents,
  getMetrics,
  listRecentLeads,
} from '../db/leads.repo.js';

const STEP_DELAY_MS = Number(process.env.PIPELINE_STEP_DELAY_MS ?? 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processEvent(event: NormalizedLeadEvent): Promise<void> {
  const correlationId = randomUUID();

  // ── 0. Dedup guard (idempotent) ──────────────────────────
  const isNewMessage = await claimMessage(event.channel, event.externalMessageId);
  if (!isNewMessage) {
    logger.info({ id: event.externalMessageId }, 'Duplicate message ignored');
    return;
  }

  const contact = { name: event.name, phone: event.phone };

  // Announce the raw incoming event to the dashboard immediately.
  bus.publish({
    type: 'pipeline',
    data: {
      correlationId,
      channel: event.channel,
      contact,
      message: event.message,
      receivedAt: event.timestamp,
      step: mkStep('message_received', 'Message received', 'ok', `via ${event.channel}`),
    },
  });

  let leadId: number | null = null;
  try {
    // ── 1. Identify contact ────────────────────────────────
    await step(correlationId, 'contact_identified', 'Contact identified', 'ok', contact.phone ?? '');

    // ── 2. New vs existing ─────────────────────────────────
    const existing = await findLead(event.channel, event.externalContactId);
    await step(
      correlationId,
      existing ? 'existing_lead' : 'new_lead_detected',
      existing ? 'Existing lead matched' : 'New lead detected',
      'ok'
    );

    // ── 3. AI intelligence ─────────────────────────────────
    const { analysis, degraded, error } = await analyzeLead(event.message, event.name);
    await step(
      correlationId,
      'ai_analysis',
      degraded ? 'AI unavailable — deterministic fallback used' : 'AI analysis completed',
      degraded ? 'info' : 'ok',
      degraded ? (error ? `fallback (${truncate(error)})` : 'fallback') : `${analysis.intent} · ${analysis.purchaseIntent} intent`
    );

    // ── 4. Qualification (deterministic) ───────────────────
    const qual = qualify(analysis);

    // ── 5. Persist lead ────────────────────────────────────
    const lead = await upsertLead(event, analysis, qual);
    leadId = lead.id;
    await recordEvent(leadId, 'lead_persisted', 'ok', { analysis });
    await step(correlationId, 'lead_created', existing ? 'Lead updated' : 'Lead created', 'ok', `#${lead.id}`, leadId);
    await emitLead(leadId, correlationId);
    await emitMetrics();

    // ── 6. Bitrix24 CRM sync (REAL) ────────────────────────
    if (bitrix24Adapter.isConfigured()) {
      const result = await bitrix24Adapter.createLead(lead, analysis);
      const updated = await updateBitrix(leadId, result.status, result.crmLeadId ?? null);
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
      await emitLead(leadId, correlationId, updated);
      await emitMetrics();
    } else {
      await step(correlationId, 'bitrix_skipped', 'Bitrix24 not configured', 'info', 'set BITRIX24_WEBHOOK_URL', leadId);
    }

    // ── 7. Qualification result to dashboard ───────────────
    await step(
      correlationId,
      'qualification_completed',
      'Qualification completed',
      'ok',
      qual.qualification.replace(/_/g, ' '),
      leadId
    );

    // ── 8. Sales follow-up (step() persists the lead_event) ─
    await step(
      correlationId,
      'follow_up_created',
      'Sales follow-up created',
      'ok',
      `${qual.assignedTo} · ${qual.nextAction}`,
      leadId
    );

    // Optional: acknowledge the prospect on WhatsApp (off by default).
    if (process.env.FOLLOWUP_AUTOREPLY === 'true' && event.channel === 'whatsapp' && event.phone) {
      void sendWhatsappAck(event.phone);
    }

    await emitLead(leadId, correlationId);
    await emitMetrics();
    logger.info({ leadId, correlationId }, 'Pipeline complete');
  } catch (err) {
    logger.error({ err: String(err), correlationId }, 'Pipeline error');
    await step(correlationId, 'pipeline_error', 'Processing error', 'error', truncate(String(err)), leadId);
    if (leadId) await recordEvent(leadId, 'pipeline_error', 'error', { error: String(err) });
  }
}

// ── helpers ────────────────────────────────────────────────
function mkStep(
  key: string,
  label: string,
  status: PipelineStep['status'],
  detail?: string
): PipelineStep {
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
  await sleep(STEP_DELAY_MS);
}

async function emitLead(leadId: number, correlationId: string, lead?: Lead): Promise<void> {
  const events = await getLeadEvents(leadId);
  const record = lead ?? (await findLeadById(leadId));
  bus.publish({ type: 'lead', data: { correlationId, lead: record, events } });
}

async function findLeadById(id: number): Promise<Lead | null> {
  const { getLeadById } = await import('../db/leads.repo.js');
  return getLeadById(id);
}

async function emitMetrics(): Promise<void> {
  const [metrics, recent] = await Promise.all([getMetrics(), listRecentLeads(20)]);
  bus.publish({ type: 'metrics', data: { metrics, recent } });
}

function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

async function sendWhatsappAck(phone: string): Promise<void> {
  try {
    await fetch(`${config.whatsappServiceUrl.replace(/\/+$/, '')}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: phone,
        text: 'Thank you for contacting NetOne! A sales representative will reach out to you shortly regarding your enquiry.',
      }),
    });
  } catch (err) {
    logger.warn({ err: String(err) }, 'WhatsApp acknowledgement failed');
  }
}
