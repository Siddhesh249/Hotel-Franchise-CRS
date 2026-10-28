/**
 * GET /api/staff/bookings
 *
 * Staff only (scoped to session.hotelId). Returns bookings/arrivals for
 * the staff member's hotel only.
 *
 * Phase 1 — §1.5 Staff portal
 */

// TODO: Phase 1 (1.5)
// 1. requireRole(session, ['Staff'], { sameHotel: true })
// 2. SELECT bookings WHERE room_type.hotel_id = session.hotelId
//    ordered by check_in_date ASC
// 3. Return Booking[]

import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Phase 1 (1.5)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
