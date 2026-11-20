import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { apiClient, ApiError } from '../../services/apiClient';

/**
 * BackendApiAdapter — Modern Enterprise Data Access Adapter
 *
 * Replaces direct client-to-YDB/Firebase connections with secure,
 * RBAC-governed HTTP calls to the Yandex Cloud Functions backend (/api/data/*).
 */
export class BackendApiAdapter implements IDatabaseAdapter {
  readonly providerName = 'backend_api' as const;

  async saveEntity<T extends { id: string }>(
    collectionName: string,
    entity: T
  ): Promise<T> {
    try {
      const res = await apiClient.put<{ success: boolean; item?: T }>(
        `/api/data/${collectionName}/${encodeURIComponent(entity.id)}`,
        entity
      );
      return res.item || entity;
    } catch (err: any) {
      console.error(`[BackendApiAdapter] saveEntity error on ${collectionName}:`, err);
      throw err;
    }
  }

  async getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback?: T[]
  ): Promise<T[]> {
    try {
      const res = await apiClient.get<{ items?: T[] }>(`/api/data/${collectionName}`);
      if (res && Array.isArray(res.items)) {
        if (res.items.length === 0 && seedFallback && seedFallback.length > 0) {
          return seedFallback;
        }
        return res.items;
      }
      return seedFallback || [];
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Return fallback or empty if unauthorized
        return seedFallback || [];
      }
      console.warn(`[BackendApiAdapter] getAllEntities fallback for ${collectionName}:`, err.message);
      return seedFallback || [];
    }
  }

  async getEntityById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback?: T[]
  ): Promise<T | null> {
    try {
      const res = await apiClient.get<{ item?: T }>(
        `/api/data/${collectionName}/${encodeURIComponent(id)}`
      );
      if (res?.item) return res.item;
      if (seedFallback && seedFallback.length > 0) {
        return seedFallback.find((item) => item.id === id) || null;
      }
      return null;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        if (seedFallback && seedFallback.length > 0) {
          return seedFallback.find((item) => item.id === id) || null;
        }
        return null;
      }
      console.warn(`[BackendApiAdapter] getEntityById fallback for ${collectionName}/${id}:`, err.message);
      return seedFallback?.find((item) => item.id === id) || null;
    }
  }

  async queryEntities<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback?: T[]
  ): Promise<T[]> {
    const all = await this.getAllEntities<T>(collectionName, seedFallback);
    return all.filter(predicate);
  }

  async removeEntity(collectionName: string, id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/api/data/${collectionName}/${encodeURIComponent(id)}`);
      return true;
    } catch (err: any) {
      console.error(`[BackendApiAdapter] removeEntity error on ${collectionName}/${id}:`, err);
      return false;
    }
  }
}

export const backendApiAdapterInstance = new BackendApiAdapter();
