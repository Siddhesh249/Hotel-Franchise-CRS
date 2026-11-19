import pool from '@/lib/db';
import { addDaysIso } from '@/lib/format';

export const MIN_DAYS = 7;
export const MAX_DAYS = 60;

export interface PlanDay {
  date: string;
  physical_rooms: number;
  base_buffer_rooms: number;
  buffer_rooms: number;
  max_sellable_rooms: number;
  booked_rooms: number;
}

/** Recompute daily_inventory_plan with the database's own buffer function. */
export async function refreshPlan(hotelId: number | null, days: number) {
  if (hotelId) {
    await pool.query('CALL sp_refresh_hotel_inventory_plan(?, CURRENT_DATE, ?)', [hotelId, days]);
  } else {
    await pool.query('CALL sp_refresh_inventory_plan(CURRENT_DATE, ?)', [days]);
  }
}

/** Read the stored plan for the next `days` days (summed over hotels when hotelId is null). */
export async function readPlan(hotelId: number | null, days: number): Promise<PlanDay[]> {
  const [[{ today }]] = await pool.query<any[]>("SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS today");
  const [rows] = await pool.query<any[]>(
    `SELECT DATE_FORMAT(stay_date, '%Y-%m-%d') AS date,
            SUM(physical_rooms) AS physical_rooms, SUM(base_buffer_rooms) AS base_buffer_rooms,
            SUM(buffer_rooms) AS buffer_rooms, SUM(max_sellable_rooms) AS max_sellable_rooms,
            SUM(booked_rooms) AS booked_rooms
       FROM daily_inventory_plan
      WHERE stay_date BETWEEN ? AND ? AND (? IS NULL OR hotel_id = ?)
      GROUP BY stay_date ORDER BY stay_date`,
    [today, addDaysIso(today, days - 1), hotelId, hotelId],
  );
  return rows.map((row) => ({
    date: row.date,
    physical_rooms: Number(row.physical_rooms),
    base_buffer_rooms: Number(row.base_buffer_rooms),
    buffer_rooms: Number(row.buffer_rooms),
    max_sellable_rooms: Number(row.max_sellable_rooms),
    booked_rooms: Number(row.booked_rooms),
  }));
}
