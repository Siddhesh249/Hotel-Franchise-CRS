/**
 * PUT /api/admin/hotels/[id]/features
 *
 * Admin only. Edits the hotel_features MongoDB document for a hotel.
 * Uses findOneAndReplace (or updateOne with $set) keyed by hotel_id.
 *
 * Phase 2 — §2.1 Admin catalog management
 * See ARCHITECTURE.md §4.2 for the hotel_features document schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import clientPromise from '@/lib/mongodb';
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
  const [hotels] = await pool.execute<any[]>('SELECT hotel_id FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);
  try {
    const client = await clientPromise;
    const features = await client.db(process.env.MONGODB_DB ?? 'hotel_crs').collection('hotel_features').findOne({ hotel_id: hotelId }, { projection: { _id: 0 } });
    return NextResponse.json(features ?? { hotel_id: hotelId, amenities: { general: [], wellness: [], policies: {} }, room_type_features: {} });
  } catch { return apiError('MONGODB_ERROR', 'Unable to load hotel features', 500); }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveId((await params).id);
  const body = await req.json().catch(() => null);
  if (!hotelId || !isRecord(body) || !isRecord(body.amenities) || (body.room_type_features !== undefined && !isRecord(body.room_type_features))) return invalid('Amenities must be an object; room type features must be an object when provided');
  const [hotels] = await pool.execute<any[]>('SELECT hotel_id FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!hotels.length) return apiError('NOT_FOUND', 'Hotel not found', 404);
  try {
    const client = await clientPromise;
    await client.db(process.env.MONGODB_DB ?? 'hotel_crs').collection('hotel_features').updateOne({ hotel_id: hotelId }, { $set: { amenities: body.amenities, room_type_features: body.room_type_features ?? {} }, $setOnInsert: { hotel_id: hotelId } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch { return apiError('MONGODB_ERROR', 'Unable to save hotel features', 500); }
}
