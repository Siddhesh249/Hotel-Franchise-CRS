/**
 * GET /api/admin/reports/overbooked
 *
 * Admin only. Returns currently-overbooked confirmed bookings.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession } from '@/lib/admin';
import { apiError } from '@/lib/authz';

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT b.booking_id, b.check_in_date, b.check_out_date, b.booking_status,
              b.total_amount, b.is_overbooked,
              g.first_name, g.last_name, g.email, g.is_synthetic,
              rt.type_name, h.hotel_name, h.city
         FROM booking b
         JOIN guest g ON g.guest_id = b.guest_id
         JOIN room_type rt ON rt.room_type_id = b.room_type_id
         JOIN hotel h ON h.hotel_id = rt.hotel_id
        WHERE b.is_overbooked = TRUE
          AND b.booking_status IN ('Confirmed','CheckedIn')
        ORDER BY b.check_in_date, h.hotel_name`,
    );
    return NextResponse.json(rows);
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to generate the overbooking report', 500);
  }
}
