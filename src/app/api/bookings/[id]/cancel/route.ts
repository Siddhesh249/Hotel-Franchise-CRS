/**
 * POST /api/bookings/[id]/cancel   (Guest, own booking)
 * Body: { reason? }
 *
 * sp_cancel_booking releases the inventory, refunds any payment and promotes
 * waitlisted guests in FIFO order.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, positiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';
import { retryOnError } from '@/lib/retry';

const REFUSALS: Record<string, [string, string, number]> = {
  NOT_FOUND: ['NOT_FOUND', 'Booking not found', 404],
  ALREADY_CANCELLED: ['NOT_CANCELLABLE', 'This booking is already cancelled', 409],
  STAY_STARTED: ['NOT_CANCELLABLE', 'A stay that has already started cannot be cancelled', 409],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const bookingId = positiveInt((await params).id);
  if (!bookingId) return apiError('VALIDATION_ERROR', 'A valid booking id is required', 400);

  const body = await req.json().catch(() => null);
  const reason = String(body?.reason ?? '').trim().slice(0, 200) || 'Guest cancellation';

  const conn = await pool.getConnection();
  try {
    const { status } = await retryOnError(async () => {
      await conn.query('CALL sp_cancel_booking(?, ?, ?, @status)', [bookingId, Number(session!.sub), reason]);
      const [[row]] = await conn.query<any[]>('SELECT @status AS status');
      return { status: String(row.status) };
    });
    if (status === 'CANCELLED') {
      return NextResponse.json({ cancelled: true, booking_id: bookingId });
    }
    const refusal = REFUSALS[status];
    return refusal
      ? apiError(refusal[0], refusal[1], refusal[2])
      : apiError('DATABASE_ERROR', 'The booking could not be cancelled right now', 500);
  } catch (error) {
    console.error('cancel booking failed', error);
    return apiError('DATABASE_ERROR', 'The booking could not be cancelled right now', 500);
  } finally {
    conn.release();
  }
}
