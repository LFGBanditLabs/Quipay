import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "quipay-offline-db";
const STORE_NAME = "payroll-cache";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
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

export async function getCache(key: string, ttlMs: number = DEFAULT_TTL_MS) {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    await db.delete(STORE_NAME, key);
    return null;
  }
  return entry.data;
}

export async function clearCache() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
