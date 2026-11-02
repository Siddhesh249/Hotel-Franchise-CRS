'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { formatDate } from '@/lib/format';

type HotelOption = { hotel_id: number; hotel_name: string };
type DayRow = {
  date: string;
  physical_rooms: number;
  base_buffer_rooms: number;
  buffer_rooms: number;
  max_sellable_rooms: number;
  booked_rooms: number;
  remaining_rooms: number;
};
type Payload = {
  days: DayRow[];
  totals: {
    physical_rooms: number;
    buffer_rooms: number;
    max_sellable_rooms: number;
    overbook_percentage: number;
    peak_max_sellable_rooms?: number;
  };
};

async function api(url: string): Promise<Payload> {
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 401) {
    window.location.href = new URL('/login?callbackUrl=/admin', window.location.origin).href;
    throw new Error('Sign in is required.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Unable to load inventory data.');
  return data as Payload;
}

const series = [
  { key: 'physical_rooms', label: 'Physical rooms', color: 'bg-ink-300' },
  { key: 'max_sellable_rooms', label: 'Max sellable', color: 'bg-brand-500' },
  { key: 'booked_rooms', label: 'Booked', color: 'bg-accent-400' },
] as const;

export function AdminInventoryChart({ hotels }: { hotels: HotelOption[] }) {
  const [hotelId, setHotelId] = useState('');
  const [days, setDays] = useState('14');
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ days });
      if (hotelId) params.set('hotel_id', hotelId);
      setData(await api(`/api/admin/reports/inventory?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory data.');
    } finally {
      setLoading(false);
    }
  }, [days, hotelId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const scale = useMemo(() => {
    if (!data?.days.length) return 1;
    return Math.max(1, ...data.days.flatMap((day) => [day.physical_rooms, day.max_sellable_rooms, day.booked_rooms]));
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Daily inventory & overbooking</h2>
          <p className="muted mt-1">
            Physical rooms are constant. The teal bar is the adaptive daily ceiling: an under-booked night
            raises the next day&apos;s buffer, an over-booked night lowers it. Amber is what is actually booked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">Hotel</span>
            <select value={hotelId} onChange={(event) => { setLoading(true); setHotelId(event.target.value); }} className="input w-56">
              <option value="">All hotels</option>
              {hotels.map((hotel) => (
                <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Days</span>
            <select value={days} onChange={(event) => { setLoading(true); setDays(event.target.value); }} className="input w-32">
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Physical rooms', value: data?.totals.physical_rooms ?? 0 },
          { label: 'Adaptive buffer (today)', value: data?.totals.buffer_rooms ?? 0 },
          { label: 'Max sellable (today)', value: data?.totals.max_sellable_rooms ?? 0 },
          {
            label: 'Peak max sellable',
            value: data?.totals.peak_max_sellable_rooms ?? data?.totals.max_sellable_rooms ?? 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900">{loading ? '…' : stat.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Capacity vs allowed sales</h3>
          <div className="flex flex-wrap gap-3 text-xs font-medium text-ink-600">
            {series.map((item) => (
              <span key={item.key} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-sm ${item.color}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="skeleton mt-5 h-72" />
        ) : data?.days.length ? (
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-[720px] items-end gap-2 border-b border-ink-100 pb-2">
              {data.days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-56 w-full items-end justify-center gap-1">
                    {series.map((item) => {
                      const value = day[item.key];
                      return (
                        <div
                          key={item.key}
                          title={`${item.label}: ${value} on ${formatDate(day.date)}`}
                          className={`w-3 rounded-t-sm ${item.color} transition-all`}
                          style={{ height: `${Math.max(2, (value / scale) * 100)}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-medium text-ink-500">{formatDate(day.date, { year: false })}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card-muted mt-5 p-8 text-center">
            <p className="font-semibold text-ink-800">No rooms configured</p>
            <p className="muted mt-1">Add hotels and room types in the Catalog tab first.</p>
          </div>
        )}
      </section>

      {data?.days.length ? (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Physical rooms</th>
                <th>Base buffer</th>
                <th>Adaptive buffer</th>
                <th>Max sellable</th>
                <th>Booked</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => {
                const adjustment = day.buffer_rooms - day.base_buffer_rooms;
                return (
                  <tr key={day.date}>
                    <td className="font-medium text-ink-900">{formatDate(day.date, { weekday: true })}</td>
                    <td>{day.physical_rooms}</td>
                    <td>{day.base_buffer_rooms}</td>
                    <td>
                      {day.buffer_rooms}
                      {adjustment !== 0 && (
                        <span className={`ml-1 text-xs ${adjustment > 0 ? 'text-brand-700' : 'text-accent-700'}`}>
                          ({adjustment > 0 ? '+' : ''}{adjustment})
                        </span>
                      )}
                    </td>
                    <td>{day.max_sellable_rooms}</td>
                    <td>{day.booked_rooms}</td>
                    <td>{day.remaining_rooms}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
