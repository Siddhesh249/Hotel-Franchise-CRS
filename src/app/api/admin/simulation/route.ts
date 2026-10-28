/**
 * GET /api/admin/simulation   — get simulation engine status + archetype config
 * POST /api/admin/simulation  — start / stop / configure / spawn-one / clear
 *
 * Admin only. Controls the singleton in-process simulation engine.
 * (ARCHITECTURE.md §7)
 *
 * POST body variants:
 *   { action: 'start' }
 *   { action: 'stop' }
 *   { action: 'set-archetypes', archetypes: ClientArchetype[] }
 *   { action: 'set-spawn-rate', bookings_per_virtual_hour: number }
 *   { action: 'spawn-one', archetype_name: string }
 *   { action: 'clear-synthetic' }  -- deletes all rows where is_synthetic = TRUE
 *
 * Phase 2 — §2.4 Simulation engine
 */

// TODO: Phase 2 (2.4)

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
