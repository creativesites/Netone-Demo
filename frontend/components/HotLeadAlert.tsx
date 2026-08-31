'use client';

/**
 * A dramatic, real-time toast the moment a lead crosses into QUALIFIED or
 * SALES_READY — reuses the existing SSE lead stream (useLeadStream) that
 * already pushes every lead update; no new backend plumbing needed. Fires
 * at most once per lead per page load (tracked in a ref, not persisted —
 * a fresh page load is a fresh "what have I seen" slate, matching how the
 * rest of the live-activity UI already resets on reload).
 */
import { useEffect, useRef, useState } from 'react';
import { Flame, Volume2, VolumeX, X } from 'lucide-react';
import { useLeadStream } from '@/lib/useLeadStream';
import { channelLabel } from '@/lib/channel';

const HOT_STAGES = new Set(['QUALIFIED', 'SALES_READY']);
const STAGE_LABEL: Record<string, string> = { QUALIFIED: 'Qualified', SALES_READY: 'Sales Ready' };
const MUTE_KEY = 'netone-hotlead-muted';

/** A short, tasteful two-note chime synthesized with WebAudio — no audio
 *  asset to ship or fail to load. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close();
  } catch {
    /* WebAudio unavailable — the toast still shows, just silently */
  }
}

interface HotLead {
  id: number;
  name: string;
  channel: string;
  stage: string;
}

export function HotLeadAlert() {
  const { currentLead } = useLeadStream();
  const alertedIds = useRef<Set<number>>(new Set());
  const [toast, setToast] = useState<HotLead | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* localStorage unavailable — default unmuted */
    }
  }, []);

  useEffect(() => {
    const stage = currentLead?.qualification_stage;
    if (!currentLead?.id || !stage || !HOT_STAGES.has(stage)) return;
    if (alertedIds.current.has(currentLead.id)) return;
    alertedIds.current.add(currentLead.id);

    setToast({
      id: currentLead.id,
      name: currentLead.name || currentLead.phone || 'New contact',
      channel: currentLead.channel,
      stage,
    });
    if (!muted) playChime();

    const dismiss = setTimeout(() => {
      setToast((cur) => (cur?.id === currentLead.id ? null : cur));
    }, 8000);
    return () => clearTimeout(dismiss);
  }, [currentLead, muted]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* best-effort persistence only */
      }
      return next;
    });
  }

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2.5rem)] max-w-sm animate-fade-up">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-emerald-400 bg-white p-4 shadow-xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Flame size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Hot lead — {STAGE_LABEL[toast.stage] ?? toast.stage}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-ink-900">{toast.name}</div>
          <div className="text-[11px] text-ink-500">via {channelLabel(toast.channel)} · qualified in real time by Nia</div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
            title={muted ? 'Unmute alerts' : 'Mute alerts'}
            className="rounded-lg p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="rounded-lg p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
