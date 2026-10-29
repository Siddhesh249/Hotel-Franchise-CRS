/**
 * POST /api/bookings/[id]/cancel
 *
 * Guest only (own booking). Calls sp_cancel_booking(), which also attempts
 * FIFO waitlist promotion automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parsePositiveInt } from '@/lib/request';
import { apiError, requireOwnership, requireRole } from '@/lib/authz';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const bookingId = parsePositiveInt((await params).id);
  if (!bookingId) return apiError('VALIDATION_ERROR', 'A valid booking id is required', 400);

  try {
    const [bookings] = await pool.execute<any[]>(
      'SELECT guest_id, booking_status FROM booking WHERE booking_id = ?',
      [bookingId],
    );
    if (!bookings.length) return apiError('NOT_FOUND', 'Booking not found', 404);

    const owned = requireOwnership(session, Number(bookings[0].guest_id));
    if (owned) return owned;

    const status = String(bookings[0].booking_status);
    if (['Cancelled', 'CheckedOut', 'NoShow'].includes(status)) {
      return apiError('NOT_CANCELLABLE', `This booking is already ${status.toLowerCase()}`, 409);
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason ?? '').trim().slice(0, 200) || 'Guest cancellation';
    await pool.query('CALL sp_cancel_booking(?, ?)', [bookingId, reason]);

    return NextResponse.json({ cancelled: true, booking_id: bookingId, status: 'Cancelled' });
  } catch {
    return apiError('DATABASE_ERROR', 'The booking could not be cancelled right now', 500);
  }
}
