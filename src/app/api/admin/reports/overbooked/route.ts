/** GET /api/admin/reports/overbooked: confirmed bookings that rely on the overbooking buffer. */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, serverError } from '@/lib/admin';

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT booking_id, hotel_name, type_name, first_name, last_name,
              check_in_date, check_out_date, total_amount
         FROM vw_booking_details
        WHERE is_overbooked = TRUE AND booking_status = 'Confirmed' AND stay_phase <> 'Past'
        ORDER BY check_in_date, hotel_name, booking_id`,
    );
    return NextResponse.json(rows);
  } catch (error) {
    return serverError('DATABASE_ERROR', 'Unable to generate the overbooking report', error);
  }
}
