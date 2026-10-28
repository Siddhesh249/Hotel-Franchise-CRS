/**
 * /staff — Staff dashboard (Staff only, scoped to session.hotelId)
 *
 * Fetches GET /api/staff/bookings.
 * Room assignment action: POST /api/staff/assign-room.
 *
 * CRITICAL: The double-assignment guard (SQLSTATE '45000') must be
 * shown as a clean user-facing error, not a raw SQL message.
 *
 * Phase 1 — §1.5 Staff portal
 *
 * TODO: Phase 1 (1.5) — implement staff dashboard
 *   - Today's arrivals list (filtered by check_in_date = virtual_now.date)
 *   - Room assignment form per booking
 *   - Error state for trigger-rejected double assignment
 */
"use client";
import { useEffect, useState } from 'react';
export default function StaffPage() { const [rows, setRows] = useState<any[]>([]); const [message, setMessage] = useState(''); useEffect(() => { fetch('/api/staff/bookings').then(r => r.json()).then(setRows); }, []); async function assign(booking_id: number, room_id: string) { const r = await fetch('/api/staff/assign-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id, room_id: Number(room_id) }) }); const d = await r.json(); setMessage(r.ok ? 'Room assigned.' : d.error?.message ?? 'Assignment failed'); } return <main className="mx-auto max-w-5xl p-8"><h1 className="text-3xl font-bold">Staff dashboard</h1>{message && <p className="mt-4">{message}</p>}<div className="mt-6 space-y-4">{rows.map(row => <article key={row.booking_id} className="rounded border p-5"><h2 className="font-semibold">Booking #{row.booking_id} · {row.first_name} {row.last_name}</h2><p>{row.check_in_date} → {row.check_out_date} · {row.booking_status}</p><div className="mt-3 flex gap-2"><input id={`room-${row.booking_id}`} placeholder="Room ID" className="rounded border p-2" /><button onClick={() => assign(row.booking_id, (document.getElementById(`room-${row.booking_id}`) as HTMLInputElement).value)} className="rounded bg-black px-3 py-2 text-white">Assign room</button></div></article>)}</div></main>; }
