/**
 * POST /api/bookings/[id]/cancel
 *
 * Guest only (own booking). Calls sp_cancel_booking().
 * After cancellation, sp_try_promote_waitlist() is called automatically
 * by sp_cancel_booking itself — no extra call needed from the API.
 *
 * Body: { reason? }
 * Returns: { cancelled: true, promoted_booking_id?: number }
 *
 * Phase 1 — §1.4 Guest booking flow
 */

// TODO: Phase 1 (1.4)
// 1. requireRole(session, ['Guest'])
// 2. Fetch booking to get guest_id; requireOwnership(session, booking.guest_id)
// 3. CALL sp_cancel_booking(booking_id, reason)
// 4. Return success (promotion happens automatically inside the stored procedure)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  void id; // TODO: Phase 1 (1.4)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
