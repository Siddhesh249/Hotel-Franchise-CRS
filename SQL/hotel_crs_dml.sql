-- ============================================================================
-- Hotel Franchise CRS -- sample synthetic data
-- Run this AFTER hotel_crs_ddl.sql
-- ============================================================================

USE hotel_crs;

-- Demo dates are relative to the day this file is loaded, so the sample stays
-- useful whenever the project is set up (arrivals are today, not a fixed past date).
SET @demo_checkin  = CURRENT_DATE;
SET @demo_checkout = DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY);

-- Demo password for every seeded account: Demo@1234
-- (hash generated with bcrypt, cost 12). Change before any real deployment.
SET @demo_password_hash = '$2b$12$1ugpwnX.DaFfZmJD8TfzhuO8rYHNvpXMw8ukiqGTkNm1G.dcLM6qa';

-- ----------------------------------------------------------------------------
-- Franchise + two properties under it
-- ----------------------------------------------------------------------------
INSERT INTO franchise (franchise_name, headquarters_city, founded_year) VALUES
('Nightingale Suites', 'Bengaluru', 2010);

INSERT INTO hotel (franchise_id, hotel_name, city, state, address, star_rating, contact_number) VALUES
(1, 'Nightingale Suites - Koramangala', 'Bengaluru', 'Karnataka', '4th Block, Koramangala', 4, '08041234567'),
(1, 'Nightingale Suites - Andheri',     'Mumbai',    'Maharashtra', 'Andheri East, MIDC',    4, '02241234567');

INSERT INTO staff_account (hotel_id, full_name, email, password_hash, role) VALUES
(1, 'Koramangala Front Desk', 'staff.koramangala@example.com', @demo_password_hash, 'Staff'),
(NULL, 'Franchise Administrator', 'admin@example.com', @demo_password_hash, 'Admin');

-- ----------------------------------------------------------------------------
-- Room types (room_type_id 1-3 = Koramangala, 4-6 = Andheri)
-- ----------------------------------------------------------------------------
INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES
(1, 'Standard', 3500.00, 2, 5),
(1, 'Deluxe',   5500.00, 3, 4),
(1, 'Suite',    9000.00, 4, 2),
(2, 'Standard', 3200.00, 2, 6),
(2, 'Deluxe',   5200.00, 3, 3),
(2, 'Suite',    8800.00, 4, 2);

-- ----------------------------------------------------------------------------
-- Physical rooms
-- ----------------------------------------------------------------------------
INSERT INTO room (hotel_id, room_type_id, room_number, floor_number) VALUES
(1,1,'101',1),(1,1,'102',1),(1,1,'103',1),(1,1,'104',1),(1,1,'105',1),
(1,2,'201',2),(1,2,'202',2),(1,2,'203',2),(1,2,'204',2),
(1,3,'301',3),(1,3,'302',3),
(2,4,'101',1),(2,4,'102',1),(2,4,'103',1),(2,4,'104',1),(2,4,'105',1),(2,4,'106',1),
(2,5,'201',2),(2,5,'202',2),(2,5,'203',2),
(2,6,'301',3),(2,6,'302',3);

-- ----------------------------------------------------------------------------
-- Guests
-- ----------------------------------------------------------------------------
INSERT INTO guest (first_name, last_name, email, phone, address, password_hash) VALUES
('Arjun','Mehta','arjun.mehta@example.com','9876500001','Bengaluru', @demo_password_hash),
('Priya','Nair','priya.nair@example.com','9876500002','Chennai', @demo_password_hash),
('Rohan','Kulkarni','rohan.kulkarni@example.com','9876500003','Pune', @demo_password_hash),
('Sneha','Iyer','sneha.iyer@example.com','9876500004','Hyderabad', @demo_password_hash),
('Karan','Singh','karan.singh@example.com','9876500005','Delhi', @demo_password_hash),
('Ananya','Rao','ananya.rao@example.com','9876500006','Bengaluru', @demo_password_hash),
('Vikram','Joshi','vikram.joshi@example.com','9876500007','Mumbai', @demo_password_hash),
('Divya','Menon','divya.menon@example.com','9876500008','Kochi', @demo_password_hash),
('Aditya','Verma','aditya.verma@example.com','9876500009','Jaipur', @demo_password_hash),
('Neha','Kapoor','neha.kapoor@example.com','9876500010','Chandigarh', @demo_password_hash),
('Rahul','Deshmukh','rahul.deshmukh@example.com','9876500011','Nagpur', @demo_password_hash),
('Ishita','Bose','ishita.bose@example.com','9876500012','Kolkata', @demo_password_hash);

-- ----------------------------------------------------------------------------
-- Overbooking policy per room type
-- Standard rooms cancel/no-show the most historically -> overbook them harder.
-- Suites are never overbooked -- guests who book premium rooms rarely cancel,
-- and the reputational cost of failing them is much higher.
-- ----------------------------------------------------------------------------
INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES
(1, 20.00),  -- Koramangala Standard
(2, 10.00),  -- Koramangala Deluxe
(3, 0.00),   -- Koramangala Suite
(4, 15.00),  -- Andheri Standard
(5, 10.00),  -- Andheri Deluxe
(6, 0.00);   -- Andheri Suite

