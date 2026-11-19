import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { featuresCollection } from '@/lib/mongodb';
import { adminSession, invalid, serverError } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { boundedNumber, isDuplicateEntry, isMissingParent, isReferenced, positiveInt } from '@/lib/request';

function hotelInput(body: Record<string, unknown>) {
  const franchiseId = positiveInt(body.franchise_id);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name = text(body.hotel_name);
  const city = text(body.city);
  const rating = boundedNumber(body.star_rating, 1, 5);
  if (!franchiseId || !name || !city || rating === null || !Number.isInteger(rating)) return null;
  return {
    franchiseId, name, city, rating,
    state: text(body.state) || null,
    address: text(body.address) || null,
    contact: text(body.contact_number).slice(0, 15) || null,
  };
}

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const [hotels] = await pool.query<any[]>(
      `SELECT h.*, f.franchise_name,
              COUNT(rt.room_type_id) AS room_type_count,
              COALESCE(SUM(rt.total_rooms), 0) AS physical_rooms
         FROM hotel h
         JOIN franchise f ON f.franchise_id = h.franchise_id
         LEFT JOIN room_type rt ON rt.hotel_id = h.hotel_id
        GROUP BY h.hotel_id
        ORDER BY h.city, h.hotel_name`,
    );
    const [franchises] = await pool.query<any[]>('SELECT franchise_id, franchise_name FROM franchise ORDER BY franchise_name');
    return NextResponse.json({ hotels, franchises });
  } catch (error) {
    return serverError('DATABASE_ERROR', 'Unable to load the hotel catalog', error);
  }
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const data = hotelInput(await req.json().catch(() => ({})));
  if (!data) return invalid('Franchise, hotel name and city are required; star rating must be a whole number from 1 to 5');

  try {
    const [result] = await pool.execute<any>(
      'INSERT INTO hotel (franchise_id, hotel_name, city, state, address, star_rating, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.franchiseId, data.name, data.city, data.state, data.address, data.rating, data.contact],
    );
    const hotelId = Number(result.insertId);
    try {
      await (await featuresCollection()).updateOne(
        { hotel_id: hotelId },
        { $setOnInsert: { hotel_id: hotelId, amenities: { general: [], wellness: [], policies: {} }, room_type_features: {} } },
        { upsert: true },
      );
    } catch (error) {
      console.error('Unable to create the Mongo feature document; the hotel is still valid', error);
    }
    return NextResponse.json({ hotel_id: hotelId }, { status: 201 });
  } catch (error) {
    if (isDuplicateEntry(error)) return apiError('CONFLICT', 'A hotel with that name already exists in this city', 409);
    if (isMissingParent(error)) return invalid('That franchise does not exist');
    return serverError('DATABASE_ERROR', 'Unable to create the hotel', error);
  }
}

export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const hotelId = positiveInt(body.hotel_id);
  const data = hotelInput(body);
  if (!hotelId || !data) return invalid('A valid hotel and all required fields are needed');
  try {
    const [result] = await pool.execute<any>(
      'UPDATE hotel SET franchise_id = ?, hotel_name = ?, city = ?, state = ?, address = ?, star_rating = ?, contact_number = ? WHERE hotel_id = ?',
      [data.franchiseId, data.name, data.city, data.state, data.address, data.rating, data.contact, hotelId],
    );
    if (!result.affectedRows) return apiError('NOT_FOUND', 'Hotel not found', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDuplicateEntry(error)) return apiError('CONFLICT', 'Another hotel already uses that name in this city', 409);
    if (isMissingParent(error)) return invalid('That franchise does not exist');
    return serverError('DATABASE_ERROR', 'Unable to update the hotel', error);
  }
}

export async function DELETE(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveInt(req.nextUrl.searchParams.get('hotel_id'));
  if (!hotelId) return invalid('A valid hotel_id is required');
  try {
    const [result] = await pool.execute<any>('DELETE FROM hotel WHERE hotel_id = ?', [hotelId]);
    if (!result.affectedRows) return apiError('NOT_FOUND', 'Hotel not found', 404);
    try {
      await (await featuresCollection()).deleteOne({ hotel_id: hotelId });
    } catch (error) {
      console.error('Unable to delete the Mongo feature document', error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isReferenced(error)) {
      return apiError('CONFLICT', 'This hotel still has bookings, so it cannot be deleted.', 409);
    }
    return serverError('DATABASE_ERROR', 'Unable to delete the hotel', error);
  }
}
