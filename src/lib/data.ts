/**
 * Server-only read helpers for public pages.
 *
 * Pages query these directly instead of fetching their own /api routes: one
 * less network hop, no dependency on NEXTAUTH_URL being correct at runtime,
 * and the same SQL + Mongo merge the API returns.
 */

import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { getMongoClient, mongoDbName } from '@/lib/mongodb';
import { addDaysIso } from '@/lib/format';
import { withAvailability, validStay, stayDates } from '@/lib/availability';
import type { HotelDetail, HotelFeatures, HotelListItem, RoomType, RoomTypeWithAvailability } from '@/types';

async function featuresFor(hotelId: number): Promise<HotelFeatures | null> {
  try {
    const client = await getMongoClient();
    const doc = await client.db(mongoDbName()).collection('hotel_features').findOne({ hotel_id: hotelId });
    if (!doc) return null;
    const rest = { ...(doc as Record<string, unknown>) };
    delete rest._id;
    return rest as unknown as HotelFeatures;
  } catch {
    return null;
  }
}

async function allFeatures(): Promise<Map<number, HotelFeatures>> {
  try {
    const client = await getMongoClient();
    const docs = await client.db(mongoDbName()).collection('hotel_features').find({}).toArray();
    return new Map(
      docs.map((doc) => {
        const rest = { ...(doc as Record<string, unknown>) };
        delete rest._id;
        return [Number(doc.hotel_id), rest as unknown as HotelFeatures];
      }),
    );
  } catch {
    return new Map();
  }
}

/** The virtual clock's current calendar date, falling back to the real one. */
export async function getVirtualToday(): Promise<string> {
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT DATE_FORMAT(virtual_now, '%Y-%m-%d') AS today FROM sim_clock WHERE clock_id = 1",
    );
    if (rows[0]?.today) return String(rows[0].today);
  } catch {
    /* fall through to the wall clock */
  }
  return new Date().toISOString().slice(0, 10);
}

/** Resolve optional search dates into a valid stay, defaulting to tomorrow + 2 nights. */
export async function resolveStay(checkIn?: string | null, checkOut?: string | null) {
  const parsed = validStay(checkIn, checkOut);
  if (parsed) return parsed;
  const today = await getVirtualToday();
  const start = addDaysIso(today, 1);
  const end = addDaysIso(start, 2);
  return { checkIn: start, checkOut: end, nights: 2 };
}

export async function listCities(): Promise<string[]> {
  const [rows] = await pool.query<any[]>('SELECT DISTINCT city FROM hotel ORDER BY city');
  return rows.map((row) => String(row.city));
}

type HotelRow = RowDataPacket & {
  hotel_id: number;
  franchise_id: number;
  hotel_name: string;
  city: string;
  state: string | null;
  address: string | null;
  star_rating: number | null;
  contact_number: string | null;
  type_name?: string;
  room_type_id?: number;
  base_price?: number;
  max_occupancy?: number;
  total_rooms?: number;
};

type RoomTypeRow = RowDataPacket & RoomType;

function groupRoomTypes(rows: HotelRow[]): Map<number, RoomType[]> {
  const grouped = new Map<number, RoomType[]>();
  for (const row of rows) {
    if (!row.room_type_id) continue;
    const list = grouped.get(row.hotel_id) ?? [];
    list.push({
      room_type_id: Number(row.room_type_id),
      hotel_id: Number(row.hotel_id),
      type_name: String(row.type_name),
      base_price: Number(row.base_price),
      max_occupancy: Number(row.max_occupancy),
      total_rooms: Number(row.total_rooms),
    });
    grouped.set(row.hotel_id, list);
  }
  return grouped;
}

/** Public hotel listing, with per-room-type availability for the requested stay. */
export async function listHotels(options: {
  city?: string | null;
  checkIn: string;
  checkOut: string;
  guests?: number | null;
}): Promise<HotelListItem[]> {
  const [rows] = await pool.query<HotelRow[]>(
    `SELECT h.*, rt.room_type_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms
       FROM hotel h
       LEFT JOIN room_type rt ON rt.hotel_id = h.hotel_id
      WHERE (? IS NULL OR LOWER(h.city) = LOWER(?))
        AND (? IS NULL OR rt.max_occupancy >= ?)
      ORDER BY h.hotel_name, rt.base_price`,
    [options.city ?? null, options.city ?? null, options.guests ?? null, options.guests ?? null],
  );
  const grouped = groupRoomTypes(rows);
  const features = await allFeatures();
  const dates = stayDates(options.checkIn, options.checkOut);

  const hotelIds = [...new Set(rows.map((row) => Number(row.hotel_id)))];
  return Promise.all(
    hotelIds.map(async (hotelId) => {
      const first = rows.find((row) => Number(row.hotel_id) === hotelId)!;
      const roomTypes = await withAvailability(grouped.get(hotelId) ?? [], dates);
      return {
        hotel_id: Number(first.hotel_id),
        franchise_id: Number(first.franchise_id),
        hotel_name: String(first.hotel_name),
        city: String(first.city),
        state: first.state,
        address: first.address,
        star_rating: first.star_rating === null ? null : Number(first.star_rating),
        contact_number: first.contact_number,
        room_types: roomTypes,
        features: features.get(hotelId) ?? null,
      } satisfies HotelListItem;
    }),
  );
}

