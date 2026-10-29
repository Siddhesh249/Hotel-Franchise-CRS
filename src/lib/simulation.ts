import pool from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type GuestRow = RowDataPacket & { guest_id: number };
type ClockRow = RowDataPacket & { virtual_now: string | Date };
type RoomTypeRow = RowDataPacket & { room_type_id: number };
type BookingRow = RowDataPacket & { booking_id: number; status?: string };

export interface ClientArchetype {
  name: string;
  roomTypePreference: string;
  stayNights: number[];
  numGuests: number;
  cancelProbability: number;
}

export const defaultArchetypes: ClientArchetype[] = [
  { name: 'budget solo', roomTypePreference: 'Standard', stayNights: [1, 2], numGuests: 1, cancelProbability: 0.1 },
  { name: 'weekend couple', roomTypePreference: 'Deluxe', stayNights: [2, 3], numGuests: 2, cancelProbability: 0.07 },
];

type State = { running: boolean; bookingsPerVirtualHour: number; archetypes: ClientArchetype[]; timer: ReturnType<typeof setInterval> | null; lastVirtualNow: Date | null; bookingCredit: number };
const globalState = globalThis as typeof globalThis & { __hotelCrsSimulation?: State };
const state: State = globalState.__hotelCrsSimulation ?? { running: false, bookingsPerVirtualHour: 2, archetypes: defaultArchetypes, timer: null, lastVirtualNow: null, bookingCredit: 0 };
globalState.__hotelCrsSimulation = state;

const dateSql = (date: Date) => date.toISOString().slice(0, 10);
const choose = <T>(values: T[]) => values[Math.floor(Math.random() * values.length)];

export function validateArchetypes(value: unknown): ClientArchetype[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const parsed = value.map((item) => {
    if (typeof item !== 'object' || item === null) return null;
    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const preference = typeof candidate.roomTypePreference === 'string' ? candidate.roomTypePreference.trim() : '';
    const stays = Array.isArray(candidate.stayNights) ? candidate.stayNights.map(Number).filter((night) => Number.isInteger(night) && night >= 1 && night <= 30) : [];
    const guests = Number(candidate.numGuests);
    const probability = Number(candidate.cancelProbability);
    return name && preference && stays.length && Number.isInteger(guests) && guests >= 1 && guests <= 20 && Number.isFinite(probability) && probability >= 0 && probability <= 1
      ? { name, roomTypePreference: preference, stayNights: [...new Set(stays)], numGuests: guests, cancelProbability: probability } : null;
  });
  return parsed.every(Boolean) ? parsed as ClientArchetype[] : null;
}

async function getSyntheticGuest() {
  const [guests] = await pool.query<GuestRow[]>('SELECT guest_id FROM guest WHERE is_synthetic = TRUE ORDER BY guest_id LIMIT 1');
  if (guests.length) return guests[0].guest_id;
  const token = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO guest (first_name, last_name, email, phone, address, password_hash, is_synthetic) VALUES (?, ?, ?, ?, ?, ?, TRUE)', ['Simulation', 'Guest', `simulation-${token}@example.invalid`, '0000000000', 'Synthetic traffic', 'simulation-only']);
  return Number(result.insertId);
}

export async function spawnOne(archetypeName?: string) {
  const archetype = archetypeName ? state.archetypes.find((item) => item.name === archetypeName) : choose(state.archetypes);
  if (!archetype) throw new Error('Unknown simulation archetype');
  const [clockRows] = await pool.query<ClockRow[]>('SELECT virtual_now FROM sim_clock WHERE clock_id = 1');
  const [roomTypes] = await pool.execute<RoomTypeRow[]>('SELECT room_type_id FROM room_type WHERE type_name = ? ORDER BY room_type_id', [archetype.roomTypePreference]);
  if (!clockRows.length || !roomTypes.length) throw new Error(`No room type named “${archetype.roomTypePreference}” exists`);
  const checkIn = new Date(clockRows[0].virtual_now);
  checkIn.setUTCDate(checkIn.getUTCDate() + 1 + Math.floor(Math.random() * 7));
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + choose(archetype.stayNights));
  const conn = await pool.getConnection();
  try {
    const guestId = await getSyntheticGuest();
    await conn.query('CALL sp_create_booking(?, ?, ?, ?, ?, @booking_id, @status)', [guestId, choose(roomTypes).room_type_id, dateSql(checkIn), dateSql(checkOut), archetype.numGuests]);
    const [result] = await conn.query<BookingRow[]>('SELECT @booking_id AS booking_id, @status AS status');
    return { archetype: archetype.name, ...result[0] };
  } finally { conn.release(); }
}

async function cancelSyntheticBookings() {
  for (const archetype of state.archetypes) {
    if (Math.random() > archetype.cancelProbability) continue;
    const [bookings] = await pool.query<BookingRow[]>(`SELECT b.booking_id FROM booking b JOIN guest g ON g.guest_id = b.guest_id JOIN room_type rt ON rt.room_type_id = b.room_type_id WHERE g.is_synthetic = TRUE AND rt.type_name = ? AND b.booking_status IN ('Confirmed', 'Waitlisted') ORDER BY b.booking_date LIMIT 1`, [archetype.roomTypePreference]);
    if (bookings.length) await pool.query('CALL sp_cancel_booking(?, ?)', [bookings[0].booking_id, 'Simulation cancellation']);
  }
}

async function cycle() {
  if (!state.running) return;
  try {
    const [rows] = await pool.query<ClockRow[]>('SELECT virtual_now FROM sim_clock WHERE clock_id = 1');
    if (!rows.length) return;
    const now = new Date(rows[0].virtual_now);
    if (state.lastVirtualNow) state.bookingCredit += Math.max(0, now.valueOf() - state.lastVirtualNow.valueOf()) / 3_600_000 * state.bookingsPerVirtualHour;
    state.lastVirtualNow = now;
    while (state.bookingCredit >= 1) { state.bookingCredit -= 1; await spawnOne(); }
    await cancelSyntheticBookings();
  } catch { /* A transient database error should not kill an admin-started demo. */ }
}

export function snapshot() {
  return { running: state.running, bookings_per_virtual_hour: state.bookingsPerVirtualHour, archetypes: state.archetypes };
}

export function start() {
  if (!state.running) {
    state.running = true;
    state.lastVirtualNow = null;
    state.timer = setInterval(() => { void cycle(); }, 1000);
  }
  return snapshot();
}

export function stop() {
  state.running = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  return snapshot();
}

export function configure(archetypes: ClientArchetype[], rate: number) {
  state.archetypes = archetypes;
  state.bookingsPerVirtualHour = rate;
  state.bookingCredit = 0;
  return snapshot();
}

export async function clearSyntheticData() {
  const [bookings] = await pool.query<BookingRow[]>('SELECT b.booking_id FROM booking b JOIN guest g ON g.guest_id = b.guest_id WHERE g.is_synthetic = TRUE AND b.booking_status NOT IN (\'Cancelled\', \'CheckedOut\', \'NoShow\')');
  for (const booking of bookings) await pool.query('CALL sp_cancel_booking(?, ?)', [booking.booking_id, 'Simulation reset']);
  await pool.query('DELETE b FROM booking b JOIN guest g ON g.guest_id = b.guest_id WHERE g.is_synthetic = TRUE');
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM guest WHERE is_synthetic = TRUE');
  return Number(result.affectedRows ?? 0);
}
