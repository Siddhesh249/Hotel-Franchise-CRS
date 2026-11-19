/**
 * GET /api/staff/rooms?booking_id=
 *
 * Staff of the booking's hotel. Lists the physical rooms of the booked room
 * type and marks the ones already taken for the booking's dates.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, positiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff']);
  if (denied) return denied;

  const bookingId = positiveInt(req.nextUrl.searchParams.get('booking_id'));
  if (!bookingId) return apiError('VALIDATION_ERROR', 'A valid booking_id is required', 400);

  try {
    const [bookings] = await pool.execute<any[]>(
      `SELECT rt.hotel_id FROM booking b JOIN room_type rt ON rt.room_type_id = b.room_type_id
        WHERE b.booking_id = ?`,
      [bookingId],
    );
    if (!bookings.length || Number(bookings[0].hotel_id) !== session!.hotelId) {
      return apiError('NOT_FOUND', 'Booking not found', 404);
    }

    const [rooms] = await pool.execute<any[]>(
      `SELECT r.room_id, r.room_number, r.floor_number, r.room_status,
              EXISTS (
                SELECT 1 FROM room_assignment ra
                  JOIN booking b2 ON b2.booking_id = ra.booking_id
                 WHERE ra.room_id = r.room_id
                   AND b2.booking_status = 'Confirmed'
                   AND b2.check_in_date < b.check_out_date
                   AND b2.check_out_date > b.check_in_date
              ) AS occupied
         FROM booking b
         JOIN room r ON r.room_type_id = b.room_type_id
        WHERE b.booking_id = ?
        ORDER BY r.floor_number, r.room_number`,
      [bookingId],
    );
    return NextResponse.json(rooms.map((room) => ({ ...room, occupied: Boolean(room.occupied) })));
  } catch (error) {
    console.error('staff rooms failed', error);
    return apiError('DATABASE_ERROR', 'Unable to load rooms right now', 500);
  }
}
