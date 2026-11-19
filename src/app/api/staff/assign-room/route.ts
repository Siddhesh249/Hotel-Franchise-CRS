/**
 * POST /api/staff/assign-room   (Staff of the booking's hotel)
 * Body: { booking_id, room_id }
 *
 * The API only checks that the booking and room belong to the staff member's
 * hotel. Every business rule (confirmed, paid, right room type, room
 * available, no overlap) is enforced by trg_prevent_room_double_assignment, and
 * its message is returned as the error.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, isDuplicateEntry, positiveInt, triggerMessage } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff']);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const bookingId = positiveInt(body?.booking_id);
  const roomId = positiveInt(body?.room_id);
  if (!bookingId || !roomId) return apiError('VALIDATION_ERROR', 'booking_id and room_id are required', 400);

  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT rt.hotel_id AS booking_hotel, r.hotel_id AS room_hotel, r.room_number
         FROM booking b
         JOIN room_type rt ON rt.room_type_id = b.room_type_id
         JOIN room r ON r.room_id = ?
        WHERE b.booking_id = ?`,
      [roomId, bookingId],
    );
    if (!rows.length) return apiError('NOT_FOUND', 'Booking or room not found', 404);
    const { booking_hotel, room_hotel, room_number } = rows[0];
    if (Number(booking_hotel) !== session!.hotelId || Number(room_hotel) !== session!.hotelId) {
      return apiError('FORBIDDEN', 'The booking or room is outside your hotel', 403);
    }

    const [result] = await pool.execute<any>(
      'INSERT INTO room_assignment (booking_id, room_id) VALUES (?, ?)',
      [bookingId, roomId],
    );
    return NextResponse.json({ assignment_id: result.insertId, room_number }, { status: 201 });
  } catch (error) {
    const message = triggerMessage(error);
    if (message) return apiError('ASSIGNMENT_REFUSED', message, 409);
    if (isDuplicateEntry(error)) return apiError('ALREADY_ASSIGNED', 'This booking already has a room', 409);
    console.error('assign room failed', error);
    return apiError('DATABASE_ERROR', 'The room assignment could not be completed right now', 500);
  }
}
