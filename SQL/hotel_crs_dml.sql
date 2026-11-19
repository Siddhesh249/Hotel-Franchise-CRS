-- ============================================================================
-- Hotel Franchise CRS: sample data
-- Run AFTER hotel_crs_ddl.sql.
--
-- Dates are relative to the day the file is loaded (@today). Everything the
-- application writes goes through the stored procedures; the only direct
-- inserts into booking/payment are the few historical stays below, because
-- the engine (correctly) refuses to book a night that has already started.
--
-- Password for every seeded account: Demo@1234  (bcrypt, cost 12)
-- ============================================================================

USE hotel_crs;

SET @today = CURRENT_DATE;
SET @demo_password_hash = '$2b$12$1ugpwnX.DaFfZmJD8TfzhuO8rYHNvpXMw8ukiqGTkNm1G.dcLM6qa';

-- ----------------------------------------------------------------------------
-- Franchise, hotels, staff
-- ----------------------------------------------------------------------------
INSERT INTO franchise (franchise_name, headquarters_city, founded_year) VALUES
('Nightingale Suites', 'Bengaluru', 2010);

INSERT INTO hotel (franchise_id, hotel_name, city, state, address, star_rating, contact_number) VALUES
(1, 'Nightingale Suites - Koramangala', 'Bengaluru', 'Karnataka',   '4th Block, Koramangala', 4, '08041234567'),
(1, 'Nightingale Suites - Andheri',     'Mumbai',    'Maharashtra', 'Andheri East, MIDC',     4, '02241234567'),
(1, 'Nightingale Suites - BKC',         'Mumbai',    'Maharashtra', 'Bandra Kurla Complex',   5, '02241234568');

INSERT INTO staff_account (hotel_id, full_name, email, password_hash, role) VALUES
(1,    'Koramangala Front Desk', 'staff.koramangala@example.com', @demo_password_hash, 'Staff'),
(2,    'Andheri Front Desk',     'staff.andheri@example.com',     @demo_password_hash, 'Staff'),
(3,    'BKC Front Desk',         'staff.bkc@example.com',         @demo_password_hash, 'Staff'),
(NULL, 'Franchise Administrator', 'admin@example.com',            @demo_password_hash, 'Admin');

-- ----------------------------------------------------------------------------
-- Room types (ids 1-3 Koramangala, 4-6 Andheri, 7-9 BKC) and physical rooms
-- ----------------------------------------------------------------------------
INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES
(1, 'Standard', 3500.00, 2,  5),
(1, 'Deluxe',   5500.00, 3,  4),
(1, 'Suite',    9000.00, 4,  2),
(2, 'Standard', 3200.00, 2,  6),
(2, 'Deluxe',   5200.00, 3,  3),
(2, 'Suite',    8800.00, 4,  2),
(3, 'Standard', 4800.00, 2,  8),
(3, 'Deluxe',   7400.00, 3,  5),
(3, 'Suite',   12500.00, 4,  3);

INSERT INTO room (hotel_id, room_type_id, room_number, floor_number) VALUES
(1,1,'101',1),(1,1,'102',1),(1,1,'103',1),(1,1,'104',1),(1,1,'105',1),
(1,2,'201',2),(1,2,'202',2),(1,2,'203',2),(1,2,'204',2),
(1,3,'301',3),(1,3,'302',3),
(2,4,'101',1),(2,4,'102',1),(2,4,'103',1),(2,4,'104',1),(2,4,'105',1),(2,4,'106',1),
(2,5,'201',2),(2,5,'202',2),(2,5,'203',2),
(2,6,'301',3),(2,6,'302',3),
(3,7,'101',1),(3,7,'102',1),(3,7,'103',1),(3,7,'104',1),
(3,7,'105',1),(3,7,'106',1),(3,7,'107',1),(3,7,'108',1),
(3,8,'201',2),(3,8,'202',2),(3,8,'203',2),(3,8,'204',2),(3,8,'205',2),
(3,9,'301',3),(3,9,'302',3),(3,9,'303',3);

-- ----------------------------------------------------------------------------
-- Overbooking policy. Standard rooms see the most cancellations, so they get
-- the biggest buffer; suites are never oversold. The buffer is
-- FLOOR(total_rooms * percent / 100): Andheri Deluxe (3 x 10%) rounds down to 0.
-- ----------------------------------------------------------------------------
INSERT INTO overbooking_policy (room_type_id, overbook_percentage) VALUES
(1, 20.00), (2, 25.00), (3, 0.00),
(4, 20.00), (5, 10.00), (6, 0.00),
(7, 25.00), (8, 20.00), (9, 0.00);

