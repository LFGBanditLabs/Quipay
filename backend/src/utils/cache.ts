type CacheItem<T> = {
  value: T;
  expiry: number;
};

export class SimpleCache {
  private cache: Map<string, CacheItem<any>> = new Map();

  /**
   * Set a value in the cache with a TTL (Time To Live).
   * @param key The cache key
   * @param value The value to store
   * @param ttlMs Time to live in milliseconds
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache. Returns null if not found or expired.
   * @param key The cache key
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Delete a specific key from the cache.
   * @param key The cache key
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate keys matching a pattern (simple prefix match).
   * @param prefix Prefix to match
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const globalCache = new SimpleCache();
