/**
 * POST /api/admin/room-types/[id]/rooms
 *
 * Admin only. Creates any missing physical `room` rows for a room type so
 * staff can assign real rooms. Existing rooms are never deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { ensurePhysicalRooms } from '@/lib/rooms';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { denied } = await adminSession();
  if (denied) return denied;

  const roomTypeId = positiveId((await params).id);
  if (!roomTypeId) return apiError('VALIDATION_ERROR', 'A valid room type id is required', 400);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute<any[]>(
      'SELECT hotel_id, total_rooms FROM room_type WHERE room_type_id = ?',
      [roomTypeId],
    );
    if (!rows.length) return apiError('NOT_FOUND', 'Room type not found', 404);

    await conn.beginTransaction();
    const created = await ensurePhysicalRooms(
      conn,
      roomTypeId,
      Number(rows[0].hotel_id),
      Number(rows[0].total_rooms),
    );
    await conn.commit();

    const [countRows] = await conn.execute<any[]>(
      'SELECT COUNT(*) AS room_count FROM room WHERE room_type_id = ?',
      [roomTypeId],
    );
    return NextResponse.json({ created, physical_room_count: Number(countRows[0]?.room_count ?? 0) });
  } catch {
    await conn.rollback();
    return apiError('DATABASE_ERROR', 'Unable to create the missing physical rooms', 500);
  } finally {
    conn.release();
  }
}
