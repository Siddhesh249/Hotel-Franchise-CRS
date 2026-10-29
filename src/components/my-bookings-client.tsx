'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDate, todayIso } from '@/lib/format';
import type { BookingWithDetails } from '@/types';

type Filter = 'all' | 'upcoming' | 'waitlisted' | 'past';

const paymentMethods = ['Card', 'UPI', 'NetBanking', 'Cash'];

export function MyBookingsClient({ guestName }: { guestName: string }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [payingId, setPayingId] = useState<number | null>(null);
  const [method, setMethod] = useState('Card');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/bookings/mine', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login?callbackUrl=/my-bookings');
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'Unable to load your bookings.');
        return;
      }
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setError('We could not reach the reservation service.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const today = todayIso();
  const stats = useMemo(() => {
    const active = bookings.filter((b) => !['Cancelled', 'CheckedOut', 'NoShow'].includes(b.booking_status));
    const upcoming = active.filter((b) => b.check_out_date >= today);
    const waitlisted = bookings.filter((b) => b.booking_status === 'Waitlisted');
    const paid = bookings
      .filter((b) => b.payment_status === 'Completed')
      .reduce((sum, b) => sum + Number(b.paid_amount ?? 0), 0);
    return { active: active.length, upcoming: upcoming.length, waitlisted: waitlisted.length, paid };
  }, [bookings, today]);

  const visible = useMemo(() => {
    if (filter === 'upcoming') {
      return bookings.filter((b) => !['Cancelled', 'CheckedOut', 'NoShow'].includes(b.booking_status) && b.check_out_date >= today);
    }
    if (filter === 'waitlisted') return bookings.filter((b) => b.booking_status === 'Waitlisted');
    if (filter === 'past') {
      return bookings.filter((b) => ['Cancelled', 'CheckedOut', 'NoShow'].includes(b.booking_status) || b.check_out_date < today);
    }
    return bookings;
  }, [bookings, filter, today]);

  async function cancel(booking: BookingWithDetails) {
    if (!window.confirm(`Cancel booking #${booking.booking_id} for ${booking.hotel_name}?`)) return;
    setBusyId(booking.booking_id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/bookings/${booking.booking_id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Guest cancellation' }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push('/login?callbackUrl=/my-bookings');
        return;
      }
      if (!response.ok) {
        setError(data?.error?.message ?? 'The booking could not be cancelled.');
        return;
      }
      setNotice(`Booking #${booking.booking_id} cancelled. If a room was freed, the oldest waitlisted guest was promoted automatically.`);
      await load();
    } catch {
      setError('We could not reach the reservation service.');
    } finally {
      setBusyId(null);
    }
  }

  async function pay(booking: BookingWithDetails) {
    setBusyId(booking.booking_id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.booking_id, payment_method: method }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push('/login?callbackUrl=/my-bookings');
        return;
      }
      if (!response.ok) {
        setError(data?.error?.message ?? 'The payment could not be recorded.');
        return;
      }
      setNotice(`Payment of ${formatCurrency(data.amount)} recorded for booking #${booking.booking_id}.`);
      setPayingId(null);
      await load();
    } catch {
      setError('We could not reach the payment service.');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: bookings.length },
    { id: 'upcoming', label: 'Upcoming', count: stats.upcoming },
    { id: 'waitlisted', label: 'Waitlisted', count: stats.waitlisted },
    { id: 'past', label: 'Past & cancelled', count: bookings.filter((b) => ['Cancelled', 'CheckedOut', 'NoShow'].includes(b.booking_status) || b.check_out_date < today).length },
  ];

  return (
    <main className="container-page py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Guest portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">My bookings</h1>
          <p className="muted mt-1">Welcome back, {guestName}. Manage stays, payments, and cancellations here.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="btn-secondary btn-sm">
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          <Link href="/hotels" className="btn-primary btn-sm">
            <Icon name="search" size={14} />
            Book a stay
          </Link>
        </div>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active bookings', value: stats.active, icon: 'bed' as const },
          { label: 'Upcoming stays', value: stats.upcoming, icon: 'calendar' as const },
          { label: 'On the waitlist', value: stats.waitlisted, icon: 'clock' as const },
          { label: 'Paid to date', value: formatCurrency(stats.paid), icon: 'credit-card' as const },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={stat.icon} size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{stat.label}</p>
              <p className="text-lg font-bold text-ink-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div className="mt-5 flex gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}
      {error && (
        <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-1.5 rounded-xl border border-ink-100 bg-white p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              filter === tab.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${filter === tab.id ? 'text-ink-300' : 'text-ink-400'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          [1, 2, 3].map((item) => <div key={item} className="skeleton h-52" />)
        ) : visible.length ? (
          visible.map((booking) => {
            const active = !['Cancelled', 'CheckedOut', 'NoShow'].includes(booking.booking_status);
            const canPay = ['Confirmed', 'CheckedIn'].includes(booking.booking_status) && booking.payment_status !== 'Completed';
            const canCancel = active;
            const isPaying = payingId === booking.booking_id;
            return (
              <article key={booking.booking_id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={booking.booking_status} />
                      {booking.is_overbooked && <span className="badge-amber">Buffer booking</span>}
                      {booking.room_number && <span className="badge-slate">Room {booking.room_number}</span>}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">{booking.hotel_name}</h2>
                    <p className="muted">
                      {booking.type_name} · {booking.city}{booking.state ? `, ${booking.state}` : ''} · Booking #{booking.booking_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ink-900">{formatCurrency(booking.total_amount)}</p>
                    <p className="text-xs text-ink-500">
                      {booking.nights} {booking.nights === 1 ? 'night' : 'nights'} · {booking.num_guests} {booking.num_guests === 1 ? 'guest' : 'guests'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Stay</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-medium text-ink-800">
                        <Icon name="calendar" size={14} className="text-ink-400" />
                        {formatDate(booking.check_in_date, { weekday: true })} → {formatDate(booking.check_out_date, { weekday: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Payment</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={booking.payment_status ?? 'Pending'} />
                        {booking.payment_status === 'Completed' && (
                          <span className="text-xs text-ink-500">{booking.payment_method} · {formatCurrency(booking.paid_amount)}</span>
                        )}
                      </div>
                    </div>
                    {booking.special_requests && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Special requests</p>
                        <p className="mt-1 text-sm text-ink-700">{booking.special_requests}</p>
                      </div>
                    )}
                    {booking.booking_status === 'Waitlisted' && (
                      <div className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800 sm:col-span-2">
                        <b>You are in the FIFO queue.</b> If a cancellation frees capacity, this booking is promoted to
                        Confirmed automatically. Use Refresh to see the latest status.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link href={`/hotels/${booking.hotel_id}`} className="btn-secondary btn-sm">
                      View hotel
                    </Link>
                    {canPay && (
                      <button type="button" onClick={() => setPayingId(isPaying ? null : booking.booking_id)} className="btn-primary btn-sm">
                        <Icon name="credit-card" size={14} />
                        {isPaying ? 'Close' : 'Pay now'}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={busyId === booking.booking_id}
                        onClick={() => void cancel(booking)}
                        className="btn-danger btn-sm"
                      >
                        <Icon name="x" size={14} />
                        {busyId === booking.booking_id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                {isPaying && (
                  <div className="border-t border-ink-100 bg-sand-50 p-5">
                    <p className="text-sm font-semibold text-ink-800">Simulated payment</p>
                    <p className="muted mt-1">
                      No real card is charged. The amount is fixed by the server at {formatCurrency(booking.total_amount)}.
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="w-full sm:w-56">
                        <span className="label">Payment method</span>
                        <select value={method} onChange={(event) => setMethod(event.target.value)} className="input">
                          {paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busyId === booking.booking_id}
                        onClick={() => void pay(booking)}
                        className="btn-primary"
                      >
                        {busyId === booking.booking_id ? 'Recording…' : `Pay ${formatCurrency(booking.total_amount)}`}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="card-muted flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-ink-500">
              <Icon name="bed" size={22} />
            </span>
            <h3 className="mt-4 text-lg font-semibold">
              {bookings.length ? 'Nothing in this filter' : 'No bookings yet'}
            </h3>
            <p className="muted mt-1 max-w-md">
              {bookings.length
                ? 'Try another filter, or book a new stay.'
                : 'Search a city and your dates, then reserve a room in a few clicks.'}
            </p>
            <Link href="/hotels" className="btn-primary mt-5">
              <Icon name="search" size={16} />
              Find a room
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
