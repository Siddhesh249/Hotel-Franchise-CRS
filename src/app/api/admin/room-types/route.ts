import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, boundedNumber, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { isDuplicateEntry, isMissingParent, isReferenced } from '@/lib/request';
import { ensurePhysicalRooms } from '@/lib/rooms';

function input(body: Record<string, unknown>) {
  const hotelId = positiveId(body.hotel_id);
  const name = typeof body.type_name === 'string' ? body.type_name.trim() : '';
  const price = boundedNumber(body.base_price, 0.01, 10_000_000);
  const occupancy = boundedNumber(body.max_occupancy, 1, 50);
  const totalRooms = boundedNumber(body.total_rooms, 1, 10_000);
  return hotelId
    && name
    && price !== null
    && occupancy !== null
    && Number.isInteger(occupancy)
    && totalRooms !== null
    && Number.isInteger(totalRooms)
    ? { hotelId, name, price, occupancy, totalRooms }
    : null;
}

export async function GET(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const hotelParam = req.nextUrl.searchParams.get('hotel_id');
  const hotelId = hotelParam ? positiveId(hotelParam) : null;
  if (hotelParam && !hotelId) return invalid('hotel_id must be a positive integer');
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
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load room types', 500);
  }
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const data = input(await req.json().catch(() => ({})));
  if (!data) return invalid('Hotel, name, price, occupancy, and total rooms must be valid');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<any>(
      'INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES (?, ?, ?, ?, ?)',
      [data.hotelId, data.name, data.price, data.occupancy, data.totalRooms],
    );
    await conn.execute('INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES (?, 0)', [result.insertId]);
    await ensurePhysicalRooms(conn, Number(result.insertId), data.hotelId, data.totalRooms);
    await conn.commit();
    return NextResponse.json({ room_type_id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    await conn.rollback();
    if (isDuplicateEntry(error)) {
      return apiError('CONFLICT', 'This room type already exists at the hotel', 409);
    }
    if (isMissingParent(error)) return apiError('VALIDATION_ERROR', 'That hotel does not exist', 400);
    return apiError('DATABASE_ERROR', 'Unable to create the room type', 500);
  } finally {
    conn.release();
  }
}

export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const roomTypeId = positiveId(body.room_type_id);
  const data = input(body);
  if (!roomTypeId || !data) return invalid('A valid room type and all fields are required');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [currentRows] = await conn.execute<any[]>(
      `SELECT rt.hotel_id,
              (SELECT COUNT(*) FROM room r WHERE r.room_type_id = rt.room_type_id) AS room_count,
              (SELECT COUNT(*) FROM booking b WHERE b.room_type_id = rt.room_type_id) AS booking_count
         FROM room_type rt WHERE rt.room_type_id = ?`,
      [roomTypeId],
    );
    if (!currentRows.length) {
      await conn.rollback();
      return apiError('NOT_FOUND', 'Room type not found', 404);
    }
    const current = currentRows[0];
    if (Number(current.hotel_id) !== data.hotelId
        && (Number(current.room_count) > 0 || Number(current.booking_count) > 0)) {
      await conn.rollback();
      return apiError(
        'CONFLICT',
        'A room type with physical rooms or bookings cannot be moved to another hotel',
        409,
      );
    }

    const [result] = await conn.execute<any>(
      'UPDATE room_type SET hotel_id = ?, type_name = ?, base_price = ?, max_occupancy = ?, total_rooms = ? WHERE room_type_id = ?',
      [data.hotelId, data.name, data.price, data.occupancy, data.totalRooms, roomTypeId],
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return apiError('NOT_FOUND', 'Room type not found', 404);
    }
    await ensurePhysicalRooms(conn, roomTypeId, data.hotelId, data.totalRooms);
    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    if (isDuplicateEntry(error)) return apiError('CONFLICT', 'Another room type at this hotel already has that name', 409);
    if (isMissingParent(error)) return apiError('VALIDATION_ERROR', 'That hotel does not exist', 400);
    return apiError('DATABASE_ERROR', 'Unable to update the room type', 500);
  } finally {
    conn.release();
  }
}

export async function DELETE(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const roomTypeId = positiveId(req.nextUrl.searchParams.get('room_type_id'));
  if (!roomTypeId) return invalid('A valid room_type_id is required');
  try {
    const [result] = await pool.execute<any>('DELETE FROM room_type WHERE room_type_id = ?', [roomTypeId]);
    if (!result.affectedRows) return apiError('NOT_FOUND', 'Room type not found', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isReferenced(error)) {
      return apiError('CONFLICT', 'This room type has bookings. Cancel those bookings before deleting it.', 409);
    }
    return apiError('DATABASE_ERROR', 'Unable to delete the room type', 500);
  }
}
