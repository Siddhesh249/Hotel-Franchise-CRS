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
(1, 'Nightingale Suites - Koramangala', 'Bengaluru', 'Karnataka',   '4th Block, Koramangala', 4, '08041234567'),
(1, 'Nightingale Suites - Andheri',     'Mumbai',    'Maharashtra', 'Andheri East, MIDC',     4, '02241234567'),
(1, 'Nightingale Suites - Whitefield',  'Bengaluru', 'Karnataka',   'ITPL Main Road',         4, '08041234568'),
(1, 'Nightingale Suites - Hitech City', 'Hyderabad', 'Telangana',   'Madhapur, Hitech City',  4, '04041234567'),
(1, 'Nightingale Suites - BKC',         'Mumbai',    'Maharashtra', 'Bandra Kurla Complex',   5, '02241234568'),
(1, 'Nightingale Suites - Aerocity',    'Delhi',     'Delhi',       'Aerocity, IGI Airport',  5, '01141234567');

INSERT INTO staff_account (hotel_id, full_name, email, password_hash, role) VALUES
(1, 'Koramangala Front Desk', 'staff.koramangala@example.com', @demo_password_hash, 'Staff'),
(2, 'Andheri Front Desk',     'staff.andheri@example.com',     @demo_password_hash, 'Staff'),
(3, 'Whitefield Front Desk',  'staff.whitefield@example.com',  @demo_password_hash, 'Staff'),
(4, 'Hitech City Front Desk', 'staff.hitech@example.com',      @demo_password_hash, 'Staff'),
(5, 'BKC Front Desk',         'staff.bkc@example.com',         @demo_password_hash, 'Staff'),
(6, 'Aerocity Front Desk',    'staff.aerocity@example.com',    @demo_password_hash, 'Staff'),
(NULL, 'Franchise Administrator', 'admin@example.com', @demo_password_hash, 'Admin');

-- ----------------------------------------------------------------------------
-- Room types
--   1-3  Koramangala, 4-6  Andheri, 7-9  Whitefield
--   10-12 Hitech City, 13-15 BKC, 16-18 Aerocity
-- Physical rooms total 100 across the franchise.
-- ----------------------------------------------------------------------------
INSERT INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms) VALUES
(1, 'Standard', 3500.00, 2,  5),
(1, 'Deluxe',   5500.00, 3,  4),
(1, 'Suite',    9000.00, 4,  2),
(2, 'Standard', 3200.00, 2,  6),
(2, 'Deluxe',   5200.00, 3,  3),
(2, 'Suite',    8800.00, 4,  2),
(3, 'Standard', 3600.00, 2, 10),
(3, 'Deluxe',   5700.00, 3,  6),
(3, 'Suite',    9200.00, 4,  3),
(4, 'Standard', 3900.00, 2,  9),
(4, 'Deluxe',   6100.00, 3,  6),
(4, 'Suite',    9800.00, 4,  3),
(5, 'Standard', 4800.00, 2, 12),
(5, 'Deluxe',   7400.00, 3,  8),
(5, 'Suite',   12500.00, 4,  4),
(6, 'Standard', 4200.00, 2,  8),
(6, 'Deluxe',   6600.00, 3,  6),
(6, 'Suite',   10800.00, 4,  3);

