/**
 * GET /api/availability
 *
 * Public. Wraps fn_available_rooms(room_type_id, stay_date) for a city/hotel
 * date search. A room type is available only when every night in the stay has
 * at least one room left.
 *
 * Query params: city, hotel_id, check_in, check_out, guests
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { apiError } from '@/lib/authz';
import { parsePositiveInt } from '@/lib/request';
import { roomsLeft, stayDates, validStay } from '@/lib/availability';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const stay = validStay(params.get('check_in'), params.get('check_out'));
  if (!stay) {
    return apiError(
      'VALIDATION_ERROR',
      'Valid check-in and check-out dates are required (stays can be 1–60 nights)',
      400,
    );
  }

  const city = params.get('city')?.trim() || null;
  const hotelId = params.get('hotel_id') ? parsePositiveInt(params.get('hotel_id')) : null;
  if (params.get('hotel_id') && !hotelId) return apiError('VALIDATION_ERROR', 'hotel_id must be a positive integer', 400);

  const guestsRaw = params.get('guests');
  const guests = guestsRaw ? parsePositiveInt(guestsRaw) : null;
  if (guestsRaw && !guests) return apiError('VALIDATION_ERROR', 'guests must be a positive integer', 400);

  const roomTypeRaw = params.get('room_type_id');
  const roomTypeId = roomTypeRaw ? parsePositiveInt(roomTypeRaw) : null;
  if (roomTypeRaw && !roomTypeId) return apiError('VALIDATION_ERROR', 'room_type_id must be a positive integer', 400);

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT h.hotel_id, h.hotel_name, h.city, h.state,
              rt.room_type_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms
         FROM hotel h
         JOIN room_type rt ON rt.hotel_id = h.hotel_id
        WHERE (? IS NULL OR LOWER(h.city) = LOWER(?))
          AND (? IS NULL OR h.hotel_id = ?)
          AND (? IS NULL OR rt.max_occupancy >= ?)
          AND (? IS NULL OR rt.room_type_id = ?)
        ORDER BY h.hotel_name, rt.base_price`,
      [city, city, hotelId, hotelId, guests, guests, roomTypeId, roomTypeId],
    );

    const dates = stayDates(stay.checkIn, stay.checkOut);
    const results = await Promise.all(
      rows.map(async (row) => {
        const left = await roomsLeft(Number(row.room_type_id), dates);
        return {
          ...row,
          base_price: Number(row.base_price),
          max_occupancy: Number(row.max_occupancy),
          total_rooms: Number(row.total_rooms),
          rooms_left: left,
          available: left > 0,
        };
      }),
    );

    return NextResponse.json({
      check_in: stay.checkIn,
      check_out: stay.checkOut,
      nights: stay.nights,
      results,
    });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to check availability right now', 500);
  }
}
