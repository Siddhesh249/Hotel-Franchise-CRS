'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { addDaysIso, todayIso } from '@/lib/format';

interface SearchFormProps {
  /** Destination choices. Leave undefined on a hotel page to hide the field. */
  cities?: string[];
  defaults: { city?: string; checkIn: string; checkOut: string; guests: number };
}

/** Dates + guests (+ destination). On /hotels it navigates; on a hotel page it updates the URL in place. */
export function SearchForm({ cities, defaults }: SearchFormProps) {
  const router = useRouter();
  const [city, setCity] = useState(defaults.city ?? '');
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(String(defaults.guests));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (cities && city) params.set('city', city);
    params.set('check_in', checkIn);
    params.set('check_out', checkOut);
    params.set('guests', guests);
    if (cities) router.push(`/hotels?${params.toString()}`);
    else router.replace(`?${params.toString()}`, { scroll: false });
  }

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  return (
    <form onSubmit={submit} className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
      {cities && (
        <label>
          <span className="label">City</span>
          <select value={city} onChange={(event) => setCity(event.target.value)} className="input">
            <option value="">All cities</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      )}
      <label>
        <span className="label">Check in</span>
        <input type="date" required value={checkIn} min={todayIso()} onChange={(e) => changeCheckIn(e.target.value)} className="input" />
      </label>
      <label>
        <span className="label">Check out</span>
        <input type="date" required value={checkOut} min={addDaysIso(checkIn || todayIso(), 1)} onChange={(e) => setCheckOut(e.target.value)} className="input" />
      </label>
      <label>
        <span className="label">Guests</span>
        <select value={guests} onChange={(event) => setGuests(event.target.value)} className="input">
          {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <button type="submit" className="btn-primary">{cities ? 'Search' : 'Update'}</button>
    </form>
  );
}
