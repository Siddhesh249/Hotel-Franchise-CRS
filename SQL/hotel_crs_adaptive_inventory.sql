-- ============================================================================
-- Hotel Franchise CRS -- ADDITIVE upgrade: adaptive daily inventory plan
--
-- Use this on an EXISTING `hotel_crs` database that was created before the
-- adaptive inventory feature. It never drops the database and never deletes
-- guest, booking, payment, or room-assignment rows.
--
-- What it does:
--   1. Creates `daily_inventory_plan` (one row per hotel per night).
--   2. Installs `fn_dynamic_buffer_rooms()` + an adaptive `fn_available_rooms()`.
--   3. Installs `sp_refresh_hotel_inventory_plan()` / `sp_refresh_inventory_plan()`.
--   4. Reinstalls `sp_create_booking()` / `sp_try_promote_waitlist()` so the
--      booking engine uses the same adaptive buffer as the chart.
--   5. Adds the four extra properties (Whitefield, Hitech City, BKC, Aerocity),
--      their room types, physical rooms, staff logins, and policies.
--   6. Seeds a patterned three-week demand wave (idempotent).
--   7. Refreshes the plan for the next 60 days.
--
-- Every data insert is idempotent (INSERT IGNORE on existing unique keys), and
-- the demand wave skips itself if it has already been seeded.
--
-- Run:  mariadb hotel_crs < SQL/hotel_crs_adaptive_inventory.sql
-- ============================================================================

USE hotel_crs;

SET @demo_password_hash = '$2b$12$1ugpwnX.DaFfZmJD8TfzhuO8rYHNvpXMw8ukiqGTkNm1G.dcLM6qa';

-- ============================================================================
-- 1. Materialised daily plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_inventory_plan (
    plan_id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    hotel_id            INT NOT NULL,
    stay_date           DATE NOT NULL,
    physical_rooms      INT NOT NULL,
    base_buffer_rooms   INT NOT NULL DEFAULT 0,
    buffer_rooms        INT NOT NULL DEFAULT 0,
    max_sellable_rooms  INT NOT NULL,
    booked_rooms        INT NOT NULL DEFAULT 0,
    generated_on        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_daily_plan_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_daily_plan_hotel_date UNIQUE (hotel_id, stay_date),
    CONSTRAINT chk_plan_nonneg CHECK (
        physical_rooms >= 0 AND base_buffer_rooms >= 0
        AND buffer_rooms >= 0 AND booked_rooms >= 0
    )
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_daily_plan_date ON daily_inventory_plan (stay_date);

-- ============================================================================
-- 2. Adaptive buffer functions
-- ============================================================================

DROP FUNCTION IF EXISTS fn_available_rooms;
DROP FUNCTION IF EXISTS fn_dynamic_buffer_rooms;

DELIMITER $$

-- The feedback controller behind the pattern:
--   previous night under physical capacity -> tomorrow's buffer grows
--   previous night above physical capacity -> tomorrow's buffer shrinks
-- The adjustment is proportional to the slack and capped at +/- the base
-- buffer. No previous-night ledger rows means "no demand signal yet", so the
-- base buffer is used.
CREATE FUNCTION fn_dynamic_buffer_rooms(p_room_type_id INT, p_stay_date DATE)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_hotel_id        INT DEFAULT NULL;
    DECLARE v_base_buffer     INT DEFAULT 0;
    DECLARE v_hotel_physical  INT DEFAULT 0;
    DECLARE v_prev_rows       INT DEFAULT 0;
    DECLARE v_prev_booked     INT DEFAULT 0;
    DECLARE v_adjustment      INT DEFAULT 0;

    SELECT rt.hotel_id,
           FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)
      INTO v_hotel_id, v_base_buffer
    FROM room_type rt
    LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id
    WHERE rt.room_type_id = p_room_type_id;

    IF v_hotel_id IS NULL OR v_base_buffer <= 0 OR p_stay_date IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(SUM(rt.total_rooms), 0)
      INTO v_hotel_physical
    FROM room_type rt
    WHERE rt.hotel_id = v_hotel_id;

    SELECT COUNT(*), COALESCE(SUM(i.booked_count), 0)
      INTO v_prev_rows, v_prev_booked
    FROM room_type_inventory i
    JOIN room_type rt ON rt.room_type_id = i.room_type_id
    WHERE rt.hotel_id = v_hotel_id
      AND i.stay_date = DATE_SUB(p_stay_date, INTERVAL 1 DAY);

    IF v_prev_rows = 0 OR v_hotel_physical = 0 THEN
        RETURN v_base_buffer;
    END IF;

    IF v_prev_booked < v_hotel_physical THEN
        SET v_adjustment = CEIL((v_hotel_physical - v_prev_booked) * v_base_buffer / v_hotel_physical);
    ELSEIF v_prev_booked > v_hotel_physical THEN
        SET v_adjustment = -CEIL((v_prev_booked - v_hotel_physical) * v_base_buffer / v_hotel_physical);
    END IF;

    IF v_adjustment > v_base_buffer THEN
        SET v_adjustment = v_base_buffer;
    ELSEIF v_adjustment < -v_base_buffer THEN
        SET v_adjustment = -v_base_buffer;
    END IF;

    RETURN GREATEST(0, v_base_buffer + v_adjustment);
