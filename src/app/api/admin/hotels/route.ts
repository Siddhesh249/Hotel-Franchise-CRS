import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import clientPromise from '@/lib/mongodb';
import { adminSession, boundedNumber, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';

const dbName = () => process.env.MONGODB_DB ?? 'hotel_crs';

function hotelInput(body: Record<string, unknown>) {
  const franchiseId = positiveId(body.franchise_id);
  const name = typeof body.hotel_name === 'string' ? body.hotel_name.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const rating = body.star_rating === undefined || body.star_rating === '' ? null : boundedNumber(body.star_rating, 1, 7);
  if (!franchiseId || !name || !city || (body.star_rating !== undefined && body.star_rating !== '' && rating === null)) return null;
  return {
    franchiseId, name, city, rating,
    state: typeof body.state === 'string' ? body.state.trim() || null : null,
    address: typeof body.address === 'string' ? body.address.trim() || null : null,
    contact: typeof body.contact_number === 'string' ? body.contact_number.trim() || null : null,
  };
}

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  const [hotels] = await pool.query<any[]>(`SELECT h.*, f.franchise_name,
    COUNT(DISTINCT rt.room_type_id) AS room_type_count
    FROM hotel h JOIN franchise f ON f.franchise_id = h.franchise_id
    LEFT JOIN room_type rt ON rt.hotel_id = h.hotel_id
    GROUP BY h.hotel_id ORDER BY h.city, h.hotel_name`);
  const [franchises] = await pool.query<any[]>('SELECT franchise_id, franchise_name FROM franchise ORDER BY franchise_name');
  return NextResponse.json({ hotels, franchises });
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const data = hotelInput(await req.json().catch(() => ({})));
  if (!data) return invalid('Franchise, hotel name, city, and a 1–7 star rating are required');
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute<any>('INSERT INTO hotel (franchise_id, hotel_name, city, state, address, star_rating, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?)', [data.franchiseId, data.name, data.city, data.state, data.address, data.rating, data.contact]);
    const hotelId = Number(result.insertId);
    try {
      const mongo = await clientPromise;
      await mongo.db(dbName()).collection('hotel_features').updateOne({ hotel_id: hotelId }, { $setOnInsert: { hotel_id: hotelId, amenities: { general: [], wellness: [], policies: {} }, room_type_features: {} } }, { upsert: true });
    } catch (error) {
      await conn.execute('DELETE FROM hotel WHERE hotel_id = ?', [hotelId]);
      throw error;
    }
    return NextResponse.json({ hotel_id: hotelId }, { status: 201 });
  } catch (error: any) {
    return apiError(error?.code === 'ER_DUP_ENTRY' ? 'CONFLICT' : 'DATABASE_ERROR', error?.code === 'ER_DUP_ENTRY' ? 'A hotel with that name already exists in this city' : 'Unable to create hotel', error?.code === 'ER_DUP_ENTRY' ? 409 : 500);
  } finally { conn.release(); }
}

export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const hotelId = positiveId(body.hotel_id);
  const data = hotelInput(body);
  if (!hotelId || !data) return invalid('A valid hotel and all required hotel fields are needed');
  const [result] = await pool.execute<any>('UPDATE hotel SET franchise_id = ?, hotel_name = ?, city = ?, state = ?, address = ?, star_rating = ?, contact_number = ? WHERE hotel_id = ?', [data.franchiseId, data.name, data.city, data.state, data.address, data.rating, data.contact, hotelId]);
  if (!result.affectedRows) return apiError('NOT_FOUND', 'Hotel not found', 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveId(req.nextUrl.searchParams.get('hotel_id'));
  if (!hotelId) return invalid('A valid hotel_id is required');
  const [result] = await pool.execute<any>('DELETE FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!result.affectedRows) return apiError('NOT_FOUND', 'Hotel not found', 404);
  try { const mongo = await clientPromise; await mongo.db(dbName()).collection('hotel_features').deleteOne({ hotel_id: hotelId }); } catch { /* SQL deletion is authoritative; an orphan document is inert. */ }
  return NextResponse.json({ ok: true });
}
