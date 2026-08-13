'use client';

import type { ActiveEvent, PipelineStep } from '@/lib/types';

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'ok')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-400">
        ✓
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] text-rose-400">
        ✗
      </span>
    );
  if (status === 'info')
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] text-amber-400">
        !
      </span>
    );
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] text-slate-400">
      •
    </span>
  );
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

const FINAL_KEYS = ['follow_up_created'];

export function LiveActivity({ active }: { active: ActiveEvent | null }) {
  if (!active) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-30 animate-pulse-ring" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 text-2xl">
            💬
          </span>
        </div>
        <div className="text-sm font-semibold text-slate-200">Waiting for incoming lead…</div>
        <div className="mt-1 max-w-xs text-xs text-slate-500">
          Send a WhatsApp message to the demo number. The pipeline will react here in real time.
        </div>
      </div>
    );
  }

  const done = active.steps.some((s) => FINAL_KEYS.includes(s.key));
  const hasError = active.steps.some((s) => s.status === 'error');

  return (
    <div className="animate-fade-up rounded-xl border border-brand-500/30 bg-gradient-to-b from-brand-500/[0.08] to-transparent p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center rounded-full bg-brand-500/20 px-2 text-[11px] font-bold uppercase tracking-wide text-brand-500">
            ⚡ New Lead
          </span>
          {!done && !hasError && (
            <span className="text-[11px] text-amber-300">processing…</span>
          )}
          {done && <span className="text-[11px] text-emerald-300">complete</span>}
        </div>
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          {active.channel}
        </span>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-white">
          {active.contact.name ?? 'Unknown contact'}
        </div>
        <div className="text-xs text-slate-400">{active.contact.phone}</div>
        <blockquote className="mt-3 rounded-lg border-l-2 border-brand-500 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
          “{active.message}”
        </blockquote>
      </div>

      <div className="space-y-1">
        {active.steps.map((s) => (
          <div
            key={s.key}
            className="animate-fade-up flex items-center gap-3 rounded-md px-2 py-1.5"
          >
            <StepIcon status={s.status} />
            <div className="flex-1">
              <div
                className={`text-sm ${
                  s.status === 'error'
                    ? 'text-rose-300'
                    : s.status === 'info'
                      ? 'text-amber-200'
                      : 'text-slate-200'
                }`}
              >
                {s.label}
              </div>
              {s.detail && <div className="text-[11px] text-slate-500">{s.detail}</div>}
            </div>
            <div className="text-[10px] tabular-nums text-slate-600">{fmtTime(s.at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
