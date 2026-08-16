'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { useRealtimeDoc, apiGet } from '@/lib/realtime';
import { LeadDetail } from '@/components/LeadDetail';
import { Timeline } from '@/components/Timeline';
import type { Lead, LeadEvent } from '@/lib/types';

const PROFILE_FIELDS: { key: keyof NonNullable<Lead['collected']>; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'product', label: 'Product' },
  { key: 'financing', label: 'Financing' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'employment', label: 'Employment' },
  { key: 'monthlyIncome', label: 'Monthly income' },
];

export default function LeadPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const lead = useRealtimeDoc<Lead>(`leads/${id}`, `/api/leads/${id}`, (r) => (r.lead ?? r) as Lead);

  // Events don't stream through the leads/{id} doc, so poll them separately.
  const [events, setEvents] = useState<LeadEvent[]>([]);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const tick = async () => {
      const res = await apiGet(`/api/leads/${id}`);
      if (!res.ok || !alive) return;
      const json = await res.json();
      if (alive && Array.isArray(json.events)) setEvents(json.events);
    };
    tick();
    const iv = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  const collected = lead?.collected ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft size={14} /> Back to leads
      </Link>

      {!lead ? (
        <div className="card p-10 text-center text-sm text-ink-500">Loading lead…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <LeadDetail lead={lead} />
            <Timeline events={events} />
          </div>

          <div className="space-y-4">
            {collected && (
              <div className="card p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Collected profile</div>
                <div className="space-y-2">
                  {PROFILE_FIELDS.map((f) => {
                    const val = collected[f.key];
                    return (
                      <div key={f.key} className="flex items-center gap-2 text-sm">
                        {val ? <Check size={14} className="shrink-0 text-emerald-500" /> : <Circle size={14} className="shrink-0 text-gray-300" />}
                        <span className="w-28 shrink-0 text-ink-400">{f.label}</span>
                        <span className="truncate text-ink-800">{val ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Original message</div>
              <p className="text-sm italic text-ink-700">&ldquo;{lead.initial_message}&rdquo;</p>
              <div className="mt-2 text-[11px] text-ink-400">
                {new Date(lead.created_at).toLocaleString()} · via {lead.channel}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
