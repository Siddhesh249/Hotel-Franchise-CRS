/**
 * /book/[roomTypeId] — Booking form page (Guest only)
 *
 * Submits to POST /api/bookings.
 * CRITICAL: Must surface all three outcome states distinctly in the UI:
 *   - CONFIRMED
 *   - CONFIRMED_OVERBOOKED (accepted but over physical capacity)
 *   - WAITLISTED
 * (ARCHITECTURE.md §11, IMPLEMENTATION_PHASES.md §1.4)
 *
 * Phase 1 — §1.4 Guest booking flow
 *
 * TODO: Phase 1 (1.4) — implement booking form
 *   - check_in_date / check_out_date (default from virtual_now via /api/admin/clock)
 *   - num_guests, special_requests
 *   - Show outcome state prominently on result
 */

"use client";
import { FormEvent, use, useState } from 'react';

function BookPageContent({ roomTypeId }: { roomTypeId: string }) {
  const [outcome, setOutcome] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, room_type_id: Number(roomTypeId), num_guests: Number(body.num_guests) }) }); const data = await response.json(); setOutcome(response.ok ? data.status : data.error?.message ?? 'Booking failed'); }
  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Book a Room</h1>
      <p className="text-gray-500 mb-2">Room type ID: {roomTypeId}</p>
      <form onSubmit={submit} className="space-y-4"><label className="block">Check in<input name="check_in_date" type="date" required className="mt-1 w-full rounded border p-3" /></label><label className="block">Check out<input name="check_out_date" type="date" required className="mt-1 w-full rounded border p-3" /></label><label className="block">Guests<input name="num_guests" type="number" min="1" defaultValue="1" className="mt-1 w-full rounded border p-3" /></label><button className="rounded bg-black px-5 py-3 text-white">Book now</button></form>{outcome && <div className="mt-6 rounded border p-4"><strong>{outcome}</strong><p className="mt-2">{outcome === 'WAITLISTED' ? 'You will be promoted automatically if a cancellation frees capacity.' : outcome === 'CONFIRMED_OVERBOOKED' ? 'Your booking is confirmed using the hotel overbooking buffer.' : 'Your room is confirmed.'}</p></div>}
    </main>
  );
}

export default function BookPage({
  params,
}: {
  params: Promise<{ roomTypeId: string }>;
}) {
  const { roomTypeId } = use(params);
  return <BookPageContent roomTypeId={roomTypeId} />;
}
