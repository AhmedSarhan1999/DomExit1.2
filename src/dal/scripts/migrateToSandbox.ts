import { ISOLATED_COLLECTIONS } from '../config/collectionResolver';
import {
  initialLots,
  initialDeals,
  initialSellerRequests,
  initialCandidates,
  initialPartners,
  initialPartnerBanks,
  initialBankEmployees,
  initialSpecialApprovals,
  initialUsers,
} from '../seedData';
import {
  INITIAL_ACCREDITED_DEVELOPERS,
  deduplicateDevelopers,
} from '../repositories/DevelopersRepository';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const SEED_DATA_MAP: Record<string, unknown[]> = {
  lots: initialLots,
  deals: initialDeals,
  seller_requests: initialSellerRequests,
  buyer_applications: initialCandidates,
  candidates: initialCandidates,
  partners: initialPartners,
  partner_applications: initialPartners,
  partner_banks: initialPartnerBanks,
  bank_employees: initialBankEmployees,
  bank_special_approvals: initialSpecialApprovals,
};

const ALLOWED_USER_EMAILS = new Set([
  'amaas9499@gmail.com',
  'amaas9494@gmail.com',
  'bank@domexit.ru',
  'ceo@domexit.ru',
]);

/**
 * One-time and programmatic migration script to clone demo/test data into `demo_*` collections
 * while leaving production canonical collections 100% clean and virgin.
 */
export async function migrateToSandbox(force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const MIGRATION_FLAG = 'domexit_sandbox_migrated_v4';
  if (!force && localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return true;
  }

  try {
    console.info('[SandboxMigration] Initiating dual-environment sandbox migration v4...');

    // 1. Process LocalStorage Caches for isolated collections
    for (const baseCol of ISOLATED_COLLECTIONS) {
      const sandboxKey = `domexit_fb_demo_${baseCol}`;
      const prodKey = `domexit_fb_${baseCol}`;

      const existingSandbox = localStorage.getItem(sandboxKey);
      const existingProd = localStorage.getItem(prodKey);

      let sandboxData: unknown[] = [];

      if (existingSandbox) {
        try {
          sandboxData = JSON.parse(existingSandbox);
        } catch {
          sandboxData = [];
        }
      }

      // If sandbox is empty or uninitialized, migrate from existing prod or seed data
      if (!sandboxData || sandboxData.length === 0) {
        if (existingProd) {
          try {
            const parsedProd = JSON.parse(existingProd);
            if (Array.isArray(parsedProd) && parsedProd.length > 0) {
              sandboxData = parsedProd;
            }
          } catch {
            sandboxData = [];
          }
        }

        if (sandboxData.length === 0 && SEED_DATA_MAP[baseCol]) {
          sandboxData = SEED_DATA_MAP[baseCol];
        }

        localStorage.setItem(sandboxKey, JSON.stringify(sandboxData));
      }

      // Ensure canonical production cache is pristine empty array
      localStorage.setItem(prodKey, '[]');
    }

    // 1.1 Sanitize Developers in LocalStorage
    try {
      const devKey = 'domexit_fb_developers';
      const existingDevRaw = localStorage.getItem(devKey);
      let devs = INITIAL_ACCREDITED_DEVELOPERS;
      if (existingDevRaw) {
        try {
          const parsed = JSON.parse(existingDevRaw);
          if (Array.isArray(parsed)) {
            devs = deduplicateDevelopers(parsed);
          }
        } catch {}
      }
      localStorage.setItem(devKey, JSON.stringify(devs));
    } catch {}

    // 1.2 Sanitize Users in LocalStorage (keep only authorized system accounts)
    try {
      const usersKey = 'domexit_fb_users';
      const existingUsersRaw = localStorage.getItem(usersKey);
      let usersToKeep = initialUsers.filter((u) => ALLOWED_USER_EMAILS.has((u.email || '').toLowerCase().trim()));
      if (existingUsersRaw) {
        try {
          const parsedUsers = JSON.parse(existingUsersRaw);
          if (Array.isArray(parsedUsers)) {
            const valid = parsedUsers.filter((u) => ALLOWED_USER_EMAILS.has((u.email || '').toLowerCase().trim()));
            if (valid.length > 0) {
              usersToKeep = valid;
            }
          }
        } catch {}
      }
      localStorage.setItem(usersKey, JSON.stringify(usersToKeep));
    } catch {}

    // 2. Clone Firestore collections into demo_* and purge canonical collections
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        for (const baseCol of ISOLATED_COLLECTIONS) {
          try {
            const canonicalColRef = collection(db, baseCol);
            const snapshot = await getDocs(canonicalColRef);
            if (!snapshot.empty) {
              for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const demoDocRef = doc(db, `demo_${baseCol}`, docSnap.id);
                // Copy to demo_* collection
                await setDoc(demoDocRef, data, { merge: true });
                // Purge from canonical production collection
                await deleteDoc(doc(db, baseCol, docSnap.id));
              }
              console.info(`[SandboxMigration] Migrated & purged ${snapshot.size} records from '${baseCol}' to 'demo_${baseCol}'`);
            }
          } catch (e) {
            console.warn(`[SandboxMigration] Non-critical Firestore clone skipped for ${baseCol}:`, e);
          }
        }
      }
    } catch (fbErr) {
      console.warn('[SandboxMigration] Live Firestore migration skipped:', fbErr);
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
    console.info('[SandboxMigration] Dual-environment migration completed successfully.');

    // Dispatch update notification
    window.dispatchEvent(new CustomEvent('domexit:dal_updated', { detail: { migration: 'sandbox_v4' } }));
    return true;
  } catch (err) {
    console.error('[SandboxMigration] Migration encountered an error:', err);
    return false;
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { __DOMEXIT_MIGRATE__?: (force?: boolean) => Promise<boolean> }).__DOMEXIT_MIGRATE__ = migrateToSandbox;
}
