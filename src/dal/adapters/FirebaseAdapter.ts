import { db } from '../firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { isIsolatedCollection } from '../config/collectionResolver';
import { useEnvironmentStore } from '../../stores/useEnvironmentStore';

/**
 * Recursively strips `undefined` properties before writing to Firestore,
 * preventing Firestore SDK runtime rejections on optional fields.
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeForFirestore(v);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Transitional Data Access Layer: Firebase & Resilient Local Cache Adapter
 * Implements IDatabaseAdapter for 1-click transition to YandexCloudAdapter.
 */
export class FirebaseDatabaseAdapter implements IDatabaseAdapter {
  readonly providerName = 'firebase' as const;

  async saveEntity<T extends { id: string }>(
    collectionName: string,
    entity: T
  ): Promise<T> {
    const cleanEntity = sanitizeForFirestore(entity);
    const storageKey = `domexit_fb_${collectionName}`;

    // 1. Update LocalStorage cache immediately for zero-latency reactivity
    try {
      const cached = this.getCache<T>(collectionName);
      const existingIdx = cached.findIndex((item) => item.id === cleanEntity.id);
      if (existingIdx >= 0) {
        cached[existingIdx] = cleanEntity;
      } else {
        cached.unshift(cleanEntity);
      }
      localStorage.setItem(storageKey, JSON.stringify(cached));
    } catch (e) {
      console.warn('[FirebaseAdapter] Local cache update error:', e);
    }

    // 2. Sync to live Firebase Firestore
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const docRef = doc(db, collectionName, cleanEntity.id);
        await setDoc(docRef, cleanEntity as Record<string, unknown>, { merge: true });
      }
    } catch (fbError) {
      console.info(`[FirebaseAdapter] Firestore sync fallback (${collectionName}/${cleanEntity.id}):`, fbError);
    }

    return cleanEntity;
  }

  async getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const storageKey = `domexit_fb_${collectionName}`;
    const localCached = this.getCache<T>(collectionName);
    const isProd = useEnvironmentStore.getState().isProduction;
    const effectiveSeedFallback = isProd && isIsolatedCollection(collectionName) ? [] : seedFallback;

    // Fetch from live Firestore and merge with local/seed items so newly created or seeded entities are never lost
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const remoteMap = new Map<string, T>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as T;
            if (data && data.id) {
              remoteMap.set(data.id, data);
            }
          });

          // Merge local cached items that may not yet have flushed or additional seed items
          for (const localItem of localCached) {
            if (!remoteMap.has(localItem.id)) {
              remoteMap.set(localItem.id, localItem);
            }
          }
          for (const seedItem of effectiveSeedFallback) {
            if (!remoteMap.has(seedItem.id)) {
              remoteMap.set(seedItem.id, seedItem);
            }
          }

          const merged = Array.from(remoteMap.values());
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {}
          return merged;
        }
      }
    } catch {
      // Graceful fallback to local cache or seed data
    }

    if (localCached.length > 0) {
      // Ensure any newly added seed lots/entities appear cleanly
      if (effectiveSeedFallback.length > 0) {
        const existingIds = new Set(localCached.map((i) => i.id));
        const missingSeeds = effectiveSeedFallback.filter((s) => !existingIds.has(s.id));
        if (missingSeeds.length > 0) {
          const combined = [...localCached, ...missingSeeds];
          try {
            localStorage.setItem(storageKey, JSON.stringify(combined));
          } catch {}
          return combined;
        }
      }
      return localCached;
    }

    if (effectiveSeedFallback.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(effectiveSeedFallback));
      } catch {}
    }
    return [...effectiveSeedFallback];
  }

  async getEntityById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    if (!id) return null;

    // Direct doc lookup first when Firestore is active
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const docRef = doc(db, collectionName, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as T;
        }
      }
    } catch {
      // Fall back to collection cache
    }

    const all = await this.getAllEntities<T>(collectionName, seedFallback);
    return all.find((item) => item.id === id) || null;
  }

  async queryEntities<T extends { id: string }>(
    collectionName: string,
    predicate: (item: T) => boolean,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const all = await this.getAllEntities<T>(collectionName, seedFallback);
    return all.filter(predicate);
  }

  async removeEntity(collectionName: string, id: string): Promise<boolean> {
    const storageKey = `domexit_fb_${collectionName}`;
    try {
      const cached = this.getCache<{ id: string }>(collectionName);
      const filtered = cached.filter((item) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(filtered));

      if (db && (db as unknown as { app?: unknown }).app) {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
      }
      return true;
    } catch {
      return false;
    }
  }

  private getCache<T>(collectionName: string): T[] {
    const storageKey = `domexit_fb_${collectionName}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export const firebaseAdapterInstance = new FirebaseDatabaseAdapter();

/**
 * Static facade delegating to the active adapter instance for seamless repository compatibility.
 */
export class FirebaseAdapter {
  static saveEntity<T extends { id: string }>(collectionName: string, entity: T): Promise<T> {
    return firebaseAdapterInstance.saveEntity(collectionName, entity);
  }

  static getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback: T[] = []
  ): Promise<T[]> {
    return firebaseAdapterInstance.getAllEntities(collectionName, seedFallback);
  }

  static getEntityById<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    return firebaseAdapterInstance.getEntityById(collectionName, id, seedFallback);
  }

  static getEntity<T extends { id: string }>(
    collectionName: string,
    id: string,
    seedFallback: T[] = []
  ): Promise<T | null> {
    return firebaseAdapterInstance.getEntityById(collectionName, id, seedFallback);
  }

  static removeEntity(collectionName: string, id: string): Promise<boolean> {
    return firebaseAdapterInstance.removeEntity(collectionName, id);
  }
}
