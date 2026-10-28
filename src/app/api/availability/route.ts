/**
 * GET /api/availability
 *
 * Public. Wraps fn_available_rooms(room_type_id, stay_date) for a city/date search.
 *
 * Query params:
 *   city        - filter hotels by city
 *   check_in    - DATE (YYYY-MM-DD)
 *   check_out   - DATE (YYYY-MM-DD)
 *
 * Phase 1 — §1.4 Guest booking flow
 * See ARCHITECTURE.md §9 and DDL fn_available_rooms().
 */

// TODO: Phase 1 (1.4)
// 1. Validate query params (city, check_in, check_out)
// 2. Get hotel_ids for the city from MariaDB
// 3. For each room_type in those hotels, call fn_available_rooms() for every
//    night in the stay range and return per-room-type availability

import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: Phase 1 (1.4)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
