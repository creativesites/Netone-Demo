/**
 * Bitrix24 CRM adapter — REAL integration via the inbound webhook REST API.
 * Creates genuine leads with crm.lead.add against the configured portal.
 * The webhook URL + assigned user come from env only; nothing is hard-coded.
 */
import { config, flags } from '../../config.js';
import { logger } from '../../logger.js';
import type { CollectedProfile, Lead, LeadAnalysis, Qualification } from '../../types.js';
import type { CRMAdapter, CreateLeadResult } from './crm.adapter.js';

const TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;

// Map our qualification to Bitrix's default, always-present lead statuses.
function statusFor(q: Qualification | null): string {
  switch (q) {
    case 'qualified':
      return 'IN_PROCESS';
    case 'unqualified':
      return 'JUNK';
    default:
      return 'NEW';
  }
}

async function callBitrix(method: string, body: unknown): Promise<any> {
  const base = config.bitrix.webhookUrl.replace(/\/+$/, '');
  const url = `${base}/${method}.json`;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = (await res.json()) as any;
      if (!res.ok || json.error) {
        throw new Error(json.error_description || json.error || `HTTP ${res.status}`);
      }
      return json;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      logger.warn({ method, attempt, err: String(err) }, 'Bitrix call failed');
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // linear backoff
      }
    }
  }
  throw lastErr;
}

const CREDIT_RISK_LABEL: Record<string, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  ineligible: 'Not financing-eligible',
  unknown: 'Unknown',
};

function collectedLines(collected: CollectedProfile): string[] {
  return [
    '',
    'Collected profile:',
    `- Name: ${collected.name ?? '—'}`,
    `- Product: ${collected.product ?? '—'}`,
    `- Financing: ${collected.financing ?? '—'}`,
    `- Budget: ${collected.budget ?? '—'}`,
    `- Location: ${collected.location ?? '—'}`,
    `- Employment: ${collected.employment ?? '—'}`,
    `- Monthly income: ${collected.monthlyIncome ?? '—'}`,
  ];
}

// This mirrors the deterministic qualification.service.ts output that's
// already persisted on the lead — never the AI's own raw qualification
// guess. Score/tier/risk/routing must stay deterministic and configurable
// (see qualification.service.ts); the CRM record has to reflect the same
// decision the dashboard shows, not a second, AI-driven opinion.
function scoreLines(lead: Lead): string[] {
  const lines = [
    '',
    'Qualification (NetOne rules engine):',
    `- Score: ${lead.score ?? '—'}/100`,
    `- Qualification: ${(lead.qualification_status ?? 'pending').replace(/_/g, ' ')}`,
  ];
  if (lead.credit_risk && lead.credit_risk !== 'unknown') {
    lines.push(`- Financing eligibility indicator: ${CREDIT_RISK_LABEL[lead.credit_risk] ?? lead.credit_risk}`);
    lines.push('  (indicator only — NOT a loan approval; requires financing-partner verification)');
  }
  lines.push(`- Next action: ${lead.next_action ?? '—'}`);
  return lines;
}

export const bitrix24Adapter: CRMAdapter = {
  name: 'bitrix24',

  isConfigured(): boolean {
    return flags.hasBitrix;
  },

  async createLead(lead: Lead, analysis: LeadAnalysis): Promise<CreateLeadResult> {
    if (!flags.hasBitrix) {
      return { ok: false, status: 'failed', error: 'Bitrix24 webhook URL not configured' };
    }

    const commentLines = [
      `Channel: ${lead.channel}`,
      `Source: ${lead.source}`,
      `Initial message: "${lead.initial_message}"`,
      '',
      `AI intent: ${analysis.intent}`,
      `Product interest: ${analysis.product ?? 'n/a'}`,
      `Financing interest: ${analysis.financingInterest ? 'Yes' : 'No'}`,
      `Purchase intent: ${analysis.purchaseIntent}`,
      `AI summary: ${analysis.summary}`,
      ...scoreLines(lead),
      ...collectedLines(lead.collected),
    ];

    const fields: Record<string, unknown> = {
      TITLE: `${lead.name ?? 'WhatsApp Lead'} — ${analysis.product ?? 'NetOne'} (${lead.channel})`,
      NAME: lead.name ?? undefined,
      SOURCE_ID: 'WEB',
      SOURCE_DESCRIPTION: `NetOne Lead Automation — ${lead.channel}`,
      STATUS_ID: statusFor(lead.qualification_status),
      COMMENTS: commentLines.join('\n'),
      OPENED: 'Y',
    };
    if (lead.phone) {
      fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'MOBILE' }];
    }
    if (config.bitrix.assignedById) {
      fields.ASSIGNED_BY_ID = Number(config.bitrix.assignedById);
    }

    try {
      const json = await callBitrix('crm.lead.add', {
        fields,
        params: { REGISTER_SONET_EVENT: 'Y' },
      });
      const crmLeadId = String(json.result);
      logger.info({ crmLeadId }, 'Bitrix24 lead created');
      return { ok: true, status: 'synced', crmLeadId, raw: json };
    } catch (err) {
      return { ok: false, status: 'failed', error: String(err) };
    }
  },

  async updateLead(crmLeadId: string, lead: Lead, analysis: LeadAnalysis): Promise<boolean> {
    if (!flags.hasBitrix) return false;
    const fields: Record<string, unknown> = {
      STATUS_ID: statusFor(lead.qualification_status),
      COMMENTS: [
        `AI summary: ${analysis.summary}`,
        ...scoreLines(lead),
        ...collectedLines(lead.collected),
      ].join('\n'),
    };
    if (lead.collected.name) fields.NAME = lead.collected.name;
    if (lead.phone) fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'MOBILE' }];
    try {
      await callBitrix('crm.lead.update', { id: crmLeadId, fields });
      logger.info({ crmLeadId }, 'Bitrix24 lead enriched');
      return true;
    } catch (err) {
      logger.warn({ err: String(err) }, 'Bitrix24 update failed');
      return false;
    }
  },

  async assignLead(crmLeadId: string, assignedById: string): Promise<boolean> {
    if (!flags.hasBitrix || !assignedById) return false;
    try {
      await callBitrix('crm.lead.update', {
        id: crmLeadId,
        fields: { ASSIGNED_BY_ID: Number(assignedById) },
      });
      return true;
    } catch (err) {
      logger.warn({ err: String(err) }, 'Bitrix24 assign failed');
      return false;
    }
  },
};
