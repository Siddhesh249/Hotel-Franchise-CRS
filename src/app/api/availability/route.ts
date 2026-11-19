/**
 * GET /api/availability?check_in=&check_out=[&city=&hotel_id=&guests=&room_type_id=]
 *
 * Public. Rooms left per room type across the whole stay (the minimum over its
 * nights, via fn_available_rooms).
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { apiError } from '@/lib/authz';
import { positiveInt } from '@/lib/request';
import { stayDates, validStay, withAvailability } from '@/lib/availability';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const stay = validStay(params.get('check_in'), params.get('check_out'));
  if (!stay) {
    return apiError('VALIDATION_ERROR', 'Valid future check-in and check-out dates are required (1-60 nights)', 400);
  }

  const optional = (name: string) => {
    const raw = params.get(name);
    return raw ? { raw, value: positiveInt(raw) } : null;
  };
  const hotelId = optional('hotel_id');
  const guests = optional('guests');
  const roomTypeId = optional('room_type_id');
  for (const [name, item] of [['hotel_id', hotelId], ['guests', guests], ['room_type_id', roomTypeId]] as const) {
    if (item && !item.value) return apiError('VALIDATION_ERROR', `${name} must be a positive integer`, 400);
  }
  const city = params.get('city')?.trim() || null;

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT h.hotel_id, h.hotel_name, h.city, h.state,
              rt.room_type_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms
         FROM hotel h
         JOIN room_type rt ON rt.hotel_id = h.hotel_id
        WHERE (? IS NULL OR h.city = ?)
          AND (? IS NULL OR h.hotel_id = ?)
          AND (? IS NULL OR rt.max_occupancy >= ?)
          AND (? IS NULL OR rt.room_type_id = ?)
        ORDER BY h.hotel_name, rt.base_price`,
      [city, city, hotelId?.value ?? null, hotelId?.value ?? null, guests?.value ?? null, guests?.value ?? null,
        roomTypeId?.value ?? null, roomTypeId?.value ?? null],
    );
    const results = await withAvailability(
      rows.map((row) => ({
        ...row,
        base_price: Number(row.base_price),
        max_occupancy: Number(row.max_occupancy),
        total_rooms: Number(row.total_rooms),
      })),
      stayDates(stay.checkIn, stay.checkOut),
    );
    return NextResponse.json({ check_in: stay.checkIn, check_out: stay.checkOut, nights: stay.nights, results });
  } catch (error) {
    console.error('availability failed', error);
    return apiError('DATABASE_ERROR', 'Unable to check availability right now', 500);
  }
}
