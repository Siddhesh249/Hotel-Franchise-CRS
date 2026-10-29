/**
 * GET /api/admin/reports/amenities
 *
 * Admin only. MongoDB aggregation: amenity counts grouped by city.
 * Uses $unwind on the combined general + wellness arrays and $group.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getMongoClient, mongoDbName } from '@/lib/mongodb';
import { adminSession } from '@/lib/admin';
import { apiError } from '@/lib/authz';

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const [hotels] = await pool.query<any[]>('SELECT hotel_id, city FROM hotel');
    const cities = new Map(hotels.map((hotel) => [Number(hotel.hotel_id), hotel.city]));

    const client = await getMongoClient();
    const aggregation = await client
      .db(mongoDbName())
      .collection('hotel_features')
      .aggregate<any>([
        {
          $project: {
            hotel_id: 1,
            amenities: {
              $concatArrays: [
                { $ifNull: ['$amenities.general', []] },
                { $ifNull: ['$amenities.wellness', []] },
              ],
            },
          },
        },
        { $unwind: '$amenities' },
        { $group: { _id: { hotel_id: '$hotel_id', amenity: '$amenities' } } },
        { $group: { _id: '$_id.amenity', hotel_ids: { $addToSet: '$_id.hotel_id' } } },
      ])
      .toArray();

    const report = aggregation
      .flatMap((item) => {
        const byCity = new Map<string, number>();
        for (const hotelId of item.hotel_ids as number[]) {
          const city = cities.get(Number(hotelId));
          if (city) byCity.set(city, (byCity.get(city) ?? 0) + 1);
        }
        return [...byCity].map(([city, hotel_count]) => ({ city, amenity: item._id, hotel_count }));
      })
      .sort((a, b) => a.city.localeCompare(b.city) || a.amenity.localeCompare(b.amenity));

    return NextResponse.json(report);
  } catch {
    return apiError('MONGODB_ERROR', 'Unable to generate the amenity report. Is MongoDB running?', 500);
  }
}
