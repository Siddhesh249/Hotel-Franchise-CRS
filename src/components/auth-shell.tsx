import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_480px] lg:py-16">
      <section className="relative hidden overflow-hidden rounded-3xl bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,#38cba7,transparent_35%),radial-gradient(circle_at_80%_70%,#f5b027,transparent_30%)]" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur">
              <Icon name="building" size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold">Nightingale</span>
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-brand-300 uppercase">Central reservations</span>
            </span>
          </Link>
          <h2 className="mt-16 max-w-md text-3xl leading-tight font-semibold tracking-tight text-white">
            One account for every property in the franchise.
          </h2>
          <p className="mt-4 max-w-md text-ink-200">
            Search live availability, book with a clear outcome, and manage payments and
            cancellations from a single place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {[
              'Confirmed, buffer, or waitlist — always visible',
              'Automatic FIFO promotion when a room frees up',
              'Staff and admin portals use the same sign-in',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                  <Icon name="check" size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-300">DBMS course project · simulated payments only</p>
      </section>

      <section className="mx-auto w-full max-w-md lg:max-w-none">
        <div className="card p-6 sm:p-8">
          <p className="eyebrow">Welcome</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="muted mt-1">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">
          <Link href="/" className="font-semibold text-ink-700 hover:text-brand-700">← Back to home</Link>
          <span className="mx-2">·</span>
          <Link href="/hotels" className="font-semibold text-ink-700 hover:text-brand-700">Browse hotels</Link>
        </p>
      </section>
    </main>
  );
}
