'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Joyride, STATUS, type Step, type EventData } from 'react-joyride';

const steps: Step[] = [
  {
    target: '[data-tour="wa-connect"]',
    title: 'The live channel',
    content:
      'This is the WhatsApp number connected right now. Text it to trigger the whole pipeline — or disconnect it here and link your own number any time.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="integration-flow"]',
    title: 'The pipeline, live',
    content: 'Each stage lights up in real time as a message moves from "received" through to a synced CRM lead.',
  },
  {
    target: '[data-tour="architecture-diagram"]',
    title: 'How it actually works',
    content: 'Click any box to step inside it — from the big picture down to the real AI model cascade and scoring logic.',
  },
  {
    target: '[data-tour="live-activity"]',
    title: 'Watch a message process',
    content: 'Send a WhatsApp message now and watch each pipeline step appear here within a few seconds.',
  },
  {
    target: '[data-tour="current-lead"]',
    title: "The AI's reasoning",
    content: 'Qualification score, the credit-risk read, and the recommended next action — all with the "why" attached, not just a verdict.',
  },
  {
    target: '[data-tour="nav-leads"]',
    title: 'Every lead, one table',
    content: 'Search, filter by qualification, click through to any full profile, or export the whole list to Excel for a sales meeting.',
  },
  {
    target: '[data-tour="nav-analytics"]',
    title: 'The business view',
    content: 'Conversion rate, credit-risk distribution, top products, lead volume over time — real numbers computed live from the database, built for whoever runs the sales team.',
  },
  {
    target: '[data-tour="nav-inbox"]',
    title: 'Full conversation view',
    content: 'See every message thread, reply manually — Nia automatically pauses for that chat once you do, until you resume her — and inspect the same intelligence panel per conversation.',
  },
  {
    target: '[data-tour="nav-knowledge"]',
    title: 'What Nia knows',
    content: "NetOne's product catalog and reference notes — editable, and genuinely used by the AI when it answers questions.",
  },
  {
    target: '[data-tour="nav-rules"]',
    title: 'Tune it to your business',
    content: "Adjust qualification weights and the employment-type credit weighting to match your actual financing partner criteria.",
  },
  {
    target: '[data-tour="nav-help"]',
    title: 'Come back any time',
    content: 'Example messages and what to expect are always here on the Help page.',
  },
];

function GuidedTourInner() {
  const [run, setRun] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('tour') === '1') setRun(true);
  }, [searchParams]);

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false);
      router.replace(pathname);
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{ last: 'Done', skip: 'Skip tour' }}
      options={{
        primaryColor: '#a6242e',
        zIndex: 10000,
        showProgress: true,
        buttons: ['back', 'primary', 'skip'],
      }}
    />
  );
}

export function GuidedTour() {
  return (
    <Suspense fallback={null}>
      <GuidedTourInner />
    </Suspense>
  );
}
