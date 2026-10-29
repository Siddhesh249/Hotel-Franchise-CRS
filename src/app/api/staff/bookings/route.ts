/**
 * GET /api/staff/bookings
 *
 * Staff only (scoped to session.hotelId). Admins may pass ?hotel_id= to inspect
 * any property. Returns the hotel, the virtual "today", and every booking.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parsePositiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff', 'Admin']);
  if (denied) return denied;

  const requestedHotel = parsePositiveInt(req.nextUrl.searchParams.get('hotel_id'));
  const hotelId = session!.role === 'Admin' ? requestedHotel : session!.hotelId;
  if (!hotelId) {
    return apiError(
      'FORBIDDEN',
      session!.role === 'Admin' ? 'Choose a hotel to inspect' : 'This staff account has no hotel scope',
      403,
    );
  }

  try {
    const [hotels] = await pool.execute<any[]>(
      'SELECT hotel_id, hotel_name, city, state FROM hotel WHERE hotel_id = ?',
      [hotelId],
    );
    if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);

    const [clock] = await pool.query<any[]>(
      "SELECT DATE_FORMAT(virtual_now, '%Y-%m-%d') AS today FROM sim_clock WHERE clock_id = 1",
    );

    const [bookings] = await pool.execute<any[]>(
      `SELECT b.booking_id, b.guest_id, b.room_type_id, b.check_in_date, b.check_out_date,
              b.num_guests, b.special_requests, b.booking_date, b.booking_status,
              b.is_overbooked, b.total_amount,
              DATEDIFF(b.check_out_date, b.check_in_date) AS nights,
              g.first_name, g.last_name, g.email, g.phone, g.is_synthetic,
              rt.type_name, rt.base_price, rt.max_occupancy,
              h.hotel_id, h.hotel_name, h.city, h.state,
              p.payment_id, p.payment_status, p.payment_method, p.amount AS paid_amount,
              ra.assignment_id, ra.room_id, r.room_number
         FROM booking b
         JOIN guest g ON g.guest_id = b.guest_id
         JOIN room_type rt ON rt.room_type_id = b.room_type_id
         JOIN hotel h ON h.hotel_id = rt.hotel_id
         LEFT JOIN payment p ON p.payment_id = (
           SELECT MAX(payment_id) FROM payment WHERE booking_id = b.booking_id
         )
         LEFT JOIN room_assignment ra ON ra.booking_id = b.booking_id
         LEFT JOIN room r ON r.room_id = ra.room_id
        WHERE rt.hotel_id = ?
        ORDER BY b.check_in_date ASC, b.booking_id ASC`,
      [hotelId],
    );

    return NextResponse.json({
      hotel: hotels[0],
      today: clock[0]?.today ?? new Date().toISOString().slice(0, 10),
      bookings,
    });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load hotel bookings right now', 500);
  }
}
