# Implementation Phases

Two phases, split by dependency. Phase 1 is the foundation plus the full
guest-facing booking flow. Phase 2 is the admin control plane, reporting, and
demo polish. See `ARCHITECTURE.md` for component design and
`DOCS/DEMO_GUIDE.md` for the presentation run sheet.

---

## Phase 1 — Foundation + guest-facing core

Goal: a person can register, search, book (and see all three outcomes —
Confirmed, Confirmed-overbooked, Waitlisted), pay, cancel, and watch the waitlist
promote; a staff member can log in, see their hotel’s bookings, and assign a
physical room after payment.

### 1.1 Schema and data-layer additions
- Add `staff_account` table and `guest.password_hash`.
- Add `booking.special_requests`.
- Stand up MongoDB, create the `hotel_features` collection and its unique index
  on `hotel_id`, seed one document per existing hotel.
- Run the MariaDB DDL/DML as the base. The overbooking engine keeps its
  lock-and-decide structure but gains validation, refund audit, room release on
  cancellation, and the adaptive per-night buffer described in Phase 2.
- Use real calendar dates (`CURRENT_DATE`) — no virtual clock or event scheduler.

### 1.2 Auth & route protection
- Auth.js credentials provider against `guest` and `staff_account`.
- JWT session shape (`actorType`, `role`, `hotelId`).
- `requireRole` / `requireOwnership` helpers used by every protected route.
- Registration and login pages/routes, with role-based redirects and callback
  support.

### 1.3 Public site
- Landing page with availability search.
- Hotel listing + detail, merging SQL hotel/room_type rows with the Mongo
  `hotel_features` document.
- Live availability for every night of the stay.

### 1.4 Guest booking flow
- Availability search (wraps `fn_available_rooms`).
- Booking creation (wraps `sp_create_booking`) — UI surfaces all three outcomes
  distinctly.
- “My bookings” page with payment, cancellation, refunds, and waitlist status.
- Simulated payment form (inserts a `payment` row; amount is server-side).

### 1.5 Staff portal
- Hotel-scoped bookings/arrivals view (`session.hotelId`).
- Payment gate: room assignment requires a completed payment.
- Room dropdown showing only assignable rooms for the stay.
- `SQLSTATE '45000'` trigger conflict caught and shown as a clean error.

### 1.6 Core error handling and env config
- Standard `{ error: { code, message } }` API error shape.
- `.env.local` wiring for both databases and `AUTH_SECRET`/`NEXTAUTH_URL`.

**Phase 1 exit criteria:** a guest can complete booking → payment → cancellation
→ waitlist promotion through the UI; a staff member can assign a room only after
payment and hit the double-assignment guard; both are enforced by real auth.

---

## Phase 2 — Admin control plane + reporting + demo

Goal: an admin can manage the catalog, control overbooking, edit amenities
without JSON, see daily capacity vs overbooking, and run reports across both
databases.

### 2.1 Admin catalog management
- Hotel / room type CRUD.
- Physical room creation for new or under-provisioned room types.
- Overbooking control (`overbooking_policy.overbook_percentage`) with effective
  **base** buffer math shown in the UI, plus the adaptive daily buffer
  (`fn_dynamic_buffer_rooms()`) that reacts to the previous night’s occupancy.

### 2.2 Amenities editor
- Structured editor for general/wellness chips, policies, and room-type features.
- Stored as one flexible MongoDB document per hotel.
- No JSON editing required for normal use.

### 2.3 Reporting and inventory chart
- SQL report: currently-overbooked confirmed bookings.
- Mongo aggregation report: amenity counts grouped by city.
- Daily inventory chart: physical rooms (constant), adaptive max sellable
  (capacity + per-night buffer), and booked rooms for the next 14/30/60 real
  days. The database materialises the series in `daily_inventory_plan` and
  refreshes it on every chart request.
- Additive migration (`SQL/hotel_crs_adaptive_inventory.sql`) so an existing
  database gets the adaptive plan, the extra properties, and the patterned
  demand seed without dropping user data.

### 2.4 Demo readiness
- Seed data with dates relative to the day it is loaded.
- `run.sh` one-command setup/start/open-browser script.
- `DOCS/DEMO_GUIDE.md` with the full overbooking walkthrough, SQL evidence, and
  test checklist.

**Phase 2 exit criteria:** the whole system works from a clean `./run.sh
--reset`, the overbooking/waitlist cycle is demonstrable from the UI and SQL, and
the admin can explain capacity vs allowed overbooking from the inventory chart —
including why the max-sellable ceiling moves after an under- or over-booked
night.
