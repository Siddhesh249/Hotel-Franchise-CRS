# Hotel Franchise CRS with Overbooking Logic

DBMS course project. A hotel franchise central reservation system with a
two-layer overbooking/waitlist engine, built on **MariaDB** (transactional core)
and **MongoDB** (flexible per-hotel amenity documents), with a Next.js
application providing public, guest, staff, and admin experiences.

There is no virtual clock and no synthetic traffic engine. The application uses
real calendar dates, and the demo data lives in the database so you can create
your own account, make real bookings, and then inspect them in the staff and
admin consoles.

## Reference documents

Read in this order:

1. **`ARCHITECTURE.md`** — the high-level and low-level design: schema, the
   overbooking engine, authentication, API route map, and frontend page map.
2. **`FUNCTIONAL_REQUIREMENTS.odt`** — the numbered functional requirements
   (`FR-xxx`) the system must satisfy.
3. **`IMPLEMENTATION_PHASES.md`** — the build order and phase boundaries.
4. **`DEMO_GUIDE.md`** — the presentation run sheet, overbooking walkthrough,
   SQL evidence, and exhaustive test checklist.
5. This file — project summary, setup, and how to run it.

## What exists

The relational core — schema, the overbooking/waitlist engine, and sample data —
is built and is **not** being redesigned:

- `hotel_crs_ddl.sql` — `franchise → hotel → room_type → room` hierarchy,
  `booking` / `room_assignment` / `payment` / `cancellation_history`, the
  `overbooking_policy` + `room_type_inventory` buffer mechanism, the adaptive
  daily plan (`daily_inventory_plan`, `fn_dynamic_buffer_rooms()`),
  `fn_available_rooms()`, the overbooking procedures (`sp_create_booking`,
  `sp_cancel_booking`, `sp_try_promote_waitlist`,
  `sp_refresh_hotel_inventory_plan`), and the
  `trg_prevent_room_double_assignment` hard-constraint trigger.
- `hotel_crs_dml.sql` — sample data with dates relative to the day it is loaded,
  six hotels / 100 physical rooms, a patterned three-week demand wave, and the
  overbooking/waitlist/promotion walkthrough.
- `hotel_crs_adaptive_inventory.sql` — additive upgrade for an existing
  database that was created before the adaptive inventory plan existed.
- `hotel_crs_schema.dbml` — paste into dbdiagram.io for the ER diagram.

Application features:

- Public site with real availability search, hotel listings/detail, and
  MongoDB-backed amenities.
- Guest registration/login, booking, payment (simulated), cancellation,
  refunds, and waitlist status.
- Staff desk scoped to the signed-in staff member's hotel: arrivals, payment
  gate, room assignment dropdown, and double-assignment protection.
- Admin control plane: hotel/room-type CRUD, physical room creation, base
  overbooking control, structured amenities editor, adaptive daily inventory
  chart, overbooked bookings report, and amenity aggregation report.
- Role-based page guards and API authorization.
- Standard API error envelope `{ error: { code, message } }` everywhere.

### Demo accounts

Every seeded account uses the development password:

```text
Demo@1234
```

| Role | Email |
|---|---|
| Guest | `arjun.mehta@example.com` |
| Guest | `priya.nair@example.com` |
| Staff (Koramangala) | `staff.koramangala@example.com` |
| Staff (Andheri) | `staff.andheri@example.com` |
| Staff (Whitefield) | `staff.whitefield@example.com` |
| Staff (Hitech City) | `staff.hitech@example.com` |
| Staff (BKC) | `staff.bkc@example.com` |
| Staff (Aerocity) | `staff.aerocity@example.com` |
| Admin | `admin@example.com` |

The login page has one-click buttons that fill the guest/staff/admin demo
credentials. Change the seeded hashes before any real deployment.

### Current overbooking scope

The admin screen exposes a **base buffer percentage** per room type. The base
buffer is `FLOOR(total_rooms × percent / 100)`, so a small percentage on a small
room type can round down to zero.

On top of that base, the database applies an **adaptive daily buffer**
(`fn_dynamic_buffer_rooms()`):

- if the previous night's hotel occupancy was below physical capacity, the next
  night's buffer grows (the hotel can sell more);
- if the previous night was above physical capacity, the next night's buffer
  shrinks (the hotel protects itself);
- the adjustment is proportional and capped at the base buffer, so it never
  runs away or goes negative.

The same rule feeds `fn_available_rooms()` and the booking procedures, and it is
materialised per hotel/night in `daily_inventory_plan` for the admin inventory
chart. The chart therefore shows physical capacity as a flat bar, an adaptive
max-sellable bar, and actual booked rooms per day. The FIFO waitlist and the
hard physical-room trigger still work exactly as before.

## Quick start (one command)

```bash
./run.sh
```

The script prompts for `sudo` once, then:

1. starts MariaDB and MongoDB,
2. creates `.env.local` if needed and generates `AUTH_SECRET`,
3. creates the `hotel_crs_app` database user,
4. loads the schema + sample data if the database is empty,
5. seeds MongoDB amenity documents,
6. installs Node dependencies if needed,
7. starts Next.js and opens `http://localhost:3000`.

The script stays in the foreground for as long as the dev server runs. Press
**Ctrl+C** to stop it; the Next.js process group it started is terminated with
it. MariaDB and MongoDB are system services and are left running.

For a clean demo database every time:

```bash
./run.sh --reset
```

Other flags:

```bash
./run.sh --no-browser
./run.sh --port 3001
```

`--reset` drops and reloads `hotel_crs`. Do not use it after creating data you
want to keep.

See **`DOCS/DEMO_GUIDE.md`** for the full presentation flow.

