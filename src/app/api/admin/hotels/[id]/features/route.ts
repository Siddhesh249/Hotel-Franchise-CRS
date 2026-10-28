/**
 * PUT /api/admin/hotels/[id]/features
 *
 * Admin only. Edits the hotel_features MongoDB document for a hotel.
 * Uses findOneAndReplace (or updateOne with $set) keyed by hotel_id.
 *
 * Phase 2 — §2.1 Admin catalog management
 * See ARCHITECTURE.md §4.2 for the hotel_features document schema.
 */

// TODO: Phase 2 (2.1)

import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  void id;
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } }, { status: 501 });
}
