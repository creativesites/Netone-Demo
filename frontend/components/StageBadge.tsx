import type { QualificationStage } from '@/lib/types';

interface StageMeta {
  label: string;
  cls: string;
  dot: string;
}

// 8-state lifecycle badge — replaces the old 3-state qualification badge
// everywhere it appeared. Colors intentionally escalate: cool/neutral for
// early states, amber for "needs a human", emerald for qualified/ready,
// rose for ruled out, violet as the distinct "done" color for CONVERTED.
const STAGE_META: Record<QualificationStage, StageMeta> = {
  NEW: { label: 'New', cls: 'bg-gray-100 text-ink-500 border-line', dot: 'bg-ink-400' },
  DISCOVERING: { label: 'Discovering', cls: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  QUALIFICATION_PENDING: { label: 'Qualification pending', cls: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  QUALIFIED: { label: 'Qualified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  NEEDS_REVIEW: { label: 'Needs review', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  DISQUALIFIED: { label: 'Disqualified', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-400' },
  SALES_READY: { label: 'Sales ready', cls: 'bg-emerald-600 text-white border-emerald-600', dot: 'bg-emerald-600' },
  CONVERTED: { label: 'Converted', cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
};

const FALLBACK: StageMeta = { label: 'Pending', cls: 'bg-gray-100 text-ink-400 border-line', dot: 'bg-ink-300' };

export function stageMeta(stage: string | null | undefined): StageMeta {
  return STAGE_META[stage as QualificationStage] ?? FALLBACK;
}

export function StageBadge({ stage, className = '' }: { stage: string | null | undefined; className?: string }) {
  const m = stageMeta(stage);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${m.cls} ${className}`}>
      {m.label}
    </span>
  );
}

export function StageDot({ stage, className = '' }: { stage: string | null | undefined; className?: string }) {
  const m = stageMeta(stage);
  return <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot} ${className}`} />;
}
