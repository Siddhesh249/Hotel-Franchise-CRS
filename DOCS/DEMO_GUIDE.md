# Demo & Presentation Guide

This is the run sheet for presenting the **Hotel Franchise Central Reservation
System (CRS)**. It covers setup, the exact demo flow, what to click, what to say,
the SQL evidence to show, and an exhaustive test checklist.

The project is a DBMS course project. The interesting part is not the CRUD
screens — it is that the accept / overbook / waitlist decision is made **inside
MariaDB**, under row locks, and that a second database (MongoDB) holds
schema-flexible hotel amenities.

---

## 1. Before you present

### 1.1 One-command setup

From the repository root:

```bash
./run.sh
```

The script:

1. asks for `sudo` once,
2. starts MariaDB and MongoDB,
3. creates `.env.local` if needed and generates `AUTH_SECRET`,
4. creates the `hotel_crs_app` database user,
5. loads the schema + sample data if the database is empty,
6. seeds MongoDB amenity documents,
7. installs Node dependencies if needed,
8. starts Next.js and opens `http://localhost:3000`.

`run.sh` keeps running in the foreground while the dev server is up. Press
**Ctrl+C** to stop both; it terminates the Next.js process group it started.
MariaDB and MongoDB keep running as system services.

For a **clean demo database every time**:

```bash
./run.sh --reset
```

`--reset` drops and reloads `hotel_crs`. Do **not** use it after you have created
your own bookings if you want to keep them.

Useful flags:

```bash
./run.sh --no-browser
./run.sh --port 3001
```

### 1.2 Demo accounts

Every seeded account uses the password `Demo@1234`.

| Role | Email | Scope |
|---|---|---|
| Guest | `arjun.mehta@example.com` | Books and manages their own stays |
| Guest | `priya.nair@example.com` | Second guest for cancellation flow |
| Staff | `staff.koramangala@example.com` | Koramangala property only |
| Staff | `staff.andheri@example.com` | Andheri property only |
| Staff | `staff.whitefield@example.com` | Whitefield property only |
| Staff | `staff.hitech@example.com` | Hitech City property only |
| Staff | `staff.bkc@example.com` | BKC property only |
| Staff | `staff.aerocity@example.com` | Aerocity property only |
| Admin | `admin@example.com` | Franchise-wide |

The login page has one-click buttons that fill the guest/staff/admin demo
credentials.

### 1.3 Sample data already in the database

After a fresh seed:

- 6 hotels: **Koramangala** and **Whitefield** (Bengaluru), **Andheri** and
  **BKC** (Mumbai), **Hitech City** (Hyderabad), and **Aerocity** (Delhi).
- 3 room types per hotel: Standard, Deluxe, Suite (18 room types total).
- 100 physical rooms across the franchise.
- 20 guests and 7 staff/admin accounts.
- Bookings around **today’s real date** (not fixed historical dates).
- A paid + assigned Andheri booking, a paid + unassigned booking, and a
  pending-payment booking so the staff desk has different states to show.
- A Koramangala Standard stay that already exercises the overbooking buffer.
- A patterned three-week demand wave. It creates a deliberately uneven nightly
  ledger so the adaptive chart visibly oscillates: an under-booked night raises
  the next night’s sellable ceiling, and an over-booked night lowers it. The
  wave skips today/tomorrow for Koramangala and Andheri so the scripted
  overbooking/waitlist walkthrough below stays intact.

### 1.4 Quick health check

```bash
curl -s http://localhost:3000/api/hotels | head
curl -s "http://localhost:3000/api/availability?city=Bengaluru&check_in=$(date -d '+2 days' +%F)&check_out=$(date -d '+4 days' +%F)&guests=2" | head
```

If the app is up, both return JSON.

---

## 2. What the system does (30-second explanation)

- A booking is for a **room type**, never a specific room. The physical room is
  attached later at check-in. This is what makes overbooking possible.
- There are **two capacity layers**:
  1. **Soft layer** — `overbooking_policy` + `room_type_inventory` allow a room
     type to sell a few extra rooms (the buffer), and the decision is made under
     `SELECT ... FOR UPDATE` so two guests cannot take the same last room.
  2. **Hard layer** — `trg_prevent_room_double_assignment` refuses to put two
     overlapping bookings into the same physical room.