END$$

CREATE FUNCTION fn_available_rooms(p_room_type_id INT, p_stay_date DATE)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_total_rooms INT DEFAULT 0;
    DECLARE v_buffer      INT DEFAULT 0;
    DECLARE v_booked      INT DEFAULT 0;

    SELECT total_rooms INTO v_total_rooms
    FROM room_type WHERE room_type_id = p_room_type_id;

    SET v_buffer = fn_dynamic_buffer_rooms(p_room_type_id, p_stay_date);

    SET v_booked = COALESCE(
        (SELECT booked_count FROM room_type_inventory
         WHERE room_type_id = p_room_type_id AND stay_date = p_stay_date), 0);

    RETURN (v_total_rooms + v_buffer) - v_booked;
END$$

DELIMITER ;

-- ============================================================================
-- 3. Plan refresh procedures
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_refresh_inventory_plan;
DROP PROCEDURE IF EXISTS sp_refresh_hotel_inventory_plan;

DELIMITER $$

CREATE PROCEDURE sp_refresh_hotel_inventory_plan(
    IN p_hotel_id    INT,
    IN p_start_date  DATE,
    IN p_days        INT
)
this_proc: BEGIN
    DECLARE v_day             INT DEFAULT 0;
    DECLARE v_date            DATE;
    DECLARE v_physical        INT DEFAULT 0;
    DECLARE v_base_buffer     INT DEFAULT 0;
    DECLARE v_dynamic_buffer  INT DEFAULT 0;
    DECLARE v_max_sellable    INT DEFAULT 0;
    DECLARE v_booked          INT DEFAULT 0;

    IF p_hotel_id IS NULL OR p_start_date IS NULL OR p_days IS NULL
       OR p_days < 1 OR p_days > 366 THEN
        LEAVE this_proc;
    END IF;

    SELECT COALESCE(SUM(rt.total_rooms), 0),
           COALESCE(SUM(FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)), 0)
      INTO v_physical, v_base_buffer
    FROM room_type rt
    LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id
    WHERE rt.hotel_id = p_hotel_id;

    DELETE FROM daily_inventory_plan
     WHERE hotel_id = p_hotel_id
       AND stay_date BETWEEN p_start_date
                         AND DATE_ADD(p_start_date, INTERVAL p_days - 1 DAY);

    WHILE v_day < p_days DO
        SET v_date = DATE_ADD(p_start_date, INTERVAL v_day DAY);

        SELECT COALESCE(SUM(i.booked_count), 0)
          INTO v_booked
        FROM room_type_inventory i
        JOIN room_type rt ON rt.room_type_id = i.room_type_id
        WHERE rt.hotel_id = p_hotel_id
          AND i.stay_date = v_date;

        SELECT COALESCE(SUM(rt.total_rooms + fn_dynamic_buffer_rooms(rt.room_type_id, v_date)), 0)
          INTO v_max_sellable
        FROM room_type rt
        WHERE rt.hotel_id = p_hotel_id;

        SET v_dynamic_buffer = GREATEST(0, v_max_sellable - v_physical);

        INSERT INTO daily_inventory_plan
            (hotel_id, stay_date, physical_rooms, base_buffer_rooms,
             buffer_rooms, max_sellable_rooms, booked_rooms)
        VALUES
            (p_hotel_id, v_date, v_physical, v_base_buffer,
             v_dynamic_buffer, v_max_sellable, v_booked)
        ON DUPLICATE KEY UPDATE
            physical_rooms     = VALUES(physical_rooms),
            base_buffer_rooms  = VALUES(base_buffer_rooms),
            buffer_rooms       = VALUES(buffer_rooms),
            max_sellable_rooms = VALUES(max_sellable_rooms),
            booked_rooms       = VALUES(booked_rooms),
            generated_on       = CURRENT_TIMESTAMP;

        SET v_day = v_day + 1;
    END WHILE;
