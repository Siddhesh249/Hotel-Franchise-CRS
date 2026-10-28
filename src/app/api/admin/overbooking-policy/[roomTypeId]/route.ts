/**
 * PUT /api/admin/overbooking-policy/[roomTypeId]
 *
 * Admin only. Edits overbooking_policy.overbook_percentage for a room type.
 * Phase 2 — §2.1 Admin catalog management
 */

// TODO: Phase 2 (2.1)
// UPDATE overbooking_policy SET overbook_percentage = ? WHERE room_type_id = ?

import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ roomTypeId: string }> },
) {
  const { roomTypeId } = await params;
  void roomTypeId;
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
