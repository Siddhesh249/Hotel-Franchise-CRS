/**
 * MongoDB client, created lazily so a missing or stopped MongoDB only affects
 * the features that need it. The promise is cached on `globalThis` so hot
 * reloads in development do not open a new connection every time.
 */

import { MongoClient } from 'mongodb';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('Missing environment variable: MONGODB_URI'));
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 })
      .connect()
      .catch((error) => {
        globalThis._mongoClientPromise = undefined;
        throw error;
      });
  }
  return globalThis._mongoClientPromise;
}

export async function featuresCollection() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? 'hotel_crs').collection('hotel_features');
}
