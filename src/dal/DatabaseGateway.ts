import { IDatabaseAdapter } from './interfaces/IDatabaseAdapter';
import { firebaseAdapterInstance } from './adapters/FirebaseAdapter';
import { YandexCloudAdapter } from './adapters/YandexCloudAdapter';
import { resolveCollectionName, isIsolatedCollection } from './config/collectionResolver';
import { useEnvironmentStore } from '../stores/useEnvironmentStore';

/**
 * Central Transitional Data Access Layer Gateway (DAL)
 *
 * All UI Components, Contexts, and Repositories communicate strictly through DatabaseGateway.
 * Switching from Firebase Firestore to Yandex Cloud Managed PostgreSQL / YDB requires changing
 * ONLY `activeAdapter` below — zero UI lines touched.
 *
 * Dynamically resolves Sandbox ('demo_*') vs Virgin Production collections based on useEnvironmentStore.
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
    const isProd = useEnvironmentStore.getState().isProduction;
    const effectiveSeedFallback = isProd && isIsolatedCollection(collectionName) ? [] : seedFallback;
    return this.activeAdapter.getAllEntities(resolvedName, effectiveSeedFallback);
  }

  getById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    const resolvedName = resolveCollectionName(collectionName);
    const isProd = useEnvironmentStore.getState().isProduction;
    const effectiveSeedFallback = isProd && isIsolatedCollection(collectionName) ? [] : seedFallback;
    return this.activeAdapter.getEntityById(resolvedName, id, effectiveSeedFallback);
  }

  query<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const resolvedName = resolveCollectionName(collectionName);
    const isProd = useEnvironmentStore.getState().isProduction;
    const effectiveSeedFallback = isProd && isIsolatedCollection(collectionName) ? [] : seedFallback;
    return this.activeAdapter.queryEntities(resolvedName, predicate, effectiveSeedFallback);
  }

  async remove(collectionName: string, id: string): Promise<boolean> {
    const resolvedName = resolveCollectionName(collectionName);
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
   * Real-time Listener Bus (in-tab CustomEvent + cross-tab StorageEvent + Environment toggle)
   */
  subscribe(listener: (collectionName?: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<{ collectionName?: string; baseCollection?: string }>;
      listener(custom.detail?.collectionName || custom.detail?.baseCollection);
    };

    const handleEnvChanged = () => {
      listener();
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key &&
        (e.key.startsWith('domexit_db_') ||
          e.key.startsWith('domexit_fb_') ||
          e.key === 'domexit_app_environment')
      ) {
        listener();
      }
    };

    window.addEventListener('domexit:dal_updated', handleCustom);
    window.addEventListener('domexit:environment_changed', handleEnvChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('domexit:dal_updated', handleCustom);
      window.removeEventListener('domexit:environment_changed', handleEnvChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

export const DatabaseGateway = new DatabaseGatewayController();
