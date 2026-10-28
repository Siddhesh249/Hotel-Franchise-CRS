# Implementation Phases

Two phases only, split by dependency: everything in Phase 2 depends on something
built in Phase 1 being functional first. Phase 1 is intentionally the larger phase
— it contains every foundational component plus the full guest-facing booking flow,
since nothing else in the system can be demonstrated without that working end to
end. See `ARCHITECTURE.md` for the design of every component named below, and
`FUNCTIONAL_REQUIREMENTS.odt` for the requirement each component satisfies.

---

## Phase 1 — Foundation + guest-facing core

Goal at the end of this phase: a person can register, search, book a room (and see
all three possible outcomes — Confirmed, Confirmed-overbooked, Waitlisted), cancel
a booking and watch the waitlist promote, pay for it, and log out — and a staff
member can log in, see their hotel's bookings, and assign a physical room. Nothing
in this phase depends on anything outside Phase 1.

### 1.1 Schema and data-layer additions (no dependents — build first)
- Add `staff_account` table.
- Add `password_hash`, `is_synthetic` columns to `guest`.
- Add `sim_clock` table and `evt_clock_tick` event (built now because the API
  layer's date-handling in 1.4 reads from it from the start, even though the admin
  UI to control it is Phase 2).
- Stand up MongoDB, create the `hotel_features` collection and its unique index on
  `hotel_id`, seed one document per existing hotel.
- *Existing* MariaDB DDL/DML (`hotel_crs_ddl.sql`, `hotel_crs_dml.sql`) run as-is —
  no changes to the overbooking engine itself.

### 1.2 Auth & route protection (depends on 1.1's `staff_account`/`guest` columns)
- Auth.js credentials provider against `guest` and `staff_account`.
- JWT session shape (`actorType`, `role`, `hotelId`).
- `requireRole` / `requireOwnership` middleware used by every route from here on.
- Registration and login pages/routes.

### 1.3 Public site (depends on 1.1's Mongo seed data)
- Landing page.
- Hotel listing + detail pages, merging the SQL hotel/room_type rows with the Mongo
  `hotel_features` document.

### 1.4 Guest booking flow (depends on 1.2 auth, 1.1 clock for date defaults)
- Availability search (wraps `fn_available_rooms`).
- Booking creation (wraps `sp_create_booking`) — UI must surface all three outcome
  states distinctly, not just "success/fail".
- "My bookings" page.
- Cancellation (wraps `sp_cancel_booking`) — UI should reflect a waitlisted booking
  flipping to Confirmed after a cancellation frees capacity.
- Simulated payment form (inserts a `payment` row).

### 1.5 Staff portal (depends on 1.2 auth, 1.4 for there to be bookings to show)
- Hotel-scoped bookings/arrivals view (filtered by `session.hotelId`).
- Room assignment action (wraps the `room_assignment` insert), with the
  `SQLSTATE '45000'` trigger conflict caught and shown as a clean error, not a raw
  SQL message.

### 1.6 Core error handling and env config (cuts across all of the above)
- Standard `{ error: { code, message } }` API error shape.
- `.env.local` wiring for both databases and `AUTH_SECRET`/`NEXTAUTH_URL`.

**Phase 1 exit criteria:** a guest can complete a full booking → cancellation →
waitlist-promotion cycle through the UI, a staff member can assign a room and hit
the double-assignment guard, and both are enforced by real auth — all without
needing the admin portal, the clock controls, or the simulation engine to exist yet.

---

## Phase 2 — Admin control plane + simulation + reporting

Goal at the end of this phase: an admin can manage the catalog, tune the
overbooking policy, edit amenities, run reports across both databases, and run a
live, controllable simulation for a demo. Everything here depends on Phase 1 being
in place (auth, the booking flow, and the clock table already existing).

### 2.1 Admin catalog management (depends on 1.2 auth, 1.1 schema)
- Hotel / room type CRUD.
- Overbooking policy editor (`overbooking_policy.overbook_percentage`).
- Amenities editor for the `hotel_features` Mongo document.

### 2.2 Reporting (depends on 1.1 Mongo seed data + 1.4 having produced real bookings)
- SQL report: currently-overbooked confirmed bookings (the query already present in
  `hotel_crs_dml.sql`).
- Mongo aggregation report: amenity counts grouped by city (the required NoSQL
  advanced-feature deliverable).

### 2.3 Virtual clock admin UI (depends on 1.1's `sim_clock`/event already existing)
- Pause / resume / fast-forward / tick-rate controls, reading and writing
  `sim_clock` and toggling the event via `ALTER EVENT ... ENABLE/DISABLE`.

### 2.4 Simulation engine (depends on 2.3's clock controls, 1.4's booking flow, 1.1's `is_synthetic` flag)
- Singleton in-process service with start/stop/configure/spawn-one controls.
- Client archetype configuration (admin-editable, not hardcoded).
- Spawn logic calling `sp_create_booking` / `sp_cancel_booking` exactly as the real
  guest flow does, tagging created guests `is_synthetic = TRUE`.
- "Clear simulation data" action for resetting before a live demo.

### 2.5 Polish
- UI pass across all three portals.
- End-to-end run-through matching the functional requirements document.

**Phase 2 exit criteria:** the whole system — including a self-running,
admin-controllable demo via the simulation engine — works without manual database
intervention.
