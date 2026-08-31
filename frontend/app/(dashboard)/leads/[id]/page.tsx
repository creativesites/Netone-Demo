'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRealtimeDoc, apiGet, apiPost } from '@/lib/realtime';
import { LeadDetail } from '@/components/LeadDetail';
import { Timeline } from '@/components/Timeline';
import { DiscoveryPanel } from '@/components/DiscoveryPanel';
import { channelLabel } from '@/lib/channel';
import { formatDateTime } from '@/lib/format';
import type { Lead, LeadEvent } from '@/lib/types';

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

  const [converting, setConverting] = useState(false);
  const [justConverted, setJustConverted] = useState(false);
  async function markConverted() {
    if (!id) return;
    setConverting(true);
    try {
      const res = await apiPost(`/api/leads/${id}/convert`, {});
      if (res.ok) setJustConverted(true);
    } finally {
      setConverting(false);
    }
  }
  const isSalesReady = lead?.qualification_stage === 'SALES_READY';
  const isConverted = justConverted || lead?.qualification_stage === 'CONVERTED';

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
            <LeadDetail lead={lead} hideFullProfileLink={true} />
            {isSalesReady && !isConverted && (
              <button
                onClick={markConverted}
                disabled={converting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                {converting ? 'Marking as converted…' : 'Mark as Converted'}
              </button>
            )}
            {isConverted && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700">
                <CheckCircle2 size={15} /> Converted
              </div>
            )}
            <Timeline events={events} />
          </div>

          <div className="space-y-4">
            {collected && (
              <div className="card p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Collected profile</div>
                <DiscoveryPanel collected={collected} />
              </div>
            )}

            <div className="card p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Original message</div>
              <p className="text-sm italic text-ink-700">&ldquo;{lead.initial_message}&rdquo;</p>
              <div className="mt-2 text-[11px] text-ink-400">
                {formatDateTime(lead.created_at)} · via {channelLabel(lead.channel)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
