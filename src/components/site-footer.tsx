import Link from 'next/link';
import { Icon } from '@/components/icons';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-100 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-ink-900 text-white">
              <Icon name="building" size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Nightingale Suites</p>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Central reservations</p>
            </div>
          </div>
          <p className="muted mt-4 max-w-md">
            One reservation system across every property in the franchise — with a transparent
            overbooking buffer and an automatic FIFO waitlist.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-ink-500 uppercase">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li><Link className="hover:text-brand-700" href="/hotels">Hotels</Link></li>
            <li><Link className="hover:text-brand-700" href="/my-bookings">My bookings</Link></li>
            <li><Link className="hover:text-brand-700" href="/login">Sign in</Link></li>
            <li><Link className="hover:text-brand-700" href="/register">Create account</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-ink-500 uppercase">Portals</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li><Link className="hover:text-brand-700" href="/staff">Staff desk</Link></li>
            <li><Link className="hover:text-brand-700" href="/admin">Admin dashboard</Link></li>
            <li><Link className="hover:text-brand-700" href="/admin/clock">Virtual clock</Link></li>
            <li><Link className="hover:text-brand-700" href="/admin/simulation">Simulation</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>DBMS course project · MariaDB + MongoDB + Next.js</p>
          <p>Payments are simulated. No real charges are made.</p>
        </div>
      </div>
    </footer>
  );
}
