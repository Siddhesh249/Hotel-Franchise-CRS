/**
 * GET /api/staff/rooms?booking_id=123
 *
 * Staff only. Lists the physical rooms of the booking's room type and marks
 * which ones are physically occupied for the booking's dates. This is what
 * turns "type a room ID" into a usable assignment dropdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parsePositiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff', 'Admin']);
  if (denied) return denied;

  const bookingId = parsePositiveInt(req.nextUrl.searchParams.get('booking_id'));
  if (!bookingId) return apiError('VALIDATION_ERROR', 'A valid booking_id is required', 400);

  try {
    const [bookings] = await pool.execute<any[]>(
      `SELECT b.booking_id, b.booking_status, b.room_type_id, rt.hotel_id
         FROM booking b JOIN room_type rt ON rt.room_type_id = b.room_type_id
        WHERE b.booking_id = ?`,
      [bookingId],
    );
    if (!bookings.length) return apiError('NOT_FOUND', 'Booking not found', 404);

    const booking = bookings[0];
    const hotelId = Number(booking.hotel_id);
    if (session!.role === 'Staff' && session!.hotelId !== hotelId) {
      return apiError('FORBIDDEN', 'This booking belongs to another hotel', 403);
    }

    const [rooms] = await pool.execute<any[]>(
      `SELECT r.room_id, r.room_number, r.floor_number, r.room_status,
              EXISTS(
                SELECT 1
                  FROM room_assignment ra
                  JOIN booking b2 ON b2.booking_id = ra.booking_id
                 WHERE ra.room_id = r.room_id
                   AND b2.booking_id <> b.booking_id
                   AND b2.booking_status IN ('Confirmed','CheckedIn')
                   AND b2.check_in_date < b.check_out_date
                   AND b2.check_out_date > b.check_in_date
              ) AS occupied,
              EXISTS(
                SELECT 1 FROM room_assignment ra2
                 WHERE ra2.room_id = r.room_id AND ra2.booking_id = b.booking_id
              ) AS assigned_here
         FROM room r
         JOIN booking b ON b.booking_id = ?
        WHERE r.hotel_id = ? AND r.room_type_id = b.room_type_id
        ORDER BY r.floor_number, r.room_number`,
      [bookingId, hotelId],
    );

    return NextResponse.json({
      booking_id: bookingId,
      booking_status: booking.booking_status,
      room_type_id: Number(booking.room_type_id),
      rooms: rooms.map((room) => ({
        ...room,
        occupied: Boolean(room.occupied),
        assigned_here: Boolean(room.assigned_here),
      })),
    });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load rooms right now', 500);
  }
}
