'use client';

import Link from 'next/link';
import type { Lead } from '@/lib/types';
import { bitrixLeadUrl } from '@/lib/bitrix';
import { channelLabel } from '@/lib/channel';
import { StageDot } from '@/components/StageBadge';

export function RecentLeads({ leads }: { leads: Lead[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recent Leads</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-400">{leads.length}</span>
          <Link href="/leads" className="text-[11px] font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
      </div>
      {leads.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-500">No leads yet.</div>
      ) : (
        <ul className="max-h-[320px] space-y-1 overflow-y-auto scroll-thin">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <StageDot stage={l.qualification_stage} />
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
                      // Not a real <a> — nesting an anchor inside the row's Link would
                      // be invalid HTML. A span that opens Bitrix in a new tab keeps
                      // this click independent of the row's own navigation.
                      return url ? (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="cursor-pointer rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-mono text-violet-700 hover:bg-violet-100"
                        >
                          #{l.bitrix_lead_id}
                        </span>
                      ) : (
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-mono text-violet-700">#{l.bitrix_lead_id}</span>
                      );
                    })()
                  ) : (
                    <span className="text-[10px] text-ink-400">—</span>
                  )}
                  <div className="mt-0.5 text-[10px] text-ink-400">{channelLabel(l.channel)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
