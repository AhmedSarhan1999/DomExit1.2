import { IDatabaseAdapter } from './interfaces/IDatabaseAdapter';
import { firebaseAdapterInstance } from './adapters/FirebaseAdapter';
import { YandexCloudAdapter } from './adapters/YandexCloudAdapter';

/**
 * Central Transitional Data Access Layer Gateway (DAL)
 *
 * All UI Components, Contexts, and Repositories communicate strictly through DatabaseGateway.
 * Switching from Firebase Firestore to Yandex Cloud Managed PostgreSQL / YDB requires changing
 * ONLY `activeAdapter` below — zero UI lines touched.
 */
class DatabaseGatewayController {
  private activeAdapter: IDatabaseAdapter = firebaseAdapterInstance;

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
    const saved = await this.activeAdapter.saveEntity(collectionName, entity);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('domexit:dal_updated', { detail: { collectionName, id: entity.id } }));
    }
    return saved;
  }

  getAll<T extends { id: string }>(collectionName: string, seedFallback: T[] = []): Promise<T[]> {
    return this.activeAdapter.getAllEntities(collectionName, seedFallback);
  }

  getById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    return this.activeAdapter.getEntityById(collectionName, id, seedFallback);
  }

  query<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback: T[] = []
  ): Promise<T[]> {
    return this.activeAdapter.queryEntities(collectionName, predicate, seedFallback);
  }

  async remove(collectionName: string, id: string): Promise<boolean> {
    const removed = await this.activeAdapter.removeEntity(collectionName, id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('domexit:dal_updated', { detail: { collectionName, id } }));
    }
    return removed;
  }

  /**
   * Real-time Listener Bus (in-tab CustomEvent + cross-tab StorageEvent)
   */
  subscribe(listener: (collectionName?: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<{ collectionName?: string }>;
      listener(custom.detail?.collectionName);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('domexit_db_')) {
        listener(e.key.replace('domexit_db_', ''));
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
