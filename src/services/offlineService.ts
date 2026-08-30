import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "quipay-offline-db";
const STORE_NAME = "payroll-cache";

export const DYNAMIC_DATA_CACHE_TTL_MS = 5 * 60_000;

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function setCache(key: string, data: unknown) {
  const db = await getDB();
  await db.put(STORE_NAME, {
    key,
    data,
    timestamp: Date.now(),
  });
}

export async function getCache<T = unknown>(
  key: string,
  ttl?: number,
): Promise<T | null> {
  const db = await getDB();
  const entry = (await db.get(STORE_NAME, key)) as CachedData | undefined;

  if (!entry) return null;

  if (ttl !== undefined && Date.now() - entry.timestamp > ttl) {
    await db.delete(STORE_NAME, key);
    return null;
  }

  return entry.data as T;
}

export async function clearCache() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
