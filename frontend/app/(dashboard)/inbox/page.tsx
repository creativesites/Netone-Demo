'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRealtimeCollection, useRealtimeMessages, useRealtimeDoc, apiPost } from '@/lib/realtime';
import type { ChatMessage, Conversation, Lead } from '@/lib/types';
import { ConversationList } from '@/components/inbox/ConversationList';
import { MessageThread } from '@/components/inbox/MessageThread';
import { IntelPanel } from '@/components/inbox/IntelPanel';

export default function InboxPage() {
  const conversations = useRealtimeCollection<Conversation>(
    'conversations',
    'last_message_at',
    '/api/conversations',
    (r) => (r.conversations ?? []) as Conversation[],
    4000
  );
  const leads = useRealtimeCollection<Lead>('leads', 'updated_at', '/api/leads', (r) => (r.leads ?? []) as Lead[], 5000);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'leads'>('all');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  // Auto-select the most recent conversation once data arrives.
  useEffect(() => {
    if (activeId == null && conversations.length) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const messages = useRealtimeMessages(activeId) as ChatMessage[];
  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  const activeLead = useMemo(
    () => (active?.lead_id ? leads.find((l) => l.id === active.lead_id) ?? null : null),
    [active, leads]
  );

  const filtered = filter === 'leads' ? conversations.filter((c) => c.is_lead) : conversations;

  async function markRead(id: number) {
    await apiPost(`/api/conversations/${id}/read`, {});
  }

  function select(id: number) {
    setActiveId(id);
    markRead(id);
    setMobileView('thread');
  }

  async function sendManual(text: string): Promise<boolean> {
    if (activeId == null) return false;
    try {
      const res = await apiPost(`/api/conversations/${activeId}/send`, { text });
      if (!res.ok) return false;
      const data = (await res.json()) as { delivered?: boolean };
      return Boolean(data.delivered);
    } catch {
      return false;
    }
  }

  async function toggleHandoff(active: boolean) {
    if (activeId == null) return;
    await apiPost(`/api/conversations/${activeId}/handoff`, { active });
  }

  return (
    <div className="flex h-[calc(100vh-57px)] md:grid md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_300px]">
      <div className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${mobileView === 'thread' ? 'hidden' : 'flex'}`}>
        <ConversationList
          conversations={filtered}
          activeId={activeId}
          onSelect={select}
          filter={filter}
          onFilter={setFilter}
        />
      </div>
      <div className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${mobileView === 'list' ? 'hidden' : 'flex'}`}>
        <MessageThread
          conversation={active}
          messages={messages}
          onSend={sendManual}
          onBack={() => setMobileView('list')}
          onToggleHandoff={toggleHandoff}
        />
      </div>
      <div className="hidden lg:block">
        <IntelPanel conversation={active} lead={activeLead} />
      </div>
    </div>
  );
}
