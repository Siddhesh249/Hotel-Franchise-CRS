/**
 * GET /api/bookings/mine
 *
 * Guest only. Returns the authenticated guest's own bookings + payment status.
 *
 * Phase 1 — §1.4 Guest booking flow
 */

// TODO: Phase 1 (1.4)
// 1. requireRole(session, ['Guest'])
// 2. SELECT b.*, p.payment_status FROM booking b
//    LEFT JOIN payment p ON p.booking_id = b.booking_id
//    WHERE b.guest_id = session.sub
// 3. Return Booking[] with payment_status

import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Phase 1 (1.4)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
