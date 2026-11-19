/**
 * GET /api/staff/bookings[?hotel_id=]
 *
 * Staff see their own hotel only (from the session); an Admin must pass
 * ?hotel_id= to look at one. Returns the hotel, today's date (from the
 * database clock) and the hotel's bookings.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, positiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';
import { toBookingRow } from '@/lib/bookings';

export async function GET(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff', 'Admin']);
  if (denied) return denied;

  const hotelId = session!.role === 'Admin'
    ? positiveInt(req.nextUrl.searchParams.get('hotel_id'))
    : session!.hotelId;
  if (!hotelId) return apiError('VALIDATION_ERROR', 'A hotel is required', 400);

  try {
    const [hotels] = await pool.execute<any[]>(
      "SELECT hotel_id, hotel_name, city, state, DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS today FROM hotel WHERE hotel_id = ?",
      [hotelId],
    );
    if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);

    const [bookings] = await pool.execute<any[]>(
      'SELECT * FROM vw_booking_details WHERE hotel_id = ? ORDER BY check_in_date, booking_id',
      [hotelId],
    );
    const { today, ...hotel } = hotels[0];
    return NextResponse.json({ hotel, today, bookings: bookings.map(toBookingRow) });
  } catch (error) {
    console.error('staff bookings failed', error);
    return apiError('DATABASE_ERROR', 'Unable to load hotel bookings right now', 500);
  }
}