## Manual setup

These commands assume MariaDB, MongoDB, Node.js, and npm are installed.

1. Start both database services and install Node dependencies:

   ```bash
   sudo systemctl enable --now mariadb
   sudo systemctl enable --now mongod
   npm install
   ```

2. Reset and create the local development database, then load the schema and
   sample data. The reset is safe only when `hotel_crs` is a disposable local
   development database — it deletes all of its data.

   ```bash
   sudo mariadb -e "DROP DATABASE IF EXISTS hotel_crs;"
   sudo mariadb < SQL/hotel_crs_ddl.sql
   sudo mariadb < SQL/hotel_crs_dml.sql
   ```

   If you already have a `hotel_crs` database with data you want to keep, do
   **not** reset it. Run the additive upgrade instead; it installs the adaptive
   plan, adds the extra properties, and seeds the demand wave without deleting
   guests or bookings:

   ```bash
   sudo mariadb < SQL/hotel_crs_adaptive_inventory.sql
   ```

3. Create the application database user. Replace `choose-a-strong-password`
   with a password you will also put in `.env.local`. Both hosts are created so
   the application works whether its MariaDB connection resolves to `127.0.0.1`
   or `localhost`.

   ```bash
   sudo mariadb <<'SQL'
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'127.0.0.1' IDENTIFIED BY 'choose-a-strong-password';
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO 'hotel_crs_app'@'127.0.0.1';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO 'hotel_crs_app'@'localhost';
   FLUSH PRIVILEGES;
   SQL
   ```

4. Initialize MongoDB amenities. Run this block with `mongosh`, not with
   `mariadb`. The `updateOne(..., { upsert: true })` commands are safe to rerun.

   ```bash
   mongosh <<'MONGOSH'
   use hotel_crs
   db.hotel_features.createIndex({ hotel_id: 1 }, { unique: true })
   db.hotel_features.updateOne(
     { hotel_id: 1 },
     { $set: { amenities: { general: ["free wifi", "parking"], wellness: ["pool", "gym"], policies: { pet_friendly: true } }, room_type_features: {} } },
     { upsert: true }
   )
   db.hotel_features.updateOne(
     { hotel_id: 2 },
     { $set: { amenities: { general: ["free wifi", "parking"], wellness: ["gym"], policies: { pet_friendly: false } }, room_type_features: {} } },
     { upsert: true }
   )
   MONGOSH
   ```

5. Create `.env.local` and set the values. `DB_PASSWORD` must exactly match the
   password used in step 3. Generate a secret with `openssl rand -base64 32`.

   ```bash
   cp .env.example .env.local
   ```

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=hotel_crs_app
   DB_PASSWORD=choose-a-strong-password
   DB_NAME=hotel_crs
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=hotel_crs
   AUTH_SECRET=replace-with-output-of-openssl-rand-base64-32
   NEXTAUTH_URL=http://localhost:3000
   ```

6. Validate and start the application:

   ```bash
   npx tsc --noEmit
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Guests land on
   `/my-bookings`, Staff on `/staff`, and Admins on `/admin`.

For a production run, use `npm run build` followed by `npm start`.

## Tech stack

- **SQL database:** MariaDB (MySQL-compatible; same wire protocol, works with
  the `mysql2` driver).
- **NoSQL database:** MongoDB, one `hotel_features` document per hotel.
- **Frontend/backend:** Next.js (App Router pages + Route Handlers), one
  application serving public, guest, staff, and admin experiences, role-gated at
  the API layer.
- **Auth:** Auth.js (NextAuth v5), Credentials provider, JWT session carrying
  role and (for Staff) `hotelId`.
- **Version control:** Git + GitHub.

## Why the schema design looks the way it does

- A `booking` references a room **type**, never a physical room directly — the
  physical room is attached later via `room_assignment`, usually near check-in.
  This is what makes overbooking possible: a room type can be promised to more
  guests than physically exist, because no specific room is held hostage until
  someone actually shows up.
- Two overbooking layers, on purpose: a **soft** reservation-level buffer
  (`overbooking_policy` + `room_type_inventory`, enforced in
  `sp_create_booking` via `SELECT ... FOR UPDATE`) that can accept more
  bookings than physical capacity, and a **hard** physical layer
  (`trg_prevent_room_double_assignment`) that can never be crossed — two
  overlapping-date bookings can never land in the same physical room.
- The accept/waitlist decision is a stored procedure, not application code,
  specifically so MariaDB row locking serialises concurrent booking attempts for
  the last room — the exact race condition this project exists to prevent.
- `room.hotel_id` is a deliberate, documented denormalization (otherwise
  derivable via `room_type_id`) so that room-number uniqueness per building can
  be a plain `UNIQUE` constraint instead of a trigger.
- Two `ON DELETE` policies are used deliberately: `CASCADE` down the containment
  hierarchy (`franchise → hotel → room_type → room`) and for a booking's own
  dependents, vs. `RESTRICT` on transactional records referencing master data
  (`booking.guest_id`, `booking.room_type_id`) — you cancel a booking rather than
  delete the guest or room type out from under it.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The demo guide includes SQL evidence and an exhaustive functional test
checklist.

## Notes

- Payments are simulated. No real charge is made.
- Staff can assign a room only after the booking's payment is `Completed`.
- Cancelling a paid booking marks the payment `Refunded`, records the amount in
  `cancellation_history`, and releases any assigned physical room.
- The inventory chart shows per-day physical capacity (flat), the adaptive
  max-sellable ceiling, and booked rooms. The ceiling moves because the database
  raises the buffer after an under-booked night and lowers it after an
  over-booked night.
