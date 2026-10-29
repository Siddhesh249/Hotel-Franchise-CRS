'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Icon } from '@/components/icons';
import type { HeaderUser } from '@/components/user-menu';

export interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({ links, user }: { links: NavLink[]; user: HeaderUser | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="flex size-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'x' : 'menu'} size={20} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-ink-100 bg-white px-4 pt-3 pb-5 shadow-lg">
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-ink-100 pt-3">
            {user ? (
              <div className="space-y-1">
                <div className="px-3 pb-2">
                  <p className="text-sm font-semibold text-ink-900">{user.name}</p>
                  <p className="text-xs text-ink-500">{user.email}</p>
                </div>
                <Link
                  href={user.home}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  {user.role === 'Admin' ? 'Admin dashboard' : user.role === 'Staff' ? 'Staff desk' : 'My bookings'}
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: '/' })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                  <Icon name="logout" size={16} />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                  Sign in
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
