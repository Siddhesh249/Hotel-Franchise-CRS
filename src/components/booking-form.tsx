'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui';
import { addDaysIso, formatCurrency, formatDate, nightsBetween, plural, todayIso } from '@/lib/format';

interface BookingFormProps {
  roomTypeId: number;
  roomTypeName: string;
  hotelName: string;
  basePrice: number;
  maxOccupancy: number;
  roomsLeft: number;
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuests: number;
  signedInAs: string;
}

const OUTCOMES: Record<string, { title: string; body: string; tone: 'info' | 'warn' }> = {
  CONFIRMED: {
    title: 'Booking confirmed',
    body: 'A room of this type is held for you. Pay from My bookings whenever you like.',
    tone: 'info',
  },
  CONFIRMED_OVERBOOKED: {
    title: 'Booking confirmed (buffer)',
    body: 'Every physical room is already promised for these dates, so this booking uses the hotel’s overbooking buffer.',
    tone: 'warn',
  },
  WAITLISTED: {
    title: 'Added to the waitlist',
    body: 'No room is free for these dates. You will be confirmed automatically, in order, if a cancellation frees one.',
    tone: 'warn',
  },
};

export function BookingForm(props: BookingFormProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(props.initialCheckIn);
  const [checkOut, setCheckOut] = useState(props.initialCheckOut);
  const [guests, setGuests] = useState(String(props.initialGuests));
  const [requests, setRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<{ status: string; bookingId: number; total: number } | null>(null);
  const [live, setLive] = useState<{ key: string; left: number } | null>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const total = props.basePrice * nights;
  const validDates = checkIn >= todayIso() && nights >= 1 && nights <= 60;
  const dateKey = `${checkIn}|${checkOut}`;
  const roomsLeft = live?.key === dateKey ? live.left : props.roomsLeft;

  useEffect(() => {
    if (!validDates) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ room_type_id: String(props.roomTypeId), check_in: checkIn, check_out: checkOut });
        const response = await fetch(`/api/availability?${params}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        const match = data.results?.find((item: { room_type_id: number }) => item.room_type_id === props.roomTypeId);
        if (match) setLive({ key: dateKey, left: Number(match.rooms_left) });
      } catch {
        /* aborted or offline: keep the server-rendered number */
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [checkIn, checkOut, dateKey, validDates, props.roomTypeId]);

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_type_id: props.roomTypeId,
          check_in_date: checkIn,
          check_out_date: checkOut,
          num_guests: Number(guests),
          special_requests: requests.trim() || null,
        }),
      });
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'The booking could not be completed. Please try again.');
        return;
      }
      setOutcome({ status: data.status, bookingId: data.booking_id, total: data.total_amount });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    const copy = OUTCOMES[outcome.status] ?? OUTCOMES.CONFIRMED;
    return (
      <div className="card animate-fade space-y-4 self-start p-5">
        <Alert tone={copy.tone}>
          <p className="font-medium">{copy.title}</p>
          <p className="mt-1">{copy.body}</p>
        </Alert>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="eyebrow">Booking</dt><dd className="mt-1 font-medium">#{outcome.bookingId}</dd></div>
          <div><dt className="eyebrow">Total</dt><dd className="mt-1 font-medium">{formatCurrency(outcome.total)}</dd></div>
          <div className="col-span-2">
            <dt className="eyebrow">Stay</dt>
            <dd className="mt-1 font-medium">{props.roomTypeName}, {props.hotelName}, {formatDate(checkIn)} to {formatDate(checkOut)}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Link href="/my-bookings" className="btn-primary">My bookings</Link>
          <button type="button" className="btn-secondary" onClick={() => { setOutcome(null); setRequests(''); router.refresh(); }}>
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card self-start p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base">Reserve</h2>
        {roomsLeft > 0 ? <span className="badge-brand">{roomsLeft} left</span> : <span className="badge-amber">Waitlist</span>}
      </div>
      {roomsLeft === 0 && validDates && (
        <p className="muted mt-2">No room is free for these dates. Booking adds you to the waitlist.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Check in</span>
          <input type="date" required value={checkIn} min={todayIso()} onChange={(e) => changeCheckIn(e.target.value)} className="input" />
        </label>
        <label>
          <span className="label">Check out</span>
          <input type="date" required value={checkOut} min={addDaysIso(checkIn || todayIso(), 1)} onChange={(e) => setCheckOut(e.target.value)} className="input" />
        </label>
        <label>
          <span className="label">Guests</span>
          <select value={guests} onChange={(e) => setGuests(e.target.value)} className="input">
            {Array.from({ length: props.maxOccupancy }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Special requests</span>
          <input value={requests} onChange={(e) => setRequests(e.target.value)} maxLength={500} placeholder="Optional" className="input" />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
        <span className="text-ink-600">{formatCurrency(props.basePrice)} × {plural(Math.max(nights, 0), 'night')}</span>
        <span className="text-base font-semibold">{formatCurrency(total)}</span>
      </div>

      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      <button type="submit" disabled={submitting || !validDates} className="btn-primary mt-4 w-full">
        {submitting ? 'Booking…' : roomsLeft > 0 ? 'Book now' : 'Join waitlist'}
      </button>
      <p className="mt-2 text-center text-xs text-ink-500">Booking as {props.signedInAs}. Payment is simulated and taken later.</p>
    </form>
  );
}
