/**
 * GET /api/admin/reports/overbooked
 *
 * Admin only. Returns currently-overbooked confirmed bookings.
 * The query is already present in hotel_crs_dml.sql.
 *
 * Phase 2 — §2.2 Reporting
 */

// TODO: Phase 2 (2.2)
// Run the overbooked query from hotel_crs_dml.sql

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
