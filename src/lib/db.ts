/**
 * MariaDB connection pool (mysql2/promise).
 *
 * `dateStrings` keeps DATE/DATETIME values as the exact strings MariaDB
 * stored. Without it mysql2 turns them into JS Date objects, which get
 * serialised in UTC and can shift a check-in date by a day for users east or
 * west of UTC. Every layer above this one treats dates as `YYYY-MM-DD`.
 */

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'hotel_crs',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
});

export default pool;
