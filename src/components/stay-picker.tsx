'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Icon } from '@/components/icons';
import { addDaysIso, todayIso } from '@/lib/format';

export function StayPicker({
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
}: {
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(String(initialGuests));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests });
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && checkOut <= value) setCheckOut(addDaysIso(value, 1));
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_0.7fr_auto] sm:items-end">
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
        <select value={guests} onChange={(e) => setGuests(e.target.value)} className="input">
          {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <button type="submit" className="btn-primary h-[42px]">
        <Icon name="refresh" size={15} />
        Update
      </button>
    </form>
  );
}
