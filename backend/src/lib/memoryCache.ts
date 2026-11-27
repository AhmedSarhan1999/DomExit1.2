import { appCache, InMemoryLruCache } from './cache.js';

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

/**
 * Backward compatibility facade for memoryCache, delegating to the unified appCache.
 */
class MemoryCacheFacade {
  get<T = any>(key: string): T | null {
    return appCache.get<T>(key);
  }

  set<T = any>(key: string, data: T, ttlMs?: number): void {
    appCache.set(key, data, ttlMs);
  }

  delete(key: string): void {
    appCache.delete(key);
  }

  invalidate(collection: string): void {
    appCache.invalidatePrefix(collection);
  }

  invalidatePrefix(prefix: string): void {
    appCache.invalidatePrefix(prefix);
  }

  invalidateAll(): void {
    appCache.clear();
  }

  size(): number {
    return appCache.size();
  }
}

export const memoryCache = new MemoryCacheFacade();
export { appCache, InMemoryLruCache };
