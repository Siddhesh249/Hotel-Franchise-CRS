'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Icon } from '@/components/icons';
import { addDaysIso, todayIso } from '@/lib/format';

export interface SearchDefaults {
  city?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
}

export function SearchForm({
  cities,
  defaults,
  variant = 'hero',
}: {
  cities: string[];
  defaults: SearchDefaults;
  variant?: 'hero' | 'inline';
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [city, setCity] = useState(defaults.city ?? '');
  const [guests, setGuests] = useState(String(defaults.guests ?? 2));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    params.set('check_in', checkIn);
    params.set('check_out', checkOut);
    params.set('guests', guests);
    router.push(`/hotels?${params.toString()}`);
  }

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  const fields = (
    <>
      <label className="block">
        <span className="label">Destination</span>
        <span className="relative block">
          <Icon name="map-pin" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <select value={city} onChange={(event) => setCity(event.target.value)} className="input pl-9">
            <option value="">Any city</option>
            {cities.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </span>
      </label>
      <label className="block">
        <span className="label">Check in</span>
        <input
          type="date"
          required
          value={checkIn}
          min={todayIso()}
          onChange={(event) => changeCheckIn(event.target.value)}
          className="input"
        />
      </label>
      <label className="block">
        <span className="label">Check out</span>
        <input
          type="date"
          required
          value={checkOut}
          min={addDaysIso(checkIn || todayIso(), 1)}
          onChange={(event) => setCheckOut(event.target.value)}
          className="input"
        />
      </label>
      <label className="block">
        <span className="label">Guests</span>
        <select value={guests} onChange={(event) => setGuests(event.target.value)} className="input">
          {[1, 2, 3, 4, 5, 6].map((count) => (
            <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>
          ))}
        </select>
      </label>
    </>
  );

  if (variant === 'inline') {
    return (
      <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] lg:items-end">
        {fields}
        <button type="submit" className="btn-primary h-[42px] lg:mb-0">
          <Icon name="search" size={16} />
          Search
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-white/40 bg-white/95 p-4 shadow-[0_24px_70px_-30px_rgba(6,17,28,0.65)] backdrop-blur sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] lg:items-end"
    >
      {fields}
      <button type="submit" className="btn-primary h-[42px]">
        <Icon name="search" size={16} />
        Find rooms
      </button>
    </form>
  );
}
