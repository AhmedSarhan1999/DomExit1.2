/**
 * Client-Side SWR Cache (Criterion 11: Redis-Equivalent Multi-Tier SWR Cache)
 * Provides In-Memory + SessionStorage caching with Stale-While-Revalidate semantics,
 * configurable TTL, background updates, and key/prefix invalidation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class ClientSWRCache {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private storagePrefix = 'domexit_swr_';

  /**
   * Retrieves or computes a cached value using SWR semantics.
   * If cache hit (fresh): returns cached data immediately.
   * If cache hit (stale): returns stale data immediately, runs fetcher in background to revalidate.
   * If cache miss: awaits fetcher, caches result, and returns data.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60_000 // default 1 min
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      const now = Date.now();
      const isStale = now - cached.timestamp > cached.ttlMs;

      if (isStale) {
        // Stale-While-Revalidate: fire background fetcher without blocking caller
        this.revalidateInBackground(key, fetcher, ttlMs);
      }

      return cached.data;
    }

    // Cache miss: execute fetcher
    const freshData = await fetcher();
    this.set(key, freshData, ttlMs);
    return freshData;
  }

  get<T>(key: string): CacheEntry<T> | null {
    // 1. Check in-memory tier
    const mem = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (mem) return mem;

    // 2. Check sessionStorage tier
    try {
      const stored = sessionStorage.getItem(`${this.storagePrefix}${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        this.memoryCache.set(key, parsed as CacheEntry<unknown>);
        return parsed;
      }
    } catch {
      // sessionStorage unavailable/disabled
    }

    return null;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };

    // Store in memory
    this.memoryCache.set(key, entry as CacheEntry<unknown>);

    // Store in session storage
    try {
      sessionStorage.setItem(`${this.storagePrefix}${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota exceeded or storage disabled
    }
  }

  /**
   * Invalidates a specific cache key.
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    try {
      sessionStorage.removeItem(`${this.storagePrefix}${key}`);
    } catch {
      // Ignore
    }
  }

  /**
   * Invalidates all cache keys matching a prefix (e.g. 'lots:', 'documents:').
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    try {
      const fullPrefix = `${this.storagePrefix}${prefix}`;
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  /**
   * Clears the entire cache (in-memory and session storage).
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(this.storagePrefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<void> {
    try {
      const freshData = await fetcher();
      const current = this.get<T>(key);
      const hasChanged = JSON.stringify(freshData) !== JSON.stringify(current?.data);
      this.set(key, freshData, ttlMs);
      if (hasChanged && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', {
            detail: { cacheKey: key, revalidated: true },
          })
        );
      }
    } catch (err) {
      console.warn(`[SWRCache] Background revalidation failed for ${key}:`, err);
    }
  }
}

export const swrCache = new ClientSWRCache();

// Automatically invalidate cached collection queries when DAL updates
if (typeof window !== 'undefined') {
  window.addEventListener('domexit:dal_updated', (e: Event) => {
    try {
      const detail = (e as CustomEvent).detail;
      if (detail?.revalidated) {
        return; // Avoid loop
      }
      if (detail?.baseCollection) {
        swrCache.invalidatePrefix(detail.baseCollection);
      }
      if (detail?.collectionName) {
        swrCache.invalidatePrefix(detail.collectionName);
      }
    } catch {
      // Ignore
    }
  });
}
