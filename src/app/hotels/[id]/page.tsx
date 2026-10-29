import Link from 'next/link';
import { Suspense } from 'react';

type RoomType = { room_type_id: number; type_name: string; base_price: number; max_occupancy: number; total_rooms: number };
type Hotel = { hotel_name: string; city: string; state: string | null; features?: { amenities?: { general?: string[] } } | null; room_types: RoomType[] };

async function getHotel(id: string): Promise<Hotel | null> {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const response = await fetch(`${base}/api/hotels/${encodeURIComponent(id)}`, { cache: 'no-store' }).catch(() => null);
  return response?.ok ? response.json() as Promise<Hotel> : null;
}

async function HotelDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotel = await getHotel(id);
  if (!hotel) return <main className="mx-auto max-w-6xl p-8">Hotel not found.</main>;
  return <main className="mx-auto max-w-6xl p-8"><p className="text-sm text-slate-500">{hotel.city}{hotel.state ? `, ${hotel.state}` : ''}</p><h1 className="mt-2 text-4xl font-bold">{hotel.hotel_name}</h1><p className="mt-4">{hotel.features?.amenities?.general?.join(' · ') ?? 'Comfortable rooms and thoughtful service'}</p><h2 className="mt-10 text-2xl font-semibold">Rooms</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{hotel.room_types.map((room) => <Link key={room.room_type_id} href={`/book/${room.room_type_id}`} className="rounded-lg border p-5 transition-shadow hover:shadow-md"><h3 className="font-semibold">{room.type_name}</h3><p className="mt-2">₹{room.base_price} per night</p><p className="text-sm text-slate-500">Up to {room.max_occupancy} guests · {room.total_rooms} rooms</p></Link>)}</div></main>;
}

export default function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<HotelDetailSkeleton />}><HotelDetailContent params={params} /></Suspense>;
}

function HotelDetailSkeleton() {
  return <main className="mx-auto max-w-6xl animate-pulse p-8"><div className="h-4 w-40 rounded bg-slate-200" /><div className="mt-4 h-10 w-2/3 rounded bg-slate-200" /><div className="mt-4 h-5 w-1/2 rounded bg-slate-200" /><div className="mt-12 grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-40 rounded-lg bg-slate-100" />)}</div></main>;
}
