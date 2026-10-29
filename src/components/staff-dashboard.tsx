'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import type { StaffBooking } from '@/types';

interface StaffPayload {
  hotel: { hotel_id: number; hotel_name: string; city: string; state: string | null };
  today: string;
  bookings: StaffBooking[];
}

interface RoomOption {
  room_id: number;
  room_number: string;
  floor_number: number | null;
  room_status: string;
  occupied: boolean;
  assigned_here: boolean;
}

type Filter = 'arrivals' | 'inhouse' | 'upcoming' | 'all';

export function StaffDashboard({ staffName, isAdmin = false }: { staffName: string; isAdmin?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<StaffPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('arrivals');
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [hotelOptions, setHotelOptions] = useState<Array<{ hotel_id: number; hotel_name: string }>>([]);
  const [hotelId, setHotelId] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch('/api/admin/hotels', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.hotels?.length) return;
        setHotelOptions(payload.hotels);
        setHotelId((current) => current || String(payload.hotels[0].hotel_id));
      })
      .catch(() => setError('Unable to load the hotel list.'));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const load = useCallback(async () => {
    if (isAdmin && !hotelId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const url = isAdmin ? `/api/staff/bookings?hotel_id=${hotelId}` : '/api/staff/bookings';
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login?callbackUrl=/staff');
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Unable to load the staff desk.');
        return;
      }
      setData(payload);
    } catch {
      setError('We could not reach the reservation service.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, hotelId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const today = data?.today ?? '';
  const bookings = useMemo(() => data?.bookings ?? [], [data]);

  const stats = useMemo(() => {
    const arrivals = bookings.filter((b) => b.check_in_date === today && ['Confirmed', 'CheckedIn'].includes(b.booking_status));
    const inHouse = bookings.filter((b) => b.check_in_date < today && b.check_out_date > today && ['Confirmed', 'CheckedIn'].includes(b.booking_status));
    const waitlisted = bookings.filter((b) => b.booking_status === 'Waitlisted');
    const unassigned = arrivals.filter((b) => !b.room_number);
    return { arrivals, inHouse, waitlisted, unassigned };
  }, [bookings, today]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = bookings;
    if (filter === 'arrivals') list = bookings.filter((b) => b.check_in_date === today && ['Confirmed', 'CheckedIn'].includes(b.booking_status));
    if (filter === 'inhouse') list = bookings.filter((b) => b.check_in_date <= today && b.check_out_date > today && ['Confirmed', 'CheckedIn'].includes(b.booking_status));
    if (filter === 'upcoming') list = bookings.filter((b) => b.check_in_date > today && b.booking_status === 'Confirmed');
    if (term) {
      list = list.filter((b) =>
        `${b.first_name} ${b.last_name}`.toLowerCase().includes(term)
        || b.email.toLowerCase().includes(term)
        || String(b.booking_id).includes(term)
        || b.type_name.toLowerCase().includes(term),
      );
    }
    return list;
  }, [bookings, filter, search, today]);

  async function openAssign(booking: StaffBooking) {
    if (assigningId === booking.booking_id) {
      setAssigningId(null);
      return;
    }
    setAssigningId(booking.booking_id);
    setRooms([]);
    setSelectedRoom('');
    setRoomsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/staff/rooms?booking_id=${booking.booking_id}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Unable to load rooms.');
        return;
      }
      setRooms(payload.rooms ?? []);
    } catch {
      setError('We could not load the room list.');
    } finally {
      setRoomsLoading(false);
    }
  }

  async function assign(booking: StaffBooking) {
    if (!selectedRoom) return;
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
      if (response.status === 401) {
        router.push('/login?callbackUrl=/staff');
        return;
      }
      if (!response.ok) {
        setError(payload?.error?.message ?? 'The room could not be assigned.');
        return;
      }
      setNotice(`Room ${payload.room_number} assigned to booking #${booking.booking_id}.`);
      setAssigningId(null);
      await load();
    } catch {
      setError('We could not reach the reservation service.');
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'arrivals', label: "Today's arrivals", count: stats.arrivals.length },
    { id: 'inhouse', label: 'In house', count: stats.inHouse.length },
    { id: 'upcoming', label: 'Upcoming', count: bookings.filter((b) => b.check_in_date > today && b.booking_status === 'Confirmed').length },
    { id: 'all', label: 'All bookings', count: bookings.length },
  ];

  return (
    <main className="container-page py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Staff desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {data?.hotel.hotel_name ?? 'Hotel operations'}
          </h1>
          <p className="muted mt-1">
            {data ? `${data.hotel.city}${data.hotel.state ? `, ${data.hotel.state}` : ''} · Virtual today: ${formatDate(data.today, { weekday: true })}` : 'Loading today’s arrivals…'}
          </p>
          <p className="mt-1 text-xs text-ink-500">Signed in as {staffName}</p>
          {isAdmin && (
            <p className="mt-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">
              Admin view: inspect any hotel&apos;s arrivals. Room assignment is performed by that hotel&apos;s staff account.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <label className="mr-2">
              <span className="sr-only">Hotel</span>
              <select value={hotelId} onChange={(event) => setHotelId(event.target.value)} className="input h-[38px] py-1.5 text-sm">
                {hotelOptions.length ? hotelOptions.map((hotel) => (
                  <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                )) : <option value="">Loading hotels…</option>}
              </select>
            </label>
          )}
          <button type="button" onClick={() => void load()} className="btn-secondary btn-sm">
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          <Link href="/hotels" className="btn-ghost btn-sm">View public site</Link>
        </div>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today's arrivals", value: stats.arrivals.length, icon: 'calendar' as const },
          { label: 'Awaiting a room', value: stats.unassigned.length, icon: 'bed' as const },
          { label: 'In house', value: stats.inHouse.length, icon: 'users' as const },
          { label: 'Waitlisted', value: stats.waitlisted.length, icon: 'clock' as const },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={stat.icon} size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{stat.label}</p>
              <p className="text-lg font-bold text-ink-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div className="mt-5 flex gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}
      {error && (
        <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-ink-100 bg-white p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                filter === tab.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${filter === tab.id ? 'text-ink-300' : 'text-ink-400'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guest, email, booking…"
            className="input pl-9"
            aria-label="Search bookings"
          />
        </label>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          [1, 2, 3].map((item) => <div key={item} className="skeleton h-44" />)
        ) : visible.length ? (
          visible.map((booking) => {
            const isOpen = assigningId === booking.booking_id;
            const canAssign = ['Confirmed', 'CheckedIn'].includes(booking.booking_status) && !booking.room_number;
            return (
              <article key={booking.booking_id} className="card overflow-hidden">
                <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={booking.booking_status} />
                      {booking.is_overbooked && <span className="badge-amber">Buffer</span>}
                      {booking.is_synthetic && <span className="badge-slate">Synthetic</span>}
                      {booking.room_number ? <span className="badge-brand">Room {booking.room_number}</span> : <span className="badge-rose">No room yet</span>}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">
                      {booking.first_name} {booking.last_name}
                      <span className="ml-2 text-sm font-normal text-ink-500">#{booking.booking_id}</span>
                    </h2>
                    <p className="muted">
                      {booking.type_name} · {formatDate(booking.check_in_date, { weekday: true })} → {formatDate(booking.check_out_date, { weekday: true })}
                      {' · '}{booking.num_guests} {booking.num_guests === 1 ? 'guest' : 'guests'}
                    </p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Contact</p>
                        <p className="mt-0.5 truncate text-ink-700">{booking.email}</p>
                        <p className="text-xs text-ink-500">{booking.phone || 'No phone'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Payment</p>
                        <div className="mt-0.5"><StatusBadge status={booking.payment_status ?? 'Pending'} /></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Booking total</p>
                        <p className="mt-0.5 font-semibold text-ink-800">{formatCurrency(booking.total_amount)}</p>
                      </div>
                    </div>
                    {booking.special_requests && (
                      <p className="mt-3 rounded-lg bg-sand-50 p-2.5 text-sm text-ink-700">
                        <b>Request:</b> {booking.special_requests}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
                    {canAssign && !isAdmin && (
                      <button type="button" onClick={() => void openAssign(booking)} className="btn-primary btn-sm">
                        <Icon name="bed" size={14} />
                        {isOpen ? 'Close' : 'Assign room'}
                      </button>
                    )}
                    <Link href={`/hotels/${booking.hotel_id}`} className="btn-secondary btn-sm">Hotel page</Link>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-ink-100 bg-sand-50 p-5">
                    <p className="text-sm font-semibold text-ink-800">Choose a physical room</p>
                    <p className="muted mt-1">Only rooms of this booking&apos;s type are shown. Occupied rooms are disabled.</p>
                    {roomsLoading ? (
                      <div className="skeleton mt-4 h-11 w-full max-w-sm" />
                    ) : rooms.length ? (
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <label className="w-full sm:w-72">
                          <span className="label">Room</span>
                          <select value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)} className="input">
                            <option value="">Select a room</option>
                            {rooms.map((room) => (
                              <option
                                key={room.room_id}
                                value={room.room_id}
                                disabled={room.occupied || room.room_status !== 'Available'}
                              >
                                Room {room.room_number}
                                {room.floor_number ? ` · Floor ${room.floor_number}` : ''}
                                {room.occupied ? ' · occupied for these dates' : room.room_status !== 'Available' ? ` · ${room.room_status}` : ' · available'}
                                {room.assigned_here ? ' · currently assigned' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!selectedRoom || saving}
                          onClick={() => void assign(booking)}
                          className="btn-primary"
                        >
                          {saving ? 'Assigning…' : 'Confirm assignment'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
                        No physical rooms exist for this room type yet. An admin needs to add rooms to the
                        property before staff can assign one.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="card-muted flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-ink-500">
              <Icon name="calendar" size={22} />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Nothing here right now</h3>
            <p className="muted mt-1 max-w-md">
              {filter === 'arrivals'
                ? 'There are no arrivals scheduled for the virtual date today. Check Upcoming or All bookings.'
                : 'No bookings match this view or search.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
