/**
 * POST /api/auth/register   (public)
 * Body: { first_name, last_name, email, password, phone? }
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { apiError } from '@/lib/authz';
import { isDuplicateEntry } from '@/lib/request';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const firstName = text(body?.first_name);
  const lastName = text(body?.last_name);
  const email = text(body?.email).toLowerCase();
  const phone = text(body?.phone);
  const password = String(body?.password ?? '');

  if (!firstName || !lastName || !EMAIL_RE.test(email) || password.length < 8) {
    return apiError('VALIDATION_ERROR', 'First name, last name, a valid email and a password of at least 8 characters are required', 400);
  }
  if (firstName.length > 50 || lastName.length > 50 || email.length > 100 || phone.length > 15) {
    return apiError('VALIDATION_ERROR', 'A field is too long (names 50, email 100, phone 15 characters)', 400);
  }

  try {
    // A guest must not be able to shadow a staff login: sign-in checks guests first.
    const [staff] = await pool.execute<any[]>('SELECT 1 FROM staff_account WHERE email = ?', [email]);
    if (staff.length) return apiError('EMAIL_IN_USE', 'An account already exists for this email', 409);

    const [result] = await pool.execute<any>(
      'INSERT INTO guest (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [firstName, lastName, email, phone || null, await bcrypt.hash(password, 12)],
    );
    return NextResponse.json({ guest_id: result.insertId, email }, { status: 201 });
  } catch (error) {
    if (isDuplicateEntry(error)) return apiError('EMAIL_IN_USE', 'An account already exists for this email', 409);
    console.error('register failed', error);
    return apiError('DATABASE_ERROR', 'The account could not be created right now', 500);
  }
}
