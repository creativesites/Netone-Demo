'use client';

import { TrendingUp, UserCheck } from 'lucide-react';
import type { Conversation } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';

function initials(name: string | null, phone: string | null) {
  const n = (name ?? phone ?? '?').trim();
  const parts = n.split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-ink-400',
  negative: 'bg-rose-500',
};

// Avatar ring color per channel — lets a mixed WhatsApp/Facebook inbox be
// told apart at a glance during a live demo, matching each platform's own
// brand color (WhatsApp green, Messenger blue).
const CHANNEL_RING: Record<string, string> = {
  whatsapp: 'bg-emerald-500',
  facebook: 'bg-blue-600',
};

function timeAgo(val: unknown) {
  return formatRelativeTime(val, '');
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  filter,
  onFilter,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  filter: 'all' | 'leads';
  onFilter: (f: 'all' | 'leads') => void;
}) {
  return (
    <div className="flex min-h-0 flex-col border-r border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-900">Inbox</h2>
        <div className="flex rounded-lg bg-surface-muted p-0.5 text-[11px]">
          {(['all', 'leads'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={`rounded-md px-2 py-1 transition-colors ${
                filter === f ? 'bg-white font-medium text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              {f === 'leads' ? 'Leads only' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {conversations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-500">
            No conversations yet. Incoming WhatsApp and Facebook Messenger chats appear here in real time.
          </div>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-start gap-3 border-l-2 px-3 py-3 text-left transition-colors ${
                  active ? 'border-brand-500 bg-brand-50' : 'border-transparent hover:bg-surface-muted'
                }`}
              >
                <div className="relative">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${CHANNEL_RING[c.channel] ?? 'bg-brand-500'}`}
                    title={c.channel}
                  >
                    {initials(c.contact_name, c.phone)}
                  </div>
                  {c.sentiment && (
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${SENTIMENT_DOT[c.sentiment] ?? 'bg-ink-400'}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread_count > 0 ? 'font-semibold text-ink-900' : 'font-medium text-ink-800'}`}>
                      {c.contact_name ?? c.phone ?? 'Unknown'}
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-400">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {c.last_direction === 'outbound' && <span className="text-[10px] text-ink-400">You:</span>}
                    <span className="truncate text-xs text-ink-500">{c.last_message ?? '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {c.is_lead ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        <TrendingUp size={9} /> LEAD
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-ink-500">{c.intent ?? 'chat'}</span>
                    )}
                    {c.ai_priority && c.is_lead && (
                      <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium capitalize text-brand-600">{c.ai_priority} intent</span>
                    )}
                    {c.handoff_active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                        <UserCheck size={9} /> Human
                      </span>
                    )}
                    {c.unread_count > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
