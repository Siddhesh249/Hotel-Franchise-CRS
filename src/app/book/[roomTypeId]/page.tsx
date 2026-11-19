import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingForm } from '@/components/booking-form';
import { Amenities, RoomFeatures } from '@/components/amenities';
import { getBookingRoomInfo } from '@/lib/data';
import { resolveStay } from '@/lib/availability';
import { requirePageRole } from '@/lib/guard';
import { formatCurrency, formatDate } from '@/lib/format';

export const metadata = { title: 'Book a room' };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomTypeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { roomTypeId } = await params;
  const query = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [[key, first(value)!]])),
  ).toString();
  const session = await requirePageRole(['Guest'], `/book/${roomTypeId}${queryString ? `?${queryString}` : ''}`);

  const id = Number(roomTypeId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const stay = resolveStay(first(query.check_in), first(query.check_out));
  const info = await getBookingRoomInfo(id, stay.checkIn, stay.checkOut);
  if (!info) notFound();

  const { room_type: room, hotel } = info;
  const requested = Number(first(query.guests));
  const guests = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, room.max_occupancy) : Math.min(2, room.max_occupancy);

  return (
    <main className="container-page animate-fade py-8">
      <nav className="text-xs text-ink-500" aria-label="Breadcrumb">
        <Link href="/hotels" className="hover:text-ink-900">Hotels</Link> /{' '}
        <Link href={`/hotels/${hotel.hotel_id}?${queryString}`} className="hover:text-ink-900">{hotel.hotel_name}</Link> /{' '}
        <span>Book {room.type_name}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Book the {room.type_name}</h1>
      <p className="muted mt-1">
        {hotel.hotel_name}, {hotel.city} · {formatDate(stay.checkIn, { weekday: true })} to {formatDate(stay.checkOut, { weekday: true })}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <section className="card p-4">
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div><dt className="eyebrow">Rate</dt><dd className="mt-1 font-medium">{formatCurrency(room.base_price)} / night</dd></div>
              <div><dt className="eyebrow">Sleeps</dt><dd className="mt-1 font-medium">{room.max_occupancy}</dd></div>
              <div><dt className="eyebrow">Availability</dt><dd className="mt-1 font-medium">{info.rooms_left > 0 ? `${info.rooms_left} left` : 'Waitlist only'}</dd></div>
            </dl>
            <RoomFeatures features={hotel.features?.room_type_features?.[room.type_name]} />
          </section>
          <section className="card p-4">
            <h2 className="mb-3 text-base">Hotel amenities</h2>
            <Amenities features={hotel.features} />
          </section>
        </div>

        <BookingForm
          roomTypeId={room.room_type_id}
          roomTypeName={room.type_name}
          hotelName={hotel.hotel_name}
          basePrice={room.base_price}
          maxOccupancy={room.max_occupancy}
          roomsLeft={info.rooms_left}
          initialCheckIn={stay.checkIn}
          initialCheckOut={stay.checkOut}
          initialGuests={guests}
          signedInAs={session.user.name ?? session.user.email ?? 'you'}
        />
      </div>
    </main>
  );
}
