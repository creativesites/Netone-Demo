'use client';

import { Check, Circle } from 'lucide-react';
import { useRealtimeDoc } from '@/lib/realtime';
import { relevantFields, computeDiscovery, hasFieldValue } from '@/lib/discovery';
import type { CollectedProfile, QualificationRules } from '@/lib/types';

/** Registry-driven replacement for the old hardcoded 7-field checklist —
 *  reads the same field registry (required/order/question) the Rules page
 *  edits and the live conversation asks from, so this panel is never out
 *  of sync with what Nia is actually collecting. */
export function DiscoveryPanel({ collected, compact = false }: { collected: CollectedProfile | null | undefined; compact?: boolean }) {
  const rules = useRealtimeDoc<QualificationRules>(
    'settings/qualificationRules',
    '/api/settings/qualification-rules',
    (r) => r as QualificationRules,
    10000
  );

  const c = collected ?? ({} as CollectedProfile);
  const fields = rules?.fields ?? [];
  const relevant = relevantFields(fields, c);
  const discovery = computeDiscovery(fields, c);
  const required = relevant.filter((f) => f.required);
  const optionalFilled = relevant.filter((f) => !f.required && hasFieldValue(c, f.key));
  const pct = discovery.completionPercentage;

  if (!rules) {
    return <div className="text-xs text-ink-400">Loading discovery fields…</div>;
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`font-semibold uppercase tracking-wide text-ink-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          Discovery progress
        </span>
        <span className={`font-bold text-ink-700 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {discovery.collectedCount}/{discovery.totalRequired} required · {pct}%
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1">
        {required.map((f) => {
          const val = c[f.key];
          const filled = hasFieldValue(c, f.key);
          return (
            <div key={f.key} className="flex items-center gap-2 text-xs">
              {filled ? <Check size={13} className="shrink-0 text-emerald-500" /> : <Circle size={13} className="shrink-0 text-gray-300" />}
              <span className="text-ink-400">{f.label}:</span>
              <span className="truncate text-ink-800">{filled ? String(val) : '—'}</span>
            </div>
          );
        })}
      </div>

      {optionalFilled.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">Additional details</div>
          <div className="space-y-1">
            {optionalFilled.map((f) => (
              <div key={f.key} className="flex items-center gap-2 text-xs">
                <Check size={13} className="shrink-0 text-brand-400" />
                <span className="text-ink-400">{f.label}:</span>
                <span className="truncate text-ink-800">{String(c[f.key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {discovery.nextField && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] text-brand-700">
          Next: {discovery.nextField.label}
        </div>
      )}
    </div>
  );
}
