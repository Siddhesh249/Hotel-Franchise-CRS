/**
 * GET/PUT /api/admin/hotels/[id]/features
 *
 * Admin only. Reads and edits the hotel_features MongoDB document.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getMongoClient, mongoDbName } from '@/lib/mongodb';
import { adminSession, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveId((await params).id);
  if (!hotelId) return invalid('A valid hotel id is required');

  try {
    const [hotels] = await pool.execute<any[]>('SELECT hotel_id FROM hotel WHERE hotel_id = ?', [hotelId]);
    if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);

    const client = await getMongoClient();
    const features = await client
      .db(mongoDbName())
      .collection('hotel_features')
      .findOne({ hotel_id: hotelId }, { projection: { _id: 0 } });
    return NextResponse.json(
      features ?? { hotel_id: hotelId, amenities: { general: [], wellness: [], policies: {} }, room_type_features: {} },
    );
  } catch {
    return apiError('MONGODB_ERROR', 'Unable to load hotel features. Is MongoDB running?', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveId((await params).id);
  const body = await req.json().catch(() => null);
  if (
    !hotelId
    || !isRecord(body)
    || !isRecord(body.amenities)
    || (body.room_type_features !== undefined && !isRecord(body.room_type_features))
  ) {
    return invalid('Amenities must be an object; room type features must be an object when provided');
  }

  try {
    const [hotels] = await pool.execute<any[]>('SELECT hotel_id FROM hotel WHERE hotel_id = ?', [hotelId]);
    if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);

    const client = await getMongoClient();
    await client
      .db(mongoDbName())
      .collection('hotel_features')
      .updateOne(
        { hotel_id: hotelId },
        {
          $set: {
            amenities: body.amenities,
            room_type_features: body.room_type_features ?? {},
          },
          $setOnInsert: { hotel_id: hotelId },
        },
        { upsert: true },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return apiError('MONGODB_ERROR', 'Unable to save hotel features. Is MongoDB running?', 500);
  }
}
