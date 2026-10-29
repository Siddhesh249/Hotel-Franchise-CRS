/**
 * POST /api/staff/assign-room
 *
 * Staff only. Inserts a room_assignment row to physically assign a room to a
 * confirmed booking.
 *
 * Body: { booking_id, room_id }
 *
 * The trg_prevent_room_double_assignment trigger raises SQLSTATE '45000';
 * it is translated into a clean 409 here, never surfaced as a raw SQL error.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, isTriggerSignal, parsePositiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Staff']);
  if (denied) return denied;
  if (!session?.hotelId) return apiError('FORBIDDEN', 'This staff account has no hotel scope', 403);

  const body = await req.json().catch(() => null);
  const bookingId = parsePositiveInt(body?.booking_id);
  const roomId = parsePositiveInt(body?.room_id);
  if (!bookingId || !roomId) return apiError('VALIDATION_ERROR', 'booking_id and room_id are required', 400);

  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT b.booking_status, b.room_type_id, rt.hotel_id AS booking_hotel,
              r.hotel_id AS room_hotel, r.room_type_id AS room_type, r.room_status, r.room_number,
              (SELECT COUNT(*) FROM room_assignment ra WHERE ra.booking_id = b.booking_id) AS assigned
         FROM booking b
         JOIN room_type rt ON rt.room_type_id = b.room_type_id
         LEFT JOIN room r ON r.room_id = ?
        WHERE b.booking_id = ?`,
      [roomId, bookingId],
    );
    if (!rows.length) return apiError('NOT_FOUND', 'Booking not found', 404);
    const row = rows[0];
    if (row.room_hotel === null) return apiError('NOT_FOUND', 'Room not found', 404);
    if (Number(row.booking_hotel) !== Number(session.hotelId) || Number(row.room_hotel) !== Number(session.hotelId)) {
      return apiError('FORBIDDEN', 'The booking or room is outside your hotel', 403);
    }
    if (!['Confirmed', 'CheckedIn'].includes(String(row.booking_status))) {
      return apiError('NOT_ASSIGNABLE', 'Only a confirmed booking can be assigned a room', 409);
    }
    if (Number(row.room_type) !== Number(row.room_type_id)) {
      return apiError('ROOM_TYPE_MISMATCH', 'That room does not belong to the booked room type', 400);
    }
    if (String(row.room_status) !== 'Available') {
      return apiError('ROOM_UNAVAILABLE', `Room ${row.room_number} is ${String(row.room_status).toLowerCase()}`, 409);
    }
    if (Number(row.assigned) > 0) {
      return apiError('ALREADY_ASSIGNED', 'This booking already has a physical room assigned', 409);
    }

    const [result] = await pool.execute<any>(
      'INSERT INTO room_assignment (booking_id, room_id) VALUES (?, ?)',
      [bookingId, roomId],
    );
    return NextResponse.json(
      { assignment_id: result.insertId, room_id: roomId, room_number: row.room_number },
      { status: 201 },
    );
  } catch (error) {
    if (isTriggerSignal(error)) {
      return apiError('ROOM_UNAVAILABLE', 'That room is already occupied for these dates', 409);
    }
    return apiError('DATABASE_ERROR', 'The room assignment could not be completed right now', 500);
  }
}
