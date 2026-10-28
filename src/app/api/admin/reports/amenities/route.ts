/**
 * GET /api/admin/reports/amenities
 *
 * Admin only. MongoDB aggregation: amenity counts grouped by city.
 * Uses $unwind on amenities.wellness + $group — the required NoSQL
 * advanced-feature deliverable (ARCHITECTURE.md §4.2).
 *
 * Phase 2 — §2.2 Reporting
 */

// TODO: Phase 2 (2.2)
// db.hotel_features.aggregate([
//   { $lookup: { from: 'hotels_sql_mirror', ... } },  // or join at app layer
//   { $unwind: '$amenities.wellness' },
//   { $group: { _id: { city: '$city', amenity: '$amenities.wellness' }, count: { $sum: 1 } } }
// ])

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
