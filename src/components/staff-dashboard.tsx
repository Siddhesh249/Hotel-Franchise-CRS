'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingBadge, PaymentBadge } from '@/components/status-badge';
import { Empty, Feedback, PageHeader, Tabs } from '@/components/ui';
import { formatDate, plural } from '@/lib/format';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import type { BookingRow } from '@/types';

interface StaffPayload {
  hotel: { hotel_id: number; hotel_name: string; city: string; state: string | null };
  today: string;
  bookings: BookingRow[];
}

interface RoomOption {
  room_id: number;
  room_number: string;
  floor_number: number | null;
  room_status: string;
  occupied: boolean;
}

type Filter = 'active' | 'arrivals' | 'inhouse' | 'upcoming' | 'waitlist' | 'history';
const PAGE = 15;

export function StaffDashboard({ staffName, isAdmin }: { staffName: string; isAdmin: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<StaffPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [hotels, setHotels] = useState<Array<{ hotel_id: number; hotel_name: string }>>([]);
  const [hotelId, setHotelId] = useState('');
  const knownIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/hotels', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.hotels?.length) return;
        setHotels(payload.hotels);
        setHotelId(String(payload.hotels[0].hotel_id));
      })
      .catch(() => setError('Unable to load the hotel list.'));
  }, [isAdmin]);

  const load = useCallback(async (background = false) => {
    if (isAdmin && !hotelId) return;
    try {
      const response = await fetch(isAdmin ? `/api/staff/bookings?hotel_id=${hotelId}` : '/api/staff/bookings', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login?callbackUrl=/staff');
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (!background) setError(payload?.error?.message ?? 'Unable to load bookings.');
        return;
      }
      setError('');
      const incoming = payload.bookings as BookingRow[];
      if (knownIds.current) {
        const fresh = incoming.filter((b) => !knownIds.current!.has(b.booking_id));
        if (fresh.length) {
          setNotice(`New booking${fresh.length > 1 ? 's' : ''}: ${fresh
            .map((b) => `#${b.booking_id} ${b.first_name} ${b.last_name}, ${b.type_name}, ${formatDate(b.check_in_date)}`)
            .join('; ')}`);
        }
      }
      knownIds.current = new Set(incoming.map((b) => b.booking_id));
      setData(payload);
    } catch {
      if (!background) setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, hotelId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useAutoRefresh(() => void load(true), 8000);

  const today = data?.today ?? '';
  const lists = useMemo(() => {
    const all = data?.bookings ?? [];
    const confirmed = all.filter((b) => b.booking_status === 'Confirmed' && b.is_open);
    const arrivals = confirmed.filter((b) => b.check_in_date === today);
    const inhouse = confirmed.filter((b) => b.check_in_date < today);
    const upcoming = confirmed.filter((b) => b.check_in_date > today);
    const waitlist = all.filter((b) => b.booking_status === 'Waitlisted' && b.cancellable);
    const active = [...confirmed, ...waitlist].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date) || a.booking_id - b.booking_id);
    const open = new Set(active.map((b) => b.booking_id));
    return { active, arrivals, inhouse, upcoming, waitlist, history: all.filter((b) => !open.has(b.booking_id)).reverse() };
  }, [data, today]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = lists[filter];
    if (!term) return list;
    return list.filter((b) =>
      `${b.first_name} ${b.last_name} ${b.email} ${b.type_name} #${b.booking_id}`.toLowerCase().includes(term));
  }, [lists, filter, search]);

  async function openAssign(booking: BookingRow) {
    if (assigningId === booking.booking_id) {
      setAssigningId(null);
      return;
    }
    setAssigningId(booking.booking_id);
    setRooms([]);
    setSelectedRoom('');
    setError('');
    try {
      const response = await fetch(`/api/staff/rooms?booking_id=${booking.booking_id}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) setError(payload?.error?.message ?? 'Unable to load rooms.');
      else setRooms(payload);
    } catch {
      setError('Could not load the room list.');
    }
  }

  async function assign(booking: BookingRow) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/staff/assign-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.booking_id, room_id: Number(selectedRoom) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? 'The room could not be assigned.');
        return;
      }
      setNotice(`Room ${payload.room_number} assigned to booking #${booking.booking_id}.`);
      setAssigningId(null);
      await load();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container-page animate-fade py-8">
      <PageHeader
        title={data?.hotel.hotel_name ?? 'Front desk'}
        subtitle={data ? `${data.hotel.city} · Today is ${formatDate(data.today, { weekday: true })} · ${staffName}` : 'Loading…'}
        actions={
          <>
            {isAdmin && (
              <select aria-label="Hotel" value={hotelId} onChange={(e) => { knownIds.current = null; setHotelId(e.target.value); setData(null); setLoading(true); }} className="input w-64">
                {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => void load()} className="btn-secondary btn-sm">Refresh</button>
          </>
        }
      />
      {isAdmin && <p className="muted mt-2">Read-only view. Room assignment is done by the hotel’s own front desk account.</p>}
      <Feedback notice={notice} error={error} />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={filter}
          onChange={(id) => { setFilter(id); setLimit(PAGE); setAssigningId(null); }}
          tabs={[
            { id: 'active', label: 'All active', count: lists.active.length },
            { id: 'arrivals', label: 'Arriving today', count: lists.arrivals.length },
            { id: 'inhouse', label: 'In house', count: lists.inhouse.length },
            { id: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
            { id: 'waitlist', label: 'Waitlist', count: lists.waitlist.length },
            { id: 'history', label: 'History', count: lists.history.length },
          ]}
        />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest, email, #id" aria-label="Search bookings" className="input w-60" />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-40" />
        ) : visible.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr><th>Guest</th><th>Room type</th><th>Stay</th><th>Status</th><th>Room</th></tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map((booking) => {
                  const open = booking.booking_status === 'Confirmed' && booking.is_open;
                  const paid = booking.payment_status === 'Completed';
                  return (
                    <Fragment key={booking.booking_id}>
                      <tr>
                        <td>
                          <p className="font-medium text-ink-900">{booking.first_name} {booking.last_name} <span className="font-normal text-ink-400">#{booking.booking_id}</span></p>
                          <p className="text-xs text-ink-500">{booking.email}{booking.phone ? ` · ${booking.phone}` : ''}</p>
                        </td>
                        <td>{booking.type_name}<p className="text-xs text-ink-500">{plural(booking.num_guests, 'guest')}</p></td>
                        <td className="whitespace-nowrap">
                          {formatDate(booking.check_in_date)} to {formatDate(booking.check_out_date)}
                          <p className="text-xs text-ink-500">{plural(booking.nights, 'night')} · booked {formatDate(booking.booking_date, { year: false })}</p>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5"><BookingBadge booking={booking} /><PaymentBadge booking={booking} /></div>
                        </td>
                        <td>
                          {booking.room_number ? (
                            <span className="badge-brand">Room {booking.room_number}</span>
                          ) : open && paid && !isAdmin ? (
                            <button type="button" className="btn-primary btn-sm" onClick={() => void openAssign(booking)}>
                              {assigningId === booking.booking_id ? 'Close' : 'Assign'}
                            </button>
                          ) : open ? (
                            <span className="text-xs text-ink-500">{paid ? 'Not assigned' : 'Awaiting payment'}</span>
                          ) : (
                            <span className="text-ink-400">-</span>
                          )}
                        </td>
                      </tr>
                      {assigningId === booking.booking_id && (
                        <tr className="bg-ink-50">
                          <td colSpan={5}>
                            <div className="animate-fade flex flex-wrap items-end gap-3">
                              <label className="w-72">
                                <span className="label">Physical room ({booking.type_name})</span>
                                <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="input">
                                  <option value="">Select a room</option>
                                  {rooms.map((room) => (
                                    <option key={room.room_id} value={room.room_id} disabled={room.occupied || room.room_status !== 'Available'}>
                                      {room.room_number}
                                      {room.occupied ? ' · taken for these dates' : room.room_status !== 'Available' ? ` · ${room.room_status}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button type="button" className="btn-primary" disabled={!selectedRoom || saving} onClick={() => void assign(booking)}>
                                {saving ? 'Assigning…' : 'Assign room'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nothing here">{search ? 'No booking matches the search.' : 'No bookings in this view.'}</Empty>
        )}
        {visible.length > limit && (
          <button type="button" className="btn-secondary mt-3" onClick={() => setLimit((value) => value + PAGE)}>
            Show more ({visible.length - limit} left)
          </button>
        )}
      </div>
    </main>
  );
}
