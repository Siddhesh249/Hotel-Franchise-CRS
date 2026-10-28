/**
 * /hotels — Hotel listing page (Public)
 *
 * Fetches GET /api/hotels and renders the list.
 * Phase 1 — §1.3 Public site
 *
 * TODO: Phase 1 (1.3) — implement hotel listing UI with amenity summaries
 */
export default async function HotelsPage() {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'; const hotels = await fetch(`${base}/api/hotels`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
  return <main className="mx-auto max-w-6xl p-8"><h1 className="text-3xl font-bold">Our hotels</h1><div className="mt-8 grid gap-6 md:grid-cols-2">{hotels.map((hotel: any) => <a key={hotel.hotel_id} href={`/hotels/${hotel.hotel_id}`} className="rounded-xl border p-6 shadow-sm hover:shadow-md"><h2 className="text-xl font-semibold">{hotel.hotel_name}</h2><p className="mt-2 text-slate-600">{hotel.city}, {hotel.state}</p><p className="mt-4 text-sm">{hotel.features?.amenities?.general?.join(' · ') ?? 'Comfortable rooms and thoughtful service'}</p></a>)}</div></main>;
}
