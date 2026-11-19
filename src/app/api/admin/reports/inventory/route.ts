/**
 * GET  /api/admin/reports/inventory?hotel_id=&days=14   read the stored daily plan
 * POST /api/admin/reports/inventory                      recompute it, then return it
 *                                                        body: { hotel_id?, days }
 *
 * The plan lives in daily_inventory_plan. Reading never writes; the POST runs
 * sp_refresh_*_inventory_plan, which applies fn_dynamic_buffer_rooms night by night.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminSession, invalid, serverError } from '@/lib/admin';
import { MAX_DAYS, MIN_DAYS, readPlan, refreshPlan } from '@/lib/inventory';
import { positiveInt } from '@/lib/request';

function parse(hotel: unknown, days: unknown) {
  const hotelId = hotel === null || hotel === undefined || hotel === '' ? null : positiveInt(hotel);
  const dayCount = days === null || days === undefined ? 14 : Number(days);
  if ((hotel !== null && hotel !== undefined && hotel !== '' && !hotelId)
      || !Number.isInteger(dayCount) || dayCount < MIN_DAYS || dayCount > MAX_DAYS) return null;
  return { hotelId, days: dayCount };
}

async function respond(hotelId: number | null, days: number, refresh: boolean) {
  try {
    if (refresh) await refreshPlan(hotelId, days);
    return NextResponse.json({ hotel_id: hotelId, days: await readPlan(hotelId, days) });
  } catch (error) {
    return serverError('DATABASE_ERROR', 'Unable to load the inventory plan', error);
  }
}

export async function GET(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const query = parse(req.nextUrl.searchParams.get('hotel_id'), req.nextUrl.searchParams.get('days'));
  if (!query) return invalid(`hotel_id must be a positive integer and days a whole number from ${MIN_DAYS} to ${MAX_DAYS}`);
  return respond(query.hotelId, query.days, false);
}

export async function POST(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const query = parse(body.hotel_id, body.days);
  if (!query) return invalid(`hotel_id must be a positive integer and days a whole number from ${MIN_DAYS} to ${MAX_DAYS}`);
  return respond(query.hotelId, query.days, true);
}