-- ----------------------------------------------------------------------------
-- Physical rooms
-- ----------------------------------------------------------------------------
INSERT INTO room (hotel_id, room_type_id, room_number, floor_number) VALUES
(1,1,'101',1),(1,1,'102',1),(1,1,'103',1),(1,1,'104',1),(1,1,'105',1),
(1,2,'201',2),(1,2,'202',2),(1,2,'203',2),(1,2,'204',2),
(1,3,'301',3),(1,3,'302',3),
(2,4,'101',1),(2,4,'102',1),(2,4,'103',1),(2,4,'104',1),(2,4,'105',1),(2,4,'106',1),
(2,5,'201',2),(2,5,'202',2),(2,5,'203',2),
(2,6,'301',3),(2,6,'302',3),
-- Whitefield (17 -> 19 rooms)
(3,7,'101',1),(3,7,'102',1),(3,7,'103',1),(3,7,'104',1),(3,7,'105',1),
(3,7,'106',1),(3,7,'107',1),(3,7,'108',1),(3,7,'109',1),(3,7,'110',1),
(3,8,'201',2),(3,8,'202',2),(3,8,'203',2),(3,8,'204',2),(3,8,'205',2),(3,8,'206',2),
(3,9,'301',3),(3,9,'302',3),(3,9,'303',3),
-- Hitech City (18 rooms)
(4,10,'101',1),(4,10,'102',1),(4,10,'103',1),(4,10,'104',1),(4,10,'105',1),
(4,10,'106',1),(4,10,'107',1),(4,10,'108',1),(4,10,'109',1),
(4,11,'201',2),(4,11,'202',2),(4,11,'203',2),(4,11,'204',2),(4,11,'205',2),(4,11,'206',2),
(4,12,'301',3),(4,12,'302',3),(4,12,'303',3),
-- BKC (24 rooms)
(5,13,'101',1),(5,13,'102',1),(5,13,'103',1),(5,13,'104',1),(5,13,'105',1),(5,13,'106',1),
(5,13,'107',1),(5,13,'108',1),(5,13,'109',1),(5,13,'110',1),(5,13,'111',1),(5,13,'112',1),
(5,14,'201',2),(5,14,'202',2),(5,14,'203',2),(5,14,'204',2),(5,14,'205',2),(5,14,'206',2),
(5,14,'207',2),(5,14,'208',2),
(5,15,'301',3),(5,15,'302',3),(5,15,'303',3),(5,15,'304',3),
-- Aerocity (17 rooms)
(6,16,'101',1),(6,16,'102',1),(6,16,'103',1),(6,16,'104',1),(6,16,'105',1),
(6,16,'106',1),(6,16,'107',1),(6,16,'108',1),
(6,17,'201',2),(6,17,'202',2),(6,17,'203',2),(6,17,'204',2),(6,17,'205',2),(6,17,'206',2),
(6,18,'301',3),(6,18,'302',3),(6,18,'303',3);

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
('Ishita','Bose','ishita.bose@example.com','9876500012','Kolkata', @demo_password_hash),
('Meera','Pillai','meera.pillai@example.com','9876500013','Kochi', @demo_password_hash),
('Sanjay','Gupta','sanjay.gupta@example.com','9876500014','Delhi', @demo_password_hash),
('Tanvi','Shah','tanvi.shah@example.com','9876500015','Ahmedabad', @demo_password_hash),
('Nikhil','Reddy','nikhil.reddy@example.com','9876500016','Hyderabad', @demo_password_hash),
('Pooja','Bhat','pooja.bhat@example.com','9876500017','Mangaluru', @demo_password_hash),
('Aman','Malhotra','aman.malhotra@example.com','9876500018','Chandigarh', @demo_password_hash),
('Kavya','Menon','kavya.menon@example.com','9876500019','Chennai', @demo_password_hash),
('Farhan','Khan','farhan.khan@example.com','9876500020','Mumbai', @demo_password_hash);

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
(6, 0.00),   -- Andheri Suite
(7, 20.00),  -- Whitefield Standard
(8, 12.00),  -- Whitefield Deluxe
(9, 0.00),   -- Whitefield Suite
(10, 18.00), -- Hitech City Standard
(11, 10.00), -- Hitech City Deluxe
(12, 0.00),  -- Hitech City Suite
(13, 22.00), -- BKC Standard
(14, 15.00), -- BKC Deluxe
(15, 0.00),  -- BKC Suite
(16, 20.00), -- Aerocity Standard
(17, 10.00), -- Aerocity Deluxe
(18, 0.00);  -- Aerocity Suite

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
CALL sp_create_booking(11, 4, DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY), 2, @bid12, @st12);  -- Andheri Standard
CALL sp_create_booking(12, 5, DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 2, @bid13, @st13);  -- Andheri Deluxe

INSERT INTO payment (booking_id, amount, payment_method, payment_status) VALUES
(@bid8,  11000.00, 'Card',       'Completed'),
(@bid9,  27000.00, 'NetBanking', 'Completed'),
(@bid10,  6400.00, 'UPI',        'Pending'),
(@bid11, 26400.00, 'Card',       'Completed'),
(@bid12,  6400.00, 'UPI',        'Pending'),
(@bid13, 10400.00, 'Card',       'Completed');

-- One Andheri booking already has a physical room assigned, so the staff desk
-- shows both states: paid + assigned, and paid + waiting for a room.
INSERT INTO room_assignment (booking_id, room_id) VALUES (@bid13, 18);  -- Andheri Deluxe 201

