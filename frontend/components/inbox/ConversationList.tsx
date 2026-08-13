'use client';

import { TrendingUp, Users } from 'lucide-react';
import type { Conversation } from '@/lib/types';

function initials(name: string | null, phone: string | null) {
  const n = (name ?? phone ?? '?').trim();
  const parts = n.split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  negative: 'bg-rose-400',
};

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
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
    <div className="flex min-h-0 flex-col border-r border-white/5 bg-white/[0.01]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-bold text-white">Inbox</h2>
        <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]">
          {(['all', 'leads'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={`rounded-md px-2 py-1 capitalize transition-colors ${
                filter === f ? 'bg-brand-500/20 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'leads' ? 'Leads only' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {conversations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No conversations yet. Incoming WhatsApp chats appear here in real time.
          </div>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-start gap-3 border-l-2 px-3 py-3 text-left transition-colors ${
                  active ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-bold text-white">
                    {initials(c.contact_name, c.phone)}
                  </div>
                  {c.sentiment && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${
                        SENTIMENT_DOT[c.sentiment] ?? 'bg-slate-400'
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread_count > 0 ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                      {c.contact_name ?? c.phone ?? 'Unknown'}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {c.last_direction === 'outbound' && <span className="text-[10px] text-slate-500">You:</span>}
                    <span className="truncate text-xs text-slate-400">{c.last_message ?? '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {c.is_lead ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                        <TrendingUp size={9} /> LEAD
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                        {c.intent ?? 'chat'}
                      </span>
                    )}
                    {c.ai_priority && c.is_lead && (
                      <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-medium capitalize text-brand-500">
                        {c.ai_priority} intent
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
