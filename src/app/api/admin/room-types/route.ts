import { NextRequest, NextResponse } from 'next/server';
import type { PoolConnection } from 'mysql2/promise';
import pool from '@/lib/db';
import { adminSession, invalid, serverError } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { boundedNumber, isDuplicateEntry, isMissingParent, isReferenced, positiveInt } from '@/lib/request';
import { RoomSyncError, syncPhysicalRooms } from '@/lib/rooms';

function input(body: Record<string, unknown>) {
  const name = typeof body.type_name === 'string' ? body.type_name.trim() : '';
  const price = boundedNumber(body.base_price, 0.01, 10_000_000);
  const occupancy = boundedNumber(body.max_occupancy, 1, 20);
  const totalRooms = boundedNumber(body.total_rooms, 1, 500);
  if (!name || price === null || occupancy === null || totalRooms === null
      || !Number.isInteger(occupancy) || !Number.isInteger(totalRooms)) return null;
  return { name: name.slice(0, 50), price, occupancy, totalRooms };
}

export async function GET(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelId = positiveInt(req.nextUrl.searchParams.get('hotel_id'));
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT rt.*, h.hotel_name,
              COALESCE(op.overbook_percentage, 0) AS overbook_percentage,
              (SELECT COUNT(*) FROM room r WHERE r.room_type_id = rt.room_type_id) AS physical_room_count
         FROM room_type rt
         JOIN hotel h ON h.hotel_id = rt.hotel_id
         LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id
        WHERE (? IS NULL OR rt.hotel_id = ?)
        ORDER BY h.hotel_name, rt.base_price`,
      [hotelId, hotelId],
    );
    return NextResponse.json(rows);
  } catch (error) {
    return serverError('DATABASE_ERROR', 'Unable to load room types', error);
  }
}

async function failure(error: unknown, conn: PoolConnection, action: string) {
  await conn.rollback().catch(() => undefined);
  if (error instanceof RoomSyncError) return apiError('CONFLICT', error.message, 409);
  if (isDuplicateEntry(error)) return apiError('CONFLICT', 'That hotel already has a room type with this name or room numbers clash', 409);
  if (isMissingParent(error)) return invalid('That hotel does not exist');
  return serverError('DATABASE_ERROR', `Unable to ${action} the room type`, error);
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const hotelId = positiveInt(body.hotel_id);
  const data = input(body);
  if (!hotelId || !data) return invalid('Hotel, name, price, occupancy and total rooms must be valid');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<any>(
      'INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES (?, ?, ?, ?, ?)',
      [hotelId, data.name, data.price, data.occupancy, data.totalRooms],
    );
    const roomTypeId = Number(result.insertId);
    await conn.execute('INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES (?, 0)', [roomTypeId]);
    await syncPhysicalRooms(conn, roomTypeId, hotelId, data.totalRooms);
    await conn.commit();
    return NextResponse.json({ room_type_id: roomTypeId }, { status: 201 });
  } catch (error) {
    return failure(error, conn, 'create');
  } finally {
    conn.release();
  }
}

/** Updates price, occupancy, name and room count. The hotel of a room type cannot change. */
export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const roomTypeId = positiveInt(body.room_type_id);
  const data = input(body);
  if (!roomTypeId || !data) return invalid('A valid room type and all fields are required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [current] = await conn.execute<any[]>(
      `SELECT rt.hotel_id, COALESCE(op.overbook_percentage, 0) AS pct,
              (SELECT COALESCE(MAX(i.booked_count), 0) FROM room_type_inventory i
                WHERE i.room_type_id = rt.room_type_id AND i.stay_date >= CURRENT_DATE) AS peak_booked
         FROM room_type rt
         LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id
        WHERE rt.room_type_id = ? FOR UPDATE`,
      [roomTypeId],
    );
    if (!current.length) {
      await conn.rollback();
      return apiError('NOT_FOUND', 'Room type not found', 404);
    }
    const ceiling = data.totalRooms + Math.floor((data.totalRooms * Number(current[0].pct)) / 100);
    if (ceiling < Number(current[0].peak_booked)) {
      await conn.rollback();
      return apiError('CONFLICT', `Upcoming nights already have ${current[0].peak_booked} bookings; this room count is too low`, 409);
    }

    await conn.execute(
      'UPDATE room_type SET type_name = ?, base_price = ?, max_occupancy = ?, total_rooms = ? WHERE room_type_id = ?',
      [data.name, data.price, data.occupancy, data.totalRooms, roomTypeId],
    );
    await syncPhysicalRooms(conn, roomTypeId, Number(current[0].hotel_id), data.totalRooms);
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, conn, 'update');
  } finally {
    conn.release();
  }
}

export async function DELETE(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const roomTypeId = positiveInt(req.nextUrl.searchParams.get('room_type_id'));
  if (!roomTypeId) return invalid('A valid room_type_id is required');
  try {
    const [result] = await pool.execute<any>('DELETE FROM room_type WHERE room_type_id = ?', [roomTypeId]);
    if (!result.affectedRows) return apiError('NOT_FOUND', 'Room type not found', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isReferenced(error)) return apiError('CONFLICT', 'This room type has bookings, so it cannot be deleted.', 409);
    return serverError('DATABASE_ERROR', 'Unable to delete the room type', error);
  }
}
