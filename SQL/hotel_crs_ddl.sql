-- ============================================================================
-- Hotel Franchise Central Reservation System (CRS) with Overbooking Logic
-- DDL: schema, views, functions, stored procedures and triggers
-- Target: MariaDB 10.6+ (developed against 11.8), InnoDB.
--
-- All identifiers are lowercase snake_case: MariaDB on Linux treats table
-- names as case-sensitive by default.
--
-- WARNING: the first statement drops and recreates the hotel_crs database.
-- ============================================================================

DROP DATABASE IF EXISTS hotel_crs;
CREATE DATABASE hotel_crs;
USE hotel_crs;

-- ============================================================================
-- SECTION 1: Containment hierarchy  franchise -> hotel -> room_type -> room
-- ============================================================================

CREATE TABLE franchise (
    franchise_id       INT AUTO_INCREMENT PRIMARY KEY,
    franchise_name     VARCHAR(100) NOT NULL,
    headquarters_city  VARCHAR(50),
    founded_year       YEAR,
    CONSTRAINT uq_franchise_name UNIQUE (franchise_name)
) ENGINE=InnoDB;

CREATE TABLE hotel (
    hotel_id        INT AUTO_INCREMENT PRIMARY KEY,
    franchise_id    INT NOT NULL,
    hotel_name      VARCHAR(100) NOT NULL,
    city            VARCHAR(50)  NOT NULL,
    state           VARCHAR(50),
    address         VARCHAR(200),
    star_rating     TINYINT,
    contact_number  VARCHAR(15),
    CONSTRAINT fk_hotel_franchise FOREIGN KEY (franchise_id)
        REFERENCES franchise(franchise_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hotel_name_city UNIQUE (hotel_name, city),
    CONSTRAINT chk_star_rating CHECK (star_rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE room_type (
    room_type_id    INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id        INT NOT NULL,
    type_name       VARCHAR(50) NOT NULL,
    base_price      DECIMAL(10,2) NOT NULL,
    max_occupancy   TINYINT NOT NULL DEFAULT 2,
    total_rooms     INT NOT NULL,               -- physical inventory of this category
    CONSTRAINT fk_roomtype_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hotel_roomtype UNIQUE (hotel_id, type_name),
    -- lets room reference (room_type_id, hotel_id) so a room can never sit in
    -- a different hotel from its room type
    CONSTRAINT uq_roomtype_hotel UNIQUE (room_type_id, hotel_id),
    CONSTRAINT chk_base_price CHECK (base_price > 0),
    CONSTRAINT chk_max_occupancy CHECK (max_occupancy >= 1),
    CONSTRAINT chk_total_rooms CHECK (total_rooms > 0)
) ENGINE=InnoDB;

CREATE TABLE room (
    room_id       INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id      INT NOT NULL,
    room_type_id  INT NOT NULL,
    room_number   VARCHAR(10) NOT NULL,
    floor_number  TINYINT,
    room_status   ENUM('Available','Maintenance','OutOfService') NOT NULL DEFAULT 'Available',
    -- hotel_id is derivable from room_type_id. It is kept on purpose so that
    -- "room numbers are unique per building" is a plain UNIQUE constraint; the
    -- composite foreign key below guarantees the two can never disagree.
    CONSTRAINT fk_room_roomtype FOREIGN KEY (room_type_id, hotel_id)
        REFERENCES room_type(room_type_id, hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hotel_roomnumber UNIQUE (hotel_id, room_number)
) ENGINE=InnoDB;

-- ============================================================================
-- SECTION 2: People
-- ============================================================================

CREATE TABLE guest (
    guest_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name     VARCHAR(50)  NOT NULL,
    last_name      VARCHAR(50)  NOT NULL,
    email          VARCHAR(100) NOT NULL,
    phone          VARCHAR(15),
    address        VARCHAR(200),
    password_hash  VARCHAR(255) NOT NULL,
    registered_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_guest_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE staff_account (
    staff_id       INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id       INT NULL,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           ENUM('Admin','Staff') NOT NULL,
    created_on     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_staff_email UNIQUE (email)
) ENGINE=InnoDB;

-- MariaDB rejects a CHECK that references a column used by an ON UPDATE
-- CASCADE foreign key, so the rule "Admin = franchise-wide (no hotel), Staff =
-- exactly one hotel" is enforced with triggers instead.
DELIMITER $$
CREATE TRIGGER trg_staff_account_scope_insert
BEFORE INSERT ON staff_account
FOR EACH ROW
BEGIN
    IF (NEW.role = 'Admin' AND NEW.hotel_id IS NOT NULL)
       OR (NEW.role = 'Staff' AND NEW.hotel_id IS NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Admin accounts must not have a hotel; Staff accounts must have one.';
    END IF;
END$$

CREATE TRIGGER trg_staff_account_scope_update
BEFORE UPDATE ON staff_account
FOR EACH ROW
BEGIN
    IF (NEW.role = 'Admin' AND NEW.hotel_id IS NOT NULL)
       OR (NEW.role = 'Staff' AND NEW.hotel_id IS NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Admin accounts must not have a hotel; Staff accounts must have one.';
    END IF;
END$$
DELIMITER ;

-- ============================================================================
-- SECTION 3: Overbooking engine tables
-- ============================================================================

-- Optional policy row per room type: how aggressively may it be oversold?
CREATE TABLE overbooking_policy (
    policy_id            INT AUTO_INCREMENT PRIMARY KEY,
    room_type_id         INT NOT NULL,
    overbook_percentage  DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    updated_on           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_policy_roomtype FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_policy_roomtype UNIQUE (room_type_id),
    CONSTRAINT chk_overbook_pct CHECK (overbook_percentage BETWEEN 0 AND 50)
) ENGINE=InnoDB;

-- The per-night ledger: one row per (room type, night) holding how many
-- active bookings cover that night. This is the single row set that the
-- booking procedures read and lock. Rows are created on first touch.
CREATE TABLE room_type_inventory (
    inventory_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_type_id  INT NOT NULL,
    stay_date     DATE NOT NULL,
    booked_count  INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_inv_roomtype FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_inv_roomtype_date UNIQUE (room_type_id, stay_date),
    CONSTRAINT chk_booked_nonneg CHECK (booked_count >= 0)
) ENGINE=InnoDB;

-- Materialised daily picture per hotel for the admin chart. It is derived
-- data (fn_dynamic_buffer_rooms is the source of truth) and is rebuilt by
-- sp_refresh_hotel_inventory_plan.
CREATE TABLE daily_inventory_plan (
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

-- ============================================================================
-- SECTION 4: Transactional tables
-- ============================================================================

CREATE TABLE booking (
    booking_id        INT AUTO_INCREMENT PRIMARY KEY,
    guest_id          INT NOT NULL,
    room_type_id      INT NOT NULL,
    check_in_date     DATE NOT NULL,
    check_out_date    DATE NOT NULL,
    num_guests        TINYINT NOT NULL DEFAULT 1,
    special_requests  VARCHAR(500),
    booking_status    ENUM('Confirmed','Waitlisted','Cancelled') NOT NULL DEFAULT 'Waitlisted',
    is_overbooked     BOOLEAN NOT NULL DEFAULT FALSE,
    booking_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount      DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_booking_guest FOREIGN KEY (guest_id)
        REFERENCES guest(guest_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_booking_roomtype FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_booking_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT chk_booking_guests CHECK (num_guests >= 1)
) ENGINE=InnoDB;

-- Which PHYSICAL room a confirmed booking ends up in. A booking guarantees a
-- room *type*; the specific room is chosen later by the front desk. That gap
-- is what makes overbooking possible.
CREATE TABLE room_assignment (
    assignment_id  INT AUTO_INCREMENT PRIMARY KEY,
    booking_id     INT NOT NULL,
    room_id        INT NOT NULL,
    assigned_on    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_assign_room FOREIGN KEY (room_id)
        REFERENCES room(room_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_assign_booking UNIQUE (booking_id)
) ENGINE=InnoDB;

CREATE TABLE payment (
    payment_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id      INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    payment_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method  ENUM('Card','UPI','NetBanking','Cash') NOT NULL,
    payment_status  ENUM('Completed','Refunded') NOT NULL DEFAULT 'Completed',
    -- MariaDB has no partial unique index. This generated column is the
    -- booking id while the payment is Completed and NULL otherwise, so the
    -- UNIQUE key below allows at most one live payment per booking.
    live_booking_id INT AS (IF(payment_status = 'Completed', booking_id, NULL)) PERSISTENT,
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT uq_one_live_payment UNIQUE (live_booking_id)
) ENGINE=InnoDB;

CREATE TABLE cancellation_history (
    cancellation_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id           INT NOT NULL,
    cancelled_on         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason  VARCHAR(200),
    refund_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_cancel_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_cancel_booking UNIQUE (booking_id)
) ENGINE=InnoDB;

-- ============================================================================
-- SECTION 5: Indexes for the engine's query patterns
-- ============================================================================

CREATE INDEX idx_booking_roomtype_dates ON booking (room_type_id, check_in_date, check_out_date);
CREATE INDEX idx_booking_waitlist       ON booking (room_type_id, booking_status, booking_date);
CREATE INDEX idx_booking_guest          ON booking (guest_id);
CREATE INDEX idx_daily_plan_date        ON daily_inventory_plan (stay_date);

-- ============================================================================
-- SECTION 6: Views
-- ============================================================================

-- Static per-room-type overbooking summary (not date-specific; see
-- fn_available_rooms for the live number on a given night).
CREATE VIEW vw_roomtype_overview AS
SELECT
    h.hotel_id,
    h.hotel_name,
    rt.room_type_id,
    rt.type_name,
    rt.total_rooms,
    COALESCE(op.overbook_percentage, 0)                                 AS overbook_percentage,
    FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)   AS base_buffer_rooms,
    rt.total_rooms + FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)
                                                                         AS base_max_sellable
FROM room_type rt
JOIN hotel h ON h.hotel_id = rt.hotel_id
LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id;

-- One denormalised row per booking: guest, hotel, payment, assigned room and
-- where the stay sits relative to today. The guest and staff screens read this.
CREATE VIEW vw_booking_details AS
SELECT
    b.booking_id, b.guest_id, b.room_type_id,
    b.check_in_date, b.check_out_date,
    DATEDIFF(b.check_out_date, b.check_in_date) AS nights,
    b.num_guests, b.special_requests, b.booking_status, b.is_overbooked,
    b.booking_date, b.total_amount,
    CASE
        WHEN b.check_out_date <= CURRENT_DATE THEN 'Past'
        WHEN b.check_in_date  >  CURRENT_DATE THEN 'Upcoming'
        ELSE 'Current'
    END AS stay_phase,
    g.first_name, g.last_name, g.email, g.phone,
    rt.type_name, rt.hotel_id, h.hotel_name, h.city, h.state,
    p.payment_id, p.payment_status, p.payment_method, p.amount AS paid_amount,
    ra.room_id, r.room_number
FROM booking b
JOIN guest g       ON g.guest_id = b.guest_id
JOIN room_type rt  ON rt.room_type_id = b.room_type_id
JOIN hotel h       ON h.hotel_id = rt.hotel_id
LEFT JOIN payment p          ON p.booking_id = b.booking_id
LEFT JOIN room_assignment ra ON ra.booking_id = b.booking_id
LEFT JOIN room r             ON r.room_id = ra.room_id;

-- ============================================================================
-- SECTION 7: Adaptive buffer functions (read-only)
--
-- A room type's base buffer is FLOOR(total_rooms * overbook_percentage / 100).
-- fn_dynamic_buffer_rooms() then adjusts it per night from the PREVIOUS
-- night's occupancy across the whole hotel:
--   previous night below physical capacity -> buffer grows   (sell more)
--   previous night above physical capacity -> buffer shrinks (be careful)
-- The adjustment is proportional to the slack and capped at +/- the base
-- buffer, so it never runs away or goes negative. With no previous-night
-- ledger rows (no demand signal) the base buffer is used.
--
-- The booking procedures, the availability search and the admin chart all use
-- this one function, so they cannot disagree.
-- ============================================================================

DELIMITER $$

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

    SELECT COALESCE(SUM(total_rooms), 0)
      INTO v_hotel_physical
    FROM room_type
    WHERE hotel_id = v_hotel_id;

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

-- Rooms still sellable for ONE room type on ONE night (can be negative if an
-- admin lowered the buffer after the night was sold).
CREATE FUNCTION fn_available_rooms(p_room_type_id INT, p_stay_date DATE)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_total_rooms INT DEFAULT 0;
    DECLARE v_booked      INT DEFAULT 0;

    SELECT total_rooms INTO v_total_rooms
    FROM room_type WHERE room_type_id = p_room_type_id;

    SET v_booked = COALESCE(
        (SELECT booked_count FROM room_type_inventory
         WHERE room_type_id = p_room_type_id AND stay_date = p_stay_date), 0);

    RETURN v_total_rooms + fn_dynamic_buffer_rooms(p_room_type_id, p_stay_date) - v_booked;
END$$

-- Rebuild the materialised daily plan for one hotel.
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

        INSERT INTO daily_inventory_plan
            (hotel_id, stay_date, physical_rooms, base_buffer_rooms,
             buffer_rooms, max_sellable_rooms, booked_rooms)
        VALUES
            (p_hotel_id, v_date, v_physical, v_base_buffer,
             GREATEST(0, v_max_sellable - v_physical), v_max_sellable, v_booked)
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

-- Rebuild the plan for every hotel.
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
-- SECTION 8: Transactional procedures (the soft overbooking layer)
--
-- Every booking mutation follows the same shape: lock, decide, write, commit.
--   1. Lock the room_type row, then the booking row (if one exists), then the
--      ledger rows for the stay (SELECT ... FOR UPDATE). The order is always
--      room_type -> booking -> ledger, so concurrent callers queue up instead
--      of deadlocking.
--   2. Decide from the locked values: confirm, flag as overbooked, or waitlist.
--   3. Write the booking and the ledger change, then COMMIT.
-- Because the decision is made while holding the locks, two guests can never
-- both be handed the last room. That is why it lives in the database.
-- ============================================================================

DELIMITER $$

-- Try to confirm ONE waitlisted booking now that capacity may have freed up.
CREATE PROCEDURE sp_try_promote_waitlist(IN p_booking_id INT)
this_proc: BEGIN
    DECLARE v_room_type_id       INT DEFAULT NULL;
    DECLARE v_locked_type        INT DEFAULT NULL;
    DECLARE v_check_in           DATE;
    DECLARE v_check_out          DATE;
    DECLARE v_min_avail          INT;
    DECLARE v_min_physical_avail INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- room_type_id never changes for a booking, so a plain read is safe here.
    SELECT room_type_id INTO v_room_type_id FROM booking WHERE booking_id = p_booking_id;
    IF v_room_type_id IS NULL THEN
        LEAVE this_proc;
    END IF;

    START TRANSACTION;

    SELECT room_type_id INTO v_locked_type FROM room_type
    WHERE room_type_id = v_room_type_id FOR UPDATE;

    SELECT check_in_date, check_out_date
      INTO v_check_in, v_check_out
    FROM booking
    WHERE booking_id = p_booking_id
      AND booking_status = 'Waitlisted'
      AND check_in_date >= CURRENT_DATE
    FOR UPDATE;

    IF v_check_in IS NULL THEN
        ROLLBACK;
        LEAVE this_proc;
    END IF;

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
               is_overbooked  = (v_min_physical_avail < 1)
         WHERE booking_id = p_booking_id;

        UPDATE room_type_inventory
           SET booked_count = booked_count + 1
         WHERE room_type_id = v_room_type_id
           AND stay_date >= v_check_in AND stay_date < v_check_out;
    END IF;

    COMMIT;
END$$

-- Walk the waitlist of one room type in FIFO order (oldest booking first) and
-- promote every booking that now fits. A booking whose dates still do not fit
-- is skipped rather than blocking the guests behind it.
CREATE PROCEDURE sp_promote_waitlist(IN p_room_type_id INT)
BEGIN
    DECLARE v_done       INT DEFAULT 0;
    DECLARE v_booking_id INT;

    DECLARE waitlist_cursor CURSOR FOR
        SELECT booking_id
        FROM booking
        WHERE room_type_id = p_room_type_id
          AND booking_status = 'Waitlisted'
          AND check_in_date >= CURRENT_DATE
        ORDER BY booking_date, booking_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN waitlist_cursor;
    promote_loop: LOOP
        FETCH waitlist_cursor INTO v_booking_id;
        IF v_done = 1 THEN
            LEAVE promote_loop;
        END IF;
        CALL sp_try_promote_waitlist(v_booking_id);
    END LOOP;
    CLOSE waitlist_cursor;
END$$

-- Outcomes (p_status): CONFIRMED, CONFIRMED_OVERBOOKED, WAITLISTED,
-- INVALID_DATES, INVALID_ROOM_TYPE, INVALID_GUEST, INVALID_GUESTS, ERROR
CREATE PROCEDURE sp_create_booking(
    IN  p_guest_id          INT,
    IN  p_room_type_id      INT,
    IN  p_check_in          DATE,
    IN  p_check_out         DATE,
    IN  p_num_guests        TINYINT,
    IN  p_special_requests  VARCHAR(500),
    OUT p_booking_id        INT,
    OUT p_status            VARCHAR(25)
)
this_proc: BEGIN
    DECLARE v_date               DATE;
    DECLARE v_min_avail          INT;
    DECLARE v_min_physical_avail INT;
    DECLARE v_total_rooms        INT;
    DECLARE v_max_occupancy      TINYINT;
    DECLARE v_price              DECIMAL(10,2);
    DECLARE v_nights             INT;
    DECLARE v_guest_exists       INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
        SET p_booking_id = NULL;
    END;

    SET p_booking_id = NULL;

    IF p_check_in IS NULL OR p_check_out IS NULL
       OR p_check_out <= p_check_in
       OR p_check_in < CURRENT_DATE
       OR DATEDIFF(p_check_out, p_check_in) > 60 THEN
        SET p_status = 'INVALID_DATES';
        LEAVE this_proc;
    END IF;

    SELECT COUNT(*) INTO v_guest_exists FROM guest WHERE guest_id = p_guest_id;
    IF v_guest_exists = 0 THEN
        SET p_status = 'INVALID_GUEST';
        LEAVE this_proc;
    END IF;

    START TRANSACTION;

    -- Per-room-type lock: concurrent bookings for the same category queue here.
    SELECT total_rooms, base_price, max_occupancy
      INTO v_total_rooms, v_price, v_max_occupancy
    FROM room_type WHERE room_type_id = p_room_type_id
    FOR UPDATE;

    IF v_total_rooms IS NULL THEN
        ROLLBACK;
        SET p_status = 'INVALID_ROOM_TYPE';
        LEAVE this_proc;
    END IF;

    IF p_num_guests IS NULL OR p_num_guests < 1 OR p_num_guests > v_max_occupancy THEN
        ROLLBACK;
        SET p_status = 'INVALID_GUESTS';
        LEAVE this_proc;
    END IF;

    SET v_nights = DATEDIFF(p_check_out, p_check_in);

    -- Make sure every night has a ledger row so there is something to lock.
    SET v_date = p_check_in;
    WHILE v_date < p_check_out DO
        INSERT IGNORE INTO room_type_inventory (room_type_id, stay_date, booked_count)
        VALUES (p_room_type_id, v_date, 0);
        SET v_date = DATE_ADD(v_date, INTERVAL 1 DAY);
    END WHILE;

    -- The tightest night decides the whole stay; FOR UPDATE locks them all.
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
                             num_guests, special_requests, booking_status,
                             is_overbooked, total_amount)
        VALUES (p_guest_id, p_room_type_id, p_check_in, p_check_out,
                p_num_guests, NULLIF(TRIM(p_special_requests), ''), 'Confirmed',
                (v_min_physical_avail < 1), v_price * v_nights);

        SET p_booking_id = LAST_INSERT_ID();
        SET p_status = IF(v_min_physical_avail < 1, 'CONFIRMED_OVERBOOKED', 'CONFIRMED');

        UPDATE room_type_inventory
           SET booked_count = booked_count + 1
         WHERE room_type_id = p_room_type_id
           AND stay_date >= p_check_in AND stay_date < p_check_out;
    ELSE
        INSERT INTO booking (guest_id, room_type_id, check_in_date, check_out_date,
                             num_guests, special_requests, booking_status,
                             is_overbooked, total_amount)
        VALUES (p_guest_id, p_room_type_id, p_check_in, p_check_out,
                p_num_guests, NULLIF(TRIM(p_special_requests), ''), 'Waitlisted',
                FALSE, v_price * v_nights);

        SET p_booking_id = LAST_INSERT_ID();
        SET p_status = 'WAITLISTED';
    END IF;

    COMMIT;
END$$

-- Outcomes (p_status): CANCELLED, NOT_FOUND, ALREADY_CANCELLED, STAY_STARTED, ERROR
-- p_guest_id may be NULL for an internal (non-guest) cancellation; otherwise
-- the booking must belong to that guest.
-- A cancelled paid booking is refunded in full: the payment is marked
-- Refunded and the amount is recorded in cancellation_history.
CREATE PROCEDURE sp_cancel_booking(
    IN  p_booking_id  INT,
    IN  p_guest_id    INT,
    IN  p_reason      VARCHAR(200),
    OUT p_status      VARCHAR(25)
)
this_proc: BEGIN
    DECLARE v_room_type_id INT DEFAULT NULL;
    DECLARE v_locked_type  INT DEFAULT NULL;
    DECLARE v_guest_id     INT DEFAULT NULL;
    DECLARE v_check_in     DATE;
    DECLARE v_check_out    DATE;
    DECLARE v_status       VARCHAR(20);
    DECLARE v_refund       DECIMAL(10,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
    END;

    -- room_type_id never changes for a booking, so a plain read is safe here.
    SELECT room_type_id INTO v_room_type_id FROM booking WHERE booking_id = p_booking_id;
    IF v_room_type_id IS NULL THEN
        SET p_status = 'NOT_FOUND';
        LEAVE this_proc;
    END IF;

    START TRANSACTION;

    SELECT room_type_id INTO v_locked_type FROM room_type
    WHERE room_type_id = v_room_type_id FOR UPDATE;

    SELECT guest_id, check_in_date, check_out_date, booking_status
      INTO v_guest_id, v_check_in, v_check_out, v_status
    FROM booking
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF p_guest_id IS NOT NULL AND p_guest_id <> v_guest_id THEN
        ROLLBACK;
        SET p_status = 'NOT_FOUND';
        LEAVE this_proc;
    END IF;

    IF v_status = 'Cancelled' THEN
        ROLLBACK;
        SET p_status = 'ALREADY_CANCELLED';
        LEAVE this_proc;
    END IF;

    IF v_check_in < CURRENT_DATE THEN
        ROLLBACK;
        SET p_status = 'STAY_STARTED';
        LEAVE this_proc;
    END IF;

    -- A confirmed booking holds one unit on every night of its stay.
    IF v_status = 'Confirmed' THEN
        UPDATE room_type_inventory
           SET booked_count = booked_count - 1
         WHERE room_type_id = v_room_type_id
           AND stay_date >= v_check_in AND stay_date < v_check_out;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_refund
    FROM payment
    WHERE booking_id = p_booking_id AND payment_status = 'Completed';

    UPDATE booking SET booking_status = 'Cancelled' WHERE booking_id = p_booking_id;

    INSERT INTO cancellation_history (booking_id, cancellation_reason, refund_amount)
    VALUES (p_booking_id, NULLIF(TRIM(p_reason), ''), v_refund);

    UPDATE payment SET payment_status = 'Refunded'
     WHERE booking_id = p_booking_id AND payment_status = 'Completed';

    -- Release the physical room too, so the desk does not show a room on a
    -- dead booking.
    DELETE FROM room_assignment WHERE booking_id = p_booking_id;

    COMMIT;
    SET p_status = 'CANCELLED';

    -- Capacity just freed up: let waiting guests in, oldest first.
    IF v_status = 'Confirmed' THEN
        CALL sp_promote_waitlist(v_room_type_id);
    END IF;
END$$

-- Simulated payment. The amount always comes from the booking itself.
-- Outcomes (p_status): PAID, NOT_FOUND, NOT_PAYABLE, ALREADY_PAID, ERROR
CREATE PROCEDURE sp_record_payment(
    IN  p_booking_id  INT,
    IN  p_guest_id    INT,
    IN  p_method      VARCHAR(20),
    OUT p_status      VARCHAR(25),
    OUT p_payment_id  INT,
    OUT p_amount      DECIMAL(10,2)
)
this_proc: BEGIN
    DECLARE v_guest_id   INT DEFAULT NULL;
    DECLARE v_status     VARCHAR(20);
    DECLARE v_check_out  DATE;
    DECLARE v_total      DECIMAL(10,2);
    DECLARE v_paid       INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
    END;

    SET p_payment_id = NULL;
    SET p_amount = NULL;

    START TRANSACTION;

    SELECT guest_id, booking_status, check_out_date, total_amount
      INTO v_guest_id, v_status, v_check_out, v_total
    FROM booking
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF v_guest_id IS NULL OR v_guest_id <> p_guest_id THEN
        ROLLBACK;
        SET p_status = 'NOT_FOUND';
        LEAVE this_proc;
    END IF;

    IF v_status <> 'Confirmed' OR v_check_out <= CURRENT_DATE THEN
        ROLLBACK;
        SET p_status = 'NOT_PAYABLE';
        LEAVE this_proc;
    END IF;

    SELECT COUNT(*) INTO v_paid
    FROM payment WHERE booking_id = p_booking_id AND payment_status = 'Completed';
    IF v_paid > 0 THEN
        ROLLBACK;
        SET p_status = 'ALREADY_PAID';
        LEAVE this_proc;
    END IF;

    INSERT INTO payment (booking_id, amount, payment_method, payment_status)
    VALUES (p_booking_id, v_total, p_method, 'Completed');

    SET p_payment_id = LAST_INSERT_ID();
    SET p_amount = v_total;
    COMMIT;
    SET p_status = 'PAID';
END$$

DELIMITER ;

-- ============================================================================
-- SECTION 9: The hard physical layer
--
-- Everything above is SOFT: reservation-level, allowed to exceed physical
-- capacity by the buffer. This trigger is the HARD layer. When the front desk
-- finally attaches a physical room to a booking, every rule below must hold,
-- no matter which client performs the INSERT.
-- ============================================================================

DELIMITER $$

CREATE TRIGGER trg_prevent_room_double_assignment
BEFORE INSERT ON room_assignment
FOR EACH ROW
BEGIN
    DECLARE v_check_in       DATE;
    DECLARE v_check_out      DATE;
    DECLARE v_status         VARCHAR(20);
    DECLARE v_booking_type   INT;
    DECLARE v_room_type      INT;
    DECLARE v_room_status    VARCHAR(20);
    DECLARE v_paid           INT DEFAULT 0;
    DECLARE v_conflict       INT DEFAULT 0;

    -- Serialise concurrent assignments of the same room. This must be the
    -- first read so the later reads see what the previous holder committed.
    SELECT room_type_id, room_status INTO v_room_type, v_room_status
    FROM room WHERE room_id = NEW.room_id FOR UPDATE;

    SELECT check_in_date, check_out_date, booking_status, room_type_id
      INTO v_check_in, v_check_out, v_status, v_booking_type
    FROM booking WHERE booking_id = NEW.booking_id;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking not found.';
    END IF;
    IF v_room_type IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room not found.';
    END IF;
    IF v_status <> 'Confirmed' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a confirmed booking can be assigned a room.';
    END IF;
    IF v_check_out <= CURRENT_DATE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This stay is already over.';
    END IF;
    IF v_room_type <> v_booking_type THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That room does not belong to the booked room type.';
    END IF;
    IF v_room_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'That room is not available (maintenance or out of service).';
    END IF;

    SELECT COUNT(*) INTO v_paid
    FROM payment
    WHERE booking_id = NEW.booking_id AND payment_status = 'Completed';
    IF v_paid = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment must be completed before a room can be assigned.';
    END IF;

    SELECT COUNT(*) INTO v_conflict
    FROM room_assignment ra
    JOIN booking b ON b.booking_id = ra.booking_id
    WHERE ra.room_id = NEW.room_id
      AND b.booking_status = 'Confirmed'
      AND b.check_in_date < v_check_out
      AND b.check_out_date > v_check_in;
    IF v_conflict > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room already assigned for overlapping dates (physical capacity conflict).';
    END IF;
END$$

DELIMITER ;
