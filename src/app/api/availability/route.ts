/**
 * GET /api/availability
 *
 * Public. Wraps fn_available_rooms(room_type_id, stay_date) for a city/date search.
 *
 * Query params:
 *   city        - filter hotels by city
 *   check_in    - DATE (YYYY-MM-DD)
 *   check_out   - DATE (YYYY-MM-DD)
 *
 * Phase 1 — §1.4 Guest booking flow
 * See ARCHITECTURE.md §9 and DDL fn_available_rooms().
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseDate } from '@/lib/request';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const checkIn = parseDate(params.get('check_in'));
  const checkOut = parseDate(params.get('check_out'));
  if (!checkIn || !checkOut || checkOut <= checkIn) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Valid check-in and check-out dates are required' } }, { status: 400 });
  const city = params.get('city');
  const [rows] = await pool.query<any[]>('SELECT h.hotel_id, h.hotel_name, h.city, rt.room_type_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms FROM hotel h JOIN room_type rt ON rt.hotel_id = h.hotel_id WHERE (? IS NULL OR h.city = ?) ORDER BY h.hotel_name, rt.base_price', [city, city]);
  const result = [];
  for (const row of rows) {
    const [availability] = await pool.execute<any[]>('SELECT MIN(fn_available_rooms(?, d.stay_date)) AS rooms_left FROM (SELECT ? + INTERVAL seq DAY AS stay_date FROM (SELECT 0 seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29) s WHERE ? + INTERVAL seq DAY < ?) d', [row.room_type_id, checkIn, checkIn, checkOut]);
    result.push({ ...row, rooms_left: Number(availability[0]?.rooms_left ?? 0) });
  }
  return NextResponse.json({ check_in: checkIn, check_out: checkOut, results: result });
}