/** Featured hotels for the landing page (no availability calculation needed). */
export async function featuredHotels(limit = 3): Promise<HotelListItem[]> {
  const [rows] = await pool.query<HotelRow[]>(
    `SELECT h.*, rt.room_type_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms
       FROM hotel h LEFT JOIN room_type rt ON rt.hotel_id = h.hotel_id
      ORDER BY h.star_rating DESC, h.hotel_name
      LIMIT ${Math.max(1, Math.min(12, limit))}`,
  );
  const grouped = groupRoomTypes(rows);
  const features = await allFeatures();
  const hotelIds = [...new Set(rows.map((row) => Number(row.hotel_id)))];
  return hotelIds.map((hotelId) => {
    const first = rows.find((row) => Number(row.hotel_id) === hotelId)!;
    return {
      hotel_id: Number(first.hotel_id),
      franchise_id: Number(first.franchise_id),
      hotel_name: String(first.hotel_name),
      city: String(first.city),
      state: first.state,
      address: first.address,
      star_rating: first.star_rating === null ? null : Number(first.star_rating),
      contact_number: first.contact_number,
      room_types: (grouped.get(hotelId) ?? []).map((room) => ({
        ...room,
        rooms_left: room.total_rooms,
        available: true,
      })),
      features: features.get(hotelId) ?? null,
    } satisfies HotelListItem;
  });
}

export async function getHotelDetail(
  hotelId: number,
  checkIn: string,
  checkOut: string,
  guests?: number | null,
): Promise<HotelDetail | null> {
  const [hotels] = await pool.execute<any[]>('SELECT * FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!hotels.length) return null;
  const hotel = hotels[0];
  const [roomTypes] = await pool.execute<RoomTypeRow[]>(
    `SELECT room_type_id, hotel_id, type_name, base_price, max_occupancy, total_rooms
       FROM room_type
      WHERE hotel_id = ? ${guests ? 'AND max_occupancy >= ?' : ''}
      ORDER BY base_price`,
    guests ? [hotelId, guests] : [hotelId],
  );
  const [withAvail, features] = await Promise.all([
    withAvailability(roomTypes, stayDates(checkIn, checkOut)),
    featuresFor(hotelId),
  ]);
  return {
    hotel_id: Number(hotel.hotel_id),
    franchise_id: Number(hotel.franchise_id),
    hotel_name: String(hotel.hotel_name),
    city: String(hotel.city),
    state: hotel.state,
    address: hotel.address,
    star_rating: hotel.star_rating === null ? null : Number(hotel.star_rating),
    contact_number: hotel.contact_number,
    features,
    room_types: withAvail as RoomTypeWithAvailability[],
  };
}

export interface BookingRoomInfo {
  room_type: RoomType;
  hotel: { hotel_id: number; hotel_name: string; city: string; state: string | null; address: string | null };
  features: HotelFeatures | null;
  rooms_left: number;
}

export async function getBookingRoomInfo(
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
): Promise<BookingRoomInfo | null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT rt.room_type_id, rt.hotel_id, rt.type_name, rt.base_price, rt.max_occupancy, rt.total_rooms,
            h.hotel_name, h.city, h.state, h.address
       FROM room_type rt JOIN hotel h ON h.hotel_id = rt.hotel_id
      WHERE rt.room_type_id = ?`,
    [roomTypeId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const [left, features] = await Promise.all([
    withAvailability(
      [{ room_type_id: Number(row.room_type_id) }],
      stayDates(checkIn, checkOut),
    ),
    featuresFor(Number(row.hotel_id)),
  ]);
  return {
    room_type: {
      room_type_id: Number(row.room_type_id),
      hotel_id: Number(row.hotel_id),
      type_name: String(row.type_name),
      base_price: Number(row.base_price),
      max_occupancy: Number(row.max_occupancy),
      total_rooms: Number(row.total_rooms),
    },
    hotel: {
      hotel_id: Number(row.hotel_id),
      hotel_name: String(row.hotel_name),
      city: String(row.city),
      state: row.state,
      address: row.address,
    },
    features,
    rooms_left: left[0]?.rooms_left ?? 0,
  };
}
