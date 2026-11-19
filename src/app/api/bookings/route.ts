/**
 * POST /api/bookings   (Guest)
 * Body: { room_type_id, check_in_date, check_out_date, num_guests, special_requests? }
 *
 * Delegates the whole decision to sp_create_booking and returns its outcome
 * (CONFIRMED, CONFIRMED_OVERBOOKED or WAITLISTED) unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parseDate, positiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

const OUTCOMES = ['CONFIRMED', 'CONFIRMED_OVERBOOKED', 'WAITLISTED'];

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const roomTypeId = positiveInt(body?.room_type_id);
  const numGuests = positiveInt(body?.num_guests ?? 1);
  const checkIn = parseDate(body?.check_in_date);
  const checkOut = parseDate(body?.check_out_date);
  const requests = typeof body?.special_requests === 'string' ? body.special_requests.trim().slice(0, 500) : null;

  if (!roomTypeId || !numGuests || !checkIn || !checkOut) {
    return apiError('VALIDATION_ERROR', 'Room type, valid dates and guest count are required', 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_create_booking(?, ?, ?, ?, ?, ?, @booking_id, @status)', [
      Number(session!.sub), roomTypeId, checkIn, checkOut, numGuests, requests || null,
    ]);
    const [[result]] = await conn.query<any[]>(
      'SELECT @booking_id AS booking_id, @status AS status, (SELECT total_amount FROM booking WHERE booking_id = @booking_id) AS total_amount',
    );
    const status = String(result.status);

    switch (status) {
      case 'INVALID_DATES':
        return apiError('INVALID_DATES', 'Dates must be in the future, check-out after check-in, at most 60 nights', 400);
      case 'INVALID_ROOM_TYPE':
        return apiError('NOT_FOUND', 'That room type does not exist', 404);
      case 'INVALID_GUESTS':
        return apiError('VALIDATION_ERROR', 'That guest count does not fit this room type', 400);
      case 'INVALID_GUEST':
        return apiError('UNAUTHENTICATED', 'Your account no longer exists. Please sign in again.', 401);
    }
    if (!OUTCOMES.includes(status)) {
      return apiError('BOOKING_FAILED', 'The booking could not be created. Please try again.', 409);
    }
    return NextResponse.json(
      { booking_id: Number(result.booking_id), status, total_amount: Number(result.total_amount) },
      { status: 201 },
    );
  } catch (error) {
    console.error('create booking failed', error);
    return apiError('DATABASE_ERROR', 'The booking could not be completed right now', 500);
  } finally {
    conn.release();
  }
}
