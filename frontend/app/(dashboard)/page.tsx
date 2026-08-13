'use client';

import { useLeadStream } from '@/lib/useLeadStream';
import { useRealtimeDoc, useRealtimeCollection } from '@/lib/realtime';
import type { IntegrationStatus, Lead, Metrics } from '@/lib/types';
import { Header } from '@/components/Header';
import { MetricsRow } from '@/components/MetricsRow';
import { IntegrationFlow } from '@/components/IntegrationFlow';
import { LiveActivity } from '@/components/LiveActivity';
import { LeadDetail } from '@/components/LeadDetail';
import { Timeline } from '@/components/Timeline';
import { RecentLeads } from '@/components/RecentLeads';

const STAGE_OF: Record<string, number> = {
  message_received: 0,
  contact_identified: 0,
  lead_detected: 1,
  new_lead_detected: 1,
  existing_lead: 1,
  ai_analysis: 2,
  lead_created: 1,
  qualification_completed: 3,
  bitrix_synced: 4,
  bitrix_updated: 4,
  bitrix_failed: 4,
  bitrix_skipped: 4,
  follow_up_created: 5,
  auto_reply_sent: 5,
};

export default function DashboardPage() {
  // SSE drives the live pipeline animation + the just-processed lead/timeline.
  const { active, currentLead, currentEvents, connected } = useLeadStream();

  // Firestore (with REST fallback) drives the persistent real-time collections.
  const status = useRealtimeDoc<IntegrationStatus>('dashboard/status', '/api/status', (r) => r as IntegrationStatus);
  const metrics = useRealtimeDoc<Metrics>('dashboard/metrics', '/api/metrics', (r) => (r.metrics ?? r) as Metrics);
  const recent = useRealtimeCollection<Lead>('leads', 'updated_at', '/api/leads', (r) => (r.leads ?? []) as Lead[]);

  const detailLead = currentLead ?? recent[0] ?? null;

  const activeIndex = active
    ? active.steps.reduce((max, s) => Math.max(max, STAGE_OF[s.key] ?? -1), -1)
    : -1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Header status={status} connected={connected} />

      <section className="mt-6">
        <MetricsRow metrics={metrics} />
      </section>

      <section className="mt-4">
        <IntegrationFlow activeIndex={activeIndex} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Live Activity</h2>
            <LiveActivity active={active} />
          </div>
          <Timeline events={currentEvents} />
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Current Lead</h2>
            <LeadDetail lead={detailLead} />
          </div>
          <RecentLeads leads={recent} />
        </div>
      </section>
    </div>
  );
}
