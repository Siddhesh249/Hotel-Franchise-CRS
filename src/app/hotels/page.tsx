import Link from 'next/link';
import { Suspense } from 'react';
import { Icon } from '@/components/icons';
import { SearchForm } from '@/components/search-form';
import { HotelCard } from '@/components/hotel-card';
import { listCities, listHotels, resolveStay } from '@/lib/data';
import { formatDate, nightsBetween } from '@/lib/format';

export const instant = false;

export const metadata = { title: 'Hotels' };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const city = first(params.city)?.trim() || null;
  const guestsRaw = Number(first(params.guests));
  const guests = Number.isInteger(guestsRaw) && guestsRaw > 0 && guestsRaw <= 20 ? guestsRaw : null;
  const [stay, cities] = await Promise.all([resolveStay(first(params.check_in), first(params.check_out)), listCities()]);
  const hotels = await listHotels({ city, checkIn: stay.checkIn, checkOut: stay.checkOut, guests });

  return (
    <>
      <SearchForm
        cities={cities}
        variant="inline"
        defaults={{ city: city ?? '', checkIn: stay.checkIn, checkOut: stay.checkOut, guests: guests ?? 2 }}
      />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{city ? `Stays in ${city}` : 'All destinations'}</p>
          <h2 className="section-title mt-2">
            {hotels.length} {hotels.length === 1 ? 'hotel' : 'hotels'} available
          </h2>
          <p className="muted mt-1">
            {formatDate(stay.checkIn, { weekday: true })} → {formatDate(stay.checkOut, { weekday: true })}
            {' · '}
            {nightsBetween(stay.checkIn, stay.checkOut)} {nightsBetween(stay.checkIn, stay.checkOut) === 1 ? 'night' : 'nights'}
            {guests ? ` · ${guests} ${guests === 1 ? 'guest' : 'guests'}` : ''}
          </p>
        </div>
        <Link href="/hotels" className="btn-ghost btn-sm">
          <Icon name="refresh" size={14} />
          Clear filters
        </Link>
      </div>

      {hotels.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <HotelCard
              key={hotel.hotel_id}
              hotel={hotel}
              checkIn={stay.checkIn}
              checkOut={stay.checkOut}
              guests={guests ?? undefined}
            />
          ))}
        </div>
      ) : (
        <div className="card-muted mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-ink-500">
            <Icon name="search" size={22} />
          </span>
          <h3 className="mt-4 text-lg font-semibold">No hotels match this search</h3>
          <p className="muted mt-1 max-w-md">
            Try another city, widen your dates, or reduce the number of guests. Availability is
            checked for every night of the stay.
          </p>
          <Link href="/hotels" className="btn-secondary mt-5">See every hotel</Link>
        </div>
      )}
    </>
  );
}

export default function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="pb-10">
      <section className="border-b border-ink-100 bg-white">
        <div className="container-page py-10">
          <p className="eyebrow">Find your stay</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Rooms across the Nightingale franchise
          </h1>
          <p className="muted mt-2 max-w-2xl">
            Every card shows live availability for the exact dates you choose — including rooms
            released by the overbooking buffer.
          </p>
        </div>
      </section>

      <div className="container-page -mt-6">
        <Suspense
          fallback={
            <div className="space-y-8">
              <div className="skeleton h-[86px]" />
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => <div key={item} className="skeleton h-72" />)}
              </div>
            </div>
          }
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
