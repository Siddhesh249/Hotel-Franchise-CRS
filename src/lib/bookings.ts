import type { RowDataPacket } from 'mysql2';
import type { BookingRow } from '@/types';

export type BookingDbRow = RowDataPacket & Record<string, any>;

/** vw_booking_details columns, normalised (DECIMALs arrive as strings, booleans as 0/1). */
export function toBookingRow(row: BookingDbRow): BookingRow {
  return {
    booking_id: Number(row.booking_id),
    guest_id: Number(row.guest_id),
    room_type_id: Number(row.room_type_id),
    hotel_id: Number(row.hotel_id),
    hotel_name: row.hotel_name,
    city: row.city,
    state: row.state,
    type_name: row.type_name,
    check_in_date: row.check_in_date,
    check_out_date: row.check_out_date,
    nights: Number(row.nights),
    num_guests: Number(row.num_guests),
    special_requests: row.special_requests,
    booking_status: row.booking_status,
    stay_phase: row.stay_phase,
    is_overbooked: Boolean(row.is_overbooked),
    booking_date: row.booking_date,
    total_amount: Number(row.total_amount),
    payment_status: row.payment_status,
    payment_method: row.payment_method,
    paid_amount: row.paid_amount === null ? null : Number(row.paid_amount),
    room_number: row.room_number,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
  };
}
