'use client';

import type { Lead } from '@/lib/types';

function qualBadge(q: string | null) {
  switch (q) {
    case 'qualified':
      return { text: 'QUALIFIED', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'needs_follow_up':
      return { text: 'NEEDS FOLLOW-UP', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'unqualified':
      return { text: 'UNQUALIFIED', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
    default:
      return { text: 'PENDING', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function intentTone(pi: string | null) {
  if (pi === 'high') return 'text-emerald-300';
  if (pi === 'medium') return 'text-amber-300';
  return 'text-slate-400';
}

export function LeadDetail({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
        Lead intelligence will appear here once a message is processed.
      </div>
    );
  }

  const q = qualBadge(lead.qualification_status);
  const bitrixOk = lead.bitrix_status === 'synced';

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-bold text-white">{lead.name ?? 'Unknown contact'}</div>
          <div className="text-xs text-slate-400">{lead.phone}</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${q.cls}`}>
          {q.text}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Channel" value={<span className="capitalize">{lead.channel}</span>} />
        <Field label="Source" value={lead.source} />
        <Field label="Product" value={lead.product ?? '—'} />
        <Field
          label="Financing"
          value={
            lead.financing_interest ? (
              <span className="text-emerald-300">Yes</span>
            ) : (
              <span className="text-slate-400">No</span>
            )
          }
        />
        <Field
          label="Purchase Intent"
          value={
            <span className={`font-semibold capitalize ${intentTone(lead.purchase_intent)}`}>
              {lead.purchase_intent ?? '—'}
            </span>
          }
        />
        <Field label="Intent" value={<span className="capitalize">{(lead.intent ?? '—').replace(/_/g, ' ')}</span>} />
      </div>

      <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">AI Summary</div>
        <p className="mt-1 text-sm text-slate-200">{lead.ai_summary ?? '—'}</p>
        {lead.ai_source && (
          <div className="mt-1 text-[10px] text-slate-600">
            via {lead.ai_source === 'deterministic' ? 'deterministic fallback' : lead.ai_source}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Bitrix24</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-sm font-semibold ${bitrixOk ? 'text-emerald-300' : lead.bitrix_status === 'failed' ? 'text-rose-300' : 'text-amber-300'}`}>
              {bitrixOk ? '✓ Synced' : lead.bitrix_status === 'failed' ? '✗ Failed' : '⏳ Pending'}
            </span>
            {lead.bitrix_lead_id && (
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-mono text-violet-300">
                Lead #{lead.bitrix_lead_id}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Assigned To</div>
          <div className="mt-1 text-sm font-semibold text-slate-200">{lead.assigned_to ?? '—'}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/[0.06] p-3">
        <span className="text-base">📞</span>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Next Action</div>
          <div className="text-sm font-semibold text-white">{lead.next_action ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
