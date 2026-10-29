/**
 * GET /api/hotels
 *
 * Public. Lists all hotels, merging the SQL hotel/room_type rows with a
 * summary of the hotel_features Mongo document (amenities).
 *
 * See ARCHITECTURE.md §9 (API route map) and §4.3 (cross-db consistency).
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getMongoClient, mongoDbName } from '@/lib/mongodb';
import { apiError } from '@/lib/authz';

export async function GET() {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT h.*,
              COALESCE(
                (
                  SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                      'room_type_id', rt.room_type_id,
                      'type_name', rt.type_name,
                      'base_price', rt.base_price,
                      'max_occupancy', rt.max_occupancy,
                      'total_rooms', rt.total_rooms
                    )
                  )
                    FROM room_type rt
                   WHERE rt.hotel_id = h.hotel_id
                ),
                JSON_ARRAY()
              ) AS room_types
         FROM hotel h
        ORDER BY h.hotel_name`,
    );

    const features = new Map<number, unknown>();
    try {
      const client = await getMongoClient();
      const docs = await client.db(mongoDbName()).collection('hotel_features').find({}).toArray();
      for (const doc of docs) {
        const rest = { ...(doc as Record<string, unknown>) };
        delete rest._id;
        features.set(Number(doc.hotel_id), rest);
      }
    } catch {
      /* Mongo is optional for SQL-only development. */
    }

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        room_types: typeof row.room_types === 'string' ? JSON.parse(row.room_types) : row.room_types,
        features: features.get(Number(row.hotel_id)) ?? null,
      })),
    );
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to load hotels right now', 500);
  }
}
