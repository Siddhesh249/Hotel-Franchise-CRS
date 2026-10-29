/**
 * POST /api/bookings/[id]/cancel
 *
 * Guest only (own booking). Calls sp_cancel_booking().
 * After cancellation, sp_try_promote_waitlist() is called automatically
 * by sp_cancel_booking itself — no extra call needed from the API.
 *
 * Body: { reason? }
 * Returns: { cancelled: true, promoted_booking_id?: number }
 *
 * Phase 1 — §1.4 Guest booking flow
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { apiError, requireOwnership, requireRole } from '@/lib/authz';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;
  const bookingId = Number((await params).id);
  const [bookings] = await pool.execute<any[]>('SELECT guest_id FROM booking WHERE booking_id = ?', [bookingId]);
  if (!bookings.length) return apiError('NOT_FOUND', 'Booking not found', 404);
  const owned = requireOwnership(session, bookings[0].guest_id);
  if (owned) return owned;
  const body = await _req.json().catch(() => ({}));
  await pool.query('CALL sp_cancel_booking(?, ?)', [bookingId, String(body.reason ?? 'Guest cancellation')]);
  return NextResponse.json({ cancelled: true, booking_id: bookingId });
}
