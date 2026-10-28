/**
 * /my-bookings — Guest's bookings dashboard (Guest only)
 *
 * Fetches GET /api/bookings/mine.
 * Allows cancellation via POST /api/bookings/[id]/cancel.
 * Shows payment status and allows payment via POST /api/payments.
 *
 * Phase 1 — §1.4 Guest booking flow
 *
 * TODO: Phase 1 (1.4) — implement my bookings UI
 *   - List bookings with status badges (Confirmed / Confirmed-Overbooked / Waitlisted / Cancelled)
 *   - Cancel button (only for active bookings)
 *   - Show when a Waitlisted booking has been promoted to Confirmed
 *   - Payment status + Pay button
 */
"use client";
import { useEffect, useState } from 'react';
export default function MyBookingsPage() { const [bookings, setBookings] = useState<any[]>([]); useEffect(() => { fetch('/api/bookings/mine').then(r => r.json()).then(setBookings); }, []); async function cancel(id: number) { await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' }); setBookings(bookings.map(b => b.booking_id === id ? { ...b, booking_status: 'Cancelled' } : b)); } return <main className="mx-auto max-w-4xl p-8"><h1 className="text-3xl font-bold">My bookings</h1><div className="mt-6 space-y-4">{bookings.map(b => <article key={b.booking_id} className="rounded border p-5"><div className="flex justify-between"><h2 className="font-semibold">{b.hotel_name} · {b.type_name}</h2><span>{b.booking_status}</span></div><p className="mt-2">{b.check_in_date} → {b.check_out_date}</p>{!['Cancelled', 'CheckedOut'].includes(b.booking_status) && <button onClick={() => cancel(b.booking_id)} className="mt-4 rounded border px-3 py-2">Cancel booking</button>}</article>)}{!bookings.length && <p className="text-slate-500">No bookings yet.</p>}</div></main>; }
