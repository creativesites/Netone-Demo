'use client';

import { Check, Circle } from 'lucide-react';
import type { ScoreCriterionResult } from '@/lib/types';

function barColor(score: number) {
  if (score >= 70) return 'from-emerald-500 to-emerald-400';
  if (score >= 40) return 'from-amber-500 to-amber-400';
  return 'from-rose-500 to-rose-400';
}

function scoreTone(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

/** The "why" behind a lead's qualification — configurable criteria, not a black box. */
export function LeadScoreCard({
  score,
  breakdown,
  nextAction,
  compact = false,
}: {
  score: number | null;
  breakdown: ScoreCriterionResult[] | null;
  nextAction?: string | null;
  compact?: boolean;
}) {
  if (score == null || !breakdown || breakdown.length === 0) return null;
  const missing = breakdown.filter((b) => b.required && !b.met);

  return (
    <div className={`rounded-xl border border-line bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">AI Lead Score</span>
        <span className={`text-sm font-bold ${scoreTone(score)}`}>{score}/100</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor(score)} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <div className="space-y-1">
        {breakdown.map((b) => (
          <div key={b.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-ink-700">
              {b.met ? (
                <Check size={12} className="shrink-0 text-emerald-500" />
              ) : (
                <Circle size={12} className="shrink-0 text-gray-300" />
              )}
              <span className="truncate">{b.label}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-400">
              {b.earned}/{b.weight}
            </span>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          Missing: {missing.map((m) => m.label).join(', ')}
        </div>
      )}
      {nextAction && (
        <div className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700">
          Next action: {nextAction}
        </div>
      )}
    </div>
  );
}
