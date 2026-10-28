/**
 * GET/POST/PUT /api/admin/room-types
 *
 * Admin only. CRUD for room_type rows.
 * Phase 2 — §2.1 Admin catalog management
 */

// TODO: Phase 2 (2.1)

import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
