#!/usr/bin/env node
// End-to-end checks against a running app and a freshly seeded database.
//
//   ./run.sh --reset            (or load SQL/*.sql yourself) and keep it running, then:
//   node scripts/e2e.mjs [http://localhost:3000]
//
// Drives the real HTTP API with real sessions. It creates data (a test guest,
// a few bookings, a room type), so reload the sample data afterwards.

const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'Demo@1234';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

const iso = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

class Client {
  constructor() { this.cookies = new Map(); }
  async raw(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(BASE + path, { ...options, headers, redirect: 'manual' });
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      const value = pair.slice(index + 1);
      if (value) this.cookies.set(pair.slice(0, index), value);
      else this.cookies.delete(pair.slice(0, index));
    }
    return response;
  }
  async json(method, path, body) {
    const response = await this.raw(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  }
  get(path) { return this.json('GET', path); }
  post(path, body) { return this.json('POST', path, body ?? {}); }
  put(path, body) { return this.json('PUT', path, body); }
  del(path) { return this.json('DELETE', path); }
  async login(email, password = PASSWORD) {
    const { csrfToken } = await (await this.raw('/api/auth/csrf')).json();
    const response = await this.raw('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email, password, json: 'true' }),
    });
    const session = await (await this.raw('/api/auth/session')).json();
    return { ok: response.status < 400 && Boolean(session?.user), user: session?.user };
  }
  async page(path) {
    const response = await this.raw(path);
    return { status: response.status, html: response.status === 200 ? await response.text() : '', location: response.headers.get('location') };
  }
}

async function section(title, run) {
  console.log(`\n${title}`);
  try {
    await run();
  } catch (error) {
    failures.push(`${title}: ${error.message}`);
    console.log(`  FAIL ${title} threw: ${error.stack}`);
  }
}

