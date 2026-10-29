/**
 * POST /api/bookings
 *
 * Guest only. Calls sp_create_booking() and returns the booking outcome.
 *
 * Body: { room_type_id, check_in_date, check_out_date, num_guests, special_requests? }
 * Returns: { booking_id, status, total_amount }
 *
 * The status OUT parameter from sp_create_booking is surfaced directly to the
 * frontend so all three outcomes are shown distinctly (ARCHITECTURE.md §11).
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, errorCode, parseDate, sqlState } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

const VALID_OUTCOMES = ['CONFIRMED', 'CONFIRMED_OVERBOOKED', 'WAITLISTED'];

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const roomTypeId = Number(body?.room_type_id);
  const numGuests = Number(body?.num_guests ?? 1);
  const checkIn = parseDate(body?.check_in_date);
  const checkOut = parseDate(body?.check_out_date);
  const specialRequests = body?.special_requests === undefined || body?.special_requests === null
    ? null
    : String(body.special_requests).trim().slice(0, 500) || null;

  if (!Number.isInteger(roomTypeId) || roomTypeId <= 0 || !checkIn || !checkOut || checkOut <= checkIn
      || !Number.isInteger(numGuests) || numGuests < 1) {
    return apiError('VALIDATION_ERROR', 'Room type, valid dates, and guest count are required', 400);
  }

  const conn = await pool.getConnection();
  try {
    const [roomTypes] = await conn.execute<any[]>(
      'SELECT room_type_id, max_occupancy FROM room_type WHERE room_type_id = ?',
      [roomTypeId],
    );
    if (!roomTypes.length) return apiError('NOT_FOUND', 'That room type does not exist', 404);
    if (numGuests > Number(roomTypes[0].max_occupancy)) {
      return apiError(
        'VALIDATION_ERROR',
        `This room sleeps up to ${roomTypes[0].max_occupancy} guests`,
        400,
      );
    }

    await conn.query('CALL sp_create_booking(?, ?, ?, ?, ?, @booking_id, @status)', [
      Number(session!.sub),
      roomTypeId,
      checkIn,
      checkOut,
      numGuests,
    ]);
    const [rows] = await conn.query<any[]>('SELECT @booking_id AS booking_id, @status AS status');
    const result = rows[0];
    const status = String(result.status ?? '').toUpperCase();

    if (status === 'INVALID_DATES') return apiError('INVALID_DATES', 'Check-out must be after check-in', 400);
    if (status === 'INVALID_ROOM_TYPE') return apiError('NOT_FOUND', 'That room type does not exist', 404);
    if (status === 'INVALID_GUESTS') return apiError('VALIDATION_ERROR', 'That guest count is not valid for this room', 400);
    if (!VALID_OUTCOMES.includes(status)) {
      return apiError('BOOKING_FAILED', 'The booking could not be created. Please try again.', 409);
    }

    const bookingId = Number(result.booking_id);
    if (specialRequests) {
      await conn.execute('UPDATE booking SET special_requests = ? WHERE booking_id = ?', [specialRequests, bookingId]);
    }
    const [bookingRows] = await conn.execute<any[]>(
      'SELECT total_amount FROM booking WHERE booking_id = ?',
      [bookingId],
    );

    return NextResponse.json(
      { booking_id: bookingId, status, total_amount: Number(bookingRows[0]?.total_amount ?? 0) },
      { status: 201 },
    );
  } catch (error) {
    if (sqlState(error) === '45000' || errorCode(error) === 'ER_SIGNAL_EXCEPTION') {
      return apiError('BOOKING_FAILED', 'The booking conflicted with another reservation. Please try again.', 409);
    }
    return apiError('DATABASE_ERROR', 'The booking could not be completed right now', 500);
  } finally {
    conn.release();
  }
}
