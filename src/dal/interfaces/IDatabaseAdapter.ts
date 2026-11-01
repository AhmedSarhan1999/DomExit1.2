/**
 * Transitional Data Access Layer (DAL) — Standard Database Adapter Contract
 * Guarantees 0-line UI/Repository changes when switching from FirebaseAdapter to YandexCloudAdapter (PostgreSQL / YDB).
 */
export interface IDatabaseAdapter {
  readonly providerName: 'firebase' | 'yandex_cloud';

  saveEntity<T extends { id: string }>(
    collectionName: string,
    entity: T
  ): Promise<T>;

  getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback?: T[]
  ): Promise<T[]>;

  getEntityById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback?: T[]
  ): Promise<T | null>;

  queryEntities<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback?: T[]
  ): Promise<T[]>;

  removeEntity(
    collectionName: string,
    id: string
  ): Promise<boolean>;
}