- A guest who cannot fit is **waitlisted**. When a booking is cancelled, the
  oldest waitlisted booking for that room type is promoted automatically (FIFO).
- MongoDB stores each hotel’s flexible amenities document — a genuinely
  schema-less part of the data model, not a duplicate of SQL rows.

---

## 3. The demo flow (recommended order, 12–18 minutes)

### Part A — Public site and search (2 minutes)

1. Open `http://localhost:3000`.
2. Point out the navigation: **Hotels**, **My bookings** (after sign-in),
   **Staff desk**, **Admin**, and the user menu.
3. Use the hero search: pick a city, dates, guests, click **Find rooms**.
4. On `/hotels`, show:
   - live rooms-left per room type,
   - “from ₹…” price,
   - amenity chips from MongoDB.
5. Open a hotel. Show:
   - room types and rates,
   - availability for every night of the stay,
   - amenities and room-type features,
   - the three possible booking outcomes explained on the page.

**Say:** “Availability is the minimum across every night in the stay, not just
the first night.”

---

### Part B — Create a guest and book through the UI (3 minutes)

1. Click **Create account**.
2. Register a new guest, e.g. `demo.<timestamp>@example.com` / `Demo@1234`.
3. The app signs you in and sends you to **My bookings**.
4. Go to **Hotels**, choose a room, and book dates a few weeks out.
5. Show the booking outcome panel:
   - **Confirmed** — normal case.
   - **Confirmed · buffer** — accepted using the overbooking buffer.
   - **Waitlisted** — no capacity; FIFO queue.
6. Open **My bookings**. Show the booking card, status badge, total, and
   payment state.
7. Click **Pay now**, choose a method, and pay. Point out that the amount is
   fixed by the server, not editable by the browser.

**Say:** “Payments are simulated, but the API never trusts a client-supplied
amount — it always reads `booking.total_amount`.”

---

### Part C — The overbooking core (5 minutes) — the main event

Use a **controlled future date** so the result is deterministic. Let’s use
`CURDATE() + 90 days`, Koramangala Standard (`room_type_id = 1`).

The numbers:

- physical rooms = **5**
- overbooking policy = **20%**
- buffer = `FLOOR(5 × 20 / 100)` = **1 room**
- max sellable = **6 rooms**

#### C1. Run the bookings in SQL

Open a terminal:

```bash
sudo mariadb hotel_crs
```

Then:

```sql
SET @d1 = DATE_ADD(CURDATE(), INTERVAL 90 DAY);
SET @d2 = DATE_ADD(@d1, INTERVAL 2 DAY);

CALL sp_create_booking(1, 1, @d1, @d2, 1, @b1, @s1);
CALL sp_create_booking(2, 1, @d1, @d2, 1, @b2, @s2);
CALL sp_create_booking(3, 1, @d1, @d2, 1, @b3, @s3);
CALL sp_create_booking(4, 1, @d1, @d2, 1, @b4, @s4);
CALL sp_create_booking(5, 1, @d1, @d2, 1, @b5, @s5);
CALL sp_create_booking(6, 1, @d1, @d2, 1, @b6, @s6);
CALL sp_create_booking(7, 1, @d1, @d2, 1, @b7, @s7);

SELECT @b1 AS booking_id, @s1 AS outcome
UNION ALL SELECT @b2, @s2
UNION ALL SELECT @b3, @s3
UNION ALL SELECT @b4, @s4
UNION ALL SELECT @b5, @s5
UNION ALL SELECT @b6, @s6
UNION ALL SELECT @b7, @s7;
```

Expected:

| Booking | Outcome | Why |
|---|---|---|
| 1–5 | `CONFIRMED` | physical rooms |
| 6 | `CONFIRMED_OVERBOOKED` | takes the 1-room buffer |
| 7 | `WAITLISTED` | no capacity left |

Show the ledger:

```sql
SELECT stay_date, booked_count
FROM room_type_inventory
WHERE room_type_id = 1
  AND stay_date BETWEEN @d1 AND DATE_SUB(@d2, INTERVAL 1 DAY);
```

