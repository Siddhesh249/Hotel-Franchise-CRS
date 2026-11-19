import type { PoolConnection } from 'mysql2/promise';

export class RoomSyncError extends Error {}

/**
 * Make the number of physical `room` rows of a room type equal its
 * total_rooms. New rooms are numbered after the hotel's highest numeric room
 * number (101, 102, ...). When shrinking, the highest-numbered rooms that were
 * never assigned to a booking are removed; if there are not enough of those,
 * the change is refused.
 */
export async function syncPhysicalRooms(
  conn: PoolConnection,
  roomTypeId: number,
  hotelId: number,
  totalRooms: number,
): Promise<void> {
  const [countRows] = await conn.execute<any[]>(
    'SELECT COUNT(*) AS room_count FROM room WHERE room_type_id = ?',
    [roomTypeId],
  );
  const existing = Number(countRows[0].room_count);

  if (existing < totalRooms) {
    const [maxRows] = await conn.query<any[]>(
      `SELECT MAX(CAST(room_number AS UNSIGNED)) AS max_number
         FROM room WHERE hotel_id = ? AND room_number REGEXP '^[0-9]+$'`,
      [hotelId],
    );
    const start = Number(maxRows[0].max_number ?? 100) + 1;
    const values = Array.from({ length: totalRooms - existing }, (_, index) => {
      const number = start + index;
      return [hotelId, roomTypeId, String(number), Math.min(127, Math.floor(number / 100))];
    });
    await conn.query('INSERT INTO room (hotel_id, room_type_id, room_number, floor_number) VALUES ?', [values]);
    return;
  }

  if (existing > totalRooms) {
    const extra = existing - totalRooms;
    const [removable] = await conn.query<any[]>(
      `SELECT r.room_id FROM room r
        WHERE r.room_type_id = ?
          AND NOT EXISTS (SELECT 1 FROM room_assignment ra WHERE ra.room_id = r.room_id)
        ORDER BY CAST(r.room_number AS UNSIGNED) DESC, r.room_number DESC
        LIMIT ?`,
      [roomTypeId, extra],
    );
    if (removable.length < extra) {
      throw new RoomSyncError('Not enough unassigned rooms to remove; some rooms already have bookings assigned.');
    }
    await conn.query('DELETE FROM room WHERE room_id IN (?)', [removable.map((row) => row.room_id)]);
  }
}
