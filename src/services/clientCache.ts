/**
 * Client-Side In-Memory SWR Cache + Request Deduplication (FinOps UX Layer)
 *
 * - Coalesces identical concurrent GET requests via in-flight promise sharing.
 * - Serves cached responses in 0ms and silently revalidates in background once
 *   age exceeds 50% of TTL (stale-while-revalidate).
 * - Immediately invalidates related keys/prefixes on any mutating request
 *   (POST / PUT / PATCH / DELETE) or auth session state change.
 */

interface ClientCacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  ttlMs: number;
}

const DEFAULT_SHORT_TTL_MS = 30_000;
const REFERENCE_TTL_MS = 120_000;
const FALLBACK_TTL_MS = 20_000;

class ClientCacheManager {
  private cache = new Map<string, ClientCacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();
  private backgroundRevalidating = new Set<string>();
  private prefetchCooldown = new Map<string, number>();

  /**
   * Resolves endpoint-specific SWR TTL. Returns 0 when caching must be bypassed.
   */
  resolveTtlMs(endpoint: string): number {
    const clean = endpoint.split('?')[0];
    const query = endpoint.includes('?') ? endpoint.split('?')[1] : '';

    if (query.includes('fresh=1')) return 0;

    // Never cache auth sessions, storage presigns, OTP/PEP signatures, or telegram/messenger mutations
    if (
      clean.startsWith('/api/auth/') ||
      clean.startsWith('/api/storage/') ||
      clean.startsWith('/api/pep/') ||
      clean.startsWith('/api/telegram/') ||
      clean.startsWith('/api/messenger/')
    ) {
      return 0;
    }

    // 120s for slow-changing reference / governance collections
    if (
      clean.startsWith('/api/data/developers') ||
      clean.startsWith('/api/data/curators') ||
      clean.startsWith('/api/data/employees') ||
      clean.startsWith('/api/data/legal_documents') ||
      clean.startsWith('/api/data/legal_settings') ||
      clean.startsWith('/api/data/market_settings') ||
      clean.startsWith('/api/data/public_channels') ||
      clean.startsWith('/api/data/company_profile') ||
      clean.startsWith('/api/data/platform_settings')
    ) {
      return REFERENCE_TTL_MS;
    }

    // 30s for active catalog, lots, applications, buy-box
    if (
      clean.startsWith('/api/data/lots') ||
      clean.startsWith('/api/matching/my-applications') ||
      clean.startsWith('/api/matching/my-buy-box') ||
      clean.startsWith('/api/tier-requests/my')
    ) {
      return DEFAULT_SHORT_TTL_MS;
    }

    if (clean.startsWith('/api/data/') || clean.startsWith('/api/matching/')) {
      return FALLBACK_TTL_MS;
    }

    return 0;
  }

  /**
   * Deduplicates identical concurrent requests by key.
   */
  dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise as Promise<unknown>);
    return promise;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    if (this.cache.size >= 400 && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      ttlMs,
    });
  }

  /**
   * Returns fresh data immediately; triggers silent background revalidation when
   * age exceeds half of TTL (SWR). Falls back to deduplicated network call on miss.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    if (ttlMs <= 0) {
      return this.dedupe(key, fetcher);
    }

    const entry = this.cache.get(key);
    if (entry) {
      const age = Date.now() - entry.createdAt;
      if (age <= entry.ttlMs) {
        if (age >= entry.ttlMs * 0.5 && !this.backgroundRevalidating.has(key)) {
          this.backgroundRevalidating.add(key);
          void this.dedupe(key, fetcher)
            .then((fresh) => {
              this.set(key, fresh, ttlMs);
            })
            .catch(() => {})
            .finally(() => {
              this.backgroundRevalidating.delete(key);
            });
        }
        return entry.data as T;
      }
      this.cache.delete(key);
    }

    const data = await this.dedupe(key, fetcher);
    this.set(key, data, ttlMs);
    return data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Immediate 0ms invalidation triggered automatically on any mutating HTTP request.
   */
  invalidateByEndpoint(endpoint: string): void {
    const clean = endpoint.split('?')[0];

    // Any auth mutation resets all user-scoped & shared caches immediately
    if (clean.startsWith('/api/auth/')) {
      this.clear();
      return;
    }

    // Data collections (/api/data/:collection...)
    const dataMatch = clean.match(/^\/api\/data\/([^/]+)/);
    if (dataMatch) {
      const collection = dataMatch[1];
      this.invalidatePrefix(`/api/data/${collection}`);
      if (collection === 'lots') {
        this.invalidatePrefix('/api/matching/');
        this.prefetchCooldown.clear();
      } else if (collection === 'users' || collection === 'employees') {
        this.invalidatePrefix('/api/data/curators');
      } else if (collection === 'deals') {
        this.invalidatePrefix('/api/matching/');
      }
      return;
    }

    // Cascade lot deletion
    if (clean.startsWith('/api/lots/')) {
      this.invalidatePrefix('/api/data/lots');
      this.invalidatePrefix('/api/data/deals');
      this.invalidatePrefix('/api/matching/');
      this.prefetchCooldown.clear();
      return;
    }

    // Matching / Buy-Box / Tier Requests mutations affect lot counts, applications, and deals
    if (clean.startsWith('/api/matching/') || clean.startsWith('/api/tier-requests/')) {
      this.invalidatePrefix('/api/matching/');
      this.invalidatePrefix('/api/tier-requests/');
      this.invalidatePrefix('/api/data/lots');
      this.invalidatePrefix('/api/data/deals');
      this.invalidatePrefix('/api/data/buyer_applications');
      return;
    }

    // Admin / Telegram / PEP / Messenger actions can advance lot or deal stages
    if (
      clean.startsWith('/api/admin/') ||
      clean.startsWith('/api/telegram/') ||
      clean.startsWith('/api/pep/') ||
      clean.startsWith('/api/messenger/')
    ) {
      this.invalidatePrefix('/api/data/lots');
      this.invalidatePrefix('/api/data/deals');
      this.invalidatePrefix('/api/matching/');
    }
  }

  /**
   * Checks and records a 30s per-lot hover prefetch cooldown.
   */
  shouldPrefetch(key: string, cooldownMs = 30_000): boolean {
    const last = this.prefetchCooldown.get(key);
    const now = Date.now();
    if (last && now - last < cooldownMs) {
      return false;
    }
    this.prefetchCooldown.set(key, now);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.backgroundRevalidating.clear();
    this.prefetchCooldown.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const clientCache = new ClientCacheManager();
