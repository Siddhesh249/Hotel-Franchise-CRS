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

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, errorCode } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff']);
  if (denied) return denied;
  if (!session?.hotelId) return apiError('FORBIDDEN', 'Staff account has no hotel scope', 403);
  const body = await req.json().catch(() => null);
  const bookingId = Number(body?.booking_id);
  const roomId = Number(body?.room_id);
  if (!Number.isInteger(bookingId) || !Number.isInteger(roomId)) return apiError('VALIDATION_ERROR', 'booking_id and room_id are required', 400);
  const [scope] = await pool.execute<any[]>('SELECT b.booking_id FROM booking b JOIN room_type rt ON rt.room_type_id = b.room_type_id JOIN room r ON r.room_id = ? WHERE b.booking_id = ? AND rt.hotel_id = ? AND r.hotel_id = rt.hotel_id', [roomId, bookingId, session.hotelId]);
  if (!scope.length) return apiError('FORBIDDEN', 'The booking or room is outside your hotel', 403);
  try {
    const [result] = await pool.execute<any>('INSERT INTO room_assignment (booking_id, room_id) VALUES (?, ?)', [bookingId, roomId]);
    return NextResponse.json({ assignment_id: result.insertId }, { status: 201 });
  } catch (error) {
    if (errorCode(error) === '45000') return apiError('ROOM_UNAVAILABLE', 'Room already occupied for these dates', 409);
    return apiError('DATABASE_ERROR', 'Room assignment could not be completed', 409);
  }
}
