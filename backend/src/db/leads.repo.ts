/** Data-access for leads, events, dedup, and dashboard metrics. */
import { query } from './pool.js';
import type { Lead, LeadAnalysis, NormalizedLeadEvent } from '../types.js';
import type { QualificationResult } from '../services/qualification.service.js';

/** Returns true if this message is new (claimed), false if already processed. */
export async function claimMessage(channel: string, externalMessageId: string): Promise<boolean> {
  const res = await query(
    `INSERT INTO processed_messages (channel, external_message_id)
     VALUES ($1, $2)
     ON CONFLICT (channel, external_message_id) DO NOTHING
     RETURNING external_message_id`,
    [channel, externalMessageId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function findLead(channel: string, externalContactId: string): Promise<Lead | null> {
  const res = await query<Lead>(
    `SELECT * FROM leads WHERE channel = $1 AND external_contact_id = $2`,
    [channel, externalContactId]
  );
  return res.rows[0] ?? null;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const res = await query<Lead>(`SELECT * FROM leads WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

/** Insert a fresh lead or update the existing one for this contact/channel. */
export async function upsertLead(
  event: NormalizedLeadEvent,
  analysis: LeadAnalysis,
  qual: QualificationResult
): Promise<Lead> {
  const res = await query<Lead>(
    `INSERT INTO leads (
        external_contact_id, channel, source, name, phone, initial_message,
        intent, product, financing_interest, purchase_intent, qualification_status,
        ai_reasoning, ai_summary, ai_source, assigned_to, next_action, bitrix_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending')
     ON CONFLICT (channel, external_contact_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name),
        phone = COALESCE(EXCLUDED.phone, leads.phone),
        initial_message = EXCLUDED.initial_message,
        intent = EXCLUDED.intent,
        product = EXCLUDED.product,
        financing_interest = EXCLUDED.financing_interest,
        purchase_intent = EXCLUDED.purchase_intent,
        qualification_status = EXCLUDED.qualification_status,
        ai_reasoning = EXCLUDED.ai_reasoning,
        ai_summary = EXCLUDED.ai_summary,
        ai_source = EXCLUDED.ai_source,
        assigned_to = EXCLUDED.assigned_to,
        next_action = EXCLUDED.next_action,
        updated_at = now()
     RETURNING *`,
    [
      event.externalContactId,
      event.channel,
      'Social / Demo',
      event.name,
      event.phone,
      event.message,
      analysis.intent,
      analysis.product,
      analysis.financingInterest,
      analysis.purchaseIntent,
      qual.qualification,
      analysis.reasoning,
      analysis.summary,
      analysis.aiSource,
      qual.assignedTo,
      qual.nextAction,
    ]
  );
  return res.rows[0];
}

export async function updateBitrix(
  leadId: number,
  status: 'synced' | 'failed',
  crmLeadId: string | null
): Promise<Lead> {
  const res = await query<Lead>(
    `UPDATE leads
        SET bitrix_status = $2,
            bitrix_lead_id = COALESCE($3, bitrix_lead_id),
            bitrix_synced_at = CASE WHEN $2 = 'synced' THEN now() ELSE bitrix_synced_at END,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [leadId, status, crmLeadId]
  );
  return res.rows[0];
}

export async function recordEvent(
  leadId: number | null,
  eventType: string,
  status: 'ok' | 'error' | 'info',
  payload: Record<string, unknown> = {}
): Promise<void> {
  await query(
    `INSERT INTO lead_events (lead_id, event_type, status, payload) VALUES ($1,$2,$3,$4)`,
    [leadId, eventType, status, JSON.stringify(payload)]
  );
}

export async function listRecentLeads(limit = 20): Promise<Lead[]> {
  const res = await query<Lead>(`SELECT * FROM leads ORDER BY updated_at DESC LIMIT $1`, [limit]);
  return res.rows;
}

export async function getLeadEvents(leadId: number) {
  const res = await query(
    `SELECT id, event_type, status, payload, created_at
       FROM lead_events WHERE lead_id = $1 ORDER BY created_at ASC, id ASC`,
    [leadId]
  );
  return res.rows;
}

export async function getMetrics() {
  const res = await query<{
    leads_today: string;
    qualified: string;
    needs_follow_up: string;
    synced: string;
  }>(
    `SELECT
        COUNT(*) FILTER (WHERE created_at::date = now()::date)                 AS leads_today,
        COUNT(*) FILTER (WHERE qualification_status = 'qualified')             AS qualified,
        COUNT(*) FILTER (WHERE qualification_status = 'needs_follow_up')       AS needs_follow_up,
        COUNT(*) FILTER (WHERE bitrix_status = 'synced')                       AS synced
     FROM leads`
  );
  const r = res.rows[0];
  return {
    leadsToday: Number(r?.leads_today ?? 0),
    qualified: Number(r?.qualified ?? 0),
    needsFollowUp: Number(r?.needs_follow_up ?? 0),
    syncedToCrm: Number(r?.synced ?? 0),
  };
}
