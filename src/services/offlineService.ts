import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "quipay-offline-db";
const STORE_NAME = "payroll-cache";

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

export async function getCache(key: string) {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, key);
  return entry ? entry.data : null;
}

export async function clearCache() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
