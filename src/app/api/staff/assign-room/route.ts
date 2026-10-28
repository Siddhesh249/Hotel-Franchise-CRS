/**
 * POST /api/staff/assign-room
 *
 * Staff only. Inserts a room_assignment row to physically assign a room to a booking.
 *
 * Body: { booking_id, room_id }
 * Returns: { assignment_id } on success
 *
 * CRITICAL: The trg_prevent_room_double_assignment trigger (SQLSTATE '45000')
 * must be caught here and returned as a 409 with a human-readable error message.
 * Never surface the raw SQL error to the UI. (ARCHITECTURE.md §11)
 *
 * Phase 1 — §1.5 Staff portal
 */

// TODO: Phase 1 (1.5)
// 1. requireRole(session, ['Staff'])
// 2. Verify room belongs to session.hotelId
// 3. INSERT INTO room_assignment (booking_id, room_id, assigned_on) VALUES (?, ?, NOW())
// 4. Catch mysql2 error where sqlState === '45000' → return 409 "Room already occupied for these dates"
// 5. Return { assignment_id } with 201

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Phase 1 (1.5)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
