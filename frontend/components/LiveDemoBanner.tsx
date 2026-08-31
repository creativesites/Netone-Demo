'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

const DEMO_PHONE_DISPLAY = '0762 368 105';
const DEMO_PHONE_INTL = '+260 762 368 105';
const DEMO_PHONE_DIGITS = '260762368105';

interface Scenario {
  id: string;
  title: string;
  badge: string;
  message: string;
  explanation: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'financing',
    title: 'Financing / Credit Query',
    badge: 'Popular',
    message: "Hi, I'm interested in buying a NetOne laptop on credit. What financing options do you have?",
    explanation: 'Triggers Nia to evaluate purchase intent and ask credit qualification questions.',
  },
  {
    id: 'complete-profile',
    title: 'Full Details Provided',
    badge: 'Fast-Track',
    message: "Hi, I'm employed and looking for a laptop on credit. I earn K8,000/month and I'm interested in the NEO Lite 14a.",
    explanation: 'Extracts product, employment, and income in one turn — generates an instant high score.',
  },
  {
    id: 'product-bundle',
    title: 'Product / Teacher Bundle',
    badge: 'Catalog',
    message: 'Hello, how much is the Teacher Digital Literacy bundle and what does it include?',
    explanation: 'Tests Nia pulling accurate pricing and specs from NetOne Knowledge Base.',
  },
];

export function LiveDemoBanner() {
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  function copyNumber() {
    navigator.clipboard?.writeText(DEMO_PHONE_DISPLAY);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  }

  function copyMessage(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedMsg(id);
    setTimeout(() => setCopiedMsg(null), 2000);
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-brand-500/25 bg-gradient-to-br from-brand-50/70 via-white to-emerald-50/50 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-brand-100/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-pulse-ring" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Live Demo
            </span>
            <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:inline-block">
              WhatsApp Engine Online
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/help"
            className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
          >
            Full Guide <ArrowRight size={12} />
          </Link>
          <button
            onClick={() => setMinimized((v) => !v)}
            aria-label={minimized ? 'Expand banner' : 'Collapse banner'}
            className="rounded-lg p-1 text-ink-400 hover:bg-white hover:text-ink-700"
          >
            {minimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!minimized ? (
        <div className="p-4 sm:p-6">
          <div className="max-w-3xl">
            <h2 className="text-base font-semibold text-ink-900 sm:text-lg">
              How to Test: Send a Real WhatsApp Message from Your Phone
            </h2>
            <p className="mt-1 text-xs text-ink-600 sm:text-sm">
              Pretend you are a prospective customer inquiring about a laptop. Send a WhatsApp message to our
              live demo number below and watch <strong>Nia AI qualify the lead, calculate credit risk, and sync it to Bitrix24</strong> in real time on this dashboard.
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            {/* Step 1: Target Phone Number Card */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-200/80 bg-white p-4 shadow-sm lg:col-span-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  <Smartphone size={14} /> Step 1: WhatsApp Demo Line
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                  {DEMO_PHONE_DISPLAY}
                </div>
                <div className="mt-0.5 text-xs text-ink-400">{DEMO_PHONE_INTL}</div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={`https://wa.me/${DEMO_PHONE_DIGITS}?text=${encodeURIComponent(SCENARIOS[0].message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <MessageSquare size={14} /> Chat on WhatsApp <ExternalLink size={12} />
                </a>
                <button
                  onClick={copyNumber}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-muted px-3 py-2 text-xs font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {copiedNumber ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copiedNumber ? 'Copied Number!' : 'Copy Number'}
                </button>
              </div>
            </div>

            {/* Step 2: Test Scenario Prompts */}
            <div className="rounded-xl border border-brand-200/70 bg-white p-4 shadow-sm lg:col-span-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                  <Sparkles size={14} /> Step 2: Choose a Test Scenario (or write your own)
                </div>
                <span className="text-[10px] text-ink-400">Click scenario to copy or open</span>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {SCENARIOS.map((s) => {
                  const isCopied = copiedMsg === s.id;
                  const waUrl = `https://wa.me/${DEMO_PHONE_DIGITS}?text=${encodeURIComponent(s.message)}`;
                  return (
                    <div
                      key={s.id}
                      className="group flex flex-col justify-between rounded-xl border border-line bg-surface-muted/60 p-3 transition-colors hover:border-brand-300 hover:bg-white"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-ink-900">{s.title}</span>
                          <span className="rounded bg-brand-100/70 px-1.5 py-0.2 text-[9px] font-semibold text-brand-700">
                            {s.badge}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] italic text-ink-700">&ldquo;{s.message}&rdquo;</p>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-line/60">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open directly in WhatsApp with this text"
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Send <ExternalLink size={10} />
                        </a>
                        <button
                          onClick={() => copyMessage(s.id, s.message)}
                          title="Copy message to clipboard"
                          className="flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1.5 text-[10px] font-medium text-ink-600 hover:bg-surface-muted"
                        >
                          {isCopied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 3 footer notice */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50/60 px-3 py-2 text-[11px] text-ink-600">
                <div className="flex items-center gap-1.5">
                  <Zap size={13} className="text-brand-600 shrink-0" />
                  <span>
                    <strong>Step 3:</strong> Watch Live Activity &amp; Current Lead on this screen update in under 3 seconds!
                  </span>
                </div>
                <div className="hidden items-center gap-1 font-medium text-ink-500 md:flex">
                  <ShieldCheck size={12} className="text-emerald-600" /> Sandbox Bitrix24 Connected
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Minimized bar */
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-ink-600 sm:px-6">
          <div className="flex items-center gap-3">
            <span>
              Text WhatsApp demo line: <strong className="font-semibold text-ink-900">{DEMO_PHONE_DISPLAY}</strong>
            </span>
            <button
              onClick={copyNumber}
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-700 shadow-sm border border-line"
            >
              {copiedNumber ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setMinimized(false)}
            className="text-[11px] font-semibold text-brand-600 hover:underline"
          >
            Show full testing guide
          </button>
        </div>
      )}
    </div>
  );
}
