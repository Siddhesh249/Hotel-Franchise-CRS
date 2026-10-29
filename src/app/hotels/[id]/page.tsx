import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { StayPicker } from '@/components/stay-picker';
import { getHotelDetail, resolveStay } from '@/lib/data';
import { formatCurrency, formatDate, nightsBetween } from '@/lib/format';

export const instant = false;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function featureEntries(features: Record<string, unknown> | undefined) {
  if (!features) return [];
  return Object.entries(features).map(([key, value]) => ({
    key: key.replace(/_/g, ' '),
    value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
  }));
}

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const hotelId = Number(id);
  if (!Number.isInteger(hotelId) || hotelId <= 0) notFound();

  const query = await searchParams;
  const guestsRaw = Number(first(query.guests));
  const guests = Number.isInteger(guestsRaw) && guestsRaw > 0 && guestsRaw <= 20 ? guestsRaw : 2;
  const stay = await resolveStay(first(query.check_in), first(query.check_out));
  const hotel = await getHotelDetail(hotelId, stay.checkIn, stay.checkOut, guests);
  if (!hotel) notFound();

  const amenities = hotel.features?.amenities;
  const general = amenities?.general ?? [];
  const wellness = amenities?.wellness ?? [];
  const policies = amenities?.policies ?? {};
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const bookingParams = new URLSearchParams({
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    guests: String(guests),
  });

  return (
    <main className="pb-14">
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_15%_20%,#38cba7,transparent_35%),radial-gradient(circle_at_85%_20%,#f5b027,transparent_30%)]" />
        <div className="container-page relative py-12">
          <nav className="flex items-center gap-2 text-xs text-ink-300" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <Link href="/hotels" className="hover:text-white">Hotels</Link>
            <span>/</span>
            <span className="text-ink-200">{hotel.hotel_name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.18em] text-brand-300 uppercase">
                {hotel.city}{hotel.state ? `, ${hotel.state}` : ''}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {hotel.hotel_name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-ink-200">
                {hotel.star_rating ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="star" size={14} className="text-accent-300" />
                    {hotel.star_rating}-star property
                  </span>
                ) : null}
                {hotel.address ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="map-pin" size={14} />
                    {hotel.address}
                  </span>
                ) : null}
                {hotel.contact_number ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="phone" size={14} />
                    {hotel.contact_number}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-[10px] font-bold tracking-[0.18em] text-ink-200 uppercase">Your stay</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
              </p>
              <p className="text-xs text-ink-200">
                {nights} {nights === 1 ? 'night' : 'nights'} · {guests} {guests === 1 ? 'guest' : 'guests'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page -mt-6">
        <div className="card p-4">
          <StayPicker checkIn={stay.checkIn} checkOut={stay.checkOut} guests={guests} />
        </div>
      </div>

      <div className="container-page mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Rooms & rates</p>
              <h2 className="section-title mt-2">Choose your room type</h2>
              <p className="muted mt-1">
                Availability is the minimum across all {nights} {nights === 1 ? 'night' : 'nights'} of your stay.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {hotel.room_types.length ? hotel.room_types.map((room) => {
              const roomFeatures = featureEntries(hotel.features?.room_type_features?.[room.type_name]);
              const soldOut = !room.available;
              return (
                <article key={room.room_type_id} className="card overflow-hidden">
                  <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{room.type_name}</h3>
                        {soldOut ? (
                          <span className="badge-rose">Sold out for these dates</span>
                        ) : room.rooms_left <= 2 ? (
                          <span className="badge-amber">Only {room.rooms_left} left</span>
                        ) : (
                          <span className="badge-brand">{room.rooms_left} rooms left</span>
                        )}
                        {room.total_rooms <= 2 && <span className="badge-slate">Boutique category</span>}
                      </div>
                      <p className="muted mt-1.5">
                        Sleeps up to {room.max_occupancy} · {room.total_rooms} physical rooms in this category
                      </p>
                      {roomFeatures.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {roomFeatures.map((feature) => (
                            <span key={feature.key} className="badge-slate capitalize">
                              {feature.key}{feature.value && feature.value !== 'Yes' ? `: ${feature.value}` : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-between gap-4 border-t border-ink-100 pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                      <div className="sm:text-right">
                        <p className="text-2xl font-bold text-ink-900">{formatCurrency(room.base_price)}</p>
                        <p className="text-xs text-ink-500">per night · {formatCurrency(Number(room.base_price) * nights)} total</p>
                      </div>
                      {soldOut ? (
                        <span className="btn-secondary cursor-not-allowed opacity-60" aria-disabled="true">Sold out</span>
                      ) : (
                        <Link
                          href={`/book/${room.room_type_id}?${bookingParams.toString()}`}
                          className="btn-primary"
                        >
                          Book this room
                          <Icon name="arrow-right" size={16} />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="card-muted p-8 text-center">
                <p className="font-semibold text-ink-800">No rooms sleep {guests} guests</p>
                <p className="muted mt-1">Reduce the guest count or choose another property.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Amenities</h2>
            <div className="mt-4 space-y-4">
              {general.length ? (
                <div>
                  <p className="text-xs font-semibold text-ink-500">General</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {general.map((item) => (
                      <li key={item} className="flex items-center gap-2 capitalize">
                        <Icon name="check" size={14} className="text-brand-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {wellness.length ? (
                <div>
                  <p className="text-xs font-semibold text-ink-500">Wellness</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {wellness.map((item) => (
                      <li key={item} className="flex items-center gap-2 capitalize">
                        <Icon name="sparkles" size={14} className="text-brand-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Object.keys(policies).length ? (
                <div>
                  <p className="text-xs font-semibold text-ink-500">Good to know</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {Object.entries(policies).map(([key, value]) => (
                      <li key={key} className="flex items-center justify-between gap-3 capitalize">
                        <span>{key.replace(/_/g, ' ')}</span>
                        <span className="text-ink-500">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!general.length && !wellness.length && !Object.keys(policies).length ? (
                <p className="muted">Amenity details are not published for this property yet.</p>
              ) : null}
            </div>
          </section>

          <section className="card-muted p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Booking outcomes</h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-700">
              <li className="flex gap-2.5">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" />
                <span><b>Confirmed</b> — a physical room is within capacity.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-accent-400" />
                <span><b>Confirmed · buffer</b> — accepted using the hotel&apos;s overbooking buffer.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-400" />
                <span><b>Waitlisted</b> — no capacity; promoted automatically when a room frees up.</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
