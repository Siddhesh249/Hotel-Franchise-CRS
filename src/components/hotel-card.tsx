import Link from 'next/link';
import { formatCurrency, plural } from '@/lib/format';
import type { HotelListItem } from '@/types';

export function HotelCard({ hotel, query }: { hotel: HotelListItem; query: string }) {
  const amenities = [
    ...(hotel.features?.amenities?.general ?? []),
    ...(hotel.features?.amenities?.wellness ?? []),
  ].slice(0, 4);
  const cheapest = Math.min(...hotel.room_types.map((room) => room.base_price));
  const available = hotel.room_types.filter((room) => room.available).length;

  return (
    <Link
      href={`/hotels/${hotel.hotel_id}?${query}`}
      className="card group block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold group-hover:text-brand-700">{hotel.hotel_name}</h2>
          <p className="muted">{hotel.city}{hotel.state ? `, ${hotel.state}` : ''}</p>
        </div>
        {hotel.star_rating ? <span className="badge-slate">{hotel.star_rating} ★</span> : null}
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
        {amenities.map((amenity) => <span key={amenity} className="badge-slate capitalize">{amenity}</span>)}
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-3 text-sm">
        <span className="text-ink-500">
          from <span className="text-base font-semibold text-ink-900">{formatCurrency(cheapest)}</span> / night
        </span>
        <span className={available ? 'text-brand-700' : 'text-accent-700'}>
          {available ? `${plural(available, 'room type')} open` : 'Waitlist only'}
        </span>
      </div>
    </Link>
  );
}
