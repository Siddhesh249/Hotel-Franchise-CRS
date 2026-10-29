import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, boundedNumber, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';

function input(body: Record<string, unknown>) {
  const hotelId = positiveId(body.hotel_id);
  const name = typeof body.type_name === 'string' ? body.type_name.trim() : '';
  const price = boundedNumber(body.base_price, 0.01, 10_000_000);
  const occupancy = boundedNumber(body.max_occupancy, 1, 50);
  const totalRooms = boundedNumber(body.total_rooms, 1, 10_000);
  return hotelId && name && price !== null && occupancy !== null && totalRooms !== null ? { hotelId, name, price, occupancy, totalRooms } : null;
}

export async function GET(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = req.nextUrl.searchParams.get('hotel_id');
  const [rows] = await pool.execute<any[]>(`SELECT rt.*, h.hotel_name, COALESCE(op.overbook_percentage, 0) AS overbook_percentage
    FROM room_type rt JOIN hotel h ON h.hotel_id = rt.hotel_id
    LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id
    WHERE (? IS NULL OR rt.hotel_id = ?) ORDER BY h.hotel_name, rt.base_price`, [hotelId ? positiveId(hotelId) : null, hotelId ? positiveId(hotelId) : null]);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const data = input(await req.json().catch(() => ({})));
  if (!data) return invalid('Hotel, name, price, occupancy, and total rooms must be valid');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<any>('INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES (?, ?, ?, ?, ?)', [data.hotelId, data.name, data.price, data.occupancy, data.totalRooms]);
    await conn.execute('INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES (?, 0)', [result.insertId]);
    await conn.commit();
    return NextResponse.json({ room_type_id: Number(result.insertId) }, { status: 201 });
  } catch (error: any) {
    await conn.rollback();
    return apiError(error?.code === 'ER_DUP_ENTRY' ? 'CONFLICT' : 'DATABASE_ERROR', error?.code === 'ER_DUP_ENTRY' ? 'This room type already exists at the hotel' : 'Unable to create room type', error?.code === 'ER_DUP_ENTRY' ? 409 : 500);
  } finally { conn.release(); }
}

export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const roomTypeId = positiveId(body.room_type_id);
  const data = input(body);
  if (!roomTypeId || !data) return invalid('A valid room type and all fields are required');
  const [result] = await pool.execute<any>('UPDATE room_type SET hotel_id = ?, type_name = ?, base_price = ?, max_occupancy = ?, total_rooms = ? WHERE room_type_id = ?', [data.hotelId, data.name, data.price, data.occupancy, data.totalRooms, roomTypeId]);
  if (!result.affectedRows) return apiError('NOT_FOUND', 'Room type not found', 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const roomTypeId = positiveId(req.nextUrl.searchParams.get('room_type_id'));
  if (!roomTypeId) return invalid('A valid room_type_id is required');
  const [result] = await pool.execute<any>('DELETE FROM room_type WHERE room_type_id = ?', [roomTypeId]);
  if (!result.affectedRows) return apiError('NOT_FOUND', 'Room type not found', 404);
  return NextResponse.json({ ok: true });
}
