/**
 * GET /api/staff/bookings
 *
 * Staff only (scoped to session.hotelId). Returns bookings/arrivals for
 * the staff member's hotel only.
 *
 * Phase 1 — §1.5 Staff portal
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function GET() {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff']);
  if (denied) return denied;
  if (!session?.hotelId) return apiError('FORBIDDEN', 'Staff account has no hotel scope', 403);
  const [rows] = await pool.execute<any[]>('SELECT b.*, g.first_name, g.last_name, g.email, rt.type_name, h.hotel_name, r.room_number FROM booking b JOIN guest g ON g.guest_id = b.guest_id JOIN room_type rt ON rt.room_type_id = b.room_type_id JOIN hotel h ON h.hotel_id = rt.hotel_id LEFT JOIN room_assignment ra ON ra.booking_id = b.booking_id LEFT JOIN room r ON r.room_id = ra.room_id WHERE rt.hotel_id = ? ORDER BY b.check_in_date ASC', [session.hotelId]);
  return NextResponse.json(rows);
}
