/**
 * Standard Database Adapter Contract
 * Used by DatabaseGateway for data operations.
 */
export interface IDatabaseAdapter {
  readonly providerName: 'backend_api';

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
