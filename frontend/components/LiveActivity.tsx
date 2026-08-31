'use client';

import { Check, X, AlertTriangle, Circle, MessageCircle, Zap } from 'lucide-react';
import type { ActiveEvent, PipelineStep } from '@/lib/types';
import { formatTime } from '@/lib/format';

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'ok')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={11} />
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <X size={11} />
      </span>
    );
  if (status === 'info')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <AlertTriangle size={10} />
      </span>
    );
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-ink-400">
      <Circle size={8} fill="currentColor" />
    </span>
  );
}

function fmtTime(val: unknown) {
  return formatTime(val, true, '');
}

const FINAL_KEYS = ['follow_up_created', 'auto_reply_sent', 'not_a_lead'];

export function LiveActivity({ active }: { active: ActiveEvent | null }) {
  if (!active) {
    return (
      <div className="card flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-15 animate-pulse-ring" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <MessageCircle size={24} />
          </span>
        </div>
        <div className="text-sm font-semibold text-ink-900">Waiting for incoming lead…</div>
        <div className="mt-1 max-w-xs text-[13px] text-ink-500">
          Send a WhatsApp message to the demo number. The pipeline will react here in real time.
        </div>
      </div>
    );
  }

  const done = active.steps.some((s) => FINAL_KEYS.includes(s.key));
  const hasError = active.steps.some((s) => s.status === 'error');

  return (
    <div className="animate-fade-up card border-brand-500/20 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center gap-1 rounded-full bg-brand-50 px-2 text-[11px] font-bold uppercase tracking-wide text-brand-600">
            <Zap size={11} /> New Lead
          </span>
          {!done && !hasError && <span className="text-[11px] text-amber-600">processing…</span>}
          {done && <span className="text-[11px] text-emerald-600">complete</span>}
        </div>
        <span className="text-[11px] uppercase tracking-wide text-ink-400">{active.channel}</span>
      </div>

      <div className="mb-4">
        <div className="text-base font-semibold text-ink-900">{active.contact.name ?? 'Unknown contact'}</div>
        <div className="text-xs text-ink-500">{active.contact.phone}</div>
        <blockquote className="mt-3 rounded-xl border-l-2 border-brand-500 bg-surface-muted px-3 py-2 text-sm text-ink-700">
          “{active.message}”
        </blockquote>
      </div>

      <div className="space-y-1">
        {active.steps.map((s) => (
          <div key={s.key} className="animate-fade-up flex items-center gap-3 rounded-md px-2 py-1.5">
            <StepIcon status={s.status} />
            <div className="flex-1">
              <div className={`text-sm ${s.status === 'error' ? 'text-rose-600' : s.status === 'info' ? 'text-amber-700' : 'text-ink-800'}`}>
                {s.label}
              </div>
              {s.detail && <div className="text-[11px] text-ink-400">{s.detail}</div>}
            </div>
            <div className="text-[10px] tabular-nums text-ink-400">{fmtTime(s.at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
