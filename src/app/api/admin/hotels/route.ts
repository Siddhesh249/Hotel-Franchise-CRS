/**
 * GET /api/admin/hotels       — list all hotels (admin view, no Mongo merge needed)
 * POST /api/admin/hotels      — create a hotel + seed its hotel_features Mongo doc
 * PUT /api/admin/hotels       — update a hotel
 *
 * Admin only. See ARCHITECTURE.md §9 (admin CRUD routes).
 * NOTE: Deleting a hotel must also delete its hotel_features Mongo document
 * (MariaDB CASCADE does NOT propagate to MongoDB — ARCHITECTURE.md §4.3).
 *
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