-- ============================================================================
-- DEMO: filling up Koramangala Standard (room_type_id = 1) for the same
-- 2-night stay. Physical capacity = 5, buffer = FLOOR(5 * 20/100) = 1 room,
-- so 6 rooms are sellable in total before anyone hits the waitlist.
-- ============================================================================

CALL sp_create_booking(1,  1, @demo_checkin, @demo_checkout, 1, @bid1, @st1);
CALL sp_create_booking(2,  1, @demo_checkin, @demo_checkout, 2, @bid2, @st2);
CALL sp_create_booking(3,  1, @demo_checkin, @demo_checkout, 1, @bid3, @st3);
CALL sp_create_booking(4,  1, @demo_checkin, @demo_checkout, 2, @bid4, @st4);
CALL sp_create_booking(5,  1, @demo_checkin, @demo_checkout, 1, @bid5, @st5);
-- physical capacity (5 rooms) is now fully booked

CALL sp_create_booking(6,  1, @demo_checkin, @demo_checkout, 2, @bid6, @st6);
-- 6th booking dips into the overbooking buffer -> CONFIRMED_OVERBOOKED

CALL sp_create_booking(7,  1, @demo_checkin, @demo_checkout, 1, @bid7, @st7);
-- 7th booking has nowhere left to go -> WAITLISTED

SELECT @bid1 booking_id, @st1 status
UNION ALL SELECT @bid2, @st2
UNION ALL SELECT @bid3, @st3
UNION ALL SELECT @bid4, @st4
UNION ALL SELECT @bid5, @st5
UNION ALL SELECT @bid6, @st6
UNION ALL SELECT @bid7, @st7;

-- sanity checks
SELECT * FROM vw_roomtype_overview WHERE room_type_id = 1;
SELECT fn_available_rooms(1, @demo_checkin) AS rooms_left_on_checkin;

-- ============================================================================
-- DEMO: guest #2 cancels their booking -> a physical room frees up ->
-- the oldest waitlisted booking (guest #7, @bid7) should auto-promote
-- ============================================================================
CALL sp_cancel_booking(@bid2, 'Change of travel plans');

SELECT booking_id, booking_status, is_overbooked
FROM booking WHERE booking_id IN (@bid2, @bid7);

-- ----------------------------------------------------------------------------
-- Payments + room assignment for a couple of confirmed bookings
-- ----------------------------------------------------------------------------
INSERT INTO payment (booking_id, amount, payment_method, payment_status) VALUES
(@bid1, 7000.00, 'UPI',  'Completed'),
(@bid3, 7000.00, 'Card', 'Completed');

INSERT INTO room_assignment (booking_id, room_id) VALUES (@bid1, 1);  -- room 101
INSERT INTO room_assignment (booking_id, room_id) VALUES (@bid3, 2);  -- room 102

-- Uncomment to watch the hard-constraint trigger earn its keep: this tries to
-- put booking #4's guest into room 101, which is already occupied for an
-- overlapping stay, and should fail with a 45000 signal.
-- INSERT INTO room_assignment (booking_id, room_id) VALUES (@bid4, 1);

-- ----------------------------------------------------------------------------
-- A couple of extra bookings elsewhere in the franchise, just so the data
-- doesn't look like a single-scenario toy set
-- ----------------------------------------------------------------------------
CALL sp_create_booking(8,  2, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 9 DAY), 2, @bid8,  @st8);   -- Koramangala Deluxe
CALL sp_create_booking(9,  3, DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 33 DAY), 2, @bid9,  @st9);   -- Koramangala Suite
CALL sp_create_booking(10, 4, DATE_ADD(CURRENT_DATE, INTERVAL 4 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 6 DAY), 1, @bid10, @st10);  -- Andheri Standard
CALL sp_create_booking(11, 6, DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 62 DAY), 3, @bid11, @st11);  -- Andheri Suite

INSERT INTO payment (booking_id, amount, payment_method, payment_status) VALUES
(@bid8,  11000.00, 'Card',       'Completed'),
(@bid9,  27000.00, 'NetBanking', 'Completed'),
(@bid10,  6400.00, 'UPI',        'Pending'),
(@bid11, 26400.00, 'Card',       'Completed');

-- ----------------------------------------------------------------------------
-- Reporting queries -- handy for your demo/viva
-- ----------------------------------------------------------------------------

-- Capacity + overbooking buffer per room type, franchise-wide
SELECT hotel_name, type_name, total_rooms, overbook_percentage,
       overbook_buffer_rooms, max_sellable_rooms
FROM vw_roomtype_overview
ORDER BY hotel_name, type_name;

-- Every booking currently relying on the overbooking buffer
SELECT b.booking_id, g.first_name, g.last_name, rt.type_name,
       b.check_in_date, b.check_out_date, b.booking_status
FROM booking b
JOIN guest g      ON g.guest_id = b.guest_id
JOIN room_type rt ON rt.room_type_id = b.room_type_id
WHERE b.is_overbooked = TRUE AND b.booking_status IN ('Confirmed','CheckedIn');
