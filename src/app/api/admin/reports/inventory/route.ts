/**
 * GET /api/admin/reports/inventory?hotel_id=&days=14
 *
 * Admin only. Daily capacity picture for the next N real calendar days.
 *
 * The physical bar is constant. Max sellable is NOT: it comes from
 * daily_inventory_plan, which the database refreshes from the previous night's
 * occupancy. An under-booked night raises the next day's buffer; an
 * over-booked night lowers it. Booked is the actual per-night ledger count.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { adminSession, invalid, positiveId } from '@/lib/admin';
import { apiError } from '@/lib/authz';
import { addDaysIso } from '@/lib/format';

type PlanRow = RowDataPacket & {
  date: string;
  physical_rooms: number | string;
  base_buffer_rooms: number | string;
  buffer_rooms: number | string;
  max_sellable_rooms: number | string;
  booked_rooms: number | string;
};

export async function GET(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;

  const hotelParam = req.nextUrl.searchParams.get('hotel_id');
  const hotelId = hotelParam ? positiveId(hotelParam) : null;
  if (hotelParam && !hotelId) return invalid('hotel_id must be a positive integer');

  const daysRaw = Number(req.nextUrl.searchParams.get('days') ?? 14);
  if (!Number.isInteger(daysRaw) || daysRaw < 7 || daysRaw > 60) {
    return invalid('days must be a whole number between 7 and 60');
  }

  try {
    const [todayRows] = await pool.query<any[]>(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today",
    );
    const today = String(todayRows[0]?.today ?? new Date().toISOString().slice(0, 10));
    const endDate = addDaysIso(today, daysRaw - 1);
    const dates = Array.from({ length: daysRaw }, (_, index) => addDaysIso(today, index));

    // Recompute the plan before reading it, so the chart always reflects the
    // current booking ledger rather than a stale snapshot.
    if (hotelId) {
      await pool.query('CALL sp_refresh_hotel_inventory_plan(?, ?, ?)', [hotelId, today, daysRaw]);
    } else {
      await pool.query('CALL sp_refresh_inventory_plan(?, ?)', [today, daysRaw]);
    }

    const [rows] = await pool.query<PlanRow[]>(
      `SELECT DATE_FORMAT(stay_date, '%Y-%m-%d') AS date,
              SUM(physical_rooms)     AS physical_rooms,
              SUM(base_buffer_rooms)  AS base_buffer_rooms,
              SUM(buffer_rooms)       AS buffer_rooms,
              SUM(max_sellable_rooms) AS max_sellable_rooms,
              SUM(booked_rooms)       AS booked_rooms
         FROM daily_inventory_plan
        WHERE stay_date BETWEEN ? AND ?
          AND (? IS NULL OR hotel_id = ?)
        GROUP BY stay_date
        ORDER BY stay_date`,
      [today, endDate, hotelId, hotelId],
    );

    const planByDate = new Map<string, PlanRow>(
      rows.map((row) => [String(row.date), row]),
    );

    const days = dates.map((date) => {
      const row = planByDate.get(date);
      const physicalRooms = Number(row?.physical_rooms ?? 0);
      const baseBufferRooms = Number(row?.base_buffer_rooms ?? 0);
      const bufferRooms = Number(row?.buffer_rooms ?? 0);
      const maxSellableRooms = Number(row?.max_sellable_rooms ?? 0);
      const bookedRooms = Number(row?.booked_rooms ?? 0);
      return {
        date,
        physical_rooms: physicalRooms,
        base_buffer_rooms: baseBufferRooms,
        buffer_rooms: bufferRooms,
        max_sellable_rooms: maxSellableRooms,
        booked_rooms: bookedRooms,
        remaining_rooms: Math.max(0, maxSellableRooms - bookedRooms),
      };
    });

    const first = days[0];
    return NextResponse.json({
      hotel_id: hotelId,
      days,
      totals: {
        physical_rooms: first?.physical_rooms ?? 0,
        base_buffer_rooms: first?.base_buffer_rooms ?? 0,
        buffer_rooms: first?.buffer_rooms ?? 0,
        max_sellable_rooms: first?.max_sellable_rooms ?? 0,
        overbook_percentage: first?.physical_rooms
          ? Number(((first.buffer_rooms / first.physical_rooms) * 100).toFixed(2))
          : 0,
        peak_max_sellable_rooms: days.reduce(
          (peak, day) => Math.max(peak, day.max_sellable_rooms),
          0,
        ),
      },
    });
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load the inventory chart', 500);
  }
}
