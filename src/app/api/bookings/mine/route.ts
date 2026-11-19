/** GET /api/bookings/mine (Guest): the signed-in guest's own bookings. */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';
import { toBookingRow } from '@/lib/bookings';

export async function GET() {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM vw_booking_details WHERE guest_id = ? ORDER BY check_in_date DESC, booking_id DESC',
      [Number(session!.sub)],
    );
    return NextResponse.json(rows.map(toBookingRow));
  } catch (error) {
    console.error('load bookings failed', error);
    return apiError('DATABASE_ERROR', 'Unable to load your bookings right now', 500);
  }
}
