const CHANNELS = [
  { label: 'WhatsApp', icon: '💬', live: true },
  { label: 'Facebook', icon: '📘', live: false },
  { label: 'Instagram', icon: '📷', live: false },
  { label: 'Website', icon: '🌐', live: false },
];

/**
 * Positioning visual, not a feature list: shows that WhatsApp plugs into the
 * same lead-processing engine that Facebook/Instagram/Website would use, so
 * adding a channel later is an adapter, not new business logic.
 */
export function OmnichannelArchitecture() {
  return (
    <div className="card p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Omnichannel Architecture</div>
      <p className="mb-4 text-xs text-ink-500">
        WhatsApp is the channel we&apos;re demonstrating live today. Every channel feeds the same lead-processing
        engine, so adding Facebook, Instagram or the website later doesn&apos;t require new business logic.
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:justify-center">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          {CHANNELS.map((c) => (
            <div
              key={c.label}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                c.live ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line bg-surface-muted text-ink-400'
              }`}
            >
              <span className="text-sm">{c.icon}</span>
              {c.label}
              {c.live ? (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                </span>
              ) : (
                <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-ink-400">Ready</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center px-2">
          <div className="hidden h-full w-6 sm:block">
            <svg viewBox="0 0 24 100" className="h-full w-full" preserveAspectRatio="none">
              <path d="M2 10 H12 V90 H22" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" />
              <path d="M2 36 H12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" />
              <path d="M2 63 H12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" />
              <path d="M2 90 H12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2">
          <div className="rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">Lead Engine</div>
            <div className="text-[11px] text-ink-500">normalize · dedupe · route</div>
          </div>
        </div>

        <div className="flex items-center justify-center px-1">
          <span className="text-ink-300">→</span>
        </div>

        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <div className="rounded-xl border border-line bg-white px-3 py-2.5 text-center">
            <div className="text-base">🧠</div>
            <div className="text-[10px] font-semibold text-ink-700">AI Engine</div>
          </div>
          <div className="rounded-xl border border-line bg-white px-3 py-2.5 text-center">
            <div className="text-base">🗄️</div>
            <div className="text-[10px] font-semibold text-ink-700">Bitrix24</div>
          </div>
        </div>
      </div>
    </div>
  );
}