Expected: `6` booked on each night.

Show the statuses and the `is_overbooked` flag:

```sql
SELECT booking_id, booking_status, is_overbooked, check_in_date, check_out_date
FROM booking
WHERE booking_id IN (@b1, @b2, @b3, @b4, @b5, @b6, @b7)
ORDER BY booking_id;
```

**Say:** “The 6th booking is not a bug — it is the soft buffer. The row lock on
`room_type_inventory` is what prevents two concurrent guests from both taking
the last room.”

#### C2. Cancel and watch FIFO promotion

Cancel booking 2:

```sql
CALL sp_cancel_booking(@b2, 'Demo cancellation');
```

Then:

```sql
SELECT booking_id, booking_status, is_overbooked
FROM booking
WHERE booking_id IN (@b2, @b7);
```

Expected:

- `@b2` → `Cancelled`
- `@b7` → `Confirmed` (promoted from the waitlist)
- The ledger stays at 6 booked rooms because the cancellation freed one and the
  promoted booking immediately consumed it.

**Say:** “Cancellation frees a ledger row, then `sp_cancel_booking` asks
`sp_try_promote_waitlist` for the oldest matching waitlisted booking. That is
FIFO, not LIFO and not random.”

#### C3. Show the hard physical guard

The trigger only fires at **room assignment** time. Try to put two overlapping
bookings into the same physical room.

First assign a room to booking 1:

```sql
SELECT room_id, room_number FROM room WHERE room_type_id = 1 ORDER BY room_id;
INSERT INTO room_assignment (booking_id, room_id) VALUES (@b1, 1); -- room 101
```

Now try to assign an overlapping booking to the same room:

```sql
INSERT INTO room_assignment (booking_id, room_id) VALUES (@b3, 1);
```

Expected:

```
ERROR 1644 (45000): Room already assigned for overlapping dates - physical capacity conflict.
```

**Say:** “The soft layer can overbook; the hard layer can never double-book a
physical room. The API catches SQLSTATE 45000 and returns a clean 409 to staff.”

#### C4. Clean up the demo bookings (optional)

```sql
CALL sp_cancel_booking(@b1, 'Demo cleanup');
CALL sp_cancel_booking(@b3, 'Demo cleanup');
CALL sp_cancel_booking(@b4, 'Demo cleanup');
CALL sp_cancel_booking(@b5, 'Demo cleanup');
CALL sp_cancel_booking(@b6, 'Demo cleanup');
CALL sp_cancel_booking(@b7, 'Demo cleanup');
DELETE FROM booking WHERE booking_id BETWEEN @b1 AND @b7;
DELETE FROM room_type_inventory
WHERE room_type_id = 1
  AND stay_date BETWEEN @d1 AND DATE_SUB(@d2, INTERVAL 1 DAY);
```

You do not have to clean up during a live demo; this is only if you want the
database back to its starting state.

---

### Part D — Guest portal: payment, cancellation, refunds (2 minutes)

1. Sign in as `arjun.mehta@example.com` / `Demo@1234`.
2. Open **My bookings**.
3. Show:
   - status badges (Confirmed / buffer / Waitlisted / Cancelled),
   - payment state,
   - room assignment if staff has assigned one,
   - total, nights, guests, special requests.
4. Pay a confirmed booking. Show:
   - the **Pay now** panel,
   - the amount is fixed,
   - after payment, the status becomes **Paid**.
5. Cancel an active paid booking:
   - booking becomes **Cancelled**,
   - payment becomes **Refunded**,
   - the room assignment is released,
   - `cancellation_history` records the refund amount.

SQL evidence:

```sql
SELECT b.booking_id, b.booking_status,
       p.payment_status, p.amount,
       ch.cancellation_reason, ch.refund_amount
FROM booking b
LEFT JOIN payment p ON p.booking_id = b.booking_id
LEFT JOIN cancellation_history ch ON ch.booking_id = b.booking_id
WHERE b.guest_id = 1
ORDER BY b.booking_id DESC;
```

**Say:** “Cancelling a booking is not a delete. It is a status change plus an
audit row, and the room is released.”

---

### Part E — Staff desk: payment gate, room assignment, trigger (3 minutes)

