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
  ShieldAlert,
  Database,
  BookOpen,
  SlidersHorizontal,
  ArrowRight,
  ArrowDown,
  Users,
  BarChart3,
  UserCheck,
  Brain,
  Scale,
  Target,
  PhoneCall,
  ExternalLink,
  Lock,
  RefreshCw,
  HelpCircle,
  ListChecks,
  CircleCheck,
  Circle,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useWhatsAppStatus, displayWaNumber } from '@/lib/useWhatsAppStatus';
import { useRealtimeDoc } from '@/lib/realtime';
import type { IntegrationStatus } from '@/lib/types';

const FACEBOOK_PAGE_USERNAME = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_USERNAME || '';

// ── Demo Bitrix24 credentials ──────────────────────────────────────────
// Sandbox/demo CRM only — deliberately displayed here, and only here, so a
// CEO/client can independently inspect the resulting lead during a live
// demo. Never NetOne's production Bitrix24. Do not surface these anywhere
// else in the app (dashboard, inbox, API responses, logs).
const DEMO_BITRIX = {
  url: 'https://b24-09ys7w.bitrix24.com',
  email: 'creativesites263@gmail.com',
  password: 'NetOneDemo2026',
};

// ── Small shared bits ───────────────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copy(key: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }
  return { copiedKey, copy };
}

