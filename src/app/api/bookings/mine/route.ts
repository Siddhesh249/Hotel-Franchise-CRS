/**
 * GET /api/bookings/mine
 *
 * Guest only. Returns the authenticated guest's own bookings, payment status,
 * assigned room, and the number of nights.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function GET() {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT b.booking_id, b.guest_id, b.room_type_id, b.check_in_date, b.check_out_date,
              b.num_guests, b.special_requests, b.booking_date, b.booking_status,
              b.is_overbooked, b.total_amount,
              DATEDIFF(b.check_out_date, b.check_in_date) AS nights,
              rt.type_name, rt.base_price, rt.max_occupancy,
              h.hotel_id, h.hotel_name, h.city, h.state,
              p.payment_id, p.payment_status, p.payment_method, p.amount AS paid_amount,
              r.room_number
         FROM booking b
         JOIN room_type rt ON rt.room_type_id = b.room_type_id
         JOIN hotel h ON h.hotel_id = rt.hotel_id
         LEFT JOIN payment p ON p.payment_id = (
           SELECT MAX(payment_id) FROM payment WHERE booking_id = b.booking_id
         )
         LEFT JOIN room_assignment ra ON ra.booking_id = b.booking_id
         LEFT JOIN room r ON r.room_id = ra.room_id
        WHERE b.guest_id = ?
        ORDER BY b.check_in_date DESC, b.booking_id DESC`,
      [Number(session!.sub)],
    );
    return NextResponse.json(rows);
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load your bookings right now', 500);
  }
}
