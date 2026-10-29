/**
 * MongoDB client (singleton pattern for Next.js hot-reload safety).
 *
 * The client is created lazily so a missing MONGODB_URI only affects the
 * features that actually need Mongo — the SQL-only parts of the app keep
 * working, and we never create an unhandled rejected promise at import time.
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;

declare global {
  // Allow reuse across hot-reloads in dev
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!uri) return Promise.reject(new Error('Missing environment variable: MONGODB_URI'));
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }
  if (!clientPromise) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    clientPromise = client.connect();
  }
  return clientPromise;
}

export function mongoDbName(): string {
  return process.env.MONGODB_DB ?? 'hotel_crs';
}
