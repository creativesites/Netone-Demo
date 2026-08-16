'use client';

import { useState } from 'react';

function fmtDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Simple, single-series (one hue — magnitude only) daily bar chart with a hover tooltip. */
export function DailyVolumeChart({ data }: { data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const showEvery = data.length > 10 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Leads per day</span>
        <span className="text-[11px] text-ink-400">last {data.length} days</span>
      </div>

      <div className="relative">
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
          >
            {data[hover].count} lead{data[hover].count === 1 ? '' : 's'} · {fmtDay(data[hover].day)}
            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
          </div>
        )}

        <div className="flex h-32 items-end gap-1">
          {data.map((d, i) => {
            const heightPct = Math.max(3, (d.count / max) * 100);
            return (
              <div
                key={d.day}
                className="group flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${
                    hover === i ? 'bg-brand-600' : 'bg-brand-500/70 group-hover:bg-brand-600'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 flex gap-1">
          {data.map((d, i) => (
            <div key={d.day} className="flex-1 text-center text-[9px] text-ink-400">
              {i % showEvery === 0 ? fmtDay(d.day) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
