# Hotel Franchise CRS with Overbooking Logic

DBMS Course Project. A hotel franchise central
reservation system with a two-layer overbooking/waitlist engine, built on
MariaDB (relational core) and MongoDB (flexible per-hotel amenity data), with a
Next.js application providing public, guest, staff, and admin experiences —
including a pausable/resumable virtual clock and an admin-controlled traffic
simulation engine for demos.

## Reference documents

Read in this order:

1. **`ARCHITECTURE.md`** — the full high-level and low-level design: every
   component, every schema addition, the virtual clock, the simulation engine,
   the API route map, and the frontend page map. This is the primary reference
   for anyone (human or AI agent) implementing the system.
2. **`FUNCTIONAL_REQUIREMENTS.odt`** — the numbered functional requirements
   (`FR-xxx`) the system must satisfy, grouped by module and actor.
3. **`IMPLEMENTATION_PHASES.md`** — the two-phase build order, with each
   component's dependencies made explicit.
4. This file — project summary, what already exists, and how to run it.

## What already exists

The relational core — schema, the overbooking/waitlist engine, and sample data —
is already built and is **not** being redesigned:

- `hotel_crs_ddl.sql` — schema: `franchise → hotel → room_type → room`
  hierarchy, `booking`/`room_assignment`/`payment`/`cancellation_history`, the
  `overbooking_policy` + `room_type_inventory` buffer mechanism, the
  `vw_roomtype_overview` view, `fn_available_rooms()`, the three overbooking
  procedures (`sp_create_booking`, `sp_cancel_booking`,
  `sp_try_promote_waitlist`), and the `trg_prevent_room_double_assignment`
  hard-constraint trigger.
- `hotel_crs_dml.sql` — synthetic sample data plus a walkthrough demo of the
  overbooking/waitlist/promotion flow.
- `hotel_crs_schema.dbml` — paste into dbdiagram.io for the ER diagram.

The application layer is complete: it includes the `staff_account` and
`sim_clock` schema additions, MongoDB amenities, credentials authentication,
guest/staff/admin portals, reporting, and the simulation engine.

## Why the schema design looks the way it does

- A `booking` references a room **type**, never a physical room directly — the
  physical room is attached later via `room_assignment`, usually near check-in.
  This single choice is what makes overbooking possible: a room type can be
  promised to more guests than physically exist, because no specific room is
  held hostage until someone actually shows up.
- Two overbooking layers, on purpose: a **soft** reservation-level buffer
  (`overbooking_policy` + `room_type_inventory`, enforced in
  `sp_create_booking` via `SELECT ... FOR UPDATE`) that can accept more
  bookings than physical capacity, and a **hard** physical layer
  (`trg_prevent_room_double_assignment`) that can never be crossed — two
  overlapping-date bookings can never land in the same physical room.
- The accept/waitlist decision is a stored procedure, not application code,
  specifically so MariaDB's row locking serializes concurrent booking attempts
  for the last room — the exact race condition this project exists to prevent.
- `room.hotel_id` is a deliberate, documented denormalization (otherwise
  derivable via `room_type_id`) so that room-number uniqueness per building can
  be a plain `UNIQUE` constraint instead of a trigger.
- Two `ON DELETE` policies are used deliberately: `CASCADE` down the
  containment hierarchy (`franchise → hotel → room_type → room`) and for a
  booking's own dependents, vs. `RESTRICT` on transactional records referencing
  master data (`booking.guest_id`, `booking.room_type_id`) — you cancel a
  booking rather than delete the guest or room type out from under it.

## Tech stack

- **SQL database:** MariaDB (MySQL-compatible; same wire protocol, works with
  the `mysql2` driver — see `ARCHITECTURE.md` §4.1 for the full schema).
- **NoSQL database:** MongoDB, one `hotel_features` document per hotel —
  see `ARCHITECTURE.md` §4.2 for why amenities are modeled as documents, not
  relational columns.
- **Frontend/backend:** Next.js (pages + API routes), one application serving
  public, guest, staff, and admin experiences, role-gated at the API layer.
- **Auth:** Auth.js, credentials provider, JWT session carrying role and
  (for Staff) `hotelId`.
- **Version control:** Git + GitHub, commit history expected to show both team
  members' individual contributions.

## Setup and run

The application includes the guest booking flow, hotel-scoped staff operations,
and the Phase 2 admin control plane: catalog and buffer management, MongoDB
amenities, reports, the virtual clock, and a synthetic-traffic simulator.

These commands assume MariaDB, MongoDB, Node.js, and npm are already installed.
Run the MariaDB and MongoDB blocks in a normal terminal from the repository
root. The MongoDB block is run with `mongosh`—it is **not** a MariaDB command.

1. Start both database services and install Node dependencies:

   ```bash
   sudo systemctl enable --now mariadb
   sudo systemctl enable --now mongod
   npm install
   ```

2. Reset and create the local development database, then load the schema and
   sample data. The reset is safe only when `hotel_crs` is a disposable local
   development database—it deletes all of its data.

   ```bash
   sudo mariadb -e "DROP DATABASE IF EXISTS hotel_crs;"
   sudo mariadb < SQL/hotel_crs_ddl.sql
   sudo mariadb < SQL/hotel_crs_dml.sql
   ```

3. Create the application database user. Replace `choose-a-strong-password`
   with a password you will also put in `.env.local`. Both hosts are created so
   the application works whether its MariaDB connection resolves to `127.0.0.1`
   or `localhost`.

   ```bash
   sudo mariadb <<'SQL'
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'127.0.0.1' IDENTIFIED BY 'choose-a-strong-password';
   CREATE USER IF NOT EXISTS 'hotel_crs_app'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, EVENT ON hotel_crs.* TO 'hotel_crs_app'@'127.0.0.1';
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, EVENT ON hotel_crs.* TO 'hotel_crs_app'@'localhost';
   FLUSH PRIVILEGES;
   SQL
   ```

4. Enable the MariaDB event scheduler. It advances the persisted virtual clock.
   Add `event_scheduler=ON` to the MariaDB server configuration if you want it
   automatically enabled after every MariaDB restart.

   ```bash
   sudo mariadb -e "SET GLOBAL event_scheduler = ON;"
   ```

5. Initialize MongoDB amenities. Run this whole block with `mongosh`, not with
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

6. Create `.env.local` and set the values. `DB_PASSWORD` must exactly match the
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

7. Validate and start the application:

   ```bash
   npx tsc --noEmit
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with an Admin
   account provisioned in `staff_account` to use `/admin`, `/admin/clock`, and
   `/admin/simulation`. The simulator is intentionally process-local, so run it
   with the persistent Node development/production server rather than a
   serverless deployment.

For a production run, use `npm run build` followed by `npm start`.
