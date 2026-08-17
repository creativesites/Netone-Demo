'use client';

import Link from 'next/link';
import { ExternalLink, Check, X, Clock, PhoneCall } from 'lucide-react';
import type { Lead } from '@/lib/types';
import { bitrixLeadUrl } from '@/lib/bitrix';
import { channelLabel } from '@/lib/channel';
import { LeadScoreCard } from './LeadScoreCard';
import { CreditRiskBadge } from './CreditRiskBadge';
import { StageBadge } from './StageBadge';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 text-sm text-ink-800">{value}</div>
    </div>
  );
}

function intentTone(pi: string | null) {
  if (pi === 'high') return 'text-emerald-600';
  if (pi === 'medium') return 'text-amber-600';
  return 'text-ink-500';
}

export function LeadDetail({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <div className="card flex min-h-[200px] items-center justify-center p-6 text-center text-sm text-ink-500">
        Lead intelligence will appear here once a message is processed.
      </div>
    );
  }

  const bitrixOk = lead.bitrix_status === 'synced';
  const bitrixUrl = lead.bitrix_lead_id ? bitrixLeadUrl(lead.bitrix_lead_id) : null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-ink-900">{lead.name ?? 'Unknown contact'}</div>
          <div className="text-xs text-ink-500">{lead.phone}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StageBadge stage={lead.qualification_stage} />
          <Link href={`/leads/${lead.id}`} className="text-[11px] font-medium text-brand-600 hover:underline">
            View full profile →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Channel" value={channelLabel(lead.channel)} />
        <Field label="Source" value={lead.source} />
        <Field label="Product" value={lead.product ?? '—'} />
        <Field label="Financing" value={lead.financing_interest ? <span className="text-emerald-600">Yes</span> : <span className="text-ink-500">No</span>} />
        <Field label="Purchase Intent" value={<span className={`font-semibold capitalize ${intentTone(lead.purchase_intent)}`}>{lead.purchase_intent ?? '—'}</span>} />
        <Field label="Intent" value={<span className="capitalize">{(lead.intent ?? '—').replace(/_/g, ' ')}</span>} />
      </div>

      {(lead.financing_interest || (lead.credit_risk && lead.credit_risk !== 'unknown')) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-muted p-3">
          <span className="text-[10px] uppercase tracking-wide text-ink-400">Financing eligibility</span>
          <CreditRiskBadge risk={lead.credit_risk} />
          {lead.collected?.employment && <span className="text-xs text-ink-500">“{lead.collected.employment}”</span>}
          {lead.collected?.monthlyIncome && <span className="text-xs text-ink-400">· income: {lead.collected.monthlyIncome}/mo</span>}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line bg-surface-muted p-3">
        <div className="text-[10px] uppercase tracking-wide text-ink-400">AI Summary</div>
        <p className="mt-1 text-sm text-ink-800">{lead.ai_summary ?? '—'}</p>
        {lead.ai_reasoning && <p className="mt-1 text-xs text-ink-500">{lead.ai_reasoning}</p>}
        {lead.ai_source && (
          <div className="mt-1 text-[10px] text-ink-400">
            via {lead.ai_source === 'deterministic' ? 'deterministic fallback' : lead.ai_source}
          </div>
        )}
      </div>

      <div className="mt-4">
        <LeadScoreCard score={lead.score} breakdown={lead.score_breakdown} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-line bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-ink-400">Bitrix24</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`flex items-center gap-1 text-sm font-semibold ${bitrixOk ? 'text-emerald-600' : lead.bitrix_status === 'failed' ? 'text-rose-600' : 'text-amber-600'}`}>
              {bitrixOk ? <Check size={14} /> : lead.bitrix_status === 'failed' ? <X size={14} /> : <Clock size={14} />}
              {bitrixOk ? 'Synced' : lead.bitrix_status === 'failed' ? 'Failed' : 'Pending'}
            </span>
            {lead.bitrix_lead_id && bitrixUrl ? (
              <a
                href={bitrixUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-mono text-violet-700 hover:bg-violet-100"
              >
                Lead #{lead.bitrix_lead_id} <ExternalLink size={10} />
              </a>
            ) : lead.bitrix_lead_id ? (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-mono text-violet-700">Lead #{lead.bitrix_lead_id}</span>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-ink-400">Assigned To</div>
          <div className="mt-1 text-sm font-semibold text-ink-800">{lead.assigned_to ?? '—'}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-50 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
          <PhoneCall size={14} />
        </span>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-400">Next Action</div>
          <div className="text-sm font-semibold text-ink-900">{lead.next_action ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
