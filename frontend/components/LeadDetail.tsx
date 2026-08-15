'use client';

import { ExternalLink } from 'lucide-react';
import type { Lead } from '@/lib/types';
import { bitrixLeadUrl } from '@/lib/bitrix';
import { LeadScoreCard } from './LeadScoreCard';

function qualBadge(q: string | null) {
  switch (q) {
    case 'qualified':
      return { text: 'QUALIFIED', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'needs_follow_up':
      return { text: 'NEEDS FOLLOW-UP', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'unqualified':
      return { text: 'UNQUALIFIED', cls: 'bg-gray-100 text-ink-500 border-line' };
    default:
      return { text: 'PENDING', cls: 'bg-gray-100 text-ink-400 border-line' };
  }
}

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

  const q = qualBadge(lead.qualification_status);
  const bitrixOk = lead.bitrix_status === 'synced';
  const bitrixUrl = lead.bitrix_lead_id ? bitrixLeadUrl(lead.bitrix_lead_id) : null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-ink-900">{lead.name ?? 'Unknown contact'}</div>
          <div className="text-xs text-ink-500">{lead.phone}</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${q.cls}`}>{q.text}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Channel" value={<span className="capitalize">{lead.channel}</span>} />
        <Field label="Source" value={lead.source} />
        <Field label="Product" value={lead.product ?? '—'} />
        <Field label="Financing" value={lead.financing_interest ? <span className="text-emerald-600">Yes</span> : <span className="text-ink-500">No</span>} />
        <Field label="Purchase Intent" value={<span className={`font-semibold capitalize ${intentTone(lead.purchase_intent)}`}>{lead.purchase_intent ?? '—'}</span>} />
        <Field label="Intent" value={<span className="capitalize">{(lead.intent ?? '—').replace(/_/g, ' ')}</span>} />
      </div>

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
            <span className={`text-sm font-semibold ${bitrixOk ? 'text-emerald-600' : lead.bitrix_status === 'failed' ? 'text-rose-600' : 'text-amber-600'}`}>
              {bitrixOk ? '✓ Synced' : lead.bitrix_status === 'failed' ? '✗ Failed' : '⏳ Pending'}
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

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-50 p-3">
        <span className="text-base">📞</span>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-400">Next Action</div>
          <div className="text-sm font-semibold text-ink-900">{lead.next_action ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
