'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, MessagesSquare, SlidersHorizontal, Info, BookOpen, HelpCircle, Menu, X } from 'lucide-react';
import { AutoReplyToggle } from './AutoReplyToggle';
import { GuidedTour } from './GuidedTour';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { href: '/inbox', label: 'Inbox', icon: MessagesSquare, tourId: 'nav-inbox' },
  { href: '/knowledge-base', label: 'Knowledge', icon: BookOpen, tourId: 'nav-knowledge' },
  { href: '/settings/qualification-rules', label: 'Rules', icon: SlidersHorizontal, tourId: 'nav-rules' },
  { href: '/help', label: 'Help', icon: HelpCircle, tourId: 'nav-help' },
  { href: '/about', label: 'About', icon: Info },
];

function Brand({ imgClass }: { imgClass: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.png" alt="NetOne" className={imgClass} />
      <div className="leading-tight">
        <div className="text-sm font-semibold text-ink-900">NetOne</div>
        <div className="text-[10px] text-ink-400">Lead Intelligence Platform</div>
      </div>
    </div>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tourId}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink-500 hover:bg-surface-muted hover:text-ink-900'
            }`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const FOOTNOTE =
  'Omnichannel Marketing-to-CRM. WhatsApp is the live demo channel; Facebook, Instagram & the website feed the same pipeline in production.';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer on route change, and don't let it survive a resize to desktop.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <GuidedTour />
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white/70 p-4 backdrop-blur md:flex">
        <div className="mb-6">
          <Brand imgClass="h-9 w-9 rounded-xl" />
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto rounded-xl border border-line bg-surface-muted p-3 text-[10px] leading-relaxed text-ink-400">
          {FOOTNOTE}
        </div>
      </aside>

      {/* Drawer (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[82vw] flex-col bg-white p-4 shadow-xl animate-fade-up">
            <div className="mb-6 flex items-center justify-between">
              <Brand imgClass="h-9 w-9 rounded-xl" />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-ink-400 hover:bg-surface-muted hover:text-ink-700"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto rounded-xl border border-line bg-surface-muted p-3 text-[10px] leading-relaxed text-ink-400">
              {FOOTNOTE}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/70 px-4 py-3 backdrop-blur md:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 rounded-lg p-1.5 text-ink-600 hover:bg-surface-muted md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="NetOne" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-ink-900">NetOne</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <AutoReplyToggle />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
