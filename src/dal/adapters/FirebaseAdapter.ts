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

    // Fetch from live Firestore
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);

        // If Firestore collection is empty, then it is genuinely empty/purged! Return []!
        if (snapshot.empty) {
          try {
            localStorage.setItem(storageKey, JSON.stringify([]));
          } catch {}
          return [];
        }

        const remoteDocs: T[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as T;
          if (data && data.id) {
            remoteDocs.push(data);
          }
        });

        try {
          localStorage.setItem(storageKey, JSON.stringify(remoteDocs));
        } catch {}
        return remoteDocs;
      }
    } catch (fbErr) {
      // Graceful fallback to local cache ONLY if Firestore network request fails
    }

    if (localCached.length > 0) {
      return localCached;
    }

    try {
      if (localStorage.getItem(storageKey) !== null) {
        return [];
      }
    } catch {}

    // Only market_settings can use seed fallback if genuinely first offline load
    if (collectionName === 'market_settings' && seedFallback.length > 0) {
      return [...seedFallback];
    }

    return [];
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