END$$

CREATE PROCEDURE sp_refresh_inventory_plan(
    IN p_start_date DATE,
    IN p_days       INT
)
BEGIN
    DECLARE v_done     INT DEFAULT 0;
    DECLARE v_hotel_id INT;

    DECLARE hotel_cursor CURSOR FOR
        SELECT hotel_id FROM hotel ORDER BY hotel_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN hotel_cursor;
    read_hotels: LOOP
        FETCH hotel_cursor INTO v_hotel_id;
        IF v_done = 1 THEN
            LEAVE read_hotels;
        END IF;
        CALL sp_refresh_hotel_inventory_plan(v_hotel_id, p_start_date, p_days);
    END LOOP;
    CLOSE hotel_cursor;
END$$

DELIMITER ;

-- ============================================================================
-- 4. Reinstall booking procedures with the adaptive buffer
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_create_booking;
DROP PROCEDURE IF EXISTS sp_try_promote_waitlist;

DELIMITER $$

CREATE PROCEDURE sp_try_promote_waitlist(IN p_booking_id INT)
this_proc: BEGIN
    DECLARE v_room_type_id     INT;
    DECLARE v_check_in         DATE;
    DECLARE v_check_out        DATE;
    DECLARE v_total_rooms      INT;
    DECLARE v_min_avail        INT;
    DECLARE v_min_physical_avail INT;

    SELECT room_type_id, check_in_date, check_out_date
    INTO v_room_type_id, v_check_in, v_check_out
    FROM booking WHERE booking_id = p_booking_id AND booking_status = 'Waitlisted';

    IF v_room_type_id IS NULL THEN
        LEAVE this_proc;
    END IF;

    SELECT total_rooms INTO v_total_rooms FROM room_type WHERE room_type_id = v_room_type_id;

    START TRANSACTION;

    SELECT MIN(rt.total_rooms + fn_dynamic_buffer_rooms(rt.room_type_id, i.stay_date) - i.booked_count),
           MIN(rt.total_rooms - i.booked_count)
      INTO v_min_avail, v_min_physical_avail
    FROM room_type_inventory i
    JOIN room_type rt ON rt.room_type_id = i.room_type_id
    WHERE i.room_type_id = v_room_type_id
      AND i.stay_date >= v_check_in AND i.stay_date < v_check_out
    FOR UPDATE;

    IF v_min_avail >= 1 THEN
        UPDATE booking
        SET booking_status = 'Confirmed',
            is_overbooked = (v_min_physical_avail < 1)
        WHERE booking_id = p_booking_id;

        UPDATE room_type_inventory
        SET booked_count = booked_count + 1
        WHERE room_type_id = v_room_type_id
          AND stay_date >= v_check_in AND stay_date < v_check_out;
    END IF;

    COMMIT;
END$$

