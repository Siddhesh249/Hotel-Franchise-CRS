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

Everything described in `ARCHITECTURE.md` beyond this — the `staff_account` and
`sim_clock` tables, the `hotel_features` MongoDB collection, auth, the Next.js
app, and the simulation engine — planned but not yet built. `IMPLEMENTATION_PHASES.md` 
is the build order for it.

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

## Running the existing SQL core on Fedora 44 + MariaDB

```bash
sudo systemctl start mariadb        # if it isn't already running
mariadb -u root -p < hotel_crs_ddl.sql
mariadb -u root -p < hotel_crs_dml.sql
mariadb -u root -p hotel_crs -e "SELECT * FROM vw_roomtype_overview;"
```

(`mariadb` and `mysql` are the same client on Fedora's MariaDB packages —
either works.)
# Run the complete project

The application includes the guest booking flow, hotel-scoped staff operations,
and the Phase 2 admin control plane: catalog and buffer management, MongoDB
amenities, reports, the virtual clock, and a synthetic-traffic simulator.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database and load its schema and sample data. The DDL creates the
   clock table and `evt_clock_tick` event used by the admin clock.

   ```bash
   mariadb -u root -p < SQL/hotel_crs_ddl.sql
   mariadb -u root -p < SQL/hotel_crs_dml.sql
   ```

3. Enable MariaDB's event scheduler (add `event_scheduler=ON` to MariaDB's
   server configuration as well if it should survive a database restart):

   ```bash
   mariadb -u root -p -e "SET GLOBAL event_scheduler = ON;"
   ```

4. Set up MongoDB's `hotel_features` collection and unique index using the
   commands in [MONGO_SETUP.md](MONGO_SETUP.md).

5. Copy the environment template and fill in working database credentials and a
   long random Auth.js secret:

   ```bash
   cp .env.example .env.local
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with an Admin
   account provisioned in `staff_account` to use `/admin`, `/admin/clock`, and
   `/admin/simulation`. The simulator is intentionally process-local, so run it
   with the persistent Node development/production server rather than a
   serverless deployment.

For a production run, validate with `npx tsc --noEmit`, build with `npm run build`,
and start with `npm start`.
