/**
 * Server-side read helpers for the public pages. Pages call these directly
 * instead of fetching their own API routes.
 */

import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { featuresCollection } from '@/lib/mongodb';
import { stayDates, withAvailability } from '@/lib/availability';
import type { Hotel, HotelFeatures, HotelListItem, RoomType } from '@/types';

/** Amenity documents from MongoDB, keyed by hotel id. A Mongo outage only hides amenities. */
async function loadFeatures(hotelIds: number[]): Promise<Map<number, HotelFeatures>> {
  try {
    const docs = await (await featuresCollection())
      .find({ hotel_id: { $in: hotelIds } }, { projection: { _id: 0 } })
      .toArray();
    return new Map(docs.map((doc) => [Number(doc.hotel_id), doc as unknown as HotelFeatures]));
  } catch (error) {
    console.error('MongoDB features unavailable', error);
    return new Map();
  }
}

type HotelRow = RowDataPacket & Hotel;
type RoomTypeRow = RowDataPacket & RoomType;

function toHotel(row: HotelRow): Hotel {
  return {
    hotel_id: Number(row.hotel_id),
    franchise_id: Number(row.franchise_id),
    hotel_name: row.hotel_name,
    city: row.city,
    state: row.state,
    address: row.address,
    star_rating: row.star_rating === null ? null : Number(row.star_rating),
    contact_number: row.contact_number,
  };
}

function toRoomType(row: RoomTypeRow): RoomType {
  return {
    room_type_id: Number(row.room_type_id),
    hotel_id: Number(row.hotel_id),
    type_name: row.type_name,
    base_price: Number(row.base_price),
    max_occupancy: Number(row.max_occupancy),
    total_rooms: Number(row.total_rooms),
  };
}

export async function listCities(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT DISTINCT city FROM hotel ORDER BY city');
  return rows.map((row) => String(row.city));
}

async function roomTypesFor(hotelIds: number[], guests?: number | null): Promise<RoomType[]> {
  if (!hotelIds.length) return [];
  const [rows] = await pool.query<RoomTypeRow[]>(
    `SELECT room_type_id, hotel_id, type_name, base_price, max_occupancy, total_rooms
       FROM room_type
      WHERE hotel_id IN (?) AND (? IS NULL OR max_occupancy >= ?)
      ORDER BY base_price`,
    [hotelIds, guests ?? null, guests ?? null],
  );
  return rows.map(toRoomType);
}

/** Hotels (optionally in one city) with availability for the stay and their Mongo amenities. */
export async function listHotels(options: {
  city?: string | null;
  checkIn: string;
  checkOut: string;
  guests?: number | null;
}): Promise<HotelListItem[]> {
  const [hotelRows] = await pool.query<HotelRow[]>(
    'SELECT * FROM hotel WHERE (? IS NULL OR city = ?) ORDER BY hotel_name',
    [options.city ?? null, options.city ?? null],
  );
  const hotels = hotelRows.map(toHotel);
  const ids = hotels.map((hotel) => hotel.hotel_id);
  const [roomTypes, features] = await Promise.all([roomTypesFor(ids, options.guests), loadFeatures(ids)]);
  const withLeft = await withAvailability(roomTypes, stayDates(options.checkIn, options.checkOut));

  return hotels
    .map((hotel) => ({
      ...hotel,
      room_types: withLeft.filter((room) => room.hotel_id === hotel.hotel_id),
      features: features.get(hotel.hotel_id) ?? null,
    }))
    .filter((hotel) => hotel.room_types.length > 0);
}

export async function getHotelDetail(
  hotelId: number,
  checkIn: string,
  checkOut: string,
  guests?: number | null,
): Promise<HotelListItem | null> {
  const [rows] = await pool.execute<HotelRow[]>('SELECT * FROM hotel WHERE hotel_id = ?', [hotelId]);
  if (!rows.length) return null;
  const [roomTypes, features] = await Promise.all([roomTypesFor([hotelId], guests), loadFeatures([hotelId])]);
  return {
    ...toHotel(rows[0]),
    room_types: await withAvailability(roomTypes, stayDates(checkIn, checkOut)),
    features: features.get(hotelId) ?? null,
  };
}

/** One room type with its hotel, amenities and rooms left for the stay (booking page). */
export async function getBookingRoomInfo(roomTypeId: number, checkIn: string, checkOut: string) {
  const [rows] = await pool.execute<RoomTypeRow[]>(
    `SELECT room_type_id, hotel_id, type_name, base_price, max_occupancy, total_rooms
       FROM room_type WHERE room_type_id = ?`,
    [roomTypeId],
  );
  if (!rows.length) return null;
  const roomType = toRoomType(rows[0]);
  const hotel = await getHotelDetail(roomType.hotel_id, checkIn, checkOut);
  const room = hotel?.room_types.find((item) => item.room_type_id === roomTypeId);
  if (!hotel || !room) return null;
  return { room_type: room, hotel, rooms_left: room.rooms_left };
}