-- ----------------------------------------------------------------------------
-- Guests
-- ----------------------------------------------------------------------------
INSERT INTO guest (first_name, last_name, email, phone, address, password_hash) VALUES
('Arjun',  'Mehta',    'arjun.mehta@example.com',    '9876500001', 'Bengaluru', @demo_password_hash),
('Priya',  'Nair',     'priya.nair@example.com',     '9876500002', 'Chennai',   @demo_password_hash),
('Rohan',  'Kulkarni', 'rohan.kulkarni@example.com', '9876500003', 'Pune',      @demo_password_hash),
('Sneha',  'Iyer',     'sneha.iyer@example.com',     '9876500004', 'Hyderabad', @demo_password_hash),
('Karan',  'Singh',    'karan.singh@example.com',    '9876500005', 'Delhi',     @demo_password_hash),
('Ananya', 'Rao',      'ananya.rao@example.com',     '9876500006', 'Bengaluru', @demo_password_hash),
('Vikram', 'Joshi',    'vikram.joshi@example.com',   '9876500007', 'Mumbai',    @demo_password_hash),
('Divya',  'Menon',    'divya.menon@example.com',    '9876500008', 'Kochi',     @demo_password_hash),
('Aditya', 'Verma',    'aditya.verma@example.com',   '9876500009', 'Jaipur',    @demo_password_hash),
('Neha',   'Kapoor',   'neha.kapoor@example.com',    '9876500010', 'Chandigarh', @demo_password_hash);

-- ----------------------------------------------------------------------------
-- Historical and in-progress stays (direct inserts, see header).
-- The nightly ledger for them is rebuilt right after.
-- ----------------------------------------------------------------------------
INSERT INTO booking (guest_id, room_type_id, check_in_date, check_out_date, num_guests,
                     booking_status, is_overbooked, booking_date, total_amount) VALUES
(1, 1, DATE_SUB(@today, INTERVAL 12 DAY), DATE_SUB(@today, INTERVAL 10 DAY), 1, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 20 DAY),  7000.00),
(3, 2, DATE_SUB(@today, INTERVAL 8 DAY),  DATE_SUB(@today, INTERVAL 5 DAY),  2, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 15 DAY), 16500.00),
(5, 4, DATE_SUB(@today, INTERVAL 6 DAY),  DATE_SUB(@today, INTERVAL 3 DAY),  2, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 12 DAY),  9600.00),
(6, 9, DATE_SUB(@today, INTERVAL 4 DAY),  DATE_SUB(@today, INTERVAL 1 DAY),  3, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 9 DAY),  37500.00),
(7, 7, DATE_SUB(@today, INTERVAL 2 DAY),  @today,                            1, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 6 DAY),   9600.00),
(9, 8, DATE_SUB(@today, INTERVAL 1 DAY),  DATE_ADD(@today, INTERVAL 1 DAY),  2, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 5 DAY),  14800.00),
(4, 1, DATE_SUB(@today, INTERVAL 1 DAY),  DATE_ADD(@today, INTERVAL 2 DAY),  2, 'Confirmed', FALSE, DATE_SUB(@today, INTERVAL 4 DAY),  10500.00);

INSERT INTO payment (booking_id, amount, payment_date, payment_method)
SELECT booking_id, total_amount, DATE_ADD(booking_date, INTERVAL 1 HOUR),
       ELT(MOD(booking_id, 3) + 1, 'Card', 'UPI', 'NetBanking')
FROM booking
WHERE booking_id BETWEEN 1 AND 6;          -- the 7th (in house, unpaid) stays unpaid

-- In-house guest in BKC Deluxe 201 (the desk assigned it at check-in).
INSERT INTO room_assignment (booking_id, room_id) VALUES (6, 31);

-- Ledger rows for the historical bookings: one unit per night per booking.
INSERT INTO room_type_inventory (room_type_id, stay_date, booked_count)
SELECT b.room_type_id, DATE_ADD(b.check_in_date, INTERVAL n.i DAY), COUNT(*)
FROM booking b
JOIN (WITH RECURSIVE seq (i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM seq WHERE i < 60)
      SELECT i FROM seq) n
  ON DATE_ADD(b.check_in_date, INTERVAL n.i DAY) < b.check_out_date
WHERE b.booking_status = 'Confirmed'
GROUP BY b.room_type_id, DATE_ADD(b.check_in_date, INTERVAL n.i DAY);

-- ----------------------------------------------------------------------------
-- Arrivals today (Koramangala): paid + waiting for a room, unpaid, and paid +
-- already assigned. Shows every state of the front-desk screen.
-- ----------------------------------------------------------------------------
CALL sp_create_booking(5, 1, @today, DATE_ADD(@today, INTERVAL 2 DAY), 1, 'Early check-in if possible', @b_t1, @s_t1);
CALL sp_create_booking(6, 2, @today, DATE_ADD(@today, INTERVAL 1 DAY), 2, NULL,                          @b_t2, @s_t2);
CALL sp_create_booking(7, 1, @today, DATE_ADD(@today, INTERVAL 2 DAY), 2, NULL,                          @b_t3, @s_t3);
CALL sp_record_payment(@b_t1, 5, 'Card', @p_st, @p_id, @p_amt);
CALL sp_record_payment(@b_t3, 7, 'UPI',  @p_st, @p_id, @p_amt);
INSERT INTO room_assignment (booking_id, room_id) VALUES (@b_t3, 3);       -- room 103

