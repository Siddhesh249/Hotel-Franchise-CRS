/**
 * PUT /api/admin/overbooking-policy/[roomTypeId]
 *
 * Admin only. Edits overbooking_policy.overbook_percentage for a room type.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, boundedNumber, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomTypeId: string }> },
) {
  const { denied } = await adminSession();
  if (denied) return denied;

  const roomTypeId = positiveId((await params).roomTypeId);
  const body = await req.json().catch(() => ({}));
  const percentage = boundedNumber(body.overbook_percentage, 0, 50);
  if (!roomTypeId || percentage === null) return invalid('Overbooking percentage must be between 0 and 50');

  try {
    const [exists] = await pool.execute<any[]>('SELECT room_type_id FROM room_type WHERE room_type_id = ?', [roomTypeId]);
    if (!exists.length) return apiError('NOT_FOUND', 'Room type not found', 404);

    await pool.execute(
      `INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE overbook_percentage = ?, updated_on = CURRENT_TIMESTAMP`,
      [roomTypeId, percentage, percentage],
    );
    return NextResponse.json({ room_type_id: roomTypeId, overbook_percentage: percentage });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to save the overbooking policy', 500);
  }
}
