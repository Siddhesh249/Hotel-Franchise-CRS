'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

export function AdminShell({ userName, children }: { userName: string; children: ReactNode }) {
  return (
    <main className="container-page py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Franchise control plane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Admin dashboard</h1>
          <p className="muted mt-1">
            Signed in as {userName}. Catalog, overbooking, amenities, inventory, and reports.
          </p>
        </div>
        <Link href="/hotels" className="btn-secondary btn-sm">
          <Icon name="arrow-right" size={14} />
          View public site
        </Link>
      </header>

      <div className="mt-8">{children}</div>
    </main>
  );
}