CREATE PROCEDURE sp_create_booking(
    IN  p_guest_id      INT,
    IN  p_room_type_id  INT,
    IN  p_check_in      DATE,
    IN  p_check_out     DATE,
    IN  p_num_guests    TINYINT,
    OUT p_booking_id    INT,
    OUT p_status        VARCHAR(25)
)
this_proc: BEGIN
    DECLARE v_date         DATE;
    DECLARE v_min_avail    INT;
    DECLARE v_min_physical_avail INT;
    DECLARE v_total_rooms  INT;
    DECLARE v_max_occupancy TINYINT;
    DECLARE v_price        DECIMAL(10,2);
    DECLARE v_nights       INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
        SET p_booking_id = NULL;
    END;

    IF p_check_out <= p_check_in THEN
        SET p_status = 'INVALID_DATES';
        SET p_booking_id = NULL;
        LEAVE this_proc;
    END IF;

    SELECT total_rooms, base_price, max_occupancy
      INTO v_total_rooms, v_price, v_max_occupancy
    FROM room_type WHERE room_type_id = p_room_type_id;

    IF v_total_rooms IS NULL THEN
        SET p_status = 'INVALID_ROOM_TYPE';
        SET p_booking_id = NULL;
        LEAVE this_proc;
    END IF;

    IF p_num_guests IS NULL OR p_num_guests < 1 OR p_num_guests > v_max_occupancy THEN
        SET p_status = 'INVALID_GUESTS';
        SET p_booking_id = NULL;
        LEAVE this_proc;
    END IF;

    SET v_nights  = DATEDIFF(p_check_out, p_check_in);

    START TRANSACTION;

    SET v_date = p_check_in;
    WHILE v_date < p_check_out DO
        INSERT IGNORE INTO room_type_inventory (room_type_id, stay_date, booked_count)
        VALUES (p_room_type_id, v_date, 0);
        SET v_date = DATE_ADD(v_date, INTERVAL 1 DAY);
    END WHILE;

    SELECT MIN(rt.total_rooms + fn_dynamic_buffer_rooms(rt.room_type_id, i.stay_date) - i.booked_count),
           MIN(rt.total_rooms - i.booked_count)
      INTO v_min_avail, v_min_physical_avail
    FROM room_type_inventory i
    JOIN room_type rt ON rt.room_type_id = i.room_type_id
    WHERE i.room_type_id = p_room_type_id
      AND i.stay_date >= p_check_in AND i.stay_date < p_check_out
    FOR UPDATE;

    IF v_min_avail >= 1 THEN
        INSERT INTO booking (guest_id, room_type_id, check_in_date, check_out_date,
                              num_guests, booking_status, is_overbooked, total_amount)
        VALUES (p_guest_id, p_room_type_id, p_check_in, p_check_out, p_num_guests,
                'Confirmed', (v_min_physical_avail < 1), v_price * v_nights);

        SET p_booking_id = LAST_INSERT_ID();
        SET p_status = IF(v_min_physical_avail < 1, 'CONFIRMED_OVERBOOKED', 'CONFIRMED');

        UPDATE room_type_inventory
        SET booked_count = booked_count + 1
        WHERE room_type_id = p_room_type_id
          AND stay_date >= p_check_in AND stay_date < p_check_out;
    ELSE
        INSERT INTO booking (guest_id, room_type_id, check_in_date, check_out_date,
                              num_guests, booking_status, is_overbooked, total_amount)
        VALUES (p_guest_id, p_room_type_id, p_check_in, p_check_out, p_num_guests,
                'Waitlisted', FALSE, v_price * v_nights);

        SET p_booking_id = LAST_INSERT_ID();
        SET p_status = 'WAITLISTED';
    END IF;

    COMMIT;
END$$

DELIMITER ;

-- ============================================================================
-- 5. Extra properties (existing hotels/room types are left untouched)
-- ============================================================================

