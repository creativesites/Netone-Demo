'use client';

import { useState } from 'react';
import { useRealtimeDoc, apiPut } from '@/lib/realtime';

export function AutoReplyToggle() {
  const settings = useRealtimeDoc<{ autoReplyEnabled: boolean }>(
    'settings/app',
    '/api/settings',
    (r) => ({ autoReplyEnabled: !!r.autoReplyEnabled }),
    4000
  );
  const [pending, setPending] = useState(false);
  const enabled = settings?.autoReplyEnabled ?? true;

  async function toggle() {
    setPending(true);
    try {
      await apiPut('/api/settings', { autoReplyEnabled: !enabled });
    } finally {
      setTimeout(() => setPending(false), 400);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title="Autonomous WhatsApp auto-reply"
      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.06] disabled:opacity-60"
    >
      <span className="hidden sm:inline text-slate-400">Auto-reply</span>
      <span
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
      <span className={`font-semibold ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}>
        {enabled ? 'On' : 'Off'}
      </span>
    </button>
  );
}
