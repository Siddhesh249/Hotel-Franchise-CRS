import { Suspense } from 'react';
import { SearchForm } from '@/components/search-form';
import { HotelCard } from '@/components/hotel-card';
import { Empty, PageHeader } from '@/components/ui';
import { listCities, listHotels } from '@/lib/data';
import { resolveStay } from '@/lib/availability';
import { formatDate, plural } from '@/lib/format';

export const metadata = { title: 'Hotels' };

type Params = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function Results({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const city = first(params.city)?.trim() || null;
  const guestsRaw = Number(first(params.guests));
  const guests = Number.isInteger(guestsRaw) && guestsRaw >= 1 && guestsRaw <= 4 ? guestsRaw : 2;
  const stay = resolveStay(first(params.check_in), first(params.check_out));

  const [cities, hotels] = await Promise.all([
    listCities(),
    listHotels({ city, checkIn: stay.checkIn, checkOut: stay.checkOut, guests }),
  ]);
  const query = new URLSearchParams({ check_in: stay.checkIn, check_out: stay.checkOut, guests: String(guests) }).toString();

  return (
    <>
      <SearchForm cities={cities} defaults={{ city: city ?? '', checkIn: stay.checkIn, checkOut: stay.checkOut, guests }} />
      <p className="muted mt-5">
        {plural(hotels.length, 'hotel')} · {formatDate(stay.checkIn, { weekday: true })} to {formatDate(stay.checkOut, { weekday: true })}
        {' '}({plural(stay.nights, 'night')}, {plural(guests, 'guest')})
      </p>
      {hotels.length ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel, index) => (
            <div key={hotel.hotel_id} className="animate-fade" style={{ animationDelay: `${index * 50}ms` }}>
              <HotelCard hotel={hotel} query={query} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3"><Empty title="No hotels match this search">Try another city or fewer guests.</Empty></div>
      )}
    </>
  );
}

export default function HotelsPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="container-page py-8">
      <PageHeader title="Find a stay" subtitle="Availability is checked for every night of your stay." />
      <div className="mt-5">
        <Suspense fallback={<div className="skeleton h-24" />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
