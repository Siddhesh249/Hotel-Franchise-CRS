/**
 * Availability helpers shared by the public pages and the availability API.
 *
 * fn_available_rooms() answers "rooms left on ONE night". A stay is only
 * bookable if every night has capacity, so the answer for a stay is the
 * minimum across its nights, the same rule sp_create_booking applies when it
 * locks the tightest night.
 */

import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { parseDate } from '@/lib/request';
import { addDaysIso, todayIso } from '@/lib/format';

export const MAX_STAY_NIGHTS = 60;

/** Every calendar night in [checkIn, checkOut). */
export function stayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  for (let date = checkIn; date < checkOut && dates.length <= MAX_STAY_NIGHTS; date = addDaysIso(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** Validates a stay: real dates, check-out after check-in, 1-60 nights, not in the past. */
export function validStay(checkIn: unknown, checkOut: unknown) {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  if (!start || !end || end <= start || start < todayIso()) return null;
  const nights = stayDates(start, end).length;
  return nights >= 1 && nights <= MAX_STAY_NIGHTS ? { checkIn: start, checkOut: end, nights } : null;
}

/** Valid search dates from the URL, or tomorrow + 2 nights. */
export function resolveStay(checkIn?: string | null, checkOut?: string | null) {
  const parsed = validStay(checkIn, checkOut);
  if (parsed) return parsed;
  const start = addDaysIso(todayIso(), 1);
  return { checkIn: start, checkOut: addDaysIso(start, 2), nights: 2 };
}

type LeftRow = RowDataPacket & { room_type_id: number; rooms_left: number | string | null };

/** Rooms left across a whole stay, for many room types in one query. */
export async function roomsLeftByType(roomTypeIds: number[], dates: string[]): Promise<Map<number, number>> {
  const result = new Map<number, number>(roomTypeIds.map((id) => [id, 0]));
  if (!roomTypeIds.length || !dates.length) return result;
  const [rows] = await pool.query<LeftRow[]>(
    `SELECT rt.room_type_id, MIN(fn_available_rooms(rt.room_type_id, n.stay_date)) AS rooms_left
       FROM room_type rt
       JOIN (${dates.map(() => 'SELECT ? AS stay_date').join(' UNION ALL ')}) n
      WHERE rt.room_type_id IN (?)
      GROUP BY rt.room_type_id`,
    [...dates, roomTypeIds],
  );
  for (const row of rows) result.set(Number(row.room_type_id), Math.max(0, Number(row.rooms_left ?? 0)));
  return result;
}

export async function withAvailability<T extends { room_type_id: number }>(roomTypes: T[], dates: string[]) {
  const left = await roomsLeftByType(roomTypes.map((room) => room.room_type_id), dates);
  return roomTypes.map((room) => {
    const rooms_left = left.get(room.room_type_id) ?? 0;
    return { ...room, rooms_left, available: rooms_left > 0 };
  });
}
