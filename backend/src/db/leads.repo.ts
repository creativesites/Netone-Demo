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
        ai_reasoning, ai_summary, ai_source, assigned_to, next_action, score, score_breakdown, credit_risk, bitrix_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending')
     ON CONFLICT (channel, external_contact_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name),
        phone = COALESCE(EXCLUDED.phone, leads.phone),
        initial_message = EXCLUDED.initial_message,
        intent = EXCLUDED.intent,
        product = COALESCE(EXCLUDED.product, leads.product),
        financing_interest = EXCLUDED.financing_interest,
        purchase_intent = EXCLUDED.purchase_intent,
        qualification_status = EXCLUDED.qualification_status,
        ai_reasoning = EXCLUDED.ai_reasoning,
        ai_summary = EXCLUDED.ai_summary,
        ai_source = EXCLUDED.ai_source,
        assigned_to = EXCLUDED.assigned_to,
        next_action = EXCLUDED.next_action,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        credit_risk = EXCLUDED.credit_risk,
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
      qual.score,
      JSON.stringify(qual.breakdown),
      qual.creditRisk,
    ]
  );
  return res.rows[0];
}

/** Recompute qualification/score after new profile info is collected (e.g. a conversational turn). */
export async function updateQualification(leadId: number, qual: QualificationResult): Promise<Lead> {
  const res = await query<Lead>(
    `UPDATE leads SET
        qualification_status = $2,
        assigned_to = $3,
        next_action = $4,
        score = $5,
        score_breakdown = $6,
        credit_risk = $7,
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [leadId, qual.qualification, qual.assignedTo, qual.nextAction, qual.score, JSON.stringify(qual.breakdown), qual.creditRisk]
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

export async function updateCollected(
  leadId: number,
  collected: import('../types.js').CollectedProfile,
  complete: boolean
): Promise<Lead> {
  // The conversational agent's collected.product is the authoritative,
  // deterministic read (built up over the whole conversation, carried
  // forward turn to turn) — it should always win over the top-level
  // `product` column, which the gatekeeper otherwise sets from a single
  // isolated message and can leave stale or null. Never let it regress:
  // only overwrite when the freshly collected value is non-null.
  const res = await query<Lead>(
    `UPDATE leads SET collected = $2, profile_complete = $3, product = COALESCE($4, product), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [leadId, JSON.stringify(collected), complete, collected.product]
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

export interface AnalyticsData {
  totals: {
    totalLeads: number;
    qualified: number;
    needsFollowUp: number;
    unqualified: number;
    avgScore: number;
    conversionRate: number; // qualified / total, 0-100
    bitrixSynced: number;
    bitrixPending: number;
    bitrixFailed: number;
  };
  dailyVolume: { day: string; count: number }[];
  byQualification: { status: string; count: number }[];
  byProduct: { product: string; count: number }[];
  byCreditRisk: { risk: string; count: number }[];
  byChannel: { channel: string; count: number }[];
}

/** Real-data aggregates for the management/analytics view — every number
 *  computed live from Postgres, nothing mocked or hardcoded. */
export async function getAnalytics(days = 14): Promise<AnalyticsData> {
  const [totalsRes, dailyRes, qualRes, productRes, riskRes, channelRes] = await Promise.all([
    query<{
      total_leads: string;
      qualified: string;
      needs_follow_up: string;
      unqualified: string;
      avg_score: string | null;
      bitrix_synced: string;
      bitrix_pending: string;
      bitrix_failed: string;
    }>(
      `SELECT
          COUNT(*)                                                            AS total_leads,
          COUNT(*) FILTER (WHERE qualification_status = 'qualified')          AS qualified,
          COUNT(*) FILTER (WHERE qualification_status = 'needs_follow_up')    AS needs_follow_up,
          COUNT(*) FILTER (WHERE qualification_status = 'unqualified')        AS unqualified,
          ROUND(AVG(score))                                                   AS avg_score,
          COUNT(*) FILTER (WHERE bitrix_status = 'synced')                    AS bitrix_synced,
          COUNT(*) FILTER (WHERE bitrix_status = 'pending' OR bitrix_status IS NULL) AS bitrix_pending,
          COUNT(*) FILTER (WHERE bitrix_status = 'failed')                    AS bitrix_failed
       FROM leads`
    ),
    query<{ day: string; count: string }>(
      `SELECT gs.day::date AS day, COUNT(l.id) AS count
         FROM generate_series((now()::date - ($1::int - 1) * interval '1 day'), now()::date, interval '1 day') AS gs(day)
         LEFT JOIN leads l ON l.created_at::date = gs.day
        GROUP BY gs.day
        ORDER BY gs.day`,
      [days]
    ),
    query<{ status: string; count: string }>(
      `SELECT COALESCE(qualification_status, 'pending') AS status, COUNT(*) AS count
         FROM leads GROUP BY 1 ORDER BY 2 DESC`
    ),
    query<{ product: string; count: string }>(
      `SELECT product, COUNT(*) AS count
         FROM leads WHERE product IS NOT NULL AND product <> ''
        GROUP BY product ORDER BY count DESC, product LIMIT 8`
    ),
    query<{ risk: string; count: string }>(
      `SELECT COALESCE(credit_risk, 'unknown') AS risk, COUNT(*) AS count
         FROM leads GROUP BY 1`
    ),
    query<{ channel: string; count: string }>(
      `SELECT channel, COUNT(*) AS count FROM leads GROUP BY channel ORDER BY count DESC`
    ),
  ]);

  const t = totalsRes.rows[0];
  const totalLeads = Number(t?.total_leads ?? 0);
  const qualified = Number(t?.qualified ?? 0);

  return {
    totals: {
      totalLeads,
      qualified,
      needsFollowUp: Number(t?.needs_follow_up ?? 0),
      unqualified: Number(t?.unqualified ?? 0),
      avgScore: Math.round(Number(t?.avg_score ?? 0)),
      conversionRate: totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0,
      bitrixSynced: Number(t?.bitrix_synced ?? 0),
      bitrixPending: Number(t?.bitrix_pending ?? 0),
      bitrixFailed: Number(t?.bitrix_failed ?? 0),
    },
    dailyVolume: dailyRes.rows.map((r) => ({ day: r.day, count: Number(r.count) })),
    byQualification: qualRes.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
    byProduct: productRes.rows.map((r) => ({ product: r.product, count: Number(r.count) })),
    byCreditRisk: riskRes.rows.map((r) => ({ risk: r.risk, count: Number(r.count) })),
    byChannel: channelRes.rows.map((r) => ({ channel: r.channel, count: Number(r.count) })),
  };
}
