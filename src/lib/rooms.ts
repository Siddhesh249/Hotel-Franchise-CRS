import type { PoolConnection } from 'mysql2/promise';

/**
 * Make sure a room type has as many physical `room` rows as its total_rooms
 * says it does. New room types created from the admin dashboard would
 * otherwise be unassignable by staff, because assignment works on real rooms.
 *
 * Rooms are numbered sequentially after the highest numeric room number in the
 * hotel (101, 102, …), which keeps the per-hotel UNIQUE constraint happy.
 */
export async function ensurePhysicalRooms(
  conn: PoolConnection,
  roomTypeId: number,
  hotelId: number,
  totalRooms: number,
): Promise<number> {
  const [countRows] = await conn.execute<any[]>(
    'SELECT COUNT(*) AS room_count FROM room WHERE room_type_id = ?',
    [roomTypeId],
  );
  const existing = Number(countRows[0]?.room_count ?? 0);
  const missing = Math.max(0, totalRooms - existing);
  if (missing === 0) return 0;

  const [maxRows] = await conn.query<any[]>(
    `SELECT MAX(CAST(room_number AS UNSIGNED)) AS max_number
       FROM room
      WHERE hotel_id = ? AND room_number REGEXP '^[0-9]+$'`,
    [hotelId],
  );
  const start = Number(maxRows[0]?.max_number ?? 100) + 1;

  const values = Array.from({ length: missing }, (_, index) => {
    const number = start + index;
    return [hotelId, roomTypeId, String(number), Math.floor(number / 100)];
  });
  await conn.query(
    'INSERT INTO room (hotel_id, room_type_id, room_number, floor_number) VALUES ?',
    [values],
  );
  return missing;
}
