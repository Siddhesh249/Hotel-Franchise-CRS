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

import { NextRequest, NextResponse } from 'next/server';
import { adminSession, boundedNumber, invalid } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { clearSyntheticData, configure, defaultArchetypes, snapshot, spawnOne, start, stop, validateArchetypes } from '@/lib/simulation';

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  return NextResponse.json(snapshot());
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'start') return NextResponse.json(start());
    if (body.action === 'stop') return NextResponse.json(stop());
    if (body.action === 'set-archetypes') {
      const archetypes = validateArchetypes(body.archetypes);
      if (!archetypes) return invalid('Provide 1–20 valid simulation archetypes');
      return NextResponse.json(configure(archetypes, snapshot().bookings_per_virtual_hour));
    }
    if (body.action === 'set-spawn-rate') {
      const rate = boundedNumber(body.bookings_per_virtual_hour, 0, 1000);
      if (rate === null) return invalid('Spawn rate must be between 0 and 1000 bookings per virtual hour');
      return NextResponse.json(configure(snapshot().archetypes, rate));
    }
    if (body.action === 'spawn-one') return NextResponse.json(await spawnOne(body.archetype_name), { status: 201 });
    if (body.action === 'clear-synthetic') return NextResponse.json({ deleted_guests: await clearSyntheticData() });
    if (body.action === 'restore-defaults') return NextResponse.json(configure(defaultArchetypes, 2));
    return invalid('Unknown simulation action');
  } catch (error) { return apiError('SIMULATION_ERROR', error instanceof Error ? error.message : 'Simulation action failed', 409); }
}