1. Sign in as `staff.koramangala@example.com` / `Demo@1234`.
2. Point out:
   - the hotel name is fixed by the staff session,
   - today’s arrivals, in-house, upcoming, all bookings,
   - search,
   - **payment pending** badges.
3. Find a booking with **Payment pending**. Show that **Assign room** is not
   available. If you call the API directly, it returns 409 `PAYMENT_REQUIRED`.
4. Pay that booking as the guest (or use a paid booking from sample data).
5. Back as staff, click **Assign room**:
   - the dropdown lists only rooms of the booked room type,
   - occupied rooms are disabled,
   - the assignment succeeds.
6. Try to assign the same room to another overlapping booking:
   - the API returns 409,
   - the UI shows “already occupied for these dates”, not a raw SQL error.
7. Sign in as `staff.andheri@example.com` and show that they cannot see
   Koramangala bookings.

**Say:** “The server enforces the hotel scope; the UI is not the security
boundary.”

---

### Part F — Admin control plane (4 minutes)

Sign in as `admin@example.com` / `Demo@1234`.

#### F1. Catalog

- Show hotels and room types.
- Create a room type. Point out that physical room rows are created
  automatically so staff can assign them immediately.
- Edit a hotel or room type.
- Try deleting a hotel with bookings: the API returns a clean 409 instead of a
  raw SQL error.

#### F2. Overbooking control

- Show the per-room-type **base** buffer percentage.
- For Koramangala Standard: 5 rooms, 20% → base buffer
  `FLOOR(5 × 20 / 100)` = **1 room**.
- Change the percentage and show the **effective base buffer** calculation.
- Important talking point: `FLOOR` is used, so a small percentage on a small
  room type can round down to zero. Example: 15% of 6 rooms = 0.9 → 0 rooms.
  This is why changing 15% → 1% on a 6-room category may not change the
  baseline number. The UI shows `floor(rooms × percent) = base buffer`.
- Explain the two layers:
  - the admin percentage sets the **base** buffer and the maximum possible
    daily adjustment;
  - `fn_dynamic_buffer_rooms()` then adapts each night inside `0..2 × base`
    using the previous night’s hotel occupancy.
- For Koramangala Standard (base 1), the daily buffer can swing between 0 and
  2. The UI labels both values so the automatic part is visible without hiding
  the admin control.

#### F3. Amenities (MongoDB)

- Choose a hotel.
- Add general amenities (chips), wellness amenities, policy fields
  (pet-friendly, check-in/out times), and per-room-type features.
- Save, then open the public hotel page and show the amenities.
- Emphasise: no JSON editing is required; the API still stores one flexible
  MongoDB document per hotel.

#### F4. Inventory chart

- Open **Inventory chart**.
- Select all hotels or one hotel.
- Show the three series:
  - **Physical rooms** — flat line/bar, because capacity is constant.
  - **Max sellable** — physical + the **adaptive daily buffer**. It moves
    because the database looks at yesterday’s hotel occupancy: an under-booked
    night raises today’s ceiling, an over-booked night lowers it.
  - **Booked** — varies per day from the nightly ledger.
- Point at the summary cards: **Adaptive buffer (today)** and **Max sellable
  (today)** are today’s values; **Peak max sellable** is the highest adaptive
  ceiling in the selected range. The difference between base and peak is the
  automatic part.
- Change the base percentage, return to the chart, and show the whole adaptive
  band shift (subject to the floor rule). The day-to-day oscillation is driven
  by demand, not by re-editing the percentage.
- Scroll the table for each day’s base buffer, adaptive buffer (with its `+`/`−`
  adjustment), max sellable, booked, and remaining values.

#### F5. Reports

- **Overbooked bookings** — every confirmed booking currently relying on the
  buffer.
- **Amenities by city** — the MongoDB aggregation (`$unwind` + `$group`).
- Mention this is the required NoSQL advanced-feature deliverable.

---

## 4. The overbooking logic in detail (for questions/viva)

### 4.1 Why room type, not room?

A booking promises a **category**. The physical room is assigned later. If a
booking held a specific room from the start, the hotel could never oversell,
and the whole buffer/waitlist mechanism would be pointless.

