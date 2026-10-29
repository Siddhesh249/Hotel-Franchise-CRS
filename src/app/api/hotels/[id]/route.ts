/**
 * GET /api/hotels/[id]
 *
 * Public. Returns hotel detail: SQL row + room types + hotel_features Mongo doc.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getMongoClient, mongoDbName } from '@/lib/mongodb';
import { apiError } from '@/lib/authz';
import { parsePositiveInt } from '@/lib/request';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const hotelId = parsePositiveInt((await params).id);
  if (!hotelId) return apiError('VALIDATION_ERROR', 'A valid hotel id is required', 400);

  try {
    const [hotels] = await pool.execute<any[]>('SELECT * FROM hotel WHERE hotel_id = ?', [hotelId]);
    if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);

    const [rooms] = await pool.execute<any[]>(
      'SELECT * FROM room_type WHERE hotel_id = ? ORDER BY base_price',
      [hotelId],
    );

    let features = null;
    try {
      const client = await getMongoClient();
      const doc = await client.db(mongoDbName()).collection('hotel_features').findOne({ hotel_id: hotelId });
      if (doc) {
        const rest = { ...(doc as Record<string, unknown>) };
        delete rest._id;
        features = rest;
      }
    } catch {
      /* Mongo is optional. */
    }

    return NextResponse.json({ ...hotels[0], room_types: rooms, features });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load this hotel right now', 500);
  }
}
