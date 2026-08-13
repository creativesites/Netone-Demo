'use client';

import type { Lead } from '@/lib/types';

function dot(q: string | null) {
  if (q === 'qualified') return 'bg-emerald-400';
  if (q === 'needs_follow_up') return 'bg-amber-400';
  return 'bg-slate-500';
}

export function RecentLeads({ leads }: { leads: Lead[] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Recent Leads
        </span>
        <span className="text-[11px] text-slate-600">{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-500">No leads yet.</div>
      ) : (
        <ul className="max-h-[320px] space-y-1 overflow-y-auto scroll-thin">
          {leads.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot(l.qualification_status)}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">
                  {l.name ?? l.phone ?? 'Unknown'}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {l.product ?? 'general'} · {(l.purchase_intent ?? '—')} intent
                </div>
              </div>
              <div className="text-right">
                {l.bitrix_lead_id ? (
                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-mono text-violet-300">
                    #{l.bitrix_lead_id}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">—</span>
                )}
                <div className="mt-0.5 text-[10px] capitalize text-slate-500">
                  {l.channel}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
