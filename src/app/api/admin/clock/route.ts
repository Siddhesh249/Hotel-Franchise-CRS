/**
 * GET /api/admin/clock   — read current sim_clock row
 * PUT /api/admin/clock   — pause / resume / fast-forward / change tick rate
 *
 * Admin only. Controls the virtual clock (ARCHITECTURE.md §5).
 *
 * PUT body variants:
 *   { action: 'pause' }
 *   { action: 'resume' }
 *   { action: 'fast-forward', days: number }
 *   { action: 'set-rate', tick_minutes: number }
 *
 * Pause/resume toggle the MariaDB event via:
 *   ALTER EVENT evt_clock_tick DISABLE / ENABLE
 * and update sim_clock.is_running accordingly.
 *
 * Phase 2 — §2.3 Virtual clock admin UI
 */

// TODO: Phase 2 (2.3)

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}

export async function PUT(_req: NextRequest) {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
