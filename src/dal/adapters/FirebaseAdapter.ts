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
import {
  initialLots,
  initialDeals,
  initialSellerRequests,
  initialCandidates,
  initialPartners,
  initialPartnerBanks,
  initialBankEmployees,
  initialSpecialApprovals,
} from '../seedData';

const DEMO_DEVELOPER_IDS = Array.from({ length: 20 }, (_, i) => `dev-${i + 1}`);

/**
 * Exact set of all mock/demo IDs used in Sandbox seed data.
 * Used to cleanly segregate demo items from genuine user-submitted entities in production mode.
 */
const DEMO_SEED_ID_SET = new Set<string>([
  ...initialLots.map((l) => l.id),
  ...initialDeals.map((d) => d.id),
  ...initialSellerRequests.map((s) => s.id),
  ...initialCandidates.map((c) => c.id),
  ...initialPartners.map((p) => p.id),
  ...initialPartnerBanks.map((b) => b.id),
  ...initialBankEmployees.map((be) => be.id),
  ...initialSpecialApprovals.map((sa) => sa.id),
  ...DEMO_DEVELOPER_IDS,
]);

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

          // Merge local cached items that may not yet have flushed or additional non-seed items
          for (const localItem of localCached) {
            if (!remoteMap.has(localItem.id)) {
              if (!isProd || !isIsolatedCollection(collectionName) || !DEMO_SEED_ID_SET.has(localItem.id)) {
                remoteMap.set(localItem.id, localItem);
              }
            }
          }
          if (!isProd || !isIsolatedCollection(collectionName)) {
            for (const seedItem of effectiveSeedFallback) {
              if (!remoteMap.has(seedItem.id)) {
                remoteMap.set(seedItem.id, seedItem);
              }
            }
          }

          const merged = Array.from(remoteMap.values());
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {}
          return merged;
        } else if (isProd && isIsolatedCollection(collectionName)) {
          // In production, when remote is empty, preserve ALL non-demo entities created locally
          const nonSeed = localCached.filter((item) => !DEMO_SEED_ID_SET.has(item.id));
          try {
            localStorage.setItem(storageKey, JSON.stringify(nonSeed));
          } catch {}
          return nonSeed;
        }
      }
    } catch {
      // Graceful fallback to local cache or seed data
    }

    if (localCached.length > 0) {
      if (isProd && isIsolatedCollection(collectionName)) {
        // Strip out demo seed items in production mode so production displays zero demo data,
        // but preserve ALL genuine user-created entities
        const nonSeed = localCached.filter((item) => !DEMO_SEED_ID_SET.has(item.id));
        if (nonSeed.length !== localCached.length) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(nonSeed));
          } catch {}
        }
        return nonSeed;
      }

      // Ensure any newly added seed lots/entities appear cleanly in demo mode
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
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const firebaseAdapterInstance = new FirebaseDatabaseAdapter();
