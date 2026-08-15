'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, MessagesSquare, SlidersHorizontal } from 'lucide-react';
import { AutoReplyToggle } from './AutoReplyToggle';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: MessagesSquare },
  { href: '/settings/qualification-rules', label: 'Rules', icon: SlidersHorizontal },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface-muted">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white/70 p-4 backdrop-blur md:flex">
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 text-sm font-black text-white">
            N1
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900">NetOne</div>
            <div className="text-[10px] text-ink-400">Lead Intelligence Platform</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink-500 hover:bg-surface-muted hover:text-ink-900'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-surface-muted p-3 text-[10px] leading-relaxed text-ink-400">
          Omnichannel Marketing-to-CRM. WhatsApp is the live demo channel; Facebook, Instagram &amp; TikTok feed the same pipeline in production.
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/70 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-emerald-500 text-xs font-black text-white">
              N1
            </div>
            <span className="text-sm font-semibold text-ink-900">NetOne</span>
          </div>
          <nav className="flex items-center gap-1 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1 text-xs ${pathname === item.href ? 'bg-brand-50 text-brand-600' : 'text-ink-500'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <AutoReplyToggle />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
