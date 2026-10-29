/**
 * POST /api/auth/register
 *
 * Public. Creates a new guest account. Hashes the password with bcrypt before
 * inserting into the guest table.
 *
 * Body: { full_name, email, password, phone?, address? }
 * Returns: { guest_id, email } on success
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { apiError } from '@/lib/authz';
import { isDuplicateEntry } from '@/lib/request';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = String(body?.full_name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const phone = String(body?.phone ?? '').trim();
  const address = String(body?.address ?? '').trim();

  if (!fullName || !EMAIL_RE.test(email) || password.length < 8) {
    return apiError(
      'VALIDATION_ERROR',
      'Name, a valid email, and a password of at least 8 characters are required',
      400,
    );
  }
  if (fullName.length > 100 || email.length > 100) {
    return apiError('VALIDATION_ERROR', 'Name and email must be 100 characters or fewer', 400);
  }
  if (phone.length > 15) return apiError('VALIDATION_ERROR', 'Phone number must be 15 characters or fewer', 400);
  if (address.length > 200) return apiError('VALIDATION_ERROR', 'Address must be 200 characters or fewer', 400);

  try {
    const [existingGuest] = await pool.execute<any[]>('SELECT guest_id FROM guest WHERE email = ? LIMIT 1', [email]);
    if (existingGuest.length) return apiError('EMAIL_IN_USE', 'An account already exists for this email', 409);

    // A guest must not be able to shadow a staff/admin login by registering the
    // same address: the credentials provider checks guests first.
    const [existingStaff] = await pool.execute<any[]>('SELECT staff_id FROM staff_account WHERE email = ? LIMIT 1', [email]);
    if (existingStaff.length) return apiError('EMAIL_IN_USE', 'This email belongs to a staff account', 409);

    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '-';
    const [result] = await pool.execute<any>(
      'INSERT INTO guest (first_name, last_name, email, phone, address, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, phone || '-', address || null, await bcrypt.hash(password, 12)],
    );
    return NextResponse.json({ guest_id: result.insertId, email }, { status: 201 });
  } catch (error) {
    if (isDuplicateEntry(error)) return apiError('EMAIL_IN_USE', 'An account already exists for this email', 409);
    return apiError('DATABASE_ERROR', 'The account could not be created right now', 500);
  }
}