INSERT IGNORE INTO hotel (franchise_id, hotel_name, city, state, address, star_rating, contact_number)
SELECT f.franchise_id, v.hotel_name, v.city, v.state, v.address, v.star_rating, v.contact_number
FROM (
    SELECT 'Nightingale Suites - Whitefield'  AS hotel_name, 'Bengaluru' AS city, 'Karnataka'   AS state, 'ITPL Main Road'          AS address, 4 AS star_rating, '08041234568' AS contact_number
    UNION ALL
    SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Telangana',   'Madhapur, Hitech City',   4, '04041234567'
    UNION ALL
    SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Maharashtra', 'Bandra Kurla Complex',    5, '02241234568'
    UNION ALL
    SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Delhi',       'Aerocity, IGI Airport',   5, '01141234567'
) v
CROSS JOIN (SELECT MIN(franchise_id) AS franchise_id FROM franchise) f
WHERE f.franchise_id IS NOT NULL;

INSERT IGNORE INTO staff_account (hotel_id, full_name, email, password_hash, role)
SELECT h.hotel_id, v.full_name, v.email, @demo_password_hash, 'Staff'
FROM (
    SELECT 'Nightingale Suites - Whitefield'  AS hotel_name, 'Bengaluru' AS city, 'Whitefield Front Desk'  AS full_name, 'staff.whitefield@example.com' AS email
    UNION ALL
    SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Hitech City Front Desk', 'staff.hitech@example.com'
    UNION ALL
    SELECT 'Nightingale Suites - BKC',         'Mumbai',    'BKC Front Desk',         'staff.bkc@example.com'
    UNION ALL
    SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Aerocity Front Desk',    'staff.aerocity@example.com'
) v
JOIN hotel h ON h.hotel_name = v.hotel_name AND h.city = v.city;

INSERT IGNORE INTO room_type (hotel_id, type_name, base_price, max_occupancy, total_rooms)
SELECT h.hotel_id, v.type_name, v.base_price, v.max_occupancy, v.total_rooms
FROM (
    SELECT 'Nightingale Suites - Whitefield'  AS hotel_name, 'Bengaluru' AS city, 'Standard' AS type_name, 3600.00 AS base_price, 2 AS max_occupancy, 10 AS total_rooms
    UNION ALL
    SELECT 'Nightingale Suites - Whitefield',  'Bengaluru', 'Deluxe', 5700.00, 3, 6
    UNION ALL
    SELECT 'Nightingale Suites - Whitefield',  'Bengaluru', 'Suite',  9200.00, 4, 3
    UNION ALL
    SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', 3900.00, 2, 9
    UNION ALL
    SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe',   6100.00, 3, 6
    UNION ALL
    SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Suite',    9800.00, 4, 3
    UNION ALL
    SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Standard', 4800.00, 2, 12
    UNION ALL
    SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Deluxe',   7400.00, 3, 8
    UNION ALL
    SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Suite',   12500.00, 4, 4
    UNION ALL
    SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Standard', 4200.00, 2, 8
    UNION ALL
    SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Deluxe',   6600.00, 3, 6
    UNION ALL
    SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Suite',   10800.00, 4, 3
) v
JOIN hotel h ON h.hotel_name = v.hotel_name AND h.city = v.city;

