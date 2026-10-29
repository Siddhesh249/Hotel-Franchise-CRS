import Link from 'next/link';
import { Suspense } from 'react';

type Hotel = { hotel_id: number; hotel_name: string; city: string; state: string | null; features?: { amenities?: { general?: string[] } } | null };

async function HotelList() {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const response = await fetch(`${base}/api/hotels`, { cache: 'no-store' }).catch(() => null);
  const hotels = response?.ok ? await response.json() as Hotel[] : [];
  return <div className="mt-8 grid gap-6 md:grid-cols-2">{hotels.map((hotel) => <Link key={hotel.hotel_id} href={`/hotels/${hotel.hotel_id}`} className="rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md"><h2 className="text-xl font-semibold">{hotel.hotel_name}</h2><p className="mt-2 text-slate-600">{hotel.city}{hotel.state ? `, ${hotel.state}` : ''}</p><p className="mt-4 text-sm">{hotel.features?.amenities?.general?.join(' · ') ?? 'Comfortable rooms and thoughtful service'}</p></Link>)}</div>;
}

export default function HotelsPage() {
  return <main className="mx-auto max-w-6xl p-8"><h1 className="text-3xl font-bold">Our hotels</h1><Suspense fallback={<HotelListSkeleton />}><HotelList /></Suspense></main>;
}

function HotelListSkeleton() {
  return <div className="mt-8 grid animate-pulse gap-6 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-44 rounded-xl bg-slate-100" />)}</div>;
}
