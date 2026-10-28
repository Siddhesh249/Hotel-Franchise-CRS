/**
 * MongoDB client (singleton pattern for Next.js hot-reload safety).
 *
 * Usage:
 *   import clientPromise from '@/lib/mongodb';
 *   const client = await clientPromise;
 *   const db = client.db('hotel_crs');
 *   const col = db.collection('hotel_features');
 *
 * Collection: hotel_features
 *   One document per hotel, keyed by hotel_id (INT from MariaDB).
 *   Unique index: { hotel_id: 1 }
 *
 * See ARCHITECTURE.md §4.2 for the document schema.
 */

// TODO: Phase 1 — implement MongoDB singleton client
// Required env var: MONGODB_URI

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;

if (!uri) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // Allow reuse across hot-reloads in dev
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default clientPromise;
