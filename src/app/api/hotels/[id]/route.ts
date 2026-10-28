/**
 * GET /api/hotels/[id]
 *
 * Public. Returns hotel detail: SQL row + room types + hotel_features Mongo doc.
 *
 * Phase 1 — §1.3 Public site
 * See ARCHITECTURE.md §9 and §4.2.
 */

// TODO: Phase 1 (1.3)
// 1. Parse hotel_id from params
// 2. Query MariaDB: hotel row + room_type rows for that hotel
// 3. Fetch hotel_features doc from MongoDB by hotel_id
// 4. Merge and return combined object

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  void id; // TODO: Phase 1 (1.3) — use id to query DB
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
