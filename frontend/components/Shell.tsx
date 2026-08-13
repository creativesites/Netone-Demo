'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, MessagesSquare } from 'lucide-react';
import { AutoReplyToggle } from './AutoReplyToggle';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: MessagesSquare },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-white/[0.02] p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-emerald-500 text-sm font-black text-white">
            N1
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">NetOne</div>
            <div className="text-[10px] text-slate-500">Lead Automation</div>
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-brand-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[10px] leading-relaxed text-slate-500">
          Omnichannel Marketing-to-CRM. WhatsApp is the live demo channel; Facebook, Instagram &amp; TikTok feed the same pipeline in production.
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-emerald-500 text-xs font-black text-white">
              N1
            </div>
            <span className="text-sm font-bold text-white">NetOne</span>
          </div>
          <nav className="flex items-center gap-1 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1 text-xs ${
                  pathname === item.href ? 'bg-brand-500/15 text-white' : 'text-slate-400'
                }`}
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
