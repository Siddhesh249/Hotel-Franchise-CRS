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

// TODO: Phase 1 (1.2)
// 1. Validate body (full_name, email, password required)
// 2. Check email not already in guest table
// 3. bcrypt.hash(password, 12)
// 4. INSERT INTO guest (full_name, email, phone, address, password_hash)
// 5. Return { guest_id, email } with 201

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: Phase 1 (1.2)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
