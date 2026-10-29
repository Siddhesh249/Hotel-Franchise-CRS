'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

const tabs = [
  { href: '/admin', label: 'Catalog & reports', icon: 'building' as const },
  { href: '/admin/clock', label: 'Virtual clock', icon: 'clock' as const },
  { href: '/admin/simulation', label: 'Simulation', icon: 'sparkles' as const },
];

export function AdminShell({ userName, children }: { userName: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="container-page py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Franchise control plane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin dashboard</h1>
          <p className="muted mt-1">Signed in as {userName}. Catalog, buffers, amenities, reports, and demo controls.</p>
        </div>
        <Link href="/hotels" className="btn-secondary btn-sm">
          <Icon name="arrow-right" size={14} />
          View public site
        </Link>
      </header>

      <nav className="mt-6 flex flex-wrap gap-1.5 rounded-xl border border-ink-100 bg-white p-1.5" aria-label="Admin sections">
        {tabs.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">{children}</div>
    </main>
  );
}
