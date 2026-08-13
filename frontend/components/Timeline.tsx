'use client';

import type { LeadEvent } from '@/lib/types';

const PRETTY: Record<string, string> = {
  message_received: 'Message received',
  contact_identified: 'Contact identified',
  new_lead_detected: 'New lead detected',
  existing_lead: 'Existing lead matched',
  ai_analysis: 'AI analysis completed',
  lead_persisted: 'Lead stored locally',
  lead_created: 'Lead created',
  bitrix_sync: 'Bitrix24 sync',
  bitrix_synced: 'Bitrix24 lead created',
  bitrix_failed: 'Bitrix24 sync failed',
  qualification_completed: 'Lead qualified',
  follow_up_created: 'Sales follow-up created',
  pipeline_error: 'Processing error',
};

function label(e: LeadEvent): string {
  const p = e.payload as { label?: string; detail?: string; crmLeadId?: string };
  if (p?.label) return p.label;
  if (e.event_type === 'bitrix_sync' && p?.crmLeadId) return `Bitrix24 lead created (#${p.crmLeadId})`;
  return PRETTY[e.event_type] ?? e.event_type;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function Timeline({ events }: { events: LeadEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center text-sm text-slate-500">
        Activity timeline will populate as the lead is processed.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Activity Timeline
      </div>
      <ol className="relative space-y-3 border-l border-white/10 pl-4">
        {events.map((e) => (
          <li key={e.id} className="animate-fade-up relative">
            <span
              className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-slate-950 ${
                e.status === 'error'
                  ? 'bg-rose-500'
                  : e.status === 'info'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
              }`}
            />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-200">{label(e)}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                {fmt(e.created_at)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
