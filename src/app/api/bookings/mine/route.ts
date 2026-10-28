/**
 * GET /api/bookings/mine
 *
 * Guest only. Returns the authenticated guest's own bookings + payment status.
 *
 * Phase 1 — §1.4 Guest booking flow
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { requireRole } from '@/lib/authz';

export async function GET() {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;
  const [rows] = await pool.execute<any[]>('SELECT b.*, rt.type_name, h.hotel_name, p.payment_status, p.amount AS paid_amount FROM booking b JOIN room_type rt ON rt.room_type_id = b.room_type_id JOIN hotel h ON h.hotel_id = rt.hotel_id LEFT JOIN payment p ON p.booking_id = b.booking_id WHERE b.guest_id = ? ORDER BY b.booking_date DESC', [Number(session!.sub)]);
  return NextResponse.json(rows);
}
