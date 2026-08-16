'use client';

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  /** Tailwind bg-* class for the bar fill — status color when the category is a
   *  reserved state (qualification/credit-risk), a single neutral hue otherwise. */
  colorClass: string;
}

/** Horizontal, ranked bar list. Direct-labeled (name + count on every row is fine
 *  here since row count is always small, ≤8) so identity never depends on color alone. */
export function BreakdownBars({ title, rows, emptyLabel }: { title: string; rows: BreakdownRow[]; emptyLabel?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-5">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-400">{emptyLabel ?? 'No data yet.'}</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-ink-600" title={r.label}>
                {r.label}
              </span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${r.colorClass}`}
                  style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-800">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
