/** GET/PUT /api/admin/hotels/[id]/features: the hotel_features MongoDB document. */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { featuresCollection } from '@/lib/mongodb';
import { adminSession, invalid } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { positiveInt } from '@/lib/request';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const EMPTY = { amenities: { general: [], wellness: [], policies: {} }, room_type_features: {} };

async function hotelExists(hotelId: number) {
  const [rows] = await pool.execute<any[]>('SELECT 1 FROM hotel WHERE hotel_id = ?', [hotelId]);
  return rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveInt((await params).id);
  if (!hotelId) return invalid('A valid hotel id is required');

  try {
    if (!(await hotelExists(hotelId))) return apiError('NOT_FOUND', 'Hotel not found', 404);
    const doc = await (await featuresCollection()).findOne({ hotel_id: hotelId }, { projection: { _id: 0 } });
    return NextResponse.json(doc ?? { hotel_id: hotelId, ...EMPTY });
  } catch (error) {
    console.error('load features failed', error);
    return apiError('MONGODB_ERROR', 'Unable to load hotel features. Is MongoDB running?', 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveInt((await params).id);
  const body = await req.json().catch(() => null);
  if (!hotelId || !isRecord(body) || !isRecord(body.amenities)
      || (body.room_type_features !== undefined && !isRecord(body.room_type_features))) {
    return invalid('Amenities must be an object; room type features must be an object when provided');
  }

  try {
    if (!(await hotelExists(hotelId))) return apiError('NOT_FOUND', 'Hotel not found', 404);
    await (await featuresCollection()).updateOne(
      { hotel_id: hotelId },
      {
        $set: { amenities: body.amenities, room_type_features: body.room_type_features ?? {} },
        $setOnInsert: { hotel_id: hotelId },
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('save features failed', error);
    return apiError('MONGODB_ERROR', 'Unable to save hotel features. Is MongoDB running?', 500);
  }
}
