'use client';

// Shared with analytics/page.tsx so the funnel and any other stage-colored
// element on this page never disagree about a stage's label/color.
export const STAGE_LABEL: Record<string, string> = {
  NEW: 'New',
  DISCOVERING: 'Discovering',
  QUALIFICATION_PENDING: 'Qualification pending',
  QUALIFIED: 'Qualified',
  NEEDS_REVIEW: 'Needs review',
  DISQUALIFIED: 'Disqualified',
  SALES_READY: 'Sales ready',
  CONVERTED: 'Converted',
};
export const STAGE_COLOR: Record<string, string> = {
  NEW: 'bg-gray-300',
  DISCOVERING: 'bg-sky-500',
  QUALIFICATION_PENDING: 'bg-teal-500',
  QUALIFIED: 'bg-emerald-500',
  NEEDS_REVIEW: 'bg-amber-500',
  DISQUALIFIED: 'bg-rose-400',
  SALES_READY: 'bg-emerald-600',
  CONVERTED: 'bg-violet-500',
};

// The "happy path" progression, shown as a shrinking funnel. NEEDS_REVIEW
// and DISQUALIFIED are branches OFF this path, not further stops along it —
// forcing them into the funnel would make the bars non-monotonic and
// misleading, so they're called out separately underneath instead.
const FUNNEL_ORDER = ['NEW', 'DISCOVERING', 'QUALIFICATION_PENDING', 'QUALIFIED', 'SALES_READY', 'CONVERTED'];
const OFFRAMP_ORDER = ['NEEDS_REVIEW', 'DISQUALIFIED'];

export function StageFunnel({ byStage }: { byStage: { stage: string; count: number }[] }) {
  const countOf = (stage: string) => byStage.find((r) => r.stage === stage)?.count ?? 0;
  const maxCount = Math.max(1, ...FUNNEL_ORDER.map(countOf));
  const offramps = OFFRAMP_ORDER.map((stage) => ({ stage, count: countOf(stage) })).filter((r) => r.count > 0);
  const hasData = byStage.some((r) => r.count > 0);

  return (
    <div className="card p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Pipeline funnel</div>
      <p className="mb-4 text-[11px] text-ink-400">
        Today&apos;s stage distribution, shown funnel-style — a live snapshot, not a cohort-retention funnel.
      </p>

      {!hasData ? (
        <div className="py-6 text-center text-sm text-ink-400">No leads yet.</div>
      ) : (
        <>
          <div className="space-y-2">
            {FUNNEL_ORDER.map((stage) => {
              const count = countOf(stage);
              const widthPct = Math.max(count > 0 ? 10 : 0, (count / maxCount) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-xs text-ink-600">{STAGE_LABEL[stage] ?? stage}</span>
                  <div className="h-7 flex-1">
                    <div
                      className={`mx-auto flex h-full min-w-[2.5rem] items-center justify-center rounded-lg text-[11px] font-semibold text-white transition-all duration-500 ${STAGE_COLOR[stage] ?? 'bg-gray-300'}`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {count > 0 && count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {offramps.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11px]">
              <span className="text-ink-400">Diverted from the funnel:</span>
              {offramps.map((o) => (
                <span key={o.stage} className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-ink-600">
                  {STAGE_LABEL[o.stage]}: {o.count}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
