'use client';

import { useLeadStream } from '@/lib/useLeadStream';
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
  new_lead_detected: 1,
  existing_lead: 1,
  ai_analysis: 2,
  lead_created: 1,
  qualification_completed: 3,
  bitrix_synced: 4,
  bitrix_failed: 4,
  bitrix_skipped: 4,
  follow_up_created: 5,
};

export default function Page() {
  const { status, metrics, recent, active, currentLead, currentEvents, connected } =
    useLeadStream();

  const activeIndex = active
    ? active.steps.reduce((max, s) => Math.max(max, STAGE_OF[s.key] ?? -1), -1)
    : -1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
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
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live Activity
            </h2>
            <LiveActivity active={active} />
          </div>
          <Timeline events={currentEvents} />
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Lead
            </h2>
            <LeadDetail lead={currentLead} />
          </div>
          <RecentLeads leads={recent} />
        </div>
      </section>

      <footer className="mt-8 border-t border-white/5 pt-4 text-center text-[11px] text-slate-600">
        NetOne · Omnichannel Marketing-to-CRM Lead Automation — WhatsApp is the live demo channel.
        Facebook · Instagram · TikTok · Web feed the same pipeline in production.
      </footer>
    </main>
  );
}
