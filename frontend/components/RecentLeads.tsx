'use client';

import type { Lead } from '@/lib/types';
import { bitrixLeadUrl } from '@/lib/bitrix';

function dot(q: string | null) {
  if (q === 'qualified') return 'bg-emerald-500';
  if (q === 'needs_follow_up') return 'bg-amber-500';
  return 'bg-ink-400';
}

export function RecentLeads({ leads }: { leads: Lead[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recent Leads</span>
        <span className="text-[11px] text-ink-400">{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-500">No leads yet.</div>
      ) : (
        <ul className="max-h-[320px] space-y-1 overflow-y-auto scroll-thin">
          {leads.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot(l.qualification_status)}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-800">{l.name ?? l.phone ?? 'Unknown'}</div>
                <div className="truncate text-[11px] text-ink-400">
                  {l.product ?? 'general'} · {l.purchase_intent ?? '—'} intent
                </div>
              </div>
              <div className="text-right">
                {l.bitrix_lead_id ? (
                  (() => {
                    const url = bitrixLeadUrl(l.bitrix_lead_id);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-mono text-violet-700 hover:bg-violet-100"
                      >
                        #{l.bitrix_lead_id}
                      </a>
                    ) : (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-mono text-violet-700">#{l.bitrix_lead_id}</span>
                    );
                  })()
                ) : (
                  <span className="text-[10px] text-ink-400">—</span>
                )}
                <div className="mt-0.5 text-[10px] capitalize text-ink-400">{l.channel}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
