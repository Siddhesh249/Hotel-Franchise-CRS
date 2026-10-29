/**
 * GET /api/hotels
 *
 * Public. Lists all hotels, merging the SQL hotel/room_type rows with a
 * summary of the hotel_features Mongo document (amenities).
 *
 * Phase 1 — §1.3 Public site
 * See ARCHITECTURE.md §9 (API route map) and §4.3 (cross-db consistency).
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  const [rows] = await pool.query<any[]>('SELECT h.*, COALESCE(JSON_ARRAYAGG(JSON_OBJECT(\'room_type_id\', rt.room_type_id, \'type_name\', rt.type_name, \'base_price\', rt.base_price, \'max_occupancy\', rt.max_occupancy, \'total_rooms\', rt.total_rooms)), JSON_ARRAY()) AS room_types FROM hotel h LEFT JOIN room_type rt ON rt.hotel_id = h.hotel_id GROUP BY h.hotel_id');
  let features = new Map<number, unknown>();
  try { const client = await clientPromise; const docs = await client.db(process.env.MONGODB_DB ?? 'hotel_crs').collection('hotel_features').find({}).toArray(); features = new Map(docs.map(doc => [Number(doc.hotel_id), doc])); } catch { /* Mongo is optional for SQL-only development */ }
  return NextResponse.json(rows.map(row => ({ ...row, room_types: typeof row.room_types === 'string' ? JSON.parse(row.room_types) : row.room_types, features: features.get(row.hotel_id) ?? null })));
}
