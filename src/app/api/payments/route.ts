/**
 * POST /api/payments
 *
 * Guest only (own booking). Inserts a simulated payment row.
 * No real payment gateway — see ARCHITECTURE.md §8.
 *
 * Body: { booking_id, amount, payment_method }
 * payment_status is set to 'Completed' unconditionally (simulated).
 *
 * Phase 1 — §1.4 Guest booking flow
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/request';
import { apiError, requireOwnership, requireRole } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const session = await currentUser();
  const denied = requireRole(session, ['Guest']);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const bookingId = Number(body?.booking_id);
  const amount = Number(body?.amount);
  const method = String(body?.payment_method ?? '');
  if (!Number.isInteger(bookingId) || !Number.isFinite(amount) || amount < 0 || !['Card', 'Cash', 'UPI', 'NetBanking'].includes(method)) return apiError('VALIDATION_ERROR', 'Valid booking, amount, and payment method are required', 400);
  const [rows] = await pool.execute<any[]>('SELECT guest_id FROM booking WHERE booking_id = ?', [bookingId]);
  if (!rows.length) return apiError('NOT_FOUND', 'Booking not found', 404);
  const owned = requireOwnership(session, rows[0].guest_id);
  if (owned) return owned;
  const [result] = await pool.execute<any>('INSERT INTO payment (booking_id, amount, payment_method, payment_status) VALUES (?, ?, ?, \'Completed\')', [bookingId, amount, method]);
  return NextResponse.json({ payment_id: result.insertId, payment_status: 'Completed' }, { status: 201 });
}
