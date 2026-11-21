interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 15000; // 15 seconds
const MAX_ENTRIES = 32;

export const CACHEABLE_COLLECTIONS = new Set([
  'lots',
  'developers',
  'market_settings',
  'legal_settings',
  'legal_documents',
  'company_profile',
  'public_channels',
  'platform_settings',
]);

class MemoryCache {
  private store: Map<string, CacheEntry> = new Map();

  get<T = any>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T = any>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
    if (this.store.size >= MAX_ENTRIES) {
      // Evict oldest or expired keys
      const now = Date.now();
      for (const [k, v] of this.store.entries()) {
        if (now > v.expiresAt) {
          this.store.delete(k);
        }
      }
      if (this.store.size >= MAX_ENTRIES) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(collection: string): void {
    for (const key of this.store.keys()) {
      if (key === collection || key.startsWith(`${collection}:`)) {
        this.store.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const memoryCache = new MemoryCache();
