/**
 * POST /api/bookings
 *
 * Guest only. Calls sp_create_booking() and returns the booking outcome.
 *
 * Body: { room_type_id, check_in_date, check_out_date, num_guests, special_requests? }
 * Returns: { booking_id, status: 'CONFIRMED' | 'CONFIRMED_OVERBOOKED' | 'WAITLISTED' }
 *
 * The status OUT parameter from sp_create_booking is surfaced directly to
 * the frontend so all three outcomes are shown distinctly (ARCHITECTURE.md §11).
 *
 * Phase 1 — §1.4 Guest booking flow
 */

// TODO: Phase 1 (1.4)
// 1. requireRole(session, ['Guest'])
// 2. Validate body
// 3. Read virtual_now from sim_clock for date defaults (if no explicit dates)
// 4. CALL sp_create_booking(guest_id, room_type_id, check_in, check_out, num_guests, @status)
//    SELECT @status
// 5. Return { booking_id, status }

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Phase 1 (1.4)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
