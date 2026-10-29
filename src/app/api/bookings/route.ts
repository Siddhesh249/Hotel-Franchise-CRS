/**
 * POST /api/bookings
 *
 * Guest only. Calls sp_create_booking() and returns the booking outcome.
 *
 * Body: { room_type_id, check_in_date, check_out_date, num_guests, special_requests? }
 * Returns: { booking_id, status: 'CONFIRMED' | 'CONFIRMED_OVERBOOKED' | 'WAITLISTED' }
 *
 * The status OUT parameter from sp_create_booking is surfaced directly to
 * the frontend so all three outcomes are shown distinctly (ARCHITECTURE.md §11).
 *
 * Phase 1 — §1.4 Guest booking flow
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parseDate, errorCode } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const roomTypeId = Number(body?.room_type_id);
  const numGuests = Number(body?.num_guests ?? 1);
  const checkIn = parseDate(body?.check_in_date);
  const checkOut = parseDate(body?.check_out_date);
  if (!Number.isInteger(roomTypeId) || !checkIn || !checkOut || checkOut <= checkIn || !Number.isInteger(numGuests) || numGuests < 1) return apiError('VALIDATION_ERROR', 'Room type, valid dates, and guest count are required', 400);
  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_create_booking(?, ?, ?, ?, ?, @booking_id, @status)', [Number(session!.sub), roomTypeId, checkIn, checkOut, numGuests]);
    const [rows] = await conn.query<any[]>('SELECT @booking_id AS booking_id, @status AS status');
    const result = rows[0];
    const status = String(result.status ?? '').toUpperCase();
    if (!['CONFIRMED', 'CONFIRMED_OVERBOOKED', 'WAITLISTED'].includes(status)) return apiError('BOOKING_FAILED', status || 'Booking could not be created', 409);
    return NextResponse.json({ booking_id: Number(result.booking_id), status }, { status: 201 });
  } catch (error) {
    return apiError(errorCode(error) === 'ER_SIGNAL_EXCEPTION' ? 'BOOKING_FAILED' : 'DATABASE_ERROR', 'The booking could not be completed', 409);
  } finally { conn.release(); }
}