-- Physical rooms. Room numbers are unique per hotel, so INSERT IGNORE makes
-- this safe to run twice.
INSERT IGNORE INTO room (hotel_id, room_type_id, room_number, floor_number)
SELECT h.hotel_id, rt.room_type_id, v.room_number, v.floor_number
FROM (
    -- Whitefield (19 rooms)
    SELECT 'Nightingale Suites - Whitefield' AS hotel_name, 'Bengaluru' AS city, 'Standard' AS type_name, '101' AS room_number, 1 AS floor_number
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '102', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '103', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '104', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '105', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '106', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '107', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '108', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '109', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Standard', '110', 1
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '201', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '202', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '203', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '204', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '205', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Deluxe', '206', 2
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Suite', '301', 3
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Suite', '302', 3
    UNION ALL SELECT 'Nightingale Suites - Whitefield', 'Bengaluru', 'Suite', '303', 3
    -- Hitech City (18 rooms)
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '101', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '102', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '103', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '104', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '105', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '106', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '107', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '108', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', '109', 1
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '201', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '202', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '203', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '204', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '205', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe', '206', 2
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Suite', '301', 3
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Suite', '302', 3
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Suite', '303', 3
    -- BKC (24 rooms)
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '101', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '102', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '103', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '104', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '105', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '106', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '107', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '108', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '109', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '110', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '111', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Standard', '112', 1
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '201', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '202', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '203', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '204', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '205', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '206', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '207', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Deluxe', '208', 2
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Suite', '301', 3
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Suite', '302', 3
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Suite', '303', 3
    UNION ALL SELECT 'Nightingale Suites - BKC', 'Mumbai', 'Suite', '304', 3
    -- Aerocity (17 rooms)
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '101', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '102', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '103', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '104', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '105', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '106', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '107', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Standard', '108', 1
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '201', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '202', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '203', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '204', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '205', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Deluxe', '206', 2
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Suite', '301', 3
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Suite', '302', 3
    UNION ALL SELECT 'Nightingale Suites - Aerocity', 'Delhi', 'Suite', '303', 3
) v
JOIN hotel h ON h.hotel_name = v.hotel_name AND h.city = v.city
JOIN room_type rt ON rt.hotel_id = h.hotel_id AND rt.type_name = v.type_name;

-- Policies for the new room types. Existing policies are intentionally left
-- alone, so an admin's current percentages survive the upgrade.
INSERT IGNORE INTO overbooking_policy (room_type_id, overbook_percentage)
SELECT rt.room_type_id, v.overbook_percentage
FROM (
    SELECT 'Nightingale Suites - Whitefield'  AS hotel_name, 'Bengaluru' AS city, 'Standard' AS type_name, 20.00 AS overbook_percentage
    UNION ALL SELECT 'Nightingale Suites - Whitefield',  'Bengaluru', 'Deluxe', 12.00
    UNION ALL SELECT 'Nightingale Suites - Whitefield',  'Bengaluru', 'Suite',   0.00
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Standard', 18.00
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Deluxe',   10.00
    UNION ALL SELECT 'Nightingale Suites - Hitech City', 'Hyderabad', 'Suite',     0.00
    UNION ALL SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Standard', 22.00
    UNION ALL SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Deluxe',   15.00
    UNION ALL SELECT 'Nightingale Suites - BKC',         'Mumbai',    'Suite',     0.00
    UNION ALL SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Standard', 20.00
    UNION ALL SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Deluxe',   10.00
    UNION ALL SELECT 'Nightingale Suites - Aerocity',    'Delhi',     'Suite',     0.00
) v
JOIN hotel h ON h.hotel_name = v.hotel_name AND h.city = v.city
JOIN room_type rt ON rt.hotel_id = h.hotel_id AND rt.type_name = v.type_name;

-- Extra guests. Existing emails are skipped, including user-created ones.
INSERT IGNORE INTO guest (first_name, last_name, email, phone, address, password_hash) VALUES
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

-- ============================================================================
-- 6. Patterned three-week demand wave (idempotent)
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
            -- Keep the original Koramangala/Andheri overbooking walkthrough
            -- intact for today and tomorrow.
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

-- ============================================================================
-- 7. Materialise the plan so the admin chart has data immediately
-- ============================================================================

CALL sp_refresh_inventory_plan(CURRENT_DATE, 60);

-- Quick verification: physical is flat, max sellable moves with the wave.
SELECT h.hotel_name,
       p.stay_date,
       p.physical_rooms,
       p.base_buffer_rooms,
       p.buffer_rooms,
       p.max_sellable_rooms,
       p.booked_rooms
FROM daily_inventory_plan p
JOIN hotel h ON h.hotel_id = p.hotel_id
WHERE p.stay_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 13 DAY)
ORDER BY h.hotel_name, p.stay_date
LIMIT 30;
