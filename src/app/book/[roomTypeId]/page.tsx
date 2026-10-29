import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { BookingForm } from '@/components/booking-form';
import { getBookingRoomInfo, resolveStay } from '@/lib/data';
import { requirePageRole } from '@/lib/guard';
import { formatCurrency, formatDate, nightsBetween } from '@/lib/format';

export const instant = false;

export const metadata = { title: 'Book a room' };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { roomTypeId } = await params;
  const query = await searchParams;
  const id = Number(roomTypeId);
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]],
    ),
  ).toString();
  const session = await requirePageRole(['Guest'], `/book/${roomTypeId}${queryString ? `?${queryString}` : ''}`);

  if (!Number.isInteger(id) || id <= 0) notFound();

  const stay = await resolveStay(first(query.check_in), first(query.check_out));
  const info = await getBookingRoomInfo(id, stay.checkIn, stay.checkOut);
  if (!info) notFound();

  const requestedGuests = Number(first(query.guests));
  const guests = Number.isInteger(requestedGuests) && requestedGuests >= 1
    ? Math.min(requestedGuests, info.room_type.max_occupancy)
    : Math.min(2, info.room_type.max_occupancy);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const total = Number(info.room_type.base_price) * nights;

  const general = info.features?.amenities?.general ?? [];
  const wellness = info.features?.amenities?.wellness ?? [];
  const policies = info.features?.amenities?.policies ?? {};
  const roomFeatures = info.features?.room_type_features?.[info.room_type.type_name] ?? {};

  return (
    <main className="pb-14">
      <div className="border-b border-ink-100 bg-white">
        <div className="container-page py-6">
          <nav className="flex flex-wrap items-center gap-2 text-xs text-ink-500" aria-label="Breadcrumb">
            <Link href="/hotels" className="hover:text-brand-700">Hotels</Link>
            <span>/</span>
            <Link href={`/hotels/${info.hotel.hotel_id}`} className="hover:text-brand-700">{info.hotel.hotel_name}</Link>
            <span>/</span>
            <span className="text-ink-800">Book {info.room_type.type_name}</span>
          </nav>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{info.hotel.city}{info.hotel.state ? `, ${info.hotel.state}` : ''}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Book the {info.room_type.type_name}</h1>
              <p className="muted mt-1">
                {info.hotel.hotel_name} · {formatDate(stay.checkIn, { weekday: true })} → {formatDate(stay.checkOut, { weekday: true })}
              </p>
            </div>
            <div className="rounded-xl bg-sand-100 px-4 py-3 text-right">
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Estimated total</p>
              <p className="text-xl font-bold text-ink-900">{formatCurrency(total)}</p>
              <p className="text-xs text-ink-500">{nights} {nights === 1 ? 'night' : 'nights'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page mt-8 grid gap-8 lg:grid-cols-[1fr_460px]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="relative h-36 bg-gradient-to-br from-ink-800 via-ink-700 to-brand-800">
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_30%)]" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-brand-200 uppercase">{info.hotel.city}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{info.hotel.hotel_name}</h2>
                </div>
                <span className="badge bg-white/15 text-white backdrop-blur">
                  <Icon name="bed" size={12} />
                  {info.room_type.type_name}
                </span>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Rate</p>
                <p className="mt-1 font-semibold text-ink-900">{formatCurrency(info.room_type.base_price)} <span className="text-xs font-normal text-ink-500">/ night</span></p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Sleeps</p>
                <p className="mt-1 font-semibold text-ink-900">Up to {info.room_type.max_occupancy} guests</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Availability</p>
                <p className="mt-1 font-semibold text-ink-900">
                  {info.rooms_left > 0 ? `${info.rooms_left} rooms left` : 'Waitlist only'}
                </p>
              </div>
            </div>
          </section>

          {Object.keys(roomFeatures).length ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">In this room</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(roomFeatures).map(([key, value]) => (
                  <span key={key} className="badge-slate capitalize">
                    {key.replace(/_/g, ' ')}{typeof value === 'boolean' ? '' : `: ${String(value)}`}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Hotel amenities</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-ink-500">General</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                  {general.length ? general.map((item) => (
                    <li key={item} className="flex items-center gap-2 capitalize">
                      <Icon name="check" size={14} className="text-brand-600" />
                      {item}
                    </li>
                  )) : <li className="muted">Not published</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-500">Wellness & policies</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                  {wellness.map((item) => (
                    <li key={item} className="flex items-center gap-2 capitalize">
                      <Icon name="sparkles" size={14} className="text-brand-600" />
                      {item}
                    </li>
                  ))}
                  {Object.entries(policies).map(([key, value]) => (
                    <li key={key} className="flex items-center justify-between gap-3 capitalize">
                      <span>{key.replace(/_/g, ' ')}</span>
                      <span className="text-ink-500">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                    </li>
                  ))}
                  {!wellness.length && !Object.keys(policies).length ? <li className="muted">Not published</li> : null}
                </ul>
              </div>
            </div>
          </section>

          <section className="card-muted p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">What happens when you book</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-ink-700">
              <li className="flex gap-2.5"><span className="font-semibold text-brand-700">1.</span> The database locks the tightest night in your stay, so two guests can never take the same last room.</li>
              <li className="flex gap-2.5"><span className="font-semibold text-brand-700">2.</span> You are confirmed, confirmed against the buffer, or placed on the FIFO waitlist.</li>
              <li className="flex gap-2.5"><span className="font-semibold text-brand-700">3.</span> Pay from My bookings — payment is simulated for this project.</li>
            </ol>
          </section>
        </div>

        <div>
          <BookingForm
            roomTypeId={info.room_type.room_type_id}
            roomTypeName={info.room_type.type_name}
            hotelName={info.hotel.hotel_name}
            city={info.hotel.city}
            basePrice={Number(info.room_type.base_price)}
            maxOccupancy={info.room_type.max_occupancy}
            roomsLeft={info.rooms_left}
            initialCheckIn={stay.checkIn}
            initialCheckOut={stay.checkOut}
            initialGuests={guests}
            signedInAs={session.user?.name ?? session.user?.email ?? 'you'}
          />
        </div>
      </div>
    </main>
  );
}
