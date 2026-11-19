/** PUT /api/admin/overbooking-policy/[roomTypeId]: set the base overbooking percentage (0-50). */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, invalid, serverError } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { boundedNumber, positiveInt } from '@/lib/request';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ roomTypeId: string }> }) {
  const { denied } = await adminSession();
  if (denied) return denied;

  const roomTypeId = positiveInt((await params).roomTypeId);
  const body = await req.json().catch(() => ({}));
  const percentage = boundedNumber(body.overbook_percentage, 0, 50);
  if (!roomTypeId || percentage === null) return invalid('Overbooking percentage must be between 0 and 50');

  try {
    const [exists] = await pool.execute<any[]>('SELECT 1 FROM room_type WHERE room_type_id = ?', [roomTypeId]);
    if (!exists.length) return apiError('NOT_FOUND', 'Room type not found', 404);
    await pool.execute(
      `INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE overbook_percentage = VALUES(overbook_percentage)`,
      [roomTypeId, percentage],
    );
    return NextResponse.json({ room_type_id: roomTypeId, overbook_percentage: percentage });
  } catch (error) {
    return serverError('DATABASE_ERROR', 'Unable to save the overbooking policy', error);
  }
}
