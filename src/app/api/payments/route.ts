/**
 * POST /api/payments
 *
 * Guest only (own booking). Inserts a simulated payment row.
 * No real payment gateway — see ARCHITECTURE.md §8.
 *
 * Body: { booking_id, amount, payment_method }
 * payment_status is set to 'Completed' unconditionally (simulated).
 *
 * Phase 1 — §1.4 Guest booking flow
 */

// TODO: Phase 1 (1.4)
// 1. requireRole(session, ['Guest'])
// 2. Verify booking belongs to the session guest (requireOwnership)
// 3. INSERT INTO payment (booking_id, amount, payment_method, payment_status)
//    VALUES (?, ?, ?, 'Completed')
// 4. Return { payment_id }

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Phase 1 (1.4)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
