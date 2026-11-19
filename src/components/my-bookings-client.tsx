'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { BookingBadge, PaymentBadge } from '@/components/status-badge';
import { Empty, Feedback, PageHeader, Tabs } from '@/components/ui';
import { formatCurrency, formatDate, plural } from '@/lib/format';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import type { BookingRow } from '@/types';

type Filter = 'upcoming' | 'waitlist' | 'past';
const METHODS = ['Card', 'UPI', 'NetBanking', 'Cash'];
const PAGE = 10;

const inFilter = (booking: BookingRow, filter: Filter): boolean => {
  if (filter === 'upcoming') return booking.booking_status === 'Confirmed' && booking.is_open;
  if (filter === 'waitlist') return booking.booking_status === 'Waitlisted' && booking.cancellable;
  return !inFilter(booking, 'upcoming') && !inFilter(booking, 'waitlist');
};

export function MyBookingsClient({ guestName }: { guestName: string }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [limit, setLimit] = useState(PAGE);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [method, setMethod] = useState('Card');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (background = false) => {
    try {
      const response = await fetch('/api/bookings/mine', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login?callbackUrl=/my-bookings');
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (!background) setError(data?.error?.message ?? 'Unable to load your bookings.');
      } else setBookings(data);
    } catch {
      if (!background) setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useAutoRefresh(() => void load(true), 10000);

  const counts = useMemo(() => ({
    upcoming: bookings.filter((b) => inFilter(b, 'upcoming')).length,
    waitlist: bookings.filter((b) => inFilter(b, 'waitlist')).length,
    past: bookings.filter((b) => inFilter(b, 'past')).length,
  }), [bookings]);
  const visible = useMemo(() => bookings.filter((b) => inFilter(b, filter)), [bookings, filter]);

  async function act(booking: BookingRow, url: string, body: unknown, success: (data: any) => string, fallback: string) {
    setBusyId(booking.booking_id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.status === 401) {
        router.push('/login?callbackUrl=/my-bookings');
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) setError(data?.error?.message ?? fallback);
      else {
        setNotice(success(data));
        setPayingId(null);
        await load();
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  }

  const cancel = (booking: BookingRow) => {
    if (!window.confirm(`Cancel booking #${booking.booking_id} at ${booking.hotel_name}?`)) return;
    void act(
      booking,
      `/api/bookings/${booking.booking_id}/cancel`,
      { reason: 'Guest cancellation' },
      () => `Booking #${booking.booking_id} cancelled${booking.payment_status === 'Completed' ? ' and refunded' : ''}.`,
      'The booking could not be cancelled.',
    );
  };

  const pay = (booking: BookingRow) =>
    void act(
      booking,
      '/api/payments',
      { booking_id: booking.booking_id, payment_method: method },
      (data) => `Paid ${formatCurrency(data.amount)} for booking #${booking.booking_id}.`,
      'The payment could not be recorded.',
    );

  return (
    <main className="container-page animate-fade py-8">
      <PageHeader
        title="My bookings"
        subtitle={`Signed in as ${guestName}`}
        actions={<Link href="/hotels" className="btn-primary btn-sm">Book a stay</Link>}
      />
      <Feedback notice={notice} error={error} />

      <div className="mt-5">
        <Tabs
          value={filter}
          onChange={(id) => { setFilter(id); setLimit(PAGE); setPayingId(null); }}
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { id: 'waitlist', label: 'Waitlist', count: counts.waitlist },
            { id: 'past', label: 'Past & cancelled', count: counts.past },
          ]}
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-40" />
        ) : visible.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr><th>Booking</th><th>Stay</th><th className="text-right">Total</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map((booking) => (
                  <Fragment key={booking.booking_id}>
                    <tr>
                      <td>
                        <p className="font-medium text-ink-900">{booking.hotel_name}</p>
                        <p className="text-xs text-ink-500">#{booking.booking_id} · {booking.type_name} · {booking.city}</p>
                        {booking.special_requests && <p className="mt-0.5 text-xs text-ink-500">“{booking.special_requests}”</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(booking.check_in_date)} to {formatDate(booking.check_out_date)}
                        <p className="text-xs text-ink-500">{plural(booking.nights, 'night')} · {plural(booking.num_guests, 'guest')}</p>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(booking.total_amount)}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BookingBadge booking={booking} />
                          <PaymentBadge booking={booking} />
                          {booking.room_number && <span className="badge-slate">Room {booking.room_number}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {booking.booking_status === 'Confirmed' && booking.is_open && !booking.payment_status && (
                            <button type="button" className="btn-primary btn-sm" onClick={() => setPayingId(payingId === booking.booking_id ? null : booking.booking_id)}>
                              Pay
                            </button>
                          )}
                          {booking.cancellable && (
                            <button type="button" className="btn-danger btn-sm" disabled={busyId === booking.booking_id} onClick={() => cancel(booking)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {payingId === booking.booking_id && (
                      <tr className="bg-ink-50">
                        <td colSpan={5}>
                          <div className="animate-fade flex flex-wrap items-end gap-3">
                            <label className="w-48">
                              <span className="label">Payment method (simulated)</span>
                              <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                                {METHODS.map((item) => <option key={item}>{item}</option>)}
                              </select>
                            </label>
                            <button type="button" className="btn-primary" disabled={busyId === booking.booking_id} onClick={() => pay(booking)}>
                              {busyId === booking.booking_id ? 'Paying…' : `Pay ${formatCurrency(booking.total_amount)}`}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={filter === 'upcoming' ? 'No upcoming stays' : filter === 'waitlist' ? 'You are not on any waitlist' : 'Nothing here yet'}>
            <Link href="/hotels" className="font-medium text-brand-700 hover:underline">Find a room</Link>
          </Empty>
        )}
        {visible.length > limit && (
          <button type="button" className="btn-secondary mt-3" onClick={() => setLimit((value) => value + PAGE)}>
            Show more ({visible.length - limit} left)
          </button>
        )}
      </div>
    </main>
  );
}
