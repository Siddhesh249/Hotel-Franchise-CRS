# Hotel Franchise Central Reservation System

A central reservation system for a hotel franchise, with an **overbooking engine** and an automatic **FIFO waitlist**.
The transactional core lives in **MariaDB** (tables, views, stored procedures, triggers). Flexible per-hotel amenity
documents live in **MongoDB**. A **Next.js** app provides the guest, front-desk and admin interfaces.

DBMS course project. Payments are simulated.

- [Quick start](#quick-start)
- [Manual setup](#manual-setup)
- [Project layout](#project-layout)
- [Testing](#testing)
- [Architecture and design](#architecture-and-design)
- [Worked examples and useful queries](#worked-examples-and-useful-queries)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Requirements: Node.js 20+, npm, MariaDB 10.6+ (developed on 11.8), MongoDB, `mongosh`, and `sudo`.

```bash
./run.sh            # start services, load the sample data if the database is empty, run the app
./run.sh --reset    # drop and reload the sample data first
./run.sh --port 3001
```

`run.sh` starts MariaDB and MongoDB with `systemctl`, creates `.env.local` (with a generated `AUTH_SECRET` and database
password), loads the schema and sample data, creates the `hotel_crs_app` database user, seeds the MongoDB amenity
documents, installs dependencies and starts `npm run dev`. Open <http://localhost:3000>.

### Demo accounts

Every seeded account uses the password `Demo@1234`. The login page has one-click buttons for the first three.

| Role | Email | Notes |
|---|---|---|
| Guest | `arjun.mehta@example.com` | has a paid, room-assigned upcoming booking |
| Staff | `staff.koramangala@example.com` | front desk of hotel 1 (Koramangala) |
| Admin | `admin@example.com` | franchise-wide |
| Guest | `divya.menon@example.com` | is on a waitlist |
| Staff | `staff.andheri@example.com`, `staff.bkc@example.com` | the other two hotels |

Other guests: `priya.nair`, `rohan.kulkarni`, `sneha.iyer`, `karan.singh`, `ananya.rao`, `vikram.joshi`, `aditya.verma`,
`neha.kapoor` (all `@example.com`).

---

## Manual setup

1. Start the databases and install dependencies.

   ```bash
   sudo systemctl enable --now mariadb mongod
   npm install
   ```

2. Load the schema and sample data. **This drops and recreates `hotel_crs`.**

   ```bash
   sudo mariadb < SQL/hotel_crs_ddl.sql
   sudo mariadb < SQL/hotel_crs_dml.sql
   ```

3. Create the application database user (use your own password; it must match `.env.local`).

   ```bash
   sudo mariadb <<'SQL'
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'127.0.0.1' IDENTIFIED BY 'choose-a-strong-password';
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO 'hotel_crs_app'@'127.0.0.1';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO 'hotel_crs_app'@'localhost';
   FLUSH PRIVILEGES;
   SQL
   ```

4. Seed the MongoDB amenity documents (safe to re-run).

   ```bash
   mongosh "mongodb://127.0.0.1:27017/hotel_crs" --file mongo/hotel_features_seed.js
   ```

5. Create `.env.local` from the template, then fill in `DB_PASSWORD` and `AUTH_SECRET` (`openssl rand -base64 32`).

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Meaning |
   |---|---|
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | MariaDB connection (the app user from step 3) |
   | `MONGODB_URI`, `MONGODB_DB` | MongoDB connection and database name |
   | `AUTH_SECRET` | signs the session JWT |
   | `NEXTAUTH_URL` | public URL of the app |

6. Run it: `npm run dev`. For a production build use `npm run build && npm start`.

---

## Project layout

```text
SQL/hotel_crs_ddl.sql          schema, views, functions, procedures, triggers (drops + recreates hotel_crs)
SQL/hotel_crs_dml.sql          sample data, dated relative to the day it is loaded
mongo/hotel_features_seed.js   the hotel_features collection (one document per hotel)
scripts/verify-db.sh           database invariants + concurrency stress test
scripts/e2e.mjs                end-to-end HTTP tests against the running app
docs/diagrams/                 ER diagram (Graphviz) and schema (dbdiagram.io DBML)
docs/FUNCTIONAL_REQUIREMENTS.odt   the numbered functional requirements
src/app/                       pages and API route handlers (App Router)
src/components/                client components for each screen
src/lib/                       db pools, auth, availability, helpers
run.sh                         one-command local setup
```

---

## Testing

```bash
npx tsc --noEmit && npm run lint        # types and lint

./scripts/verify-db.sh                  # reloads the sample data (set MARIADB="sudo mariadb" if needed)
node scripts/e2e.mjs http://localhost:3000   # with the app running on freshly seeded data
```

`verify-db.sh` checks the seed, the procedures' outcome codes and these invariants after a parallel stress test
(12 sessions racing for 2 suites, parallel cancels of one booking, parallel assignments of one room):

- the nightly ledger equals the count of active bookings covering each night;
- no room is assigned to two overlapping stays;
- at most one live payment per booking;
- rooms are only assigned to confirmed, paid bookings;
- no night is sold beyond `total_rooms + 2 × base buffer`.

`e2e.mjs` drives the real HTTP API with real sessions (about 95 checks): authentication and role boundaries, booking /
payment / cancellation rules, the waitlist and FIFO promotion, the front desk and its trigger refusals, the admin
control plane, the MongoDB aggregation and the page guards. It creates data, so reload the sample data afterwards.

---

## Architecture and design

### System overview

```text
 Browser ──► Next.js (App Router)
              ├─ pages (server components)       ──┐
              ├─ /api route handlers (role-checked) ├──► MariaDB   bookings, inventory, payments, accounts
              └─ Auth.js credentials + JWT        ──┘ └─► MongoDB   hotel_features (amenities, policies, room features)
```

**Why two databases.** Reservations need transactions, foreign keys, locking and constraints, so they live in
MariaDB. Amenities are different for every hotel (a spa, a butler service, a pet policy, a late-checkout rule) and
change often; that is a natural fit for one schemaless document per hotel. The two are joined in the application by
`hotel_id`, and a missing MongoDB only hides amenities; booking keeps working.

**Where logic lives.** Everything that must stay correct under concurrency (accept, overbook or waitlist; cancel and
refund; promote the waitlist; take a payment; attach a physical room) is a stored procedure or trigger in MariaDB. The
API layer authenticates the caller, validates input, calls the procedure and maps its outcome code to an HTTP response.
It never makes the decision itself, so no client can bypass the rules.

### Data model

`docs/diagrams/` has the ER diagram (`er_diagram_code.dot`, Graphviz) and the schema (`schema_diagram_code.dbml`,
paste into dbdiagram.io).

| Table | Purpose |
|---|---|
| `franchise` → `hotel` → `room_type` → `room` | containment hierarchy; `room_type.total_rooms` is the physical inventory of a category |
| `guest`, `staff_account` | the two kinds of login (staff are `Staff` for one hotel, or `Admin` franchise-wide) |
| `overbooking_policy` | optional row per room type: the base overbooking percentage (0 to 50) |
| `room_type_inventory` | **the nightly ledger**: one row per (room type, night) holding the number of active bookings |
| `daily_inventory_plan` | derived per-hotel/night figures for the admin chart (rebuilt by a procedure) |
| `booking` | a reservation for a room *type* and a date range; status `Confirmed`, `Waitlisted` or `Cancelled` |
| `room_assignment` | which *physical room* a confirmed booking ends up in (at most one per booking) |
| `payment`, `cancellation_history` | money in, and the audit row (with refund amount) for a cancellation |

Views: `vw_roomtype_overview` (static capacity and base buffer per room type) and `vw_booking_details` (one denormalised
row per booking with guest, hotel, payment, assigned room, and derived `stay_phase`, `is_open` and `cancellable`
columns; the guest and staff screens read it).

Constraints worth pointing out:

- **Composite foreign key** `room (room_type_id, hotel_id) → room_type (room_type_id, hotel_id)`. `room.hotel_id` is
  technically redundant; it exists so "room numbers are unique per building" is a plain `UNIQUE (hotel_id, room_number)`.
  The composite key guarantees the copy can never disagree with the room type.
- **One live payment per booking** without a partial index: `payment.live_booking_id` is a generated column equal to
  `booking_id` while the payment is `Completed` and `NULL` otherwise, with a `UNIQUE` key on it (MariaDB allows many NULLs).
- **Staff scope** (`Admin` has no hotel, `Staff` has exactly one) is enforced by triggers, because MariaDB rejects a
  `CHECK` over a column used in an `ON UPDATE CASCADE` foreign key.
- `ON DELETE CASCADE` down the hierarchy; `RESTRICT` from bookings to guests and room types, so a hotel or room type with
  bookings cannot be deleted from under them.
- `CHECK`s on dates, prices, ratings (1 to 5), occupancy, percentages (0 to 50) and non-negative counters.

### The booking model: a type is promised, a room is assigned later

A booking never names a physical room. It reserves one unit of a **room type** for every night of the stay, tracked in
`room_type_inventory`. The front desk picks the physical room later (`room_assignment`). That gap is what makes
overbooking possible: a hotel can promise more rooms of a type than it has, because most guests cancel or shift, and
resolve the difference at the desk.

### Two layers of protection

| Layer | Where | What it allows | What it forbids |
|---|---|---|---|
| **Soft** (reservations) | `sp_create_booking`, ledger rows | selling up to `total_rooms + buffer` per night | anything beyond the buffer: the guest is waitlisted |
| **Hard** (physical rooms) | trigger on `room_assignment` | nothing beyond physical capacity | two overlapping stays in one room, ever |

### The buffer and the adaptive rule

The **base buffer** of a room type is `FLOOR(total_rooms × overbook_percentage / 100)`. It is a per-category knob the
admin sets; small categories round down (3 rooms at 10% gives 0).

`fn_dynamic_buffer_rooms(room_type, night)` then **adapts it to demand**, using the hotel-wide occupancy of the *previous
night* as the signal:

```text
physical  = total_rooms summed over the hotel's room types
booked    = bookings covering the previous night (whole hotel)
adjust    = +CEIL((physical − booked) × base / physical)   if booked < physical   (slack → sell more)
          = −CEIL((booked − physical) × base / physical)   if booked > physical   (over-full → be careful)
adjust    is clamped to ±base;   buffer = MAX(0, base + adjust)
no ledger rows for the previous night (no signal yet) → buffer = base
```

Worked example, Koramangala (physical 11; Standard 5 rooms at 20% → base 1):

| Previous night booked | Adjustment | Buffer for tonight | Standard sellable |
|---|---|---|---|
| 1 | `+CEIL(10 × 1 / 11)` = +1 | 2 | 7 |
| 11 | 0 | 1 | 6 |
| 13 | `−CEIL(2 × 1 / 11)` = −1 | 0 | 5 |

The same function feeds the availability search, the booking procedures and the admin chart (through
`daily_inventory_plan`), so they cannot drift apart. `fn_available_rooms(room_type, night)` is
`total_rooms + buffer − booked`; a stay's availability is the **minimum** over its nights.

### How a booking is decided (`sp_create_booking`)

1. Validate: future dates, 1 to 60 nights, the guest exists, the party fits the room type. Each failure returns a
   distinct outcome code (`INVALID_DATES`, `INVALID_GUEST`, `INVALID_ROOM_TYPE`, `INVALID_GUESTS`).
2. `START TRANSACTION`, then `SELECT … FOR UPDATE` on the **room type row**. Concurrent bookings of the same category
   queue here.
3. Insert missing ledger rows for each night (`INSERT IGNORE`), then
   `SELECT MIN(total + buffer − booked), MIN(total − booked) … FOR UPDATE` over the stay. This finds the tightest
   night and locks every night at once.
4. If the tightest night has `≥ 1` left: insert the booking as `Confirmed` and add one to every night. If the *physical*
   minimum is `< 1` the booking is flagged `is_overbooked` and the outcome is `CONFIRMED_OVERBOOKED`; otherwise
   `CONFIRMED`. If nothing is left the booking is inserted as `Waitlisted` (`WAITLISTED`) with no ledger change.
5. `COMMIT`.

The decision is made while holding the locks, so two guests can never both receive the last room. Lock order is always
`room_type → booking → ledger`, so concurrent callers wait for each other instead of deadlocking.

### Cancellation, refunds and the waitlist

`sp_cancel_booking(booking, guest, reason, OUT status)` locks the room type and the booking, then:
refuses if it is unknown or not the caller's (`NOT_FOUND`), already cancelled (`ALREADY_CANCELLED`) or already started
(`STAY_STARTED`); otherwise releases one unit on each night (confirmed bookings only), refunds any completed payment
(payment becomes `Refunded`, the amount is written to `cancellation_history`), deletes the room assignment, and
commits. Afterwards `sp_promote_waitlist(room_type)` walks that category's waitlist **oldest first** and calls
`sp_try_promote_waitlist` for each. A waitlisted booking whose dates still do not fit is skipped rather than blocking
the guests behind it, and one cancellation can promote several waiters if it freed enough nights.

### Payments (`sp_record_payment`)

Simulated gateway. The procedure locks the booking, checks that it belongs to the caller, is `Confirmed` and has not
ended, takes the **amount from the booking itself** (a client cannot choose it) and inserts a `Completed` payment. A
second attempt returns `ALREADY_PAID`, and the unique `live_booking_id` key backs that up at the storage level.

### Assigning a physical room (the hard layer)

`trg_prevent_room_double_assignment` runs before every insert into `room_assignment` and refuses, with a readable
message, unless: the booking is `Confirmed`, the stay is not over, the room is of the booked room type, the room is
`Available`, the booking has a completed payment, and no other confirmed booking holds that room on overlapping dates.
It locks the room row first so concurrent assignments of the same room are serialised.

**Why payment gates room assignment.** Handing out a key is the point of no return for the hotel, so it requires
payment, and putting the rule in the trigger means it holds for every client. The staff screen shows "Awaiting payment"
instead of a button.

### Booking lifecycle

The stored status is only `Confirmed`, `Waitlisted` or `Cancelled`. Where the stay *is* in time is derived from the
dates by the `vw_booking_details` view (`stay_phase` = `Upcoming`, `Current`, `Past`), so nothing has to run at
midnight to update rows, and past stays show as **Completed** rather than as stale confirmations. A booking whose
check-in date has passed can no longer be cancelled or promoted from the waitlist, and payment closes when the stay ends.

### MongoDB: `hotel_features`

One document per hotel, keyed by `hotel_id` (unique index):

```js
{
  hotel_id: 3,
  amenities: {
    general: ["free wifi", "valet parking", "concierge"],
    wellness: ["spa", "pool", "gym"],
    policies: { pet_friendly: true, check_in_time: "14:00", late_checkout_available: true }
  },
  room_type_features: {                       // keyed by room type name
    Suite: { bed: "king", private_lounge: true, butler_service: true }
  }
}
```

Hotels deliberately describe themselves differently, which is the reason for a document store. The public pages merge
this with the SQL rows; the admin "Amenities" tab edits it. The **amenity report** is a MongoDB aggregation
(`$project` + `$concatArrays`, `$unwind`, `$group` with `$addToSet`) that counts how many hotels offer each amenity; the
API then joins it with `hotel.city` from MariaDB to group by city.

### Authentication and authorisation

Auth.js (NextAuth v5), credentials provider, bcrypt (cost 12), JWT session. A login is looked up in `guest` first and
then `staff_account`. The token carries `{ sub, actorType, role, hotelId }`; `hotelId` is set only for hotel staff.

| Where | What is checked |
|---|---|
| Pages (`requirePageRole`) | anonymous users go to `/login?callbackUrl=…`; a wrong role goes to its own home |
| API handlers (`requireRole`) | `401` without a session, `403` for the wrong role, before any database access |
| Ownership | guests can only touch their own bookings; the procedures take the guest id and answer `NOT_FOUND` for someone else's |
| Hotel scope | staff queries use `session.hotelId`, never a client-supplied id; admins may inspect any hotel read-only |
| Registration | refuses an email that already belongs to a staff account, so nobody can shadow a staff login |

All API errors have the shape `{ "error": { "code": "…", "message": "…" } }`.

### API map

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/availability` | public | rooms left per room type for a stay |
| `POST /api/auth/register`, `/api/auth/*` | public | sign up; Auth.js endpoints |
| `POST /api/bookings` | guest | `sp_create_booking`; returns `CONFIRMED`, `CONFIRMED_OVERBOOKED` or `WAITLISTED` |
| `GET /api/bookings/mine` | guest | own bookings from `vw_booking_details` |
| `POST /api/bookings/[id]/cancel` | guest | `sp_cancel_booking` (refund + FIFO promotion) |
| `POST /api/payments` | guest | `sp_record_payment` |
| `GET /api/staff/bookings` | staff (admin read-only) | the hotel's bookings and today's date |
| `GET /api/staff/rooms` | staff | rooms of the booked type, with the ones taken for the dates |
| `POST /api/staff/assign-room` | staff | insert into `room_assignment` (the trigger decides) |
| `/api/admin/hotels` | admin | hotel CRUD (also creates or deletes the Mongo document) |
| `/api/admin/room-types` | admin | room-type CRUD; changing the room count adds or removes physical rooms |
| `PUT /api/admin/overbooking-policy/[roomTypeId]` | admin | base buffer percentage |
| `GET/PUT /api/admin/hotels/[id]/features` | admin | the MongoDB document |
| `GET/POST /api/admin/reports/inventory` | admin | read the stored daily plan / recompute it |
| `GET /api/admin/reports/overbooked`, `…/amenities` | admin | buffer-reliant bookings (SQL); amenities by city (Mongo aggregation) |

### Screens

| Route | Audience | Notes |
|---|---|---|
| `/hotels`, `/hotels/[id]` | public | search by city, dates and guests; live availability; amenities from MongoDB |
| `/book/[roomTypeId]` | guest | live "rooms left" as dates change; shows the exact outcome |
| `/my-bookings` | guest | Upcoming, Waitlist, Past and cancelled; pay and cancel |
| `/staff` | staff, admin (read-only) | tabs for arriving today, in house, upcoming, waitlist, history; room assignment |
| `/admin` | admin | Catalog, Overbooking, Amenities, Inventory plan (chart), Reports |

### Design decisions and trade-offs

- **Decisions in the database.** The accept/overbook/waitlist decision is a stored procedure so that row locks, not
  application timing, decide who gets the last room. The price is that logic is in SQL; the benefit is that it is
  testable with plain SQL and impossible to bypass.
- **One lock per room type.** Bookings of one category are serialised by locking its `room_type` row; categories do not
  block each other. This removes lock-upgrade deadlocks seen when many sessions first-touch the same ledger rows.
- **Adaptive buffer reads a neighbouring night.** Selling more on the night after a quiet one is a heuristic, not a
  forecast. Because it looks at another night, lowering a night's buffer later can leave it above its new ceiling; the
  hard layer, not the buffer, is what guarantees no physical room is ever double-booked.
- **Derived plan table.** `daily_inventory_plan` is a cache of `fn_dynamic_buffer_rooms` for the chart; it is rebuilt
  when the admin opens the Inventory tab. Reading it never writes.
- **Full refund on cancellation.** There is no refund policy by notice period; the point is the audit trail.
- **No check-in or check-out flow.** Statuses beyond confirmed/waitlisted/cancelled would need a front-desk workflow
  that was out of scope, so a past stay is simply shown as completed.
- **Seed history is inserted directly.** The engine refuses to book a night that already started, so the few past stays
  in the sample data are inserted with plain `INSERT`s and their ledger rows rebuilt from them.
- **Sessions are JWTs.** A role change does not take effect until the user signs in again (up to 7 days).

---

## Worked examples and useful queries

### The overbooking walkthrough (already in the sample data)

Koramangala Standard has 5 rooms and a base buffer of 1. For the nights `today+10` to `today+12`:

| Guest | Result |
|---|---|
| 1 to 5 | `CONFIRMED` |
| 6 | `CONFIRMED_OVERBOOKED` (uses the buffer) |
| 7 | `WAITLISTED` |
| guest 2 cancels (paid, so refunded) | guest 7 is promoted automatically |
| guest 8 asks next | `WAITLISTED` (now first in line) |

```sql
SELECT booking_id, guest_id, booking_status, is_overbooked, payment_status
FROM vw_booking_details
WHERE room_type_id = 1 AND check_in_date = CURRENT_DATE + INTERVAL 10 DAY ORDER BY booking_id;

SELECT * FROM cancellation_history;                       -- the refund audit row
SELECT fn_available_rooms(1, CURRENT_DATE + INTERVAL 10 DAY);   -- 0: sold out including the buffer
```

### Watch the buffer shrink

Fill Andheri (11 physical rooms) past capacity on one night (7 Standard use its 6 rooms + 1 buffer, 3 Deluxe, 2 Suite):

```sql
DELIMITER $$
BEGIN NOT ATOMIC
  DECLARE i INT DEFAULT 0;
  DECLARE d DATE DEFAULT CURRENT_DATE + INTERVAL 60 DAY;
  WHILE i < 7 DO CALL sp_create_booking(1 + i, 4, d, d + INTERVAL 1 DAY, 1, NULL, @b, @s); SET i = i + 1; END WHILE;
  SET i = 0;
  WHILE i < 3 DO CALL sp_create_booking(1 + i, 5, d, d + INTERVAL 1 DAY, 1, NULL, @b, @s); SET i = i + 1; END WHILE;
  SET i = 0;
  WHILE i < 2 DO CALL sp_create_booking(1 + i, 6, d, d + INTERVAL 1 DAY, 1, NULL, @b, @s); SET i = i + 1; END WHILE;
END$$
DELIMITER ;

SELECT fn_dynamic_buffer_rooms(4, CURRENT_DATE + INTERVAL 60 DAY) AS that_night,   -- 1 (no earlier signal)
       fn_dynamic_buffer_rooms(4, CURRENT_DATE + INTERVAL 61 DAY) AS next_night;   -- 0 (12 booked > 11 physical)
```

### The hard layer refusing a room

```sql
-- booking 14 is confirmed but unpaid; try to give it a room
INSERT INTO room_assignment (booking_id, room_id) VALUES (14, 1);
-- ERROR 1644 (45000): Payment must be completed before a room can be assigned.
```

### Evidence queries

```sql
SELECT hotel_name, type_name, total_rooms, overbook_percentage, base_buffer_rooms, base_max_sellable
FROM vw_roomtype_overview ORDER BY hotel_name, type_name;                     -- static capacity

SELECT stay_date, physical_rooms, base_buffer_rooms, buffer_rooms, max_sellable_rooms, booked_rooms
FROM daily_inventory_plan WHERE hotel_id = 1 ORDER BY stay_date LIMIT 14;      -- the adaptive plan

SELECT booking_id, hotel_name, type_name, check_in_date, booking_status
FROM vw_booking_details WHERE is_overbooked AND booking_status = 'Confirmed';  -- buffer-reliant bookings

SELECT booking_id, booking_date, check_in_date FROM booking
WHERE room_type_id = 1 AND booking_status = 'Waitlisted' ORDER BY booking_date, booking_id;   -- the FIFO queue

SELECT room_type_id, stay_date, booked_count FROM room_type_inventory
WHERE room_type_id = 1 ORDER BY stay_date;                                     -- the ledger
```

MongoDB:

```js
db.hotel_features.aggregate([
  { $project: { hotel_id: 1, a: { $concatArrays: ["$amenities.general", "$amenities.wellness"] } } },
  { $unwind: "$a" },
  { $group: { _id: "$a", hotels: { $addToSet: "$hotel_id" } } },
  { $sort: { _id: 1 } }
])
```

---

## Troubleshooting

- **Login fails for a seeded account.** The database was probably created before the sample data. Run `./run.sh --reset`.
- **Hotel pages work but amenities are missing.** MongoDB is not running or not seeded:
  `sudo systemctl start mongod` and `mongosh "$MONGODB_URI/$MONGODB_DB" --file mongo/hotel_features_seed.js`.
- **"Access denied" or `ECONNREFUSED` from the app.** `DB_PASSWORD` in `.env.local` must match the `hotel_crs_app`
  user (`run.sh` keeps them in sync).
- **"Today's arrivals" is empty.** The sample data is dated relative to the day it was loaded. Reload it with
  `./run.sh --reset`.
- **Port already in use.** `./run.sh --port 3001`.
- **A booking shows as waitlisted forever.** A waitlist entry is only promoted while its check-in date has not passed.
  After that it is labelled "Waitlist expired".
