'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

export function UserMenu({ name, role, home }: { name: string; role: string; home: string }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-ink-200 px-3 py-1.5 text-sm transition hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
        <span className="max-w-40 truncate font-medium text-ink-800">{name}</span>
        <span className="badge-slate">{role}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-ink-200 bg-white py-1 text-sm shadow-md">
        <Link href={home} className="block px-3 py-2 text-ink-700 hover:bg-ink-50">Dashboard</Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: '/hotels' })}
          className="block w-full px-3 py-2 text-left text-rose-700 hover:bg-rose-50"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
