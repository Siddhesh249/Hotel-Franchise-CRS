/**
 * GET /api/admin/reports/amenities
 *
 * MongoDB aggregation ($project, $unwind, $group) over hotel_features: how many
 * hotels offer each amenity. The result is joined with hotel.city from MariaDB
 * to group the counts by city.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { featuresCollection } from '@/lib/mongodb';
import { adminSession } from '@/lib/admin';
import { apiError } from '@/lib/authz';

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const [hotels] = await pool.query<any[]>('SELECT hotel_id, city FROM hotel');
    const cityOf = new Map(hotels.map((hotel) => [Number(hotel.hotel_id), String(hotel.city)]));

    const amenityHotels = await (await featuresCollection())
      .aggregate<{ _id: string; hotel_ids: number[] }>([
        {
          $project: {
            hotel_id: 1,
            amenity: { $concatArrays: [{ $ifNull: ['$amenities.general', []] }, { $ifNull: ['$amenities.wellness', []] }] },
          },
        },
        { $unwind: '$amenity' },
        { $group: { _id: '$amenity', hotel_ids: { $addToSet: '$hotel_id' } } },
      ])
      .toArray();

    const report = amenityHotels
      .flatMap((item) => {
        const perCity = new Map<string, number>();
        for (const hotelId of item.hotel_ids) {
          const city = cityOf.get(Number(hotelId));
          if (city) perCity.set(city, (perCity.get(city) ?? 0) + 1);
        }
        return [...perCity].map(([city, hotels_offering]) => ({ city, amenity: item._id, hotels_offering }));
      })
      .sort((a, b) => a.city.localeCompare(b.city) || a.amenity.localeCompare(b.amenity));
    return NextResponse.json(report);
  } catch (error) {
    console.error('amenity report failed', error);
    return apiError('MONGODB_ERROR', 'Unable to generate the amenity report. Is MongoDB running?', 500);
  }
}
