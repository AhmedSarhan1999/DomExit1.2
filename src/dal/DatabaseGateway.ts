import { IDatabaseAdapter } from './interfaces/IDatabaseAdapter';
import { firebaseAdapterInstance } from './adapters/FirebaseAdapter';
import { YandexCloudAdapter } from './adapters/YandexCloudAdapter';
import { resolveCollectionName } from './config/collectionResolver';
import { swrCache } from './cache/SWRCache';
import { requestDeduplicator } from './cache/requestDeduplicator';

/**
 * Central Transitional Data Access Layer Gateway (DAL)
 *
 * All UI Components, Contexts, and Repositories communicate strictly through DatabaseGateway.
 * Switching from Firebase Firestore to Yandex Cloud Managed PostgreSQL / YDB requires changing
 * ONLY `activeAdapter` below — zero UI lines touched.
 */
const defaultProvider = import.meta.env.VITE_DATA_PROVIDER || 'yandex';

class DatabaseGatewayController {
  private activeAdapter: IDatabaseAdapter =
    defaultProvider === 'yandex' ? YandexCloudAdapter.getAdapter() : firebaseAdapterInstance;

  get adapter(): IDatabaseAdapter {
    return this.activeAdapter;
  }

  useYandexCloud(): void {
    this.activeAdapter = YandexCloudAdapter.getAdapter();
  }

  useFirebase(): void {
    this.activeAdapter = firebaseAdapterInstance;
  }

  async save<T extends { id: string }>(collectionName: string, entity: T): Promise<T> {
    const resolvedName = resolveCollectionName(collectionName);
    swrCache.invalidatePrefix(`getAll:${resolvedName}`);
    swrCache.invalidatePrefix(`getAll:${collectionName}`);
    swrCache.invalidatePrefix(`getById:${resolvedName}:${entity.id}`);
    swrCache.invalidatePrefix(`getById:${collectionName}:${entity.id}`);
    const saved = await this.activeAdapter.saveEntity(resolvedName, entity);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('domexit:dal_updated', {
          detail: { collectionName: resolvedName, baseCollection: collectionName, id: entity.id },
        })
      );
    }
    return saved;
  }

  getAll<T extends { id: string }>(collectionName: string, seedFallback: T[] = []): Promise<T[]> {
    const resolvedName = resolveCollectionName(collectionName);
    const cacheKey = `getAll:${resolvedName}`;
    const ttlMs = 30_000; // 30s TTL with SWR background revalidation

    return swrCache.getOrFetch<T[]>(
      cacheKey,
      () =>
        requestDeduplicator.dedupe(cacheKey, () =>
          this.activeAdapter.getAllEntities(resolvedName, seedFallback)
        ),
      ttlMs
    );
  }

  getById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    const resolvedName = resolveCollectionName(collectionName);
    const cacheKey = `getById:${resolvedName}:${id}`;
    const ttlMs = 30_000;

    return swrCache.getOrFetch<T | null>(
      cacheKey,
      () =>
        requestDeduplicator.dedupe(cacheKey, () =>
          this.activeAdapter.getEntityById(resolvedName, id, seedFallback)
        ),
      ttlMs
    );
  }

  query<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const resolvedName = resolveCollectionName(collectionName);
    return this.activeAdapter.queryEntities(resolvedName, predicate, seedFallback);
  }

  async remove(collectionName: string, id: string): Promise<boolean> {
    const resolvedName = resolveCollectionName(collectionName);
    swrCache.invalidatePrefix(`getAll:${resolvedName}`);
    swrCache.invalidatePrefix(`getAll:${collectionName}`);
    swrCache.invalidatePrefix(`getById:${resolvedName}:${id}`);
    swrCache.invalidatePrefix(`getById:${collectionName}:${id}`);
    const removed = await this.activeAdapter.removeEntity(resolvedName, id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('domexit:dal_updated', {
          detail: { collectionName: resolvedName, baseCollection: collectionName, id },
        })
      );
    }
    return removed;
  }

  /**
   * Real-time Listener Bus (in-tab CustomEvent + cross-tab StorageEvent)
   */
  subscribe(listener: (collectionName?: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<{ collectionName?: string; baseCollection?: string }>;
      listener(custom.detail?.baseCollection || custom.detail?.collectionName);
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key &&
        (e.key.startsWith('domexit_db_') ||
          e.key.startsWith('domexit_fb_'))
      ) {
        listener();
      }
    };

    window.addEventListener('domexit:dal_updated', handleCustom);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('domexit:dal_updated', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

export const DatabaseGateway = new DatabaseGatewayController();