async function main() {
  const anon = new Client();
  const guest = new Client();
  const arjun = new Client();
  const staff = new Client();
  const admin = new Client();

  await section('Public API and pages', async () => {
    let r = await anon.get(`/api/availability?check_in=${iso(40)}&check_out=${iso(42)}`);
    check('availability returns all 9 room types', r.status === 200 && r.data.results.length === 9, JSON.stringify(r.data)?.slice(0, 120));
    r = await anon.get(`/api/availability?check_in=${iso(-2)}&check_out=${iso(1)}`);
    check('availability rejects past dates', r.status === 400);
    r = await anon.get(`/api/availability?check_in=${iso(5)}&check_out=${iso(5)}`);
    check('availability rejects empty stay', r.status === 400);
    r = await anon.get(`/api/availability?check_in=${iso(10)}&check_out=${iso(12)}&room_type_id=1`);
    check('walkthrough room type is full on its nights', r.data.results[0].rooms_left === 0, JSON.stringify(r.data.results[0]));
    r = await anon.page('/hotels');
    check('/hotels renders hotels', r.status === 200 && r.html.includes('Nightingale Suites - BKC'));
    r = await anon.page('/hotels?city=Mumbai');
    check('/hotels filters by city', r.html.includes('Andheri') && !r.html.includes('Koramangala'));
    r = await anon.page('/hotels/3');
    check('hotel page shows Mongo amenities', r.status === 200 && r.html.includes('valet parking'));
    r = await anon.page('/hotels/999');
    check('unknown hotel is a 404', r.status === 404);
    r = await anon.page('/my-bookings');
    check('guest page redirects anonymous users to login', r.status === 307 && r.location.includes('/login'));
    r = await anon.page('/admin');
    check('admin page redirects anonymous users to login', r.status === 307);
  });

  await section('Authentication and authorisation', async () => {
    check('guest login works', (await arjun.login('arjun.mehta@example.com')).ok);
    check('wrong password is refused', !(await new Client().login('arjun.mehta@example.com', 'nope')).ok);
    const s = await staff.login('staff.koramangala@example.com');
    check('staff login carries hotel scope', s.ok && s.user.hotelId === 1 && s.user.role === 'Staff');
    check('admin login works', (await admin.login('admin@example.com')).ok);

    check('anonymous booking is 401', (await anon.post('/api/bookings', {})).status === 401);
    check('guest cannot read staff bookings', (await arjun.get('/api/staff/bookings')).status === 403);
    check('staff cannot use admin API', (await staff.get('/api/admin/hotels')).status === 403);
    check('guest cannot use admin API', (await arjun.get('/api/admin/reports/overbooked')).status === 403);
    check('staff cannot book', (await staff.post('/api/bookings', { room_type_id: 1 })).status === 403);
    let r = await arjun.page('/admin');
    check('guest is bounced off /admin', r.status === 307 && r.location.includes('/my-bookings'));

    r = await new Client().post('/api/auth/register', { first_name: 'Test', last_name: 'Guest', email: 'staff.bkc@example.com', password: 'longenough' });
    check('cannot register with a staff email', r.status === 409);
    r = await new Client().post('/api/auth/register', { first_name: 'Test', last_name: 'Guest', email: 'arjun.mehta@example.com', password: 'longenough' });
    check('cannot register a duplicate email', r.status === 409);
    r = await new Client().post('/api/auth/register', { first_name: 'T', last_name: 'G', email: 'bad', password: 'x' });
    check('registration validates input', r.status === 400);
    r = await guest.post('/api/auth/register', { first_name: 'Test', last_name: 'Guest', email: `e2e${Date.now()}@example.com`, password: 'longenough', phone: '' });
    check('registration succeeds', r.status === 201, JSON.stringify(r.data));
    check('new guest can log in', (await guest.login(r.data.email, 'longenough')).ok);
  });

  let suiteBooking;
  await section('Booking, payment and cancellation (guest)', async () => {
    const stay = { room_type_id: 3, check_in_date: iso(50), check_out_date: iso(52), num_guests: 2, special_requests: 'High floor' };
    let r = await guest.post('/api/bookings', stay);
    check('suite booking is CONFIRMED', r.status === 201 && r.data.status === 'CONFIRMED', JSON.stringify(r.data));
    check('total is price x nights', r.data.total_amount === 18000);
    suiteBooking = r.data.booking_id;

    r = await guest.post('/api/bookings', { ...stay, check_in_date: iso(-1) });
    check('past check-in is rejected', r.status === 400);
    r = await guest.post('/api/bookings', { ...stay, num_guests: 9 });
    check('too many guests rejected', r.status === 400);
    r = await guest.post('/api/bookings', { ...stay, room_type_id: 9999 });
    check('unknown room type is 404', r.status === 404);
    r = await guest.post('/api/bookings', { ...stay, check_out_date: iso(50) });
    check('empty stay rejected', r.status === 400);

    r = await guest.get('/api/bookings/mine');
    const mine = r.data.find((b) => b.booking_id === suiteBooking);
    check('booking appears in My bookings with request text', mine?.special_requests === 'High floor' && mine.stay_phase === 'Upcoming');
    check('guests only see their own bookings', r.data.every((b) => b.email.startsWith('e2e')));

    r = await arjun.post('/api/payments', { booking_id: suiteBooking, payment_method: 'Card' });
    check("cannot pay someone else's booking", r.status === 404);
    r = await guest.post('/api/payments', { booking_id: suiteBooking, payment_method: 'Bitcoin' });
    check('unknown payment method rejected', r.status === 400);
    r = await guest.post('/api/payments', { booking_id: suiteBooking, payment_method: 'UPI' });
    check('payment amount comes from the booking', r.status === 201 && r.data.amount === 18000);
    r = await guest.post('/api/payments', { booking_id: suiteBooking, payment_method: 'UPI' });
    check('second payment is refused', r.status === 409 && r.data.error.code === 'ALREADY_PAID');

    const racing = await Promise.all([1, 2, 3].map(() => guest.post('/api/payments', { booking_id: suiteBooking, payment_method: 'Card' })));
    check('parallel payments never double-charge', racing.every((p) => p.status === 409));

    r = await arjun.post(`/api/bookings/${suiteBooking}/cancel`, {});
    check("cannot cancel someone else's booking", r.status === 404);
    r = await guest.post(`/api/bookings/${suiteBooking}/cancel`, { reason: 'e2e' });
    check('cancel succeeds', r.status === 200);
    r = await guest.post(`/api/bookings/${suiteBooking}/cancel`, {});
    check('second cancel is refused', r.status === 409);
    r = await guest.post('/api/payments', { booking_id: suiteBooking, payment_method: 'Card' });
    check('cancelled booking cannot be paid', r.status === 409);
    r = await guest.get('/api/bookings/mine');
    const cancelled = r.data.find((b) => b.booking_id === suiteBooking);
    check('payment was refunded', cancelled.booking_status === 'Cancelled' && cancelled.payment_status === 'Refunded');
    r = await arjun.post('/api/bookings/1/cancel', {});
    check('a started or finished stay cannot be cancelled', r.status === 409, JSON.stringify(r.data));
  });

  await section('Overbooking, waitlist and FIFO promotion', async () => {
    // Seed state: Koramangala Standard has 5 rooms + 1 buffer, all 6 sold for today+10..+12.
    const stay = { room_type_id: 1, check_in_date: iso(10), check_out_date: iso(12), num_guests: 1 };
    const waiter1 = new Client();
    const waiter2 = new Client();
    for (const [client, n] of [[waiter1, 1], [waiter2, 2]]) {
      const email = `wait${n}${Date.now()}@example.com`;
      await client.post('/api/auth/register', { first_name: `Wait${n}`, last_name: 'Lister', email, password: 'longenough' });
      await client.login(email, 'longenough');
    }
    let r = await waiter1.post('/api/bookings', stay);
    check('first extra guest is WAITLISTED', r.data.status === 'WAITLISTED', JSON.stringify(r.data));
    const w1 = r.data.booking_id;
    r = await waiter2.post('/api/bookings', stay);
    check('second extra guest is WAITLISTED', r.data.status === 'WAITLISTED');
    const w2 = r.data.booking_id;

    r = await admin.get('/api/admin/reports/overbooked');
    check('overbooked report lists buffer bookings', r.status === 200 && r.data.length >= 2);

    // Seed: Divya (guest 8) has been waiting since the sample data was loaded, so she is
    // first in line. Arjun's cancellation frees exactly one slot, and it goes to her.
    const divya = new Client();
    await divya.login('divya.menon@example.com');
    const status = async (c, id) => (await c.get('/api/bookings/mine')).data.find((b) => b.booking_id === id);
    const divyaBooking = (await divya.get('/api/bookings/mine')).data.find((b) => b.booking_status === 'Waitlisted' && b.room_type_id === 1);
    check('seed leaves Divya waitlisted', Boolean(divyaBooking));

    r = await arjun.post('/api/bookings/11/cancel', {});
    check('arjun cancels his paid booking', r.status === 200);
    check('oldest waitlisted guest (Divya) is promoted', (await status(divya, divyaBooking.booking_id)).booking_status === 'Confirmed');
    check('later waiters keep waiting', (await status(waiter1, w1)).booking_status === 'Waitlisted' && (await status(waiter2, w2)).booking_status === 'Waitlisted');
    check('cancelled paid booking was refunded and room released',
      (await status(arjun, 11)).payment_status === 'Refunded' && (await status(arjun, 11)).room_number === null);

    // Next cancellation (Rohan, booking 13): the following guest in line gets it, FIFO.
    const rohan = new Client();
    await rohan.login('rohan.kulkarni@example.com');
    r = await rohan.post('/api/bookings/13/cancel', {});
    check('second cancellation succeeds', r.status === 200);
    check('FIFO: waiter1 (older) is promoted before waiter2', (await status(waiter1, w1)).booking_status === 'Confirmed' && (await status(waiter2, w2)).booking_status === 'Waitlisted');

    r = await waiter2.post(`/api/bookings/${w2}/cancel`, {});
    check('a waitlisted guest can cancel', r.status === 200);
  });

  await section('A new guest booking reaches the right front desk immediately', async () => {
    const bkcStaff = new Client();
    await bkcStaff.login('staff.bkc@example.com');
    const before = (await bkcStaff.get('/api/staff/bookings')).data.bookings.length;
    const koraBefore = (await staff.get('/api/staff/bookings')).data.bookings.length;
    const visitor = new Client();
    const email = `desk${Date.now()}@example.com`;
    await visitor.post('/api/auth/register', { first_name: 'Desk', last_name: 'Check', email, password: 'longenough' });
    await visitor.login(email, 'longenough');
    let r = await visitor.post('/api/bookings', { room_type_id: 7, check_in_date: iso(3), check_out_date: iso(5), num_guests: 2 });
    check('guest books a BKC Standard room', r.status === 201 && r.data.status === 'CONFIRMED', JSON.stringify(r.data));
    const id = r.data.booking_id;
    r = await bkcStaff.get('/api/staff/bookings');
    const seen = r.data.bookings.find((b) => b.booking_id === id);
    check('BKC front desk sees it right away', r.data.bookings.length === before + 1 && seen?.first_name === 'Desk' && seen.stay_phase === 'Upcoming' && seen.payment_status === null);
    check('Koramangala front desk does not (wrong hotel)', (await staff.get('/api/staff/bookings')).data.bookings.length === koraBefore);
    await visitor.post('/api/payments', { booking_id: id, payment_method: 'UPI' });
    r = await bkcStaff.get('/api/staff/bookings');
    check('payment shows on the desk too', r.data.bookings.find((b) => b.booking_id === id).payment_status === 'Completed');
    r = await visitor.post(`/api/bookings/${id}/cancel`, {});
    r = await bkcStaff.get('/api/staff/bookings');
    check('cancellation shows on the desk as refunded', r.data.bookings.find((b) => b.booking_id === id).booking_status === 'Cancelled' && r.data.bookings.find((b) => b.booking_id === id).payment_status === 'Refunded');
  });

  await section('Staff front desk', async () => {
    let r = await staff.get('/api/staff/bookings');
    check('staff sees only their hotel', r.status === 200 && r.data.hotel.hotel_id === 1 && r.data.bookings.every((b) => b.hotel_id === 1));
    const today = r.data.today;
    const arrivals = r.data.bookings.filter((b) => b.check_in_date === today && b.booking_status === 'Confirmed');
    check('arrivals today exist (paid, unpaid, assigned)', arrivals.length === 3, `got ${arrivals.length}`);
    const unpaid = arrivals.find((b) => !b.payment_status);
    const paid = arrivals.find((b) => b.payment_status === 'Completed' && !b.room_number);

    r = await staff.get(`/api/staff/rooms?booking_id=${paid.booking_id}`);
    check('room list is limited to the booked type', r.status === 200 && r.data.length === 5 && r.data.some((x) => x.occupied));
    const occupied = r.data.find((x) => x.occupied);
    const free = r.data.find((x) => !x.occupied);

    const unpaidRooms = (await staff.get(`/api/staff/rooms?booking_id=${unpaid.booking_id}`)).data;
    r = await staff.post('/api/staff/assign-room', { booking_id: unpaid.booking_id, room_id: unpaidRooms[0].room_id });
    check('unpaid booking cannot be assigned a room (trigger)', r.status === 409 && /Payment/.test(r.data.error.message), JSON.stringify(r.data));
    r = await staff.post('/api/staff/assign-room', { booking_id: paid.booking_id, room_id: occupied.room_id });
    check('overlapping assignment is refused (trigger)', r.status === 409 && /overlapping/.test(r.data.error.message), JSON.stringify(r.data));
    r = await staff.post('/api/staff/assign-room', { booking_id: paid.booking_id, room_id: 12 });
    check("another hotel's room is forbidden", r.status === 403);
    r = await staff.post('/api/staff/assign-room', { booking_id: paid.booking_id, room_id: 6 });
    check('wrong room type is refused (trigger)', r.status === 409 && /room type/.test(r.data.error.message), JSON.stringify(r.data));
    r = await staff.post('/api/staff/assign-room', { booking_id: paid.booking_id, room_id: free.room_id });
    check('valid assignment succeeds', r.status === 201, JSON.stringify(r.data));
    r = await staff.post('/api/staff/assign-room', { booking_id: paid.booking_id, room_id: free.room_id });
    check('a booking cannot get a second room', r.status === 409);

    r = await staff.get('/api/staff/bookings?hotel_id=2');
    check('staff cannot peek at another hotel via hotel_id', r.data.hotel.hotel_id === 1);
    r = await admin.get('/api/staff/bookings?hotel_id=2');
    check('admin can inspect any hotel', r.status === 200 && r.data.hotel.hotel_id === 2);
    r = await staff.page('/staff');
    check('/staff renders for staff', r.status === 200);
  });

  await section('Admin control plane', async () => {
    let r = await admin.get('/api/admin/hotels');
    check('admin lists 3 hotels and a franchise', r.status === 200 && r.data.hotels.length === 3 && r.data.franchises.length === 1);
    r = await admin.post('/api/admin/hotels', { franchise_id: 1, hotel_name: 'E2E Hotel', city: 'Pune', star_rating: 7 });
    check('star rating above 5 is rejected', r.status === 400);
    r = await admin.post('/api/admin/hotels', { franchise_id: 1, hotel_name: 'E2E Hotel', city: 'Pune', star_rating: 3 });
    check('hotel is created', r.status === 201, JSON.stringify(r.data));
    const hotelId = r.data.hotel_id;
    r = await admin.post('/api/admin/hotels', { franchise_id: 1, hotel_name: 'E2E Hotel', city: 'Pune', star_rating: 3 });
    check('duplicate hotel name in a city is a 409', r.status === 409);
    r = await admin.get(`/api/admin/hotels/${hotelId}/features`);
    check('Mongo document was created with the hotel', r.status === 200 && r.data.hotel_id === hotelId);

    r = await admin.post('/api/admin/room-types', { hotel_id: hotelId, type_name: 'Standard', base_price: 2500, max_occupancy: 2, total_rooms: 3 });
    check('room type is created with physical rooms', r.status === 201, JSON.stringify(r.data));
    const rtId = r.data.room_type_id;
    r = await admin.get(`/api/admin/room-types?hotel_id=${hotelId}`);
    check('3 physical rooms exist', r.data[0].physical_room_count === 3);
    r = await admin.put('/api/admin/room-types', { room_type_id: rtId, type_name: 'Standard', base_price: 2600, max_occupancy: 2, total_rooms: 2 });
    check('shrinking removes the extra room', r.status === 200);
    r = await admin.get(`/api/admin/room-types?hotel_id=${hotelId}`);
    check('room count follows total_rooms', r.data[0].physical_room_count === 2 && r.data[0].total_rooms === 2);
    r = await admin.put(`/api/admin/overbooking-policy/${rtId}`, { overbook_percentage: 51 });
    check('policy above 50% rejected', r.status === 400);
    r = await admin.put(`/api/admin/overbooking-policy/${rtId}`, { overbook_percentage: 50 });
    check('policy saved', r.status === 200);
    r = await admin.put('/api/admin/room-types', { room_type_id: 1, type_name: 'Standard', base_price: 3500, max_occupancy: 2, total_rooms: 1 });
    check('cannot shrink below upcoming bookings', r.status === 409, JSON.stringify(r.data));
    r = await admin.del(`/api/admin/room-types?room_type_id=1`);
    check('room type with bookings cannot be deleted', r.status === 409);
    r = await admin.del(`/api/admin/hotels?hotel_id=1`);
    check('hotel with bookings cannot be deleted', r.status === 409);
    r = await admin.del(`/api/admin/hotels?hotel_id=${hotelId}`);
    check('empty hotel can be deleted', r.status === 200);

    r = await admin.put('/api/admin/hotels/1/features', { amenities: { general: ['free wifi'], wellness: [], policies: { pet_friendly: true } }, room_type_features: { Suite: { bathtub: true } } });
    check('amenities are saved to Mongo', r.status === 200);
    r = await admin.get('/api/admin/hotels/1/features');
    check('amenities read back', r.data.amenities.policies.pet_friendly === true && r.data.room_type_features.Suite.bathtub === true);
    r = await admin.put('/api/admin/hotels/1/features', { amenities: 'nope' });
    check('malformed amenities rejected', r.status === 400);
    r = await admin.get('/api/admin/reports/amenities');
    check('amenity aggregation returns city rows', r.status === 200 && r.data.length > 0 && r.data.every((x) => x.city && x.amenity && x.hotels_offering >= 1));

    r = await admin.post('/api/admin/reports/inventory', { days: 14 });
    check('plan recompute returns 14 days', r.status === 200 && r.data.days.length === 14, JSON.stringify(r.data)?.slice(0, 100));
    check('physical capacity is flat, ceiling moves', new Set(r.data.days.map((d) => d.physical_rooms)).size === 1 && new Set(r.data.days.map((d) => d.max_sellable_rooms)).size > 1);
    check('ceiling is never below physical rooms', r.data.days.every((d) => d.max_sellable_rooms >= d.physical_rooms));
    r = await admin.get('/api/admin/reports/inventory?hotel_id=1&days=7');
    check('reading the plan is a plain GET', r.status === 200 && r.data.days.length === 7);
    r = await admin.get('/api/admin/reports/inventory?days=3');
    check('days out of range rejected', r.status === 400);

    for (const path of ['/admin', '/my-bookings']) {
      const page = await admin.page(path);
      check(`${path} for admin`, path === '/admin' ? page.status === 200 : page.status === 307);
    }
  });

  await section('Pages for a signed-in guest', async () => {
    let r = await arjun.page('/my-bookings');
    check('/my-bookings renders', r.status === 200);
    r = await arjun.page(`/book/2?check_in=${iso(20)}&check_out=${iso(22)}&guests=2`);
    check('booking page renders', r.status === 200 && r.html.includes('Reserve') && r.html.includes('Deluxe'));
    r = await arjun.page(`/book/2?check_in=2020-01-01&check_out=2020-01-03`);
    check('past dates on the URL fall back to defaults', r.status === 200 && !r.html.includes('value="2020-01-01"'));
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
