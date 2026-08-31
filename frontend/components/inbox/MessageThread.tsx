'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, AlertTriangle, ArrowLeft, UserCheck, RotateCcw } from 'lucide-react';
import type { ChatMessage, Conversation } from '@/lib/types';
import { channelLabel } from '@/lib/channel';
import { formatTime } from '@/lib/format';

function fmt(val: unknown) {
  return formatTime(val, false, '');
}

export function MessageThread({
  conversation,
  messages,
  onSend,
  onBack,
  onToggleHandoff,
}: {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSend: (text: string) => Promise<boolean>;
  onBack?: () => void;
  onToggleHandoff?: (active: boolean) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [resuming, setResuming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversation?.id]);

  useEffect(() => {
    setSendError(false);
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex min-h-0 items-center justify-center bg-surface-muted text-sm text-ink-500">
        Select a conversation to view the thread.
      </div>
    );
  }

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText('');
    setSendError(false);
    try {
      const delivered = await onSend(t);
      if (!delivered) setSendError(true);
    } finally {
      setSending(false);
    }
  }

  async function resumeAi() {
    if (!onToggleHandoff) return;
    setResuming(true);
    try {
      await onToggleHandoff(false);
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col bg-surface-muted">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-1">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="-ml-1.5 mr-1 shrink-0 rounded-full p-1.5 text-ink-500 hover:bg-surface-muted md:hidden"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-900">{conversation.contact_name ?? conversation.phone}</div>
            <div className="text-[11px] text-ink-500">{conversation.phone} · {channelLabel(conversation.channel)}</div>
          </div>
        </div>
        {conversation.is_lead && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">LEAD · {conversation.intent}</span>
        )}
      </div>

      {conversation.handoff_active && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-800">
            <UserCheck size={13} /> Human handling this chat — Nia is paused here
          </div>
          {onToggleHandoff && (
            <button
              onClick={resumeAi}
              disabled={resuming}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw size={11} /> {resuming ? 'Resuming…' : 'Resume AI'}
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scroll-thin px-4 py-4">
        {messages.map((m) => {
          const mine = m.direction === 'outbound';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-brand-500 text-white' : 'rounded-bl-sm border border-line bg-white text-ink-800'}`}>
                {mine && m.sender === 'agent' && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                    <Bot size={10} /> Nia · AI assistant
                  </div>
                )}
                {mine && m.sender === 'human' && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                    <User size={10} /> Sales rep
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${mine ? 'text-white/70' : 'text-ink-400'}`}>
                  {mine && m.delivery_status === 'failed' && (
                    <span className="flex items-center gap-0.5 font-semibold text-amber-200">
                      <AlertTriangle size={9} /> not delivered
                    </span>
                  )}
                  <span>{fmt(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-white p-3">
        {sendError && (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700">
            <AlertTriangle size={12} /> Message not delivered — WhatsApp may be disconnected. Check the Connect panel.
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Type a manual reply…"
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-ink-400">
          {conversation.handoff_active
            ? 'Nia is paused for this chat since a rep took over — resume her above when you\'re done.'
            : 'Sending a manual reply here hands this chat to you — Nia pauses automatically until you resume her.'}
        </p>
      </div>
    </div>
  );
}
