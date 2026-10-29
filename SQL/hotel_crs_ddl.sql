-- ============================================================================
-- Hotel Franchise Central Reservation System (CRS) with Overbooking Logic
-- DDL — schema + overbooking engine
-- Target: MariaDB (developed/tested against MariaDB 10.6+/11.x, InnoDB engine)
--
-- NOTE ON NAMING: table/column names are lowercase snake_case throughout.
-- MariaDB on Linux (Fedora included) is case-SENSITIVE for table names by
-- default (lower_case_table_names=0). Lowercasing everything sidesteps that
-- footgun entirely -- always type identifiers exactly as they appear here.
-- ============================================================================

DROP DATABASE IF EXISTS hotel_crs;      -- comment this out once you don't want a clean slate anymore
CREATE DATABASE hotel_crs;
USE hotel_crs;

-- ============================================================================
-- SECTION 1: Structural / reference tables (the franchise -> hotel -> room
-- containment hierarchy)
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
    CONSTRAINT chk_star_rating CHECK (star_rating BETWEEN 1 AND 7)
) ENGINE=InnoDB;

CREATE TABLE room_type (
    room_type_id    INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id        INT NOT NULL,
    type_name       VARCHAR(50) NOT NULL,       -- Standard / Deluxe / Suite ...
    base_price      DECIMAL(10,2) NOT NULL,
    max_occupancy   TINYINT NOT NULL DEFAULT 2,
    total_rooms     INT NOT NULL,               -- physical inventory of this category
    CONSTRAINT fk_roomtype_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hotel_roomtype UNIQUE (hotel_id, type_name),
    CONSTRAINT chk_base_price CHECK (base_price > 0),
    CONSTRAINT chk_total_rooms CHECK (total_rooms > 0)
) ENGINE=InnoDB;

CREATE TABLE room (
    room_id       INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id      INT NOT NULL,
    room_type_id  INT NOT NULL,
    room_number   VARCHAR(10) NOT NULL,
    floor_number  TINYINT,
    room_status   ENUM('Available','Maintenance','OutOfService') NOT NULL DEFAULT 'Available',
    CONSTRAINT fk_room_hotel FOREIGN KEY (hotel_id)
        REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_room_roomtype FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hotel_roomnumber UNIQUE (hotel_id, room_number)
    -- hotel_id is technically derivable via room_type_id -> room_type.hotel_id.
    -- It is kept here anyway (a deliberate, small denormalization) so that
    -- "room numbers are unique per physical building" can be enforced with a
    -- plain UNIQUE constraint instead of a trigger. Worth a line in your report.
) ENGINE=InnoDB;

CREATE TABLE guest (
    guest_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name     VARCHAR(50) NOT NULL,
    last_name      VARCHAR(50) NOT NULL,
    email          VARCHAR(100) NOT NULL,
    phone          VARCHAR(15)  NOT NULL,
    address        VARCHAR(200),
    registered_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_guest_email UNIQUE (email)
) ENGINE=InnoDB;

ALTER TABLE guest ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE guest ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE staff_account (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin','Staff') NOT NULL,
    created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_hotel FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_staff_email UNIQUE (email)
) ENGINE=InnoDB;

-- MariaDB 11.8 rejects a CHECK which references a column participating in an
-- ON UPDATE CASCADE foreign key. These triggers preserve the intended rule:
-- Admin is franchise-wide (no hotel), while Staff is scoped to one hotel.
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

CREATE TABLE sim_clock (
    clock_id TINYINT PRIMARY KEY DEFAULT 1,
    virtual_now DATETIME NOT NULL,
    tick_minutes INT NOT NULL DEFAULT 60,
    is_running BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_single_clock_row CHECK (clock_id = 1)
) ENGINE=InnoDB;

INSERT INTO sim_clock (clock_id, virtual_now) VALUES (1, NOW());

DELIMITER $$
CREATE EVENT evt_clock_tick
ON SCHEDULE EVERY 1 SECOND
DO
BEGIN
    UPDATE sim_clock SET virtual_now = virtual_now + INTERVAL tick_minutes MINUTE
    WHERE clock_id = 1 AND is_running = TRUE;
