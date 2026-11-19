/** Shared types. These mirror the MariaDB schema and the MongoDB hotel_features document. */

export type Role = 'Guest' | 'Staff' | 'Admin';
export type ActorType = 'guest' | 'staff';

export interface SessionUser {
  sub: string;
  actorType: ActorType;
  role: Role;
  hotelId: number | null;
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

export interface RoomTypeWithAvailability extends RoomType {
  rooms_left: number;
  available: boolean;
}

/** One document per hotel in the MongoDB `hotel_features` collection. */
export interface HotelFeatures {
  hotel_id: number;
  amenities: {
    general?: string[];
    wellness?: string[];
    policies?: Record<string, unknown>;
  };
  /** Keyed by room type name ("Standard", "Deluxe", "Suite"). */
  room_type_features?: Record<string, Record<string, unknown>>;
}

export interface HotelListItem extends Hotel {
  room_types: RoomTypeWithAvailability[];
  features: HotelFeatures | null;
}

export type BookingStatus = 'Confirmed' | 'Waitlisted' | 'Cancelled';
export type StayPhase = 'Past' | 'Upcoming' | 'Current';
export type PaymentStatus = 'Completed' | 'Refunded';

/** A row of the vw_booking_details view, with numeric columns normalised. */
export interface BookingRow {
  booking_id: number;
  guest_id: number;
  room_type_id: number;
  hotel_id: number;
  hotel_name: string;
  city: string;
  state: string | null;
  type_name: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  num_guests: number;
  special_requests: string | null;
  booking_status: BookingStatus;
  stay_phase: StayPhase;
  /** Not cancelled and the stay has not ended. */
  is_open: boolean;
  /** Not cancelled and the stay has not started. */
  cancellable: boolean;
  is_overbooked: boolean;
  booking_date: string;
  total_amount: number;
  payment_status: PaymentStatus | null;
  payment_method: string | null;
  paid_amount: number | null;
  room_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export interface ApiError {
  error: { code: string; message: string };
}