-- ============================================================================
-- PATTERNED DEMAND WAVE
--
-- The admin chart is only interesting if the previous night actually has a
-- signal. This seeds a repeating low/high occupancy wave from two days ago
-- through three weeks out. Each room type receives a 1-night booking per
-- target room, so the nightly ledger (and therefore the adaptive buffer on the
-- next day) has a clear sawtooth shape:
--   target = total - 2, total + 1, total - 1, total + 2, total - 3, total, total - 1
--
-- The wave deliberately skips today/tomorrow for Koramangala and Andheri so
-- the scripted overbooking/waitlist walkthrough above stays intact.
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_seed_demo_demand;

DELIMITER $$

CREATE PROCEDURE sp_seed_demo_demand()
seed_proc: BEGIN
    DECLARE v_done          INT DEFAULT 0;
    DECLARE v_existing      INT DEFAULT 0;
    DECLARE v_room_type_id  INT;
    DECLARE v_hotel_id      INT;
    DECLARE v_total_rooms   INT;
    DECLARE v_day           INT;
    DECLARE v_phase         INT;
    DECLARE v_target        INT;
    DECLARE v_i             INT;
    DECLARE v_offset        INT;
    DECLARE v_check_in      DATE;
    DECLARE v_guest_id      INT;
    DECLARE v_guest_count   INT DEFAULT 1;
    DECLARE v_booking_id    INT;
    DECLARE v_status        VARCHAR(25);

    DECLARE room_type_cursor CURSOR FOR
        SELECT room_type_id, hotel_id, total_rooms
        FROM room_type
        ORDER BY hotel_id, room_type_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    -- Idempotent: the same procedure can be called by the fresh-install DML
    -- and by the additive migration without doubling the seeded bookings.
    SELECT COUNT(*) INTO v_existing
    FROM booking WHERE special_requests = 'Demo demand wave seed';
    IF v_existing > 0 THEN
        LEAVE seed_proc;
    END IF;

    SELECT COUNT(*) INTO v_guest_count FROM guest;

    OPEN room_type_cursor;
    room_types: LOOP
        FETCH room_type_cursor INTO v_room_type_id, v_hotel_id, v_total_rooms;
        IF v_done = 1 THEN
            LEAVE room_types;
        END IF;

        SET v_day = -2;
        demand_days: WHILE v_day <= 20 DO
            IF v_hotel_id IN (1, 2) AND v_day BETWEEN 0 AND 1 THEN
                SET v_day = v_day + 1;
                ITERATE demand_days;
            END IF;

            SET v_phase = MOD(v_day + 7, 7);
            SET v_target = CASE v_phase
                WHEN 0 THEN v_total_rooms - 2
                WHEN 1 THEN v_total_rooms + 1
                WHEN 2 THEN v_total_rooms - 1
                WHEN 3 THEN v_total_rooms + 2
                WHEN 4 THEN v_total_rooms - 3
                WHEN 5 THEN v_total_rooms
                ELSE v_total_rooms - 1
            END;
            SET v_target = GREATEST(0, v_target);
            SET v_check_in = DATE_ADD(CURRENT_DATE, INTERVAL v_day DAY);

            SET v_i = 0;
            demand_rooms: WHILE v_i < v_target DO
                SET v_offset = MOD(v_day + 1000 + v_room_type_id * 3 + v_i, v_guest_count);
                SELECT guest_id INTO v_guest_id
                  FROM guest
                 ORDER BY guest_id
                 LIMIT v_offset, 1;

                CALL sp_create_booking(
                    v_guest_id, v_room_type_id, v_check_in,
                    DATE_ADD(v_check_in, INTERVAL 1 DAY), 1,
                    v_booking_id, v_status
                );

                IF v_booking_id IS NOT NULL THEN
                    UPDATE booking
                       SET special_requests = 'Demo demand wave seed'
                     WHERE booking_id = v_booking_id;
                END IF;

                SET v_i = v_i + 1;
            END WHILE demand_rooms;

            SET v_day = v_day + 1;
        END WHILE demand_days;
    END LOOP;
    CLOSE room_type_cursor;
END$$

DELIMITER ;

CALL sp_seed_demo_demand();

-- Populate the chart table once so a fresh install can be inspected without
-- opening the admin UI first. The API refreshes it on every chart request.
CALL sp_refresh_inventory_plan(CURRENT_DATE, 60);

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
