'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot } from 'lucide-react';
import type { ChatMessage, Conversation } from '@/lib/types';

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessageThread({
  conversation,
  messages,
  onSend,
}: {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex min-h-0 items-center justify-center bg-white/[0.01] text-sm text-slate-500">
        Select a conversation to view the thread.
      </div>
    );
  }

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText('');
    try {
      await onSend(t);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col bg-white/[0.01]">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-white">{conversation.contact_name ?? conversation.phone}</div>
          <div className="text-[11px] text-slate-500">{conversation.phone} · WhatsApp</div>
        </div>
        {conversation.is_lead && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
            LEAD · {conversation.intent}
          </span>
        )}
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scroll-thin px-4 py-4">
        {messages.map((m) => {
          const mine = m.direction === 'outbound';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? 'rounded-br-sm bg-brand-500/90 text-white'
                    : 'rounded-bl-sm bg-white/[0.06] text-slate-100'
                }`}
              >
                {mine && m.sender === 'agent' && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-white/80">
                    <Bot size={10} /> Nia · AI assistant
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-0.5 text-right text-[9px] ${mine ? 'text-white/70' : 'text-slate-500'}`}>
                  {fmt(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* reply dock */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Type a manual reply…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-slate-600">
          The AI assistant replies automatically when auto-reply is on. Manual messages send instantly over WhatsApp.
        </p>
      </div>
    </div>
  );
}
