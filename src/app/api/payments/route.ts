/**
 * POST /api/payments   (Guest, own booking)
 * Body: { booking_id, payment_method }
 *
 * Simulated gateway. sp_record_payment takes the amount from the booking, so a
 * client can never pay a different amount, and it refuses a second payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, positiveInt } from '@/lib/request';
import { apiError, requireRole } from '@/lib/authz';
import { retryOnError } from '@/lib/retry';

const METHODS = ['Card', 'UPI', 'NetBanking', 'Cash'];

const REFUSALS: Record<string, [string, string, number]> = {
  NOT_FOUND: ['NOT_FOUND', 'Booking not found', 404],
  NOT_PAYABLE: ['NOT_PAYABLE', 'Only a confirmed booking that has not ended can be paid', 409],
  ALREADY_PAID: ['ALREADY_PAID', 'This booking has already been paid', 409],
};

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const bookingId = positiveInt(body?.booking_id);
  const method = String(body?.payment_method ?? '');
  if (!bookingId || !METHODS.includes(method)) {
    return apiError('VALIDATION_ERROR', 'A valid booking and payment method are required', 400);
  }

  const conn = await pool.getConnection();
  try {
    const result = await retryOnError(async () => {
      await conn.query('CALL sp_record_payment(?, ?, ?, @status, @payment_id, @amount)', [
        bookingId, Number(session!.sub), method,
      ]);
      const [[row]] = await conn.query<any[]>('SELECT @status AS status, @payment_id AS payment_id, @amount AS amount');
      return { ...row, status: String(row.status) };
    });
    const status = result.status;
    if (status === 'PAID') {
      return NextResponse.json(
        { payment_id: Number(result.payment_id), amount: Number(result.amount) },
        { status: 201 },
      );
    }
    const refusal = REFUSALS[status];
    return refusal
      ? apiError(refusal[0], refusal[1], refusal[2])
      : apiError('DATABASE_ERROR', 'The payment could not be recorded right now', 500);
  } catch (error) {
    console.error('payment failed', error);
    return apiError('DATABASE_ERROR', 'The payment could not be recorded right now', 500);
  } finally {
    conn.release();
  }
}
