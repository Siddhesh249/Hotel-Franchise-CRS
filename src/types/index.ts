/**
 * Shared TypeScript types for the Hotel Franchise CRS.
 *
 * These mirror the MariaDB schema (ARCHITECTURE.md §4.1) and the MongoDB
 * hotel_features document shape (ARCHITECTURE.md §4.2).
 */

// ---------------------------------------------------------------------------
// Auth / Session
// ---------------------------------------------------------------------------

export type Role = 'Guest' | 'Staff' | 'Admin';
export type ActorType = 'guest' | 'staff';

export interface SessionUser {
  sub: string;
  actorType: ActorType;
  role: Role;
  hotelId: number | null;
}

// ---------------------------------------------------------------------------
// MariaDB entities (mirrors DDL — hotel_crs_ddl.sql)
// ---------------------------------------------------------------------------

export interface Franchise {
  franchise_id: number;
  franchise_name: string;
  headquarters_city: string | null;
  founded_year: number | null;
}

export interface Hotel {
  hotel_id: number;
  franchise_id: number;
  hotel_name: string;
  city: string;
  state: string | null;
  address: string | null;
  star_rating: number | null;
  contact_number: string | null;
}

export interface RoomType {
  room_type_id: number;
  hotel_id: number;
  type_name: string;
  base_price: number;
  max_occupancy: number;
  total_rooms: number;
}

export interface Room {
  room_id: number;
  hotel_id: number;
  room_type_id: number;
  room_number: string;
  floor_number: number | null;
  room_status: 'Available' | 'Maintenance' | 'OutOfService';
}

export interface Guest {
  guest_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  registered_on: string; // DATE
  is_synthetic: boolean;
  // password_hash intentionally omitted from client-facing type
}

export interface StaffAccount {
  staff_id: number;
  hotel_id: number | null;
  full_name: string;
  email: string;
  role: 'Admin' | 'Staff';
  created_on: string;
}

/** sp_create_booking OUT parameter values */
export type BookingStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_OVERBOOKED'
  | 'WAITLISTED'
  | 'INVALID_DATES'
  | 'INVALID_ROOM_TYPE'
  | 'INVALID_GUESTS'
  | 'ERROR';

/** booking.booking_status ENUM values */
export type BookingRowStatus =
  | 'Confirmed'
  | 'Waitlisted'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Cancelled'
  | 'NoShow';

export interface Booking {
  booking_id: number;
  guest_id: number;
  room_type_id: number;
  check_in_date: string; // DATE
  check_out_date: string; // DATE
  num_guests: number;
  special_requests: string | null;
  booking_date: string; // DATETIME
  booking_status: BookingRowStatus;
  is_overbooked: boolean;
  total_amount: string | number | null;
}

export interface BookingWithDetails extends Booking {
  type_name: string;
  base_price: string | number;
  max_occupancy: number;
  hotel_id: number;
  hotel_name: string;
  city: string;
  state: string | null;
  payment_id: number | null;
  payment_status: 'Pending' | 'Completed' | 'Refunded' | 'Failed' | null;
  payment_method: string | null;
  paid_amount: string | number | null;
  room_number: string | null;
  nights: number;
}

export interface StaffBooking extends BookingWithDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_synthetic: boolean;
}

export interface RoomAssignment {
  assignment_id: number;
  booking_id: number;
  room_id: number;
  assigned_on: string; // DATETIME
}

export interface Payment {
  payment_id: number;
  booking_id: number;
  amount: number;
  payment_method: string;
  payment_status: 'Pending' | 'Completed' | 'Refunded' | 'Failed';
  payment_date: string; // DATETIME
}

export interface SimClock {
  clock_id: 1;
  virtual_now: string; // DATETIME
  tick_minutes: number;
  is_running: boolean;
}

// ---------------------------------------------------------------------------
// MongoDB — hotel_features collection (ARCHITECTURE.md §4.2)
// ---------------------------------------------------------------------------

export interface HotelFeatures {
  /** Matches hotel.hotel_id in MariaDB */
  hotel_id: number;
  amenities: {
    general?: string[];
    wellness?: string[];
    policies?: Record<string, unknown>;
    [key: string]: unknown;
  };
  /** Keys are room type names (e.g. "Standard", "Deluxe", "Suite") */
  room_type_features?: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

/** Standard error envelope (ARCHITECTURE.md §11) */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/** Hotel listing item — SQL hotel row merged with Mongo amenities summary */
export interface HotelListItem extends Hotel {
  room_types: RoomTypeWithAvailability[];
  features: HotelFeatures | null;
}

export interface RoomTypeWithAvailability extends RoomType {
  rooms_left: number;
  available: boolean;
}

export interface HotelDetail extends Hotel {
  features: HotelFeatures | null;
  room_types: RoomTypeWithAvailability[];
}

export interface AvailabilityResult {
  check_in: string;
  check_out: string;
  results: Array<RoomTypeWithAvailability & { hotel_name: string; city: string; state: string | null }>;
}
