import crypto from 'node:crypto';

export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
  etag?: string;
}

export interface CacheAdapter {
  get<T = any>(key: string): Promise<T | null> | T | null;
  getWithMeta<T = any>(key: string): Promise<{ data: T; etag?: string } | null> | { data: T; etag?: string } | null;
  set<T = any>(key: string, data: T, ttlMs?: number, etag?: string): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  invalidatePrefix(prefix: string): Promise<void> | void;
  clear(): Promise<void> | void;
  size(): number;
}

export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(content).digest('base64url').slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * High-performance In-Memory LRU Cache with strict size bounds and TTL.
 * Implements CacheAdapter so it can be swapped with Valkey/Redis seamlessly.
 */
export class InMemoryLruCache implements CacheAdapter {
  private store: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(maxEntries = 300, defaultTtlMs = 60000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T = any>(key: string): T | null {
    const meta = this.getWithMeta<T>(key);
    return meta ? meta.data : null;
  }

  getWithMeta<T = any>(key: string): { data: T; etag?: string } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU position (delete and re-insert moves key to end of Map)
    this.store.delete(key);
    this.store.set(key, entry);

    return {
      data: entry.data as T,
      etag: entry.etag,
    };
  }

  set<T = any>(key: string, data: T, ttlMs = this.defaultTtlMs, etag?: string): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict expired entries first
      const now = Date.now();
      for (const [k, v] of this.store.entries()) {
        if (now > v.expiresAt) {
          this.store.delete(k);
        }
      }
      // If still full, evict oldest entry (first item in Map iterator)
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }

    const computedEtag = etag || generateETag(data);
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      etag: computedEtag,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    const clean = prefix.trim();
    for (const key of this.store.keys()) {
      if (
        key === clean ||
        key.startsWith(`${clean}:`) ||
        key.startsWith(`${clean}/`) ||
        key.startsWith(`${clean}?`)
      ) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// Global shared cache instance for Cloud Functions process lifecycle
export const appCache = new InMemoryLruCache(300, 60000);
