'use client';

/**
 * Operator diagnostics — deliberately NOT in the sidebar nav.
 *
 * Reachable only by typing /ops-check. This is obscurity, not security:
 * with DISABLE_AUTH=true on the demo deployment anyone with the URL can
 * open it, so the backend deliberately reports secrets as present/absent
 * and never echoes a token value.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, MinusCircle, type LucideIcon } from 'lucide-react';
import { apiGet } from '@/lib/realtime';
import { formatDateTime } from '@/lib/format';

type CheckStatus = 'ok' | 'warn' | 'fail' | 'off';

interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  meta?: Record<string, unknown>;
}

interface Diagnostics {
  generatedAt: string;
  overall: CheckStatus;
  demoReady: boolean;
  uptimeSeconds: number;
  checks: Check[];
  recentErrors: { at: string; leadId: number | null; type: string; detail: string }[];
}

const STYLE: Record<CheckStatus, { Icon: LucideIcon; cls: string; ring: string; word: string }> = {
  ok: { Icon: CheckCircle2, cls: 'text-emerald-600', ring: 'border-emerald-200 bg-emerald-50', word: 'OK' },
  warn: { Icon: AlertTriangle, cls: 'text-amber-600', ring: 'border-amber-200 bg-amber-50', word: 'WARN' },
  fail: { Icon: XCircle, cls: 'text-rose-600', ring: 'border-rose-200 bg-rose-50', word: 'FAIL' },
  off: { Icon: MinusCircle, cls: 'text-ink-400', ring: 'border-line bg-surface-muted', word: 'OFF' },
};

function uptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  return h < 24 ? `${h}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function OpsCheckPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/diagnostics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [load]);

  const overall = data ? STYLE[data.overall] : STYLE.off;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Internal · unlisted</div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Pre-demo diagnostics</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Every item below is probed live, not read from config. Check this before any demo.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not reach the diagnostics endpoint: {error}
        </div>
      )}

      {data && (
        <>
          <div className={`mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 p-5 ${overall.ring}`}>
            <overall.Icon size={26} className={overall.cls} />
            <div className="min-w-0 flex-1">
              <div className={`text-lg font-bold ${overall.cls}`}>
                {data.demoReady ? 'Demo ready' : 'NOT demo ready — fix the red items below'}
              </div>
              <div className="text-xs text-ink-500">
                Checked {formatDateTime(data.generatedAt)} · backend up {uptime(data.uptimeSeconds)}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {data.checks.map((c) => {
              const s = STYLE[c.status];
              return (
                <div key={c.key} className="card flex items-start gap-3 p-4">
                  <s.Icon size={18} className={`mt-0.5 shrink-0 ${s.cls}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900">{c.label}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${s.ring} ${s.cls}`}>
                        {s.word}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{c.detail}</p>
                    {c.meta && Object.keys(c.meta).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-2 text-[11px] leading-relaxed text-ink-500">
                        {JSON.stringify(c.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 card p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Recent pipeline errors ({data.recentErrors.length})
            </div>
            {data.recentErrors.length === 0 ? (
              <div className="py-3 text-center text-sm text-ink-400">No errors logged. </div>
            ) : (
              <div className="space-y-1.5">
                {data.recentErrors.map((e, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-2 border-b border-line pb-1.5 text-[12px] last:border-0">
                    <span className="font-mono text-ink-400">{formatDateTime(e.at)}</span>
                    <span className="font-semibold text-rose-600">{e.type}</span>
                    {e.leadId && <span className="text-ink-400">lead #{e.leadId}</span>}
                    <span className="min-w-0 flex-1 truncate text-ink-600">{e.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
            This page is unlisted, not access-controlled — anyone with the URL can load it. It never displays
            tokens or secrets, only whether they are present.
          </p>
        </>
      )}
    </div>
  );
}
