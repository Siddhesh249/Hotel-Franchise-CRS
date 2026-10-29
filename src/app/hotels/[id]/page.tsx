/**
 * /hotels/[id] — Hotel detail page (Public)
 *
 * Fetches GET /api/hotels/[id] — SQL hotel row + room types + Mongo amenities.
 * Phase 1 — §1.3 Public site
 *
 * TODO: Phase 1 (1.3) — implement hotel detail UI
 */

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'; const hotel = await fetch(`${base}/api/hotels/${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!hotel) return <main className="p-8">Hotel not found.</main>;
  return <main className="mx-auto max-w-6xl p-8"><p className="text-sm text-slate-500">{hotel.city}, {hotel.state}</p><h1 className="mt-2 text-4xl font-bold">{hotel.hotel_name}</h1><p className="mt-4">{hotel.features?.amenities?.general?.join(' · ')}</p><h2 className="mt-10 text-2xl font-semibold">Rooms</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{hotel.room_types.map((room: any) => <a key={room.room_type_id} href={`/book/${room.room_type_id}`} className="rounded-lg border p-5"><h3 className="font-semibold">{room.type_name}</h3><p className="mt-2">₹{room.base_price} per night</p><p className="text-sm text-slate-500">Up to {room.max_occupancy} guests · {room.total_rooms} rooms</p></a>)}</div></main>;
}
