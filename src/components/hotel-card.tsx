import Link from 'next/link';
import { Icon } from '@/components/icons';
import { formatCurrency } from '@/lib/format';
import type { HotelListItem } from '@/types';

export function HotelCard({
  hotel,
  checkIn,
  checkOut,
  guests,
}: {
  hotel: HotelListItem;
  checkIn: string;
  checkOut: string;
  guests?: number;
}) {
  const amenities = [
    ...(hotel.features?.amenities?.general ?? []),
    ...(hotel.features?.amenities?.wellness ?? []),
  ].slice(0, 4);
  const petFriendly = Boolean(hotel.features?.amenities?.policies?.pet_friendly);
  const cheapest = hotel.room_types.reduce<number | null>(
    (min, room) => (min === null || Number(room.base_price) < min ? Number(room.base_price) : min),
    null,
  );
  const availableRooms = hotel.room_types.reduce((sum, room) => sum + (room.available ? 1 : 0), 0);
  const params = new URLSearchParams({ check_in: checkIn, check_out: checkOut });
  if (guests) params.set('guests', String(guests));

  return (
    <Link
      href={`/hotels/${hotel.hotel_id}?${params.toString()}`}
      className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-24px_rgba(11,27,43,0.4)]"
    >
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-ink-800 via-ink-700 to-brand-800">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_30%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-brand-200 uppercase">
              {hotel.city}{hotel.state ? `, ${hotel.state}` : ''}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">{hotel.hotel_name}</h3>
          </div>
          {hotel.star_rating ? (
            <span className="badge bg-white/15 text-white backdrop-blur">
              <Icon name="star" size={11} className="text-accent-300" />
              {hotel.star_rating}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          {amenities.length ? (
            amenities.map((amenity) => (
              <span key={amenity} className="badge-slate capitalize">
                {amenity}
              </span>
            ))
          ) : (
            <span className="badge-slate">Comfortable rooms</span>
          )}
          {petFriendly && <span className="badge-brand">Pet friendly</span>}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-ink-100 pt-4">
          <div>
            {cheapest !== null ? (
              <p className="text-sm text-ink-500">
                from <span className="text-base font-bold text-ink-900">{formatCurrency(cheapest)}</span>
                <span className="text-xs"> / night</span>
              </p>
            ) : (
              <p className="text-sm text-ink-500">Rooms coming soon</p>
            )}
            <p className="mt-0.5 text-xs text-ink-500">
              {availableRooms > 0
                ? `${availableRooms} room ${availableRooms === 1 ? 'type' : 'types'} available`
                : 'Currently sold out'}
            </p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
            <Icon name="arrow-right" size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