### 4.2 The soft layer

Tables:

- `overbooking_policy(room_type_id, overbook_percentage)`
- `room_type_inventory(room_type_id, stay_date, booked_count)`

For a stay, `sp_create_booking`:

1. creates a ledger row for every night (`INSERT IGNORE`),
2. locks every affected night with `SELECT ... FOR UPDATE`,
3. computes the tightest night’s remaining capacity:
   `MIN((total_rooms + buffer) - booked_count)`,
4. confirms, confirms-overbooked, or waitlists.

The lock is the important part: two concurrent guests cannot both read “1 room
left” and both confirm. MariaDB serialises them.

### 4.3 The hard layer

`trg_prevent_room_double_assignment` runs before every `room_assignment` insert.
It looks for another **confirmed/checked-in** booking in the same room whose
dates overlap. If found, it raises `SQLSTATE 45000`.

The API translates that into a human 409. The raw SQL error never reaches the
browser.

### 4.4 Waitlist promotion

`sp_cancel_booking`:

1. decrements the ledger for a confirmed stay,
2. marks the booking `Cancelled`,
3. writes `cancellation_history` and refunds completed payments,
4. deletes the room assignment (releases the physical room),
5. picks the **oldest** matching `Waitlisted` booking,
6. calls `sp_try_promote_waitlist`, which re-runs the lock-and-check logic.

This is FIFO promotion and is fully inside the database.

### 4.5 The three outcomes

| API status | DB status | Meaning |
|---|---|---|
| `CONFIRMED` | `Confirmed` | Within physical capacity |
| `CONFIRMED_OVERBOOKED` | `Confirmed`, `is_overbooked = 1` | Uses the buffer |
| `WAITLISTED` | `Waitlisted` | No capacity; FIFO queue |

The UI shows these distinctly. This is deliberate: the most important output of
the booking flow is not “success”, it is **which kind of success**.

---

## 5. Exhaustive test checklist

Use this as a QA checklist before the presentation.

### Authentication & authorization

- [ ] Register a new guest with a valid email/password.
- [ ] Registration rejects an email already used by a guest.
- [ ] Registration rejects an email used by a staff/admin account.
- [ ] Login with guest, both staff accounts, and admin.
- [ ] After login, each role lands on the right portal.
- [ ] Anonymous `/my-bookings` redirects to `/login?callbackUrl=/my-bookings`.
- [ ] Anonymous `/staff` and `/admin` redirect to login.
- [ ] A guest cannot open `/staff` or `/admin`.
- [ ] Staff cannot open `/admin`.
- [ ] Guest API calls with no session return 401.
- [ ] Wrong-role API calls return 403.
- [ ] A guest cannot cancel or pay for another guest’s booking.
- [ ] Staff cannot read another hotel’s bookings.
- [ ] Staff cannot assign a room outside their hotel.
- [ ] Admin can inspect any hotel’s staff desk but cannot assign rooms there.

### Public site

- [ ] Landing page search works.
- [ ] City filter works.
- [ ] Date range validation: checkout must be after check-in.
- [ ] Hotel listing shows live availability.
- [ ] Hotel detail shows amenities, room features, rates, and availability.
- [ ] Sold-out room types show “Sold out” and cannot be booked.
- [ ] Search with more guests than a room sleeps hides that room type.

### Booking

- [ ] Book a normal room → `CONFIRMED`.
- [ ] Fill capacity and book one more → `CONFIRMED_OVERBOOKED`.
- [ ] Book beyond buffer → `WAITLISTED`.
- [ ] Invalid room type → 404.
- [ ] Guest count above `max_occupancy` → 400.
- [ ] Checkout before/equal check-in → 400.
- [ ] Special requests are saved and visible in My bookings/staff desk.
- [ ] Price total = nights × base price.

### Payments

- [ ] Pay a confirmed booking.
- [ ] Payment amount is server-side and cannot be tampered with.
- [ ] Paying twice is rejected.
- [ ] Paying a waitlisted booking is rejected.
- [ ] Paying a cancelled booking is rejected.
- [ ] Payment appears in My bookings and staff desk.
- [ ] Cancelling a paid booking marks the payment `Refunded` and records the
      refund amount.

