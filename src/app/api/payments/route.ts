/**
 * POST /api/payments
 *
 * Guest only (own booking). Inserts a simulated payment row.
 *
 * The amount is ALWAYS taken from booking.total_amount on the server — a client
 * cannot pay ₹1 for a ₹7,000 stay. Payment status is 'Completed' because this
 * is a simulated gateway (ARCHITECTURE.md §8).
 *
 * Body: { booking_id, payment_method }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, parsePositiveInt } from '@/lib/request';
import { apiError, requireOwnership, requireRole } from '@/lib/authz';

const METHODS = ['Card', 'Cash', 'UPI', 'NetBanking'];

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const bookingId = parsePositiveInt(body?.booking_id);
  const method = String(body?.payment_method ?? '');
  if (!bookingId || !METHODS.includes(method)) {
    return apiError('VALIDATION_ERROR', 'A valid booking and payment method are required', 400);
  }

  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT b.guest_id, b.booking_status, b.total_amount,
              (SELECT COUNT(*) FROM payment p WHERE p.booking_id = b.booking_id AND p.payment_status = 'Completed') AS paid_count
         FROM booking b WHERE b.booking_id = ?`,
      [bookingId],
    );
    if (!rows.length) return apiError('NOT_FOUND', 'Booking not found', 404);

    const booking = rows[0];
    const owned = requireOwnership(session, Number(booking.guest_id));
    if (owned) return owned;

    if (!['Confirmed', 'CheckedIn'].includes(String(booking.booking_status))) {
      return apiError('NOT_PAYABLE', 'Only a confirmed booking can be paid', 409);
    }
    if (Number(booking.paid_count) > 0) {
      return apiError('ALREADY_PAID', 'This booking has already been paid', 409);
    }

    const amount = Number(booking.total_amount ?? 0);
    const [result] = await pool.execute<any>(
      "INSERT INTO payment (booking_id, amount, payment_method, payment_status) VALUES (?, ?, ?, 'Completed')",
      [bookingId, amount, method],
    );
    return NextResponse.json(
      { payment_id: result.insertId, payment_status: 'Completed', amount },
      { status: 201 },
    );
  } catch {
    return apiError('DATABASE_ERROR', 'The payment could not be recorded right now', 500);
  }
}
