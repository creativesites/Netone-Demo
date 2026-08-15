'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Copy,
  Check,
  Compass,
  Sparkles,
  Gauge,
  ShieldCheck,
  Database,
  BookOpen,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import { useWhatsAppStatus, displayWaNumber } from '@/lib/useWhatsAppStatus';

function CopyableMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="group flex w-full items-start gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-left transition-colors hover:border-brand-500/40 hover:bg-white"
    >
      <span className="mt-0.5 flex-1 text-[13px] leading-relaxed text-ink-800">&ldquo;{text}&rdquo;</span>
      <span className="mt-0.5 shrink-0 text-ink-300 group-hover:text-brand-500">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </span>
    </button>
  );
}

interface Scenario {
  title: string;
  outcome: string;
  messages: string[];
}

const SCENARIOS: Scenario[] = [
  {
    title: '1. A non-lead message (the gatekeeper)',
    outcome:
      'Stays in the Inbox only — no lead is created, nothing is sent to Bitrix24. Watch the Live Activity panel show "Filtered — not a sales lead".',
    messages: ['Hi there', 'Good morning 🙂'],
  },
  {
    title: '2. A product enquiry (creates a qualified lead)',
    outcome:
      'A lead appears on the Dashboard and in Bitrix24 within seconds. Check the AI Lead Score card for the reasoning breakdown.',
    messages: ['Hi, how much is the NEO Pro15P laptop?', "I'm interested in a laptop for work, what do you have?"],
  },
  {
    title: '3. The financing / credit-worthiness flow (the headline feature)',
    outcome:
      "Nia will ask for product, financing preference, then — because financing was mentioned — your employment situation and monthly income. Watch the Credit Risk badge and score change live as you answer.",
    messages: [
      'I want to buy a laptop on financing',
      'Something like the Neo Pro15, paying in installments',
      "I'm a civil servant, I teach at a government school",
      'About K4,500 a month',
    ],
  },
  {
    title: '3b. Same flow, higher risk — see the badge change',
    outcome:
      'With informal or no income, the Credit Risk badge should read "High risk" or "Not financing-eligible", and the next action shifts to suggesting a cash purchase instead.',
    messages: ["I'm not working right now, but I really need a laptop on financing"],
  },
  {
    title: '4. A complaint (routes to Customer Care, not Sales)',
    outcome: 'Classified as a complaint — routed to Customer Care rather than the Financing Desk, and generally not pushed to Bitrix24 as a sales lead.',
    messages: ['My laptop screen stopped working and I need a refund'],
  },
];

const LOOK_FOR = [
  {
    Icon: Gauge,
    title: 'AI Lead Score',
    body: 'On the Dashboard\'s Current Lead card and in the Inbox — a 0-100 score with a criterion-by-criterion breakdown, not just a label.',
  },
  {
    Icon: ShieldCheck,
    title: 'Credit Risk badge',
    body: 'Appears once financing is mentioned — Low / Medium / High / Not eligible, derived from employment type.',
  },
  {
    Icon: Database,
    title: 'Bitrix24 sync',
    body: 'Click the violet "Lead #___" badge on a qualified lead to open the real record in Bitrix24.',
  },
  {
    Icon: BookOpen,
    title: 'Knowledge Base',
    body: "Nia answers product questions from here. Edit a price and ask again — she'll use the new figure.",
  },
  {
    Icon: SlidersHorizontal,
    title: 'Qualification Rules',
    body: 'Change a weight or an employment-type multiplier, then send another test message — the score reacts immediately.',
  },
];

export default function HelpPage() {
  const { status } = useWhatsAppStatus();
  const number = displayWaNumber(status.user);
  const connected = status.status === 'connected';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Getting started</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Help &amp; How to Test</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        Everything you need to try this system yourself — what to send, where to look, and what should
        happen. No prior context required.
      </p>

      {/* Live number */}
      <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-brand-500/20 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <MessageCircle size={18} />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
              {connected ? 'Text this number on WhatsApp' : 'WhatsApp not connected right now'}
            </div>
            <div className="text-xl font-bold tracking-tight text-ink-900">{number ?? '—'}</div>
          </div>
        </div>
        <Link
          href="/?tour=1"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Compass size={15} /> Take the guided tour
        </Link>
      </div>
      {!connected && (
        <p className="mt-2 text-[12px] text-ink-500">
          Open the Dashboard and click the WhatsApp status pill in the header to connect a number (yours or
          the demo one) — QR scan or a pairing code, either works.
        </p>
      )}

      {/* The story in one line */}
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-white p-4 text-sm text-ink-700">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-500" />
        <p>
          <strong>The idea in one sentence:</strong> a customer messages NetOne, AI reads and qualifies the
          enquiry against NetOne&apos;s own rules (including financing credit-worthiness), a real lead lands
          in Bitrix24, and you can watch every step of it happen live on this dashboard.
        </p>
      </div>

      {/* Scenarios */}
      <div className="mt-8">
        <h2 className="mb-1 text-sm font-semibold text-ink-900">Try these, in order</h2>
        <p className="mb-4 text-[13px] text-ink-500">Tap a message to copy it, then paste it into WhatsApp.</p>
        <div className="space-y-5">
          {SCENARIOS.map((s) => (
            <div key={s.title} className="card p-4">
              <div className="text-sm font-semibold text-ink-900">{s.title}</div>
              <div className="mt-2 space-y-1.5">
                {s.messages.map((m) => (
                  <CopyableMessage key={m} text={m} />
                ))}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-500">
                <ArrowRight size={13} className="mt-0.5 shrink-0 text-brand-500" />
                {s.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What to look for */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">What to look for on the dashboard</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOOK_FOR.map((l) => (
            <div key={l.title} className="flex items-start gap-3 rounded-xl border border-line bg-white p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <l.Icon size={15} />
              </span>
              <div>
                <div className="text-[13px] font-semibold text-ink-900">{l.title}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{l.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 rounded-xl border border-line bg-surface-muted p-4 text-[13px] text-ink-600 sm:flex-row sm:items-center sm:justify-between">
        <span>Want the full picture — architecture, what&apos;s live vs. roadmap?</span>
        <Link href="/about" className="flex shrink-0 items-center gap-1 font-semibold text-brand-600 hover:text-brand-500">
          Read the About page <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