### Cancellation and waitlist

- [ ] Cancel an active booking → status `Cancelled`.
- [ ] Cancelling a paid booking refunds it.
- [ ] Cancelling a booking with an assigned room releases the room.
- [ ] Cancelling a confirmed booking promotes the oldest waitlisted booking.
- [ ] The promoted booking shows `Confirmed` and `is_overbooked = 1` when it
      lands in the buffer.
- [ ] Cancelling an already-cancelled booking is rejected cleanly.
- [ ] Cancelling another guest’s booking is forbidden.

### Staff desk

- [ ] Arrivals view shows today’s check-ins.
- [ ] In-house, upcoming, and all-bookings filters work.
- [ ] Search by guest, email, booking id, or room type.
- [ ] Payment-pending bookings cannot be assigned.
- [ ] Only rooms of the booked room type are listed.
- [ ] Occupied rooms are disabled.
- [ ] Correct assignment succeeds and shows the room number.
- [ ] Double-assignment attempt returns a clean 409.
- [ ] Wrong room-type assignment is rejected.
- [ ] Wrong hotel assignment is rejected.
- [ ] Admin hotel selector works; assign controls are hidden for admin.

### Admin

- [ ] Create/edit hotel.
- [ ] Duplicate hotel name/city is rejected.
- [ ] Delete a hotel with bookings returns 409.
- [ ] Create/edit room type.
- [ ] Creating a room type creates its physical rooms.
- [ ] “Create rooms” fills missing physical rooms.
- [ ] Deleting a room type with bookings returns 409.
- [ ] Change overbooking percentage; base buffer/max sellable recalculate.
- [ ] Structured amenities editor adds/removes general/wellness/policies/features.
- [ ] Saved amenities appear on the public hotel page.
- [ ] Inventory chart shows physical vs adaptive max sellable vs booked per day.
- [ ] After an under-booked night, the next day’s max sellable rises; after an
      over-booked night, it falls (select a single hotel to see this clearly).
- [ ] The per-day table shows base buffer, adaptive buffer with `+`/`−`
      adjustment, max sellable, booked, and remaining.
- [ ] Overbooked report lists buffer bookings.
- [ ] Amenities-by-city report is generated by MongoDB aggregation.
- [ ] Reports stay correct after new bookings/cancellations.

### Database integrity

- [ ] `vw_roomtype_overview` shows capacity, buffer, max sellable.
- [ ] `room_type_inventory.booked_count` never goes negative.
- [ ] The double-assignment trigger fires on overlapping dates.
- [ ] The trigger does **not** fire for non-overlapping dates.
- [ ] The trigger refuses assignment for a waitlisted/cancelled booking.
- [ ] Waitlist promotion is FIFO (oldest booking first).
- [ ] Deleting a booking cascades its payments/assignments/cancellation rows.

---

## 6. SQL evidence to keep in your pocket

### Capacity view

```sql
SELECT hotel_name, type_name, total_rooms, overbook_percentage,
       overbook_buffer_rooms, max_sellable_rooms
FROM vw_roomtype_overview
ORDER BY hotel_name, type_name;
```

### Adaptive daily plan (the chart’s source)

```sql
-- Refresh first, then inspect. Physical stays flat; buffer/max move.
CALL sp_refresh_inventory_plan(CURRENT_DATE, 14);

SELECT h.hotel_name, p.stay_date,
       p.physical_rooms,
       p.base_buffer_rooms,
       p.buffer_rooms,
       p.max_sellable_rooms,
       p.booked_rooms
FROM daily_inventory_plan p
JOIN hotel h ON h.hotel_id = p.hotel_id
ORDER BY h.hotel_name, p.stay_date;
```

### Nightly ledger

```sql
SELECT rt.type_name, i.stay_date, i.booked_count
FROM room_type_inventory i
JOIN room_type rt ON rt.room_type_id = i.room_type_id
ORDER BY i.stay_date, rt.type_name;
```

### Currently overbooked bookings

