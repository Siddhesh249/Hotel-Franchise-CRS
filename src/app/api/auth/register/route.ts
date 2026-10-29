/**
 * POST /api/auth/register
 *
 * Public. Creates a new guest account. Hashes the password with bcrypt
 * before inserting into the guest table.
 *
 * Body: { full_name, email, password, phone?, address? }
 * Returns: { guest_id, email } on success
 *
 * Phase 1 — §1.2 Auth & route protection
 * See ARCHITECTURE.md §6 and DDL guest table (password_hash column added in Phase 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { apiError } from '@/lib/authz';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = String(body?.full_name ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!fullName || !email || password.length < 8) return apiError('VALIDATION_ERROR', 'Name, email, and a password of at least 8 characters are required', 400);
  const [existing] = await pool.execute<any[]>('SELECT guest_id FROM guest WHERE email = ?', [email]);
  if (existing.length) return apiError('EMAIL_IN_USE', 'An account already exists for this email', 409);
  const [result] = await pool.execute<any>('INSERT INTO guest (first_name, last_name, email, phone, address, password_hash) VALUES (?, ?, ?, ?, ?, ?)', [fullName.split(' ')[0], fullName.split(' ').slice(1).join(' ') || '-', email, body?.phone ?? '-', body?.address ?? null, await bcrypt.hash(password, 12)]);
  return NextResponse.json({ guest_id: result.insertId, email }, { status: 201 });
}
