'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Icon } from '@/components/icons';
import { initials } from '@/lib/format';

export interface HeaderUser {
  name: string;
  email: string;
  role: 'Guest' | 'Staff' | 'Admin';
  home: string;
}

export function UserMenu({ user }: { user: HeaderUser }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full border border-ink-200 bg-white py-1.5 pr-3 pl-1.5 transition hover:border-ink-300 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-32 truncate text-xs font-semibold text-ink-900">{user.name}</span>
          <span className="block text-[10px] font-medium tracking-wide text-ink-500 uppercase">{user.role}</span>
        </span>
        <Icon name="chevron-down" size={14} className="text-ink-400 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-xl">
        <div className="border-b border-ink-100 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
        </div>
        <Link href={user.home} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
          <Icon name="building" size={15} />
          {user.role === 'Admin' ? 'Admin dashboard' : user.role === 'Staff' ? 'Staff desk' : 'My bookings'}
        </Link>
        <Link href="/hotels" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
          <Icon name="search" size={15} />
          Browse hotels
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: '/' })}
          className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-ink-100 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
        >
          <Icon name="logout" size={15} />
          Sign out
        </button>
      </div>
    </details>
  );
}