```sql
SELECT b.booking_id, g.first_name, g.last_name, rt.type_name,
       h.hotel_name, b.check_in_date, b.check_out_date, b.booking_status
FROM booking b
JOIN guest g ON g.guest_id = b.guest_id
JOIN room_type rt ON rt.room_type_id = b.room_type_id
JOIN hotel h ON h.hotel_id = rt.hotel_id
WHERE b.is_overbooked = TRUE
  AND b.booking_status IN ('Confirmed', 'CheckedIn')
ORDER BY b.check_in_date;
```

### Waitlist queue

```sql
SELECT b.booking_id, g.first_name, g.last_name, rt.type_name,
       b.check_in_date, b.check_out_date, b.booking_date
FROM booking b
JOIN guest g ON g.guest_id = b.guest_id
JOIN room_type rt ON rt.room_type_id = b.room_type_id
WHERE b.booking_status = 'Waitlisted'
ORDER BY b.booking_date ASC;
```

### Cancellation/refund audit

```sql
SELECT ch.cancellation_id, ch.booking_id, ch.cancelled_on,
       ch.cancellation_reason, ch.refund_amount,
       p.payment_status, p.amount
FROM cancellation_history ch
LEFT JOIN payment p ON p.booking_id = ch.booking_id
ORDER BY ch.cancellation_id DESC;
```

### Physical assignments

```sql
SELECT ra.assignment_id, ra.booking_id, r.room_number, r.floor_number,
       b.check_in_date, b.check_out_date, b.booking_status
FROM room_assignment ra
JOIN room r ON r.room_id = ra.room_id
JOIN booking b ON b.booking_id = ra.booking_id
ORDER BY r.room_number;
```

---

## 7. Adaptive overbooking — what is implemented

The admin screen exposes a **base buffer percentage** per room type. That is the
policy input. The database then adapts the buffer per night:

- base buffer = `FLOOR(total_rooms × overbook_percentage / 100)`;
- previous night under the hotel’s physical capacity → tomorrow’s buffer grows
  in proportion to the empty rooms;
- previous night above physical capacity → tomorrow’s buffer shrinks in
  proportion to the oversell;
- the adjustment is capped at `± base buffer`, so the daily buffer stays within
  `0 .. 2 × base` and can never invert or run away;
- a night with no previous-day ledger rows falls back to the base buffer.

`fn_dynamic_buffer_rooms()` implements this once. `fn_available_rooms()`,
`sp_create_booking()`, and `sp_try_promote_waitlist()` all call it, so the
public availability answer, the booking decision, and the admin chart cannot
drift apart. `daily_inventory_plan` is only a materialised read model for the
chart; the API refreshes it on every request.

This is still a **demand-feedback policy**, not a forecasting model. A stronger
future version could replace the occupancy signal with cancellation/no-show
rates, lead time, seasonality, and competitor pricing, while keeping the same
admin cap and the same per-night plan table. The current version is fully
implemented and testable; do not describe it as a placeholder.

The chart is the evidence: physical capacity is flat, max sellable moves
opposite to the previous night’s occupancy, and booked is the actual nightly
demand.

---

## 8. Troubleshooting

### Login fails

- Confirm the database was seeded with `SQL/hotel_crs_dml.sql`.
- Demo password is `Demo@1234` (case-sensitive).
- If you reset the database, all seeded hashes are restored.
- Check `.env.local` has the correct `DB_PASSWORD` and `AUTH_SECRET`.

### App starts but data is empty

```bash
./run.sh --reset
```

This reloads the sample schema and data.

### MongoDB amenities do not appear

```bash
systemctl status mongod
mongosh --quiet --eval "db.getSiblingDB('hotel_crs').hotel_features.countDocuments()"
```

The app falls back to SQL-only mode if Mongo is unavailable; amenities and the
amenities-by-city report will be empty.

### Port already in use

```bash
./run.sh --port 3001
```

### “Room already occupied for these dates”

That is the hard constraint doing its job. Pick another room or another stay.

### “Payment must be completed before a room can be assigned”

Pay the booking from the guest portal first. This is intentional: the staff desk
cannot assign a room against an unpaid stay.

### I want to keep my own bookings but refresh sample data

Run `./run.sh` without `--reset` to keep existing data. Use `--reset` only when
you want a clean demo database.
