'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/client-api';
import { formatDate } from '@/lib/format';

type Day = {
  date: string; physical_rooms: number; base_buffer_rooms: number; buffer_rooms: number;
  max_sellable_rooms: number; booked_rooms: number;
};

const SERIES = [
  { key: 'physical_rooms', label: 'Physical rooms', color: 'bg-ink-300' },
  { key: 'max_sellable_rooms', label: 'Max sellable', color: 'bg-brand-500' },
  { key: 'booked_rooms', label: 'Booked', color: 'bg-accent-200 ring-1 ring-accent-700/40' },
] as const;

export function AdminInventoryChart({ hotels }: { hotels: Array<{ hotel_id: number; hotel_name: string }> }) {
  const [hotelId, setHotelId] = useState('');
  const [days, setDays] = useState('14');
  const [data, setData] = useState<Day[] | null>(null);
  const [error, setError] = useState('');

  const recompute = useCallback(async () => {
    setError('');
    try {
      const result = await api<{ days: Day[] }>('/api/admin/reports/inventory', {
        method: 'POST',
        body: { hotel_id: hotelId || null, days: Number(days) },
      });
      setData(result.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the plan.');
    }
  }, [hotelId, days]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recompute();
  }, [recompute]);

  const scale = useMemo(
    () => Math.max(1, ...(data ?? []).flatMap((day) => [day.physical_rooms, day.max_sellable_rooms, day.booked_rooms])),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="muted max-w-2xl">
          Physical rooms never change. The sellable ceiling moves: a night after an under-booked night gets a bigger
          buffer, a night after an over-booked night gets a smaller one. The plan is recomputed by the database each time
          this tab is opened.
        </p>
        <div className="flex gap-2">
          <select value={hotelId} onChange={(e) => { setData(null); setHotelId(e.target.value); }} aria-label="Hotel" className="input w-60">
            <option value="">All hotels</option>
            {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
          </select>
          <select value={days} onChange={(e) => { setData(null); setDays(e.target.value); }} aria-label="Days" className="input w-28">
            {[14, 30, 60].map((value) => <option key={value} value={value}>{value} days</option>)}
          </select>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!data ? (
        !error && <div className="skeleton h-72" />
      ) : (
        <>
          <section className="card p-4">
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-600">
              {SERIES.map((item) => (
                <span key={item.key} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${item.color}`} />{item.label}</span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <div className="flex h-56 min-w-[640px] items-end gap-1.5 border-b border-ink-200">
                {data.map((day) => (
                  <div key={day.date} className="flex flex-1 items-end justify-center gap-0.5" title={formatDate(day.date)}>
                    {SERIES.map((item) => (
                      <div
                        key={item.key}
                        title={`${item.label}: ${day[item.key]}`}
                        className={`w-2.5 rounded-t-sm transition-all duration-500 ${item.color}`}
                        style={{ height: `${Math.max(2, (day[item.key] / scale) * 100)}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex min-w-[640px] gap-1.5 pt-1.5 text-[10px] text-ink-500">
                {data.map((day) => <span key={day.date} className="flex-1 text-center">{formatDate(day.date, { year: false })}</span>)}
              </div>
            </div>
          </section>

          <div className="table-shell">
            <table>
              <thead><tr><th>Date</th><th>Physical</th><th>Base buffer</th><th>Buffer today</th><th>Max sellable</th><th>Booked</th></tr></thead>
              <tbody>
                {data.map((day) => {
                  const delta = day.buffer_rooms - day.base_buffer_rooms;
                  return (
                    <tr key={day.date}>
                      <td className="font-medium text-ink-900">{formatDate(day.date, { weekday: true })}</td>
                      <td>{day.physical_rooms}</td>
                      <td>{day.base_buffer_rooms}</td>
                      <td>
                        {day.buffer_rooms}
                        {delta !== 0 && <span className={`ml-1 text-xs ${delta > 0 ? 'text-brand-700' : 'text-accent-700'}`}>({delta > 0 ? '+' : ''}{delta})</span>}
                      </td>
                      <td>{day.max_sellable_rooms}</td>
                      <td>{day.booked_rooms}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
