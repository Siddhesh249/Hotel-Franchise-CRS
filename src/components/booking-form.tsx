'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { StatusBadge } from '@/components/status-badge';
import { addDaysIso, formatCurrency, formatDate, nightsBetween, todayIso } from '@/lib/format';

interface BookingFormProps {
  roomTypeId: number;
  roomTypeName: string;
  hotelName: string;
  city: string;
  basePrice: number;
  maxOccupancy: number;
  roomsLeft: number;
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuests: number;
  signedInAs: string;
}

type Outcome = { status: string; booking_id: number } | null;

export function BookingForm(props: BookingFormProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(props.initialCheckIn);
  const [checkOut, setCheckOut] = useState(props.initialCheckOut);
  const [guests, setGuests] = useState(String(props.initialGuests));
  const [requests, setRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [liveRoomsLeft, setLiveRoomsLeft] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const total = props.basePrice * Math.max(nights, 0);
  const roomsLeft = liveRoomsLeft ?? props.roomsLeft;

  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCheckingAvailability(true);
      try {
        const params = new URLSearchParams({
          room_type_id: String(props.roomTypeId),
          check_in: checkIn,
          check_out: checkOut,
        });
        const response = await fetch(`/api/availability?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const match = data?.results?.find((item: { room_type_id: number }) => Number(item.room_type_id) === props.roomTypeId);
        setLiveRoomsLeft(match ? Number(match.rooms_left) : null);
      } catch {
        /* Aborted or offline — keep the server-rendered value. */
      } finally {
        setCheckingAvailability(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [checkIn, checkOut, props.roomTypeId]);

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setOutcome(null);
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
      setOutcome({ status: String(data.status), booking_id: Number(data.booking_id) });
      router.refresh();
    } catch {
      setError('We could not reach the reservation service. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    const copy =
      outcome.status === 'WAITLISTED'
        ? {
            title: 'You are on the waitlist',
            body: 'No room is available for these dates right now. You are in the FIFO queue and will be promoted automatically if a cancellation frees capacity.',
            tone: 'amber' as const,
          }
        : outcome.status === 'CONFIRMED_OVERBOOKED'
          ? {
              title: 'Confirmed using the overbooking buffer',
              body: 'Your stay is confirmed. It relies on the hotel’s soft overbooking buffer, which is exactly what that buffer exists for.',
              tone: 'amber' as const,
            }
          : {
              title: 'Your stay is confirmed',
              body: 'A room in this category is held for you. You can pay now or later from My bookings.',
              tone: 'brand' as const,
            };
    return (
      <div className="animate-rise space-y-5">
        <div className={`card overflow-hidden ${copy.tone === 'brand' ? 'border-brand-200' : 'border-accent-200'}`}>
          <div className={`h-1.5 w-full ${copy.tone === 'brand' ? 'bg-brand-500' : 'bg-accent-400'}`} />
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${copy.tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-600'}`}>
                <Icon name={copy.tone === 'brand' ? 'check' : 'sparkles'} size={24} />
              </span>
              <StatusBadge status={outcome.status} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">{copy.title}</h2>
            <p className="muted mt-2">{copy.body}</p>
            <dl className="mt-5 grid gap-3 rounded-xl bg-sand-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Booking</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">#{outcome.booking_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Stay</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{formatDate(checkIn)} → {formatDate(checkOut)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Room</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{props.roomTypeName} · {props.hotelName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Total</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{formatCurrency(total)}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/my-bookings" className="btn-primary">
                Go to my bookings
                <Icon name="arrow-right" size={16} />
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setOutcome(null);
                  setRequests('');
                }}
              >
                Book another stay
              </button>
            </div>
          </div>
        </div>
        <p className="muted text-center">
          Signed in as <b>{props.signedInAs}</b>. Payments are simulated — no real card is charged.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reserve your stay</h2>
          <p className="muted mt-1">You will see the exact booking outcome immediately.</p>
        </div>
        {roomsLeft > 0 ? (
          <span className="badge-brand shrink-0">{checkingAvailability ? 'Checking…' : `${roomsLeft} left`}</span>
        ) : (
          <span className="badge-amber shrink-0">Waitlist</span>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {roomsLeft === 0 && (
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800 sm:col-span-2">
            <b>No room is currently free for these dates.</b> Submitting this form places you on the FIFO
            waitlist; you are promoted automatically if a cancellation frees capacity.
          </div>
        )}
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
              <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-500">This room sleeps up to {props.maxOccupancy}.</span>
        </label>
        <label>
          <span className="label">Special requests <span className="font-normal text-ink-400">(optional)</span></span>
          <input
            value={requests}
            onChange={(e) => setRequests(e.target.value)}
            maxLength={500}
            placeholder="High floor, late arrival…"
            className="input"
          />
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-ink-100 bg-sand-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-600">{formatCurrency(props.basePrice)} × {nights} {nights === 1 ? 'night' : 'nights'}</span>
          <span className="font-semibold text-ink-900">{formatCurrency(total)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-sm">
          <span className="text-ink-600">Payment</span>
          <span className="text-ink-500">Simulated · pay from My bookings</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
        {submitting ? 'Checking availability…' : `Book ${props.roomTypeName} at ${props.hotelName}`}
      </button>
      <p className="mt-3 text-center text-xs text-ink-500">
        No payment is taken now. You can cancel an active booking from My bookings.
      </p>
    </form>
  );
}