END$$
DELIMITER ;

-- ============================================================================
-- SECTION 2: The overbooking engine's own tables
-- ============================================================================

-- One (optional) row per room_type: how aggressively can we oversell it?
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

-- The per-night ledger. This is the single source of truth the overbooking
-- logic reads and locks -- one row per (room_type, calendar night). Rows are
-- created lazily, the first time a booking touches that night.
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

-- ============================================================================
-- SECTION 3: Transactional tables
-- ============================================================================

CREATE TABLE booking (
    booking_id      INT AUTO_INCREMENT PRIMARY KEY,
    guest_id        INT NOT NULL,
    room_type_id    INT NOT NULL,
    check_in_date   DATE NOT NULL,
    check_out_date  DATE NOT NULL,
    num_guests      TINYINT NOT NULL DEFAULT 1,
    booking_status  ENUM('Confirmed','Waitlisted','CheckedIn','CheckedOut','Cancelled','NoShow')
                    NOT NULL DEFAULT 'Waitlisted',
    is_overbooked   BOOLEAN NOT NULL DEFAULT FALSE,
    booking_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount    DECIMAL(10,2),
    CONSTRAINT fk_booking_guest FOREIGN KEY (guest_id)
        REFERENCES guest(guest_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_booking_roomtype FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_booking_dates CHECK (check_out_date > check_in_date)
) ENGINE=InnoDB;

-- Which PHYSICAL room a confirmed booking ends up in. Intentionally a
-- separate table: a booking guarantees a *room type*, not a specific room,
-- until assignment happens (industry-standard practice, and it's exactly
-- what lets the overbooking buffer work).
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
    payment_method  ENUM('Card','Cash','UPI','NetBanking') NOT NULL,
    payment_status  ENUM('Pending','Completed','Refunded','Failed') NOT NULL DEFAULT 'Pending',
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_amount_nonneg CHECK (amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE cancellation_history (
    cancellation_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id           INT NOT NULL,
    cancelled_on         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason  VARCHAR(200),
    refund_amount        DECIMAL(10,2) DEFAULT 0,
    CONSTRAINT fk_cancel_booking FOREIGN KEY (booking_id)
        REFERENCES booking(booking_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- SECTION 4: Indexes to support the query patterns the engine actually uses
-- ============================================================================

CREATE INDEX idx_booking_roomtype_dates ON booking (room_type_id, check_in_date, check_out_date);
CREATE INDEX idx_booking_status         ON booking (booking_status);
CREATE INDEX idx_payment_booking        ON payment (booking_id);

-- ============================================================================
-- SECTION 5: Reporting view -- static, per-room-type overbooking summary
-- (NOT date-specific -- see fn_available_rooms() below for a given night)
-- ============================================================================

CREATE VIEW vw_roomtype_overview AS
SELECT
    h.hotel_id,
    h.hotel_name,
    rt.room_type_id,
    rt.type_name,
    rt.total_rooms,
    COALESCE(op.overbook_percentage, 0)                                   AS overbook_percentage,
    FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)     AS overbook_buffer_rooms,
    rt.total_rooms + FLOOR(rt.total_rooms * COALESCE(op.overbook_percentage, 0) / 100)
                                                                            AS max_sellable_rooms
FROM room_type rt
JOIN hotel h              ON h.hotel_id = rt.hotel_id
LEFT JOIN overbooking_policy op ON op.room_type_id = rt.room_type_id;

-- ============================================================================
-- SECTION 6: Overbooking logic -- read-only helper function
-- Rooms left for ONE specific room_type on ONE specific night, buffer included.
-- Used for ad-hoc availability checks / reporting. Does NOT lock rows -- the
-- transactional procedures below do their own locking read for the real
-- accept/reject decision.
-- ============================================================================

DELIMITER $$

CREATE FUNCTION fn_available_rooms(p_room_type_id INT, p_stay_date DATE)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_total_rooms INT DEFAULT 0;
    DECLARE v_buffer      INT DEFAULT 0;
    DECLARE v_booked      INT DEFAULT 0;

    SELECT total_rooms INTO v_total_rooms
    FROM room_type WHERE room_type_id = p_room_type_id;

    SET v_buffer = FLOOR(v_total_rooms * COALESCE(
        (SELECT overbook_percentage FROM overbooking_policy WHERE room_type_id = p_room_type_id), 0) / 100);

    SET v_booked = COALESCE(
        (SELECT booked_count FROM room_type_inventory
         WHERE room_type_id = p_room_type_id AND stay_date = p_stay_date), 0);

    RETURN (v_total_rooms + v_buffer) - v_booked;
END$$

DELIMITER ;

-- ============================================================================
-- SECTION 7: Overbooking logic -- the three transactional procedures
--
-- Pattern used by all three (materialize -> lock -> decide):
--   1. Make sure every night in the date range has a ledger row (first-touch).
--   2. SELECT ... FOR UPDATE the MIN available count across that whole range
--      in one shot -- this both finds the tightest night AND locks every
--      affected row, so two guests can't both "see" the same last room and
--      both get confirmed. That race condition is exactly why this decision
--      belongs in the database and not in application code.
--   3. Confirm (flagging is_overbooked when it dips into the buffer) or
--      waitlist, then COMMIT.
-- ============================================================================

DELIMITER $$

CREATE PROCEDURE sp_try_promote_waitlist(IN p_booking_id INT)
this_proc: BEGIN
    DECLARE v_room_type_id  INT;
    DECLARE v_check_in      DATE;
    DECLARE v_check_out     DATE;
    DECLARE v_total_rooms   INT;
    DECLARE v_overbook_pct  DECIMAL(5,2);
    DECLARE v_buffer        INT;
    DECLARE v_min_avail     INT;

    SELECT room_type_id, check_in_date, check_out_date
    INTO v_room_type_id, v_check_in, v_check_out
    FROM booking WHERE booking_id = p_booking_id AND booking_status = 'Waitlisted';

    IF v_room_type_id IS NULL THEN
        LEAVE this_proc;
    END IF;

    SELECT total_rooms INTO v_total_rooms FROM room_type WHERE room_type_id = v_room_type_id;
    SET v_overbook_pct = COALESCE(
        (SELECT overbook_percentage FROM overbooking_policy WHERE room_type_id = v_room_type_id), 0);
    SET v_buffer = FLOOR(v_total_rooms * v_overbook_pct / 100);

    START TRANSACTION;

    SELECT MIN((v_total_rooms + v_buffer) - booked_count) INTO v_min_avail
    FROM room_type_inventory
    WHERE room_type_id = v_room_type_id
      AND stay_date >= v_check_in AND stay_date < v_check_out
    FOR UPDATE;

    IF v_min_avail >= 1 THEN
        UPDATE booking
        SET booking_status = 'Confirmed', is_overbooked = (v_min_avail <= v_buffer)
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
    DECLARE v_total_rooms  INT;
    DECLARE v_overbook_pct DECIMAL(5,2);
    DECLARE v_buffer       INT;
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

    SELECT total_rooms, base_price INTO v_total_rooms, v_price
    FROM room_type WHERE room_type_id = p_room_type_id;

    SET v_overbook_pct = COALESCE(
        (SELECT overbook_percentage FROM overbooking_policy WHERE room_type_id = p_room_type_id), 0);
    SET v_buffer  = FLOOR(v_total_rooms * v_overbook_pct / 100);
    SET v_nights  = DATEDIFF(p_check_out, p_check_in);

    START TRANSACTION;

    SET v_date = p_check_in;
    WHILE v_date < p_check_out DO
        INSERT IGNORE INTO room_type_inventory (room_type_id, stay_date, booked_count)
        VALUES (p_room_type_id, v_date, 0);
        SET v_date = DATE_ADD(v_date, INTERVAL 1 DAY);
    END WHILE;

    SELECT MIN((v_total_rooms + v_buffer) - booked_count) INTO v_min_avail
    FROM room_type_inventory
    WHERE room_type_id = p_room_type_id
      AND stay_date >= p_check_in AND stay_date < p_check_out
    FOR UPDATE;

    IF v_min_avail >= 1 THEN
        INSERT INTO booking (guest_id, room_type_id, check_in_date, check_out_date,
                              num_guests, booking_status, is_overbooked, total_amount)
        VALUES (p_guest_id, p_room_type_id, p_check_in, p_check_out, p_num_guests,
                'Confirmed', (v_min_avail <= v_buffer), v_price * v_nights);

        SET p_booking_id = LAST_INSERT_ID();
        SET p_status = IF(v_min_avail <= v_buffer, 'CONFIRMED_OVERBOOKED', 'CONFIRMED');

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

CREATE PROCEDURE sp_cancel_booking(
    IN p_booking_id INT,
    IN p_reason     VARCHAR(200)
)
this_proc: BEGIN
    DECLARE v_room_type_id INT;
    DECLARE v_check_in     DATE;
    DECLARE v_check_out    DATE;
    DECLARE v_status       VARCHAR(20);
    DECLARE v_promote_id   INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT room_type_id, check_in_date, check_out_date, booking_status
    INTO v_room_type_id, v_check_in, v_check_out, v_status
    FROM booking WHERE booking_id = p_booking_id;

    IF v_status IS NULL OR v_status IN ('Cancelled','CheckedOut','NoShow') THEN
        LEAVE this_proc;   -- nothing sensible to cancel
    END IF;

    START TRANSACTION;

    IF v_status IN ('Confirmed','CheckedIn') THEN
        UPDATE room_type_inventory
        SET booked_count = booked_count - 1
        WHERE room_type_id = v_room_type_id
          AND stay_date >= v_check_in AND stay_date < v_check_out;
    END IF;

    UPDATE booking SET booking_status = 'Cancelled' WHERE booking_id = p_booking_id;

    INSERT INTO cancellation_history (booking_id, cancellation_reason)
    VALUES (p_booking_id, p_reason);

    COMMIT;

    -- a room just freed up -- see if the oldest matching waitlisted guest fits now
    SELECT booking_id INTO v_promote_id
    FROM booking
    WHERE room_type_id = v_room_type_id AND booking_status = 'Waitlisted'
    ORDER BY booking_date ASC
    LIMIT 1;

    IF v_promote_id IS NOT NULL THEN
        CALL sp_try_promote_waitlist(v_promote_id);
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- SECTION 8: The hard-constraint trigger
--
-- Everything above is the SOFT layer: reservation-level, allowed to exceed
-- physical capacity by the configured buffer. This trigger is the HARD layer:
-- no two overlapping-date bookings may ever be assigned the same physical
-- room. It fires only at room_assignment time (check-in), which is exactly
-- when a real hotel would resolve an overbooking situation (walk a guest,
-- upgrade them, etc. -- all outside the database).
-- ============================================================================

DELIMITER $$

CREATE TRIGGER trg_prevent_room_double_assignment
BEFORE INSERT ON room_assignment
FOR EACH ROW
BEGIN
    DECLARE v_check_in  DATE;
    DECLARE v_check_out DATE;
    DECLARE v_conflict   INT DEFAULT 0;

    SELECT check_in_date, check_out_date INTO v_check_in, v_check_out
    FROM booking WHERE booking_id = NEW.booking_id;

    SELECT COUNT(*) INTO v_conflict
    FROM room_assignment ra
    JOIN booking b ON b.booking_id = ra.booking_id
    WHERE ra.room_id = NEW.room_id
      AND b.booking_status IN ('Confirmed','CheckedIn')
      AND b.check_in_date < v_check_out
      AND b.check_out_date > v_check_in;

    IF v_conflict > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Room already assigned for overlapping dates - physical capacity conflict.';
    END IF;
END$$

DELIMITER ;
