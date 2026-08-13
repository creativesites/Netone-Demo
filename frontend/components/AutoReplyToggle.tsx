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
      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-xs transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <span className="hidden text-ink-500 sm:inline">Auto-reply</span>
      <span className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-ink-400'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
      </span>
      <span className={`font-semibold ${enabled ? 'text-emerald-600' : 'text-ink-500'}`}>{enabled ? 'On' : 'Off'}</span>
    </button>
  );
}