-- ============================================================================
-- OVERBOOKING WALKTHROUGH: Koramangala Standard (room_type_id 1), nights
-- today+10 and today+11.
--   physical rooms = 5, base buffer = FLOOR(5 * 20 / 100) = 1  -> 6 sellable
--   bookings 1-5  : CONFIRMED
--   booking  6    : CONFIRMED_OVERBOOKED (uses the buffer)
--   booking  7    : WAITLISTED
-- Then booking 2 is cancelled (and refunded) and the waitlisted guest is
-- promoted automatically.
-- ============================================================================
SET @w_in  = DATE_ADD(@today, INTERVAL 10 DAY);
SET @w_out = DATE_ADD(@today, INTERVAL 12 DAY);

CALL sp_create_booking(1, 1, @w_in, @w_out, 1, NULL,              @w1, @ws1);
CALL sp_create_booking(2, 1, @w_in, @w_out, 2, NULL,              @w2, @ws2);
CALL sp_create_booking(3, 1, @w_in, @w_out, 1, NULL,              @w3, @ws3);
CALL sp_create_booking(4, 1, @w_in, @w_out, 2, NULL,              @w4, @ws4);
CALL sp_create_booking(5, 1, @w_in, @w_out, 1, NULL,              @w5, @ws5);
CALL sp_create_booking(6, 1, @w_in, @w_out, 2, 'Quiet room please', @w6, @ws6);
CALL sp_create_booking(7, 1, @w_in, @w_out, 1, NULL,              @w7, @ws7);

CALL sp_record_payment(@w1, 1, 'UPI',  @p_st, @p_id, @p_amt);
CALL sp_record_payment(@w2, 2, 'Card', @p_st, @p_id, @p_amt);
CALL sp_record_payment(@w3, 3, 'Card', @p_st, @p_id, @p_amt);
INSERT INTO room_assignment (booking_id, room_id) VALUES (@w1, 1), (@w3, 2);

CALL sp_cancel_booking(@w2, 2, 'Change of travel plans', @cancel_st);

-- ----------------------------------------------------------------------------
-- A few more bookings elsewhere in the franchise
-- ----------------------------------------------------------------------------
CALL sp_create_booking(8,  2, DATE_ADD(@today, INTERVAL 3 DAY),  DATE_ADD(@today, INTERVAL 5 DAY),  2, NULL,                 @b1, @s1);
CALL sp_create_booking(9,  3, DATE_ADD(@today, INTERVAL 20 DAY), DATE_ADD(@today, INTERVAL 23 DAY), 2, 'Anniversary trip',   @b2, @s2);
CALL sp_create_booking(10, 4, DATE_ADD(@today, INTERVAL 2 DAY),  DATE_ADD(@today, INTERVAL 4 DAY),  1, NULL,                 @b3, @s3);
CALL sp_create_booking(10, 6, DATE_ADD(@today, INTERVAL 30 DAY), DATE_ADD(@today, INTERVAL 32 DAY), 3, NULL,                 @b4, @s4);
CALL sp_create_booking(2,  5, DATE_ADD(@today, INTERVAL 5 DAY),  DATE_ADD(@today, INTERVAL 7 DAY),  2, NULL,                 @b5, @s5);
CALL sp_create_booking(3,  7, DATE_ADD(@today, INTERVAL 1 DAY),  DATE_ADD(@today, INTERVAL 3 DAY),  2, NULL,                 @b6, @s6);
CALL sp_create_booking(4,  8, DATE_ADD(@today, INTERVAL 7 DAY),  DATE_ADD(@today, INTERVAL 9 DAY),  2, NULL,                 @b7, @s7);
CALL sp_create_booking(5,  9, DATE_ADD(@today, INTERVAL 14 DAY), DATE_ADD(@today, INTERVAL 16 DAY), 2, 'Airport pickup',     @b8, @s8);

CALL sp_record_payment(@b1, 8,  'Card',       @p_st, @p_id, @p_amt);
CALL sp_record_payment(@b2, 9,  'NetBanking', @p_st, @p_id, @p_amt);
CALL sp_record_payment(@b5, 2,  'Card',       @p_st, @p_id, @p_amt);
CALL sp_record_payment(@b6, 3,  'UPI',        @p_st, @p_id, @p_amt);
CALL sp_record_payment(@b8, 5,  'Card',       @p_st, @p_id, @p_amt);
INSERT INTO room_assignment (booking_id, room_id) VALUES (@b5, 18);        -- Andheri Deluxe 201

-- Materialise the plan the admin chart reads.
CALL sp_refresh_inventory_plan(@today, 60);

-- ----------------------------------------------------------------------------
-- Summary of what was loaded
-- ----------------------------------------------------------------------------
SELECT booking_status, is_overbooked, COUNT(*) AS bookings
FROM booking
GROUP BY booking_status, is_overbooked
ORDER BY booking_status, is_overbooked;