function CopyField({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  mono?: boolean;
}) {
  const copied = copiedKey === copyKey;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
        <div className={`truncate text-[13px] text-ink-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
      <button
        onClick={() => onCopy(copyKey, value)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
      >
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

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

function SectionHeading({ n, title, id }: { n: number; title: string; id: string }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-6 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[12px] font-bold text-white">
        {n}
      </span>
      <h2 className="text-base font-semibold text-ink-900 sm:text-lg">{title}</h2>
    </div>
  );
}

function NumberedStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
          {n}
        </span>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
      </div>
      <div className="mt-2.5 space-y-2.5 pl-[34px] text-[13px] leading-relaxed text-ink-600">{children}</div>
    </div>
  );
}

// ── Section 1: the complete flow ────────────────────────────────────────

const FLOW_STAGES: { label: string; Icon: LucideIcon; desc: string }[] = [
  { label: 'Customer', Icon: Users, desc: 'A real customer with a genuine enquiry.' },
  { label: 'WhatsApp', Icon: MessageCircle, desc: 'The live demonstration channel — already connected, ready to use.' },
  { label: 'NetOne Lead Platform', Icon: Target, desc: 'The message is received, normalized and matched to a conversation.' },
  { label: 'AI-assisted understanding', Icon: Brain, desc: 'AI reads the message and extracts intent, product interest and other details.' },
  { label: 'Business qualification rules', Icon: Scale, desc: "NetOne's own configurable rules — not the AI — decide the qualification outcome." },
  { label: 'Lead creation / update', Icon: ListChecks, desc: 'A structured lead record is created or updated in the platform.' },
  { label: 'Bitrix24', Icon: Database, desc: 'The qualified lead is synchronized into the CRM automatically.' },
  { label: 'Sales follow-up', Icon: PhoneCall, desc: 'A rep opens an already-qualified lead with full context attached.' },
];

// ── Section 2, step 3: example first messages ───────────────────────────

const FIRST_MESSAGES = [
  "Hi, I'm interested in buying a NetOne laptop on credit.",
  "Hi, I'm looking for a laptop. What financing options do you have?",
  "I want to buy a laptop and I'd like to know what models are available.",
];

// ── Section 7: demo scenarios ───────────────────────────────────────────

interface Scenario {
  letter: string;
  title: string;
  message: string;
  expected: string;
}

const SCENARIOS: Scenario[] = [
  {
    letter: 'A',
    title: 'Basic product enquiry',
    message: "Hi, I'm interested in buying a laptop.",
    expected: 'The system identifies product interest and begins qualification — Nia will ask for the details still missing (product fit, financing preference, location, and so on).',
  },
  {
    letter: 'B',
    title: 'Financing enquiry',
    message: 'Hi, I want to buy a laptop on credit.',
    expected: 'The system identifies financing intent and follows the appropriate qualification path, including the employment-based credit-risk questions used to gauge financing eligibility.',
  },
  {
    letter: 'C',
    title: 'Detailed enquiry',
    message: "Hi, I'm employed and looking for a laptop on credit. I earn K8,000 per month and I'm interested in the NEO Lite 14a.",
    expected: 'The system extracts several pieces of information from one message — product, financing intent, employment and income — so fewer follow-up questions are needed since the customer already supplied the details.',
  },
];

// ── Section 6: what's connected ─────────────────────────────────────────

function demonstratedList(facebookConnected: boolean): string[] {
  return [
    'Live dashboard (Dashboard, Inbox, Leads, Analytics)',
    'A connected WhatsApp number receiving real messages',
    ...(facebookConnected ? ['A connected Facebook Messenger Page receiving real messages'] : []),
    'Real-time inbox and conversation view',
    'AI-assisted understanding of customer messages',
    "NetOne's configurable qualification rules engine",
    'Automatic lead creation and enrichment in a sandbox Bitrix24',
    'Human handoff — a rep can take over a chat from the AI at any time',
    'Channel and source attribution on every lead',
  ];
}

function productionChannelsList(facebookConnected: boolean): string[] {
  const all = ['WhatsApp', 'Facebook', 'Instagram', 'Website enquiries', 'Other approved digital channels'];
  // Facebook moves out of "potential" once it's actually connected — it's
  // sitting in the "currently demonstrated" card above instead.
  return facebookConnected ? all.filter((c) => c !== 'Facebook') : all;
}

export default function HelpPage() {
  const { status } = useWhatsAppStatus();
  const number = displayWaNumber(status.user);
  const connected = status.status === 'connected';
  const { copiedKey, copy } = useCopy();
  const integrationStatus = useRealtimeDoc<IntegrationStatus>('dashboard/status', '/api/status', (r) => r as IntegrationStatus);
  const facebookConnected = integrationStatus?.facebook?.status === 'connected';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      {/* Title */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Demo guide</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">NetOne Demo — How It Works</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-600">
        This proof of concept demonstrates how NetOne can connect digital customer interactions to an
        intelligent lead-qualification workflow — and ultimately to Bitrix24. Everything on this page is
        self-guided: no prior context or explanation is required.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
        <strong className="text-ink-700">
          WhatsApp{facebookConnected ? ' and Facebook Messenger are' : ' is'} being used in this demonstration as
          {facebookConnected ? ' live customer-channel examples.' : ' a live customer-channel example.'}
        </strong>{' '}
        {facebookConnected ? 'They are' : 'It is'} genuinely connected and genuinely process{facebookConnected ? '' : 'es'} real
        messages — not a mock-up, and the exact same AI and qualification rules run regardless of which channel a
        message arrives on. The same underlying architecture is channel-independent and can be extended to
        Instagram, website enquiries and other approved digital channels.
      </p>

      {/* Demo disclaimer — up top, impossible to miss */}
      <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-[13px] leading-relaxed text-amber-900">
            <span className="font-bold uppercase tracking-wide">Demo environment</span>
            <p className="mt-1">
              This is a proof-of-concept and demonstration environment — not NetOne&apos;s production CRM or
              production customer-communication environment. It uses a sandbox Bitrix24 instance and a
              demonstration WhatsApp connection.{' '}
              <strong>Please do not enter real customer personal, financial or confidential information.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Start here */}
      <div className="mt-6 rounded-2xl border border-brand-500/20 bg-brand-50 p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-brand-600">
          <Compass size={14} /> Start here
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Open this dashboard, keep it visible, send a WhatsApp message to the connected number below, and
          watch it appear here in real time. Full step-by-step walkthrough is in Section 2.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] text-ink-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-600">1</span>
            Dashboard open, this tab
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] text-ink-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-600">2</span>
            Bitrix24 open, another tab
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] text-ink-600">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-600">3</span>
            Your phone, ready
          </div>
        </div>
        <Link
          href="/?tour=1"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Compass size={15} /> Take the guided tour
        </Link>
      </div>

      {/* Table of contents */}
      <nav className="mt-6 rounded-xl border border-line bg-white p-4 text-[13px]">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">On this page</div>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {[
            ['sec-1', 'The complete flow'],
            ['sec-2', 'How to test the demo'],
            ['sec-3', 'What to look for in Bitrix24'],
            ['sec-4', 'AI-assisted qualification'],
            ['sec-5', 'Business rules'],
            ['sec-6', "What's actually connected"],
            ['sec-7', 'Demo scenarios'],
            ['sec-8', 'Demo tips'],
            ['sec-9', 'Demo disclaimer'],
            ['sec-10', 'Troubleshooting'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-ink-600 hover:text-brand-600 hover:underline">
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Section 1: the complete flow ── */}
      <div className="mt-10">
        <SectionHeading n={1} title="The complete flow" id="sec-1" />
        <div className="card p-5">
          <div className="flex flex-col gap-0">
            {FLOW_STAGES.map((s, i) => (
              <div key={s.label}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <s.Icon size={16} />
                  </span>
                  <div className="pt-1.5">
                    <div className="text-sm font-semibold text-ink-900">{s.label}</div>
                    <div className="text-[13px] text-ink-500">{s.desc}</div>
                  </div>
                </div>
                {i < FLOW_STAGES.length - 1 && (
                  <div className="ml-[17px] flex h-5 items-center">
                    <ArrowDown size={13} className="text-ink-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: how to test ── */}
      <div className="mt-10">
        <SectionHeading n={2} title="How to test the demo" id="sec-2" />

        <div className="space-y-3">
          <NumberedStep n={1} title="Open the dashboard">
            <p>Open the NetOne Demo dashboard and keep it open throughout the test — every step below happens live on screen.</p>
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-[12px] text-ink-500">
              Recommended setup: dashboard in one browser tab, Bitrix24 in another, and your phone ready to send
              a WhatsApp message.
            </p>
          </NumberedStep>

          <NumberedStep n={2} title={facebookConnected ? 'Find the connected WhatsApp number or Facebook Page' : 'Find the connected WhatsApp number'}>
            <p>
              The WhatsApp integration is already connected for this demonstration — there is nothing to set up
              or pair. The connected NetOne demo line is <strong className="font-bold text-ink-900">0762 368 105</strong> (+260 762 368 105).
              {facebookConnected && ' A Facebook Page is also connected — either works for the walkthrough below.'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Smartphone size={15} />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Active Demo Line — Ready to Test
                  </div>
                  <div className="truncate text-base font-bold text-ink-900">0762 368 105</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://wa.me/260762368105?text=Hi%2C%20I%27m%20interested%20in%20buying%20a%20NetOne%20laptop%20on%20credit.%20What%20financing%20options%20do%20you%20have%3F"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle size={13} /> Chat on WhatsApp
                </a>
                <button
                  onClick={() => copy('wa-number', '0762 368 105')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  {copiedKey === 'wa-number' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copiedKey === 'wa-number' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {facebookConnected && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <MessageCircle size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Facebook Messenger — also live for this demo
                    </div>
                    <div className="truncate text-base font-bold text-ink-900">
                      {FACEBOOK_PAGE_USERNAME ? `m.me/${FACEBOOK_PAGE_USERNAME}` : 'Connected Page'}
                    </div>
                  </div>
                </div>
                {FACEBOOK_PAGE_USERNAME && (
                  <a
                    href={`https://m.me/${FACEBOOK_PAGE_USERNAME}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <MessageCircle size={13} /> Message on Facebook
                  </a>
                )}
              </div>
            )}
          </NumberedStep>

          <NumberedStep n={3} title="Send a test enquiry as a customer">
            <p>
              On your phone, pretend you are a prospective client inquiring about purchasing a laptop or requesting financing on credit. Send a message to <strong className="font-semibold text-ink-800">0762 368 105</strong>.
            </p>
            <p className="text-[12px] text-ink-500">
              Tap any example prompt below to copy it or open directly in WhatsApp:
            </p>
            <div className="space-y-1.5">
              {FIRST_MESSAGES.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <CopyableMessage text={m} />
                  </div>
                  <a
                    href={`https://wa.me/260762368105?text=${encodeURIComponent(m)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Send via WhatsApp"
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Send <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </NumberedStep>

          <NumberedStep n={4} title="Watch the dashboard">
            <p>Within a few seconds, you should see, live:</p>
            <ul className="list-disc space-y-1 pl-4 marker:text-brand-400">
              <li>The inbound WhatsApp message and the conversation appearing in the Inbox</li>
              <li>The customer&apos;s contact information</li>
              <li>Lead processing running through the pipeline</li>
              <li>Qualification information — a score and the reasoning behind it</li>
              <li>Nia&apos;s AI-assisted reply, asking for anything still missing</li>
              <li>The lead&apos;s status updating</li>
            </ul>
            <p>This demonstrates the platform receiving and processing a customer enquiry in real time — nothing here is pre-recorded.</p>
          </NumberedStep>

          <NumberedStep n={5} title="Observe qualification">
            <p>
              The platform identifies information the customer has already provided and works out what is still
              needed — for example, product interest, financing preference, or (when relevant) employment and
              income for a financing eligibility read.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-[12px] text-ink-600">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-brand-500" />
              The AI assists with understanding the conversation and extracting relevant information. NetOne&apos;s
              actual qualification criteria are then implemented as explicit, configurable business rules — the
              AI does not independently decide business policy.
            </div>
          </NumberedStep>

          <NumberedStep n={6} title="Open Bitrix24">
            <p>Open the sandbox CRM in a separate tab and log in with the demo credentials below.</p>

            <div className="rounded-xl border-2 border-brand-500/30 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lock size={14} className="text-brand-600" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Demo credentials — demo environment only</span>
              </div>
              <div className="space-y-2">
                <CopyField label="Bitrix24 URL" value={DEMO_BITRIX.url} copyKey="bitrix-url" copiedKey={copiedKey} onCopy={copy} />
                <CopyField label="Email" value={DEMO_BITRIX.email} copyKey="bitrix-email" copiedKey={copiedKey} onCopy={copy} />
                <CopyField label="Password" value={DEMO_BITRIX.password} copyKey="bitrix-password" copiedKey={copiedKey} onCopy={copy} />
              </div>
              <a
                href={DEMO_BITRIX.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Open Bitrix24 <ExternalLink size={14} />
              </a>
              <p className="mt-2 text-[11px] text-ink-400">
                A sandbox CRM created for this demonstration — not NetOne&apos;s production Bitrix24 account.
              </p>
            </div>

            <ol className="list-decimal space-y-1 pl-4 marker:text-brand-400">
              <li>Open Bitrix24 in a separate browser tab.</li>
              <li>Log in using the demo credentials above.</li>
              <li>Navigate to the Leads / CRM area.</li>
              <li>Find the lead generated by your test enquiry.</li>
              <li>Open the lead.</li>
              <li>Review the captured information and qualification data.</li>
            </ol>
            <p>
              This lets you see the complete journey with your own eyes: WhatsApp → Platform → Qualification →
              Bitrix24.
            </p>
          </NumberedStep>
        </div>
      </div>

      {/* ── Section 3: what to look for in Bitrix24 ── */}
      <div className="mt-10">
        <SectionHeading n={3} title="What to look for in Bitrix24" id="sec-3" />
        <p className="mb-3 text-sm text-ink-500">Depending on what your test message included, the lead record may contain:</p>
        <div className="card p-5">
          <ul className="grid gap-x-6 gap-y-2 text-[13px] text-ink-700 sm:grid-cols-2">
            {[
              'Customer contact information (name, phone)',
              'Source and channel (e.g. WhatsApp)',
              "The customer's original enquiry",
              'Product interest',
              'Financing intent',
              'Qualification score and tier, with reasoning',
              'Lead status (New / In Process / Junk)',
              'AI-generated intent and conversation summary',
              'Financing eligibility indicator (when financing is relevant)',
              'Collected profile detail — budget, location, employment, income',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-400">
            The exact fields present depend on how much the customer shared — the platform never invents
            information the conversation didn&apos;t provide.
          </p>
        </div>
      </div>

      {/* ── Section 4: AI-assisted qualification ── */}
      <div className="mt-10">
        <SectionHeading n={4} title="AI-assisted qualification" id="sec-4" />
        <div className="card p-5">
          <p className="text-sm leading-relaxed text-ink-700">
            The AI layer helps understand natural-language customer conversations and extract structured
            information from them.
          </p>

          <div className="mt-4 rounded-xl border border-line bg-surface-muted p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Example</div>
            <p className="mt-1.5 text-[13px] italic text-ink-700">
              &ldquo;I&apos;m looking for a laptop on credit. I&apos;m employed and earn about K8,000 per month.&rdquo;
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Intent', 'Laptop purchase'],
                ['Financing', 'Yes'],
                ['Employment', 'Employed'],
                ['Income', 'K8,000'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white px-2.5 py-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">{k}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-ink-800">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              This information can then be evaluated against NetOne&apos;s configured qualification rules.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center gap-2 text-[12px] font-bold text-brand-600">
                <Brain size={14} /> AI
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600">Understanding, extraction, and conversation assistance.</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center gap-2 text-[12px] font-bold text-brand-600">
                <Scale size={14} /> Rules
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600">NetOne&apos;s actual qualification and routing criteria.</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-ink-400">
            This distinction matters for enterprise reliability and governance — business-critical decisions stay
            in explicit, auditable rules, not inside a model.
          </p>
        </div>
      </div>

      {/* ── Section 5: business rules ── */}
      <div className="mt-10">
        <SectionHeading n={5} title="Business rules" id="sec-5" />
        <div className="card p-5">
          <p className="text-sm leading-relaxed text-ink-700">
            The <strong>Rules</strong> page is where NetOne&apos;s qualification logic is configured — open it from
            the sidebar, or jump straight there below.
          </p>
          <Link
            href="/settings/qualification-rules"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
          >
            <SlidersHorizontal size={14} /> Open Qualification Rules <ArrowRight size={13} />
          </Link>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                <CircleCheck size={13} /> Currently demonstrated
              </div>
              <ul className="space-y-1.5 text-[13px] text-ink-700">
                {['Required information per lead', 'Weighted lead scoring (0–100)', 'Employment-based financing eligibility weighting', 'Qualification thresholds (qualified / needs follow-up / unqualified)', 'Routing to a sales desk (e.g. Financing, Customer Care)'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                <Circle size={13} /> Proposed production capability
              </div>
              <ul className="space-y-1.5 text-[13px] text-ink-500">
                {['Full sales-ready / escalation criteria tuned to NetOne policy', 'Automated follow-up escalation and reminders', 'Multi-team routing tied to real Bitrix24 users'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Circle size={13} className="mt-0.5 shrink-0 text-ink-300" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 6: what's actually connected ── */}
      <div className="mt-10">
        <SectionHeading n={6} title="What's actually connected" id="sec-6" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
              <CircleCheck size={13} /> Currently demonstrated
            </div>
            <ul className="space-y-1.5 text-[13px] text-ink-700">
              {demonstratedList(facebookConnected).map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
              <Circle size={13} /> Potential production channels
            </div>
            <ul className="space-y-1.5 text-[13px] text-ink-500">
              {productionChannelsList(facebookConnected).map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Circle size={13} className="mt-0.5 shrink-0 text-ink-300" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-400">
              A production rollout would connect NetOne&apos;s actual business accounts and systems once
              requirements, access and security arrangements are finalized.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 7: demo scenarios ── */}
      <div className="mt-10">
        <SectionHeading n={7} title="Demo scenarios" id="sec-7" />
        <div className="space-y-3">
          {SCENARIOS.map((s) => (
            <div key={s.letter} className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-600">
                  {s.letter}
                </span>
                <div className="text-sm font-semibold text-ink-900">Scenario {s.letter} — {s.title}</div>
              </div>
              <div className="mt-2.5 pl-9">
                <CopyableMessage text={s.message} />
                <div className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-500">
                  <ArrowRight size={13} className="mt-0.5 shrink-0 text-brand-500" />
                  <span><strong className="text-ink-700">Expected:</strong> {s.expected}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 8: demo tips ── */}
      <div className="mt-10">
        <SectionHeading n={8} title="Demo tips" id="sec-8" />
        <div className="card p-5">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-brand-500" />
            For the most impressive demonstration, send the message while the dashboard and Bitrix24 are both
            visible on screen.
          </p>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recommended presentation flow</div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] text-ink-700 marker:font-semibold marker:text-brand-500">
            <li>Start on the dashboard.</li>
            <li>Briefly explain the architecture.</li>
            <li>Send the WhatsApp message.</li>
            <li>Show it appear in the Inbox.</li>
            <li>Show qualification and processing happen live.</li>
            <li>Open Bitrix24.</li>
            <li>Show the resulting lead.</li>
            <li>Explain how NetOne&apos;s actual rules would control qualification in production.</li>
            <li>Explain how additional channels can be connected.</li>
          </ol>
        </div>
      </div>

      {/* ── Section 9: demo disclaimer ── */}
      <div className="mt-10">
        <SectionHeading n={9} title="Demo disclaimer" id="sec-9" />
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-amber-700">
            <ShieldAlert size={15} /> Demo environment
          </div>
          <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-amber-900">
            <p>This environment is a proof-of-concept and demonstration environment. It is not NetOne&apos;s production CRM or production customer-communication environment.</p>
            <p>Do not enter real customer personal, financial or confidential information into this demonstration environment.</p>
            <p>This demonstration uses a sandbox Bitrix24 environment and a demonstration WhatsApp connection.</p>
          </div>
        </div>
      </div>

      {/* ── Section 10: troubleshooting ── */}
      <div className="mt-10">
        <SectionHeading n={10} title="Troubleshooting" id="sec-10" />
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <HelpCircle size={15} className="text-brand-500" /> The WhatsApp message doesn&apos;t appear
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-ink-600 marker:text-brand-400">
              <li>Confirm the message was sent to the connected demo number (Section 2, Step 2).</li>
              <li>Confirm the dashboard shows the WhatsApp integration as connected.</li>
              <li>Refresh the dashboard if necessary.</li>
              <li>Check the connection status in the header status widget.</li>
              <li>Contact the demonstration administrator if the issue persists.</li>
            </ol>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <RefreshCw size={15} className="text-brand-500" /> The lead doesn&apos;t immediately appear in Bitrix24
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-ink-600 marker:text-brand-400">
              <li>Wait briefly for processing — the pipeline runs through several stages in view on the dashboard.</li>
              <li>Refresh the Bitrix24 CRM page.</li>
              <li>Search the Leads section.</li>
              <li>Check the dashboard for the lead&apos;s Bitrix24 sync status.</li>
            </ol>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Brain size={15} className="text-brand-500" /> AI processing fails or looks off
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              This proof of concept depends on external AI services. A production implementation would include
              retry and fallback handling for AI provider outages — the same principle already used in this
              demo, which falls back to a deterministic flow if an AI provider is unavailable.
            </p>
          </div>
        </div>
      </div>

      {/* What to look for on the dashboard — quick reference, kept from the original page */}
      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Quick reference — where to look on the dashboard</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { Icon: Gauge, title: 'AI Lead Score', body: "On the Dashboard's Current Lead card and in the Inbox — a 0-100 score with a criterion-by-criterion breakdown, not just a label." },
            { Icon: ShieldCheck, title: 'Credit Risk badge', body: 'Appears once financing is mentioned — Low / Medium / High / Not eligible, derived from employment type.' },
            { Icon: Database, title: 'Bitrix24 sync', body: 'Click the violet "Lead #___" badge on a qualified lead to open the real record in Bitrix24.' },
            { Icon: BookOpen, title: 'Knowledge Base', body: "Nia answers product questions from here. Edit a price and ask again — she'll use the new figure." },
            { Icon: SlidersHorizontal, title: 'Qualification Rules', body: 'Change a weight or an employment-type multiplier, then send another test message — the score reacts immediately.' },
            { Icon: Users, title: 'Leads', body: 'Every lead the pipeline has qualified, searchable and filterable. Export the current view to Excel from the top-right button.' },
            { Icon: BarChart3, title: 'Analytics', body: 'The management view — conversion rate, credit-risk distribution, top products, lead volume over time. Every number is computed live, nothing simulated.' },
            { Icon: UserCheck, title: 'Human handoff', body: 'Send a manual reply from the Inbox and Nia pauses automatically for that chat — a "Resume AI" button hands it back to her when you\'re done.' },
          ].map((l) => (
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
