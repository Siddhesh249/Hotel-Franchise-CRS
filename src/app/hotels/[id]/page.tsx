import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Amenities, RoomFeatures } from '@/components/amenities';
import { SearchForm } from '@/components/search-form';
import { getHotelDetail } from '@/lib/data';
import { resolveStay } from '@/lib/availability';
import { formatCurrency, formatDate, plural } from '@/lib/format';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const hotelId = Number((await params).id);
  if (!Number.isInteger(hotelId) || hotelId <= 0) notFound();

  const query = await searchParams;
  const guestsRaw = Number(first(query.guests));
  const guests = Number.isInteger(guestsRaw) && guestsRaw >= 1 && guestsRaw <= 4 ? guestsRaw : 2;
  const stay = resolveStay(first(query.check_in), first(query.check_out));
  const hotel = await getHotelDetail(hotelId, stay.checkIn, stay.checkOut, guests);
  if (!hotel) notFound();

  const bookingQuery = new URLSearchParams({ check_in: stay.checkIn, check_out: stay.checkOut, guests: String(guests) });

  return (
    <main className="container-page animate-fade py-8">
      <nav className="text-xs text-ink-500" aria-label="Breadcrumb">
        <Link href="/hotels" className="hover:text-ink-900">Hotels</Link> / <span>{hotel.hotel_name}</span>
      </nav>

      <header className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight">{hotel.hotel_name}</h1>
        <p className="muted mt-1">
          {[hotel.address, hotel.city, hotel.state].filter(Boolean).join(', ')}
          {hotel.star_rating ? ` · ${hotel.star_rating} ★` : ''}
          {hotel.contact_number ? ` · ${hotel.contact_number}` : ''}
        </p>
      </header>

      <div className="mt-5">
        <SearchForm defaults={{ checkIn: stay.checkIn, checkOut: stay.checkOut, guests }} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <h2 className="text-base">Rooms for {formatDate(stay.checkIn)} to {formatDate(stay.checkOut)}</h2>
          <p className="muted">{plural(stay.nights, 'night')}. Rooms left is the minimum across all nights.</p>

          <div className="mt-3 space-y-3">
            {hotel.room_types.length ? hotel.room_types.map((room) => (
              <article key={room.room_type_id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base">{room.type_name}</h3>
                    {room.available
                      ? <span className={room.rooms_left <= 2 ? 'badge-amber' : 'badge-brand'}>{room.rooms_left} left</span>
                      : <span className="badge-rose">Full</span>}
                  </div>
                  <p className="muted">Sleeps {room.max_occupancy} · {plural(room.total_rooms, 'room')}</p>
                  <RoomFeatures features={hotel.features?.room_type_features?.[room.type_name]} />
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatCurrency(room.base_price)}</p>
                    <p className="text-xs text-ink-500">per night · {formatCurrency(room.base_price * stay.nights)} total</p>
                  </div>
                  <Link href={`/book/${room.room_type_id}?${bookingQuery}`} className={room.available ? 'btn-primary' : 'btn-secondary'}>
                    {room.available ? 'Book' : 'Join waitlist'}
                  </Link>
                </div>
              </article>
            )) : (
              <p className="muted">No room type here sleeps {guests} guests.</p>
            )}
          </div>
        </section>

        <aside className="card self-start p-4">
          <h2 className="mb-3 text-base">Amenities</h2>
          <Amenities features={hotel.features} />
        </aside>
      </div>
    </main>
  );
}
