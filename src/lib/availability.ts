/**
 * Availability helpers shared by the public API and server-rendered pages.
 *
 * `fn_available_rooms` answers "rooms left on ONE night". A stay is only
 * bookable if every night in the range has capacity, so we take the minimum
 * across the stay — the same rule sp_create_booking applies when it locks the
 * tightest night.
 */

import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { parseDate } from '@/lib/request';

export const MAX_STAY_NIGHTS = 60;

/** Every calendar night in [checkIn, checkOut). */
export function stayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return dates;
  for (let cursor = start; cursor < end; cursor = new Date(cursor.valueOf() + 86_400_000)) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > MAX_STAY_NIGHTS) break;
  }
  return dates;
}

export function validStay(checkIn: unknown, checkOut: unknown): { checkIn: string; checkOut: string; nights: number } | null {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  if (!start || !end || end <= start) return null;
  const nights = stayDates(start, end).length;
  if (nights < 1 || nights > MAX_STAY_NIGHTS) return null;
  return { checkIn: start, checkOut: end, nights };
}

type AvailabilityRow = RowDataPacket & { rooms_left: number | string | null };

/** Minimum rooms left across the whole stay for one room type. */
export async function roomsLeft(roomTypeId: number, dates: string[]): Promise<number> {
  if (!dates.length) return 0;
  const [rows] = await pool.execute<AvailabilityRow[]>(
    `SELECT MIN(fn_available_rooms(?, stay_date)) AS rooms_left
       FROM (SELECT ${dates.map(() => '?').join(' AS stay_date UNION ALL SELECT ')} AS stay_date) AS nights`,
    [roomTypeId, ...dates],
  );
  return Math.max(0, Number(rows[0]?.rooms_left ?? 0));
}

/** Add availability to a list of room types in one round trip per type. */
export async function withAvailability<T extends { room_type_id: number }>(
  roomTypes: T[],
  dates: string[],
): Promise<Array<T & { rooms_left: number; available: boolean }>> {
  return Promise.all(
    roomTypes.map(async (roomType) => {
      const left = await roomsLeft(roomType.room_type_id, dates);
      return { ...roomType, rooms_left: left, available: left > 0 };
    }),
  );
}
