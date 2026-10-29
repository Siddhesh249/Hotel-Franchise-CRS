/**
 * GET /api/hotels/[id]
 *
 * Public. Returns hotel detail: SQL row + room types + hotel_features Mongo doc.
 *
 * Phase 1 — §1.3 Public site
 * See ARCHITECTURE.md §9 and §4.2.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import clientPromise from '@/lib/mongodb';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hotelId = Number(id);
  if (!Number.isInteger(hotelId)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid hotel id' } }, { status: 400 });
  const [hotels] = await pool.execute<any[]>('SELECT * FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!hotels.length) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Hotel not found' } }, { status: 404 });
  const [rooms] = await pool.execute<any[]>('SELECT * FROM room_type WHERE hotel_id = ? ORDER BY base_price', [hotelId]);
  let features = null;
  try { const client = await clientPromise; features = await client.db(process.env.MONGODB_DB ?? 'hotel_crs').collection('hotel_features').findOne({ hotel_id: hotelId }); } catch { /* optional */ }
  return NextResponse.json({ ...hotels[0], room_types: rooms, features });
}
