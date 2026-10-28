/**
 * GET /api/hotels
 *
 * Public. Lists all hotels, merging the SQL hotel/room_type rows with a
 * summary of the hotel_features Mongo document (amenities).
 *
 * Phase 1 — §1.3 Public site
 * See ARCHITECTURE.md §9 (API route map) and §4.3 (cross-db consistency).
 */

// TODO: Phase 1 (1.3)
// 1. Query MariaDB: SELECT * FROM hotel JOIN franchise ...
// 2. For each hotel, fetch its hotel_features doc from MongoDB by hotel_id
// 3. Merge and return HotelListItem[]

import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Phase 1 (1.3)
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } }, { status: 501 });
}
