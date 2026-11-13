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

export const PROD_SYSTEM_USERS = [
  {
    id: 'usr-owner-1',
    email: 'amaas9499@gmail.com',
    name: 'Ahmed Abdallah (Владелец / CEO)',
    role: 'owner',
    activeRole: 'owner',
    phone: '+7 (999) 000-00-01',
    createdAt: '2026-01-01T00:00:00Z',
    isSuperAdmin: true,
  },
  {
    id: 'usr-emp-1',
    email: 'amaas9494@gmail.com',
    name: 'Алексей Смирнов (Ведущий куратор)',
    role: 'employee',
    activeRole: 'employee',
    assignedEmployeeId: 'emp-1',
    phone: '+7 (999) 000-00-02',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const PROD_SYSTEM_EMPLOYEES = [
  {
    id: 'emp-1',
    name: 'Алексей Смирнов',
    role: 'Ведущий куратор',
    phone: '+7 (999) 000-00-02',
    email: 'amaas9494@gmail.com',
    activeDealsCount: 0,
    completedDealsCount: 0,
    rating: 5.0,
  },
];

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
  developers: INITIAL_ACCREDITED_DEVELOPERS,
  users: initialUsers,
};

const ALLOWED_PROD_EMAILS = new Set([
  'amaas9499@gmail.com',
  'amaas9494@gmail.com',
]);

/**
 * Purges all canonical production collections in Firestore and LocalStorage,
 * leaving production 100% virgin while preserving demo data in demo_* collections.
 */
export async function purgeProductionDatabase(): Promise<{
  success: boolean;
  purgedCollections: Record<string, number>;
  retainedUsers: number;
  error?: string;
}> {
  console.info('[ProductionPurge] Starting execution of production purge...');
  const stats: Record<string, number> = {};

  try {
    // 1. Clean LocalStorage caches for production
    for (const baseCol of ISOLATED_COLLECTIONS) {
      const prodKey = `domexit_fb_${baseCol}`;
      const sandboxKey = `domexit_fb_demo_${baseCol}`;

      // In production cache, everything is empty array except users & employees
      if (baseCol === 'users') {
        localStorage.setItem(prodKey, JSON.stringify(PROD_SYSTEM_USERS));
      } else if (baseCol === 'employees') {
        localStorage.setItem(prodKey, JSON.stringify(PROD_SYSTEM_EMPLOYEES));
      } else {
        localStorage.setItem(prodKey, '[]');
      }

      // Ensure sandbox cache has data
      const existingDemo = localStorage.getItem(sandboxKey);
      if (!existingDemo || existingDemo === '[]') {
        if (SEED_DATA_MAP[baseCol]) {
          localStorage.setItem(sandboxKey, JSON.stringify(SEED_DATA_MAP[baseCol]));
        }
      }
    }

    // 2. Process Firestore Collections if connected
    if (db && (db as unknown as { app?: unknown }).app) {
      for (const baseCol of ISOLATED_COLLECTIONS) {
        if (baseCol === 'users' || baseCol === 'employees') continue;

        try {
          const canonicalRef = collection(db, baseCol);
          const snap = await getDocs(canonicalRef);
          let count = 0;

          if (!snap.empty) {
            for (const docSnap of snap.docs) {
              const data = docSnap.data();
              // Back up to demo collection first
              await setDoc(doc(db, `demo_${baseCol}`, docSnap.id), data, { merge: true });
              // Delete from production canonical collection
              await deleteDoc(doc(db, baseCol, docSnap.id));
              count++;
            }
          }
          stats[baseCol] = count;
        } catch (colErr) {
          console.warn(`[ProductionPurge] Firestore purge skipped for ${baseCol}:`, colErr);
          stats[baseCol] = 0;
        }
      }

      // 3. Sanitize Firestore users collection
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const email = (data.email || '').toLowerCase().trim();
          if (!ALLOWED_PROD_EMAILS.has(email)) {
            await deleteDoc(doc(db, 'users', docSnap.id));
          }
        }
        // Ensure 2 core production users exist
        for (const u of PROD_SYSTEM_USERS) {
          await setDoc(doc(db, 'users', u.id), u, { merge: true });
        }
      } catch (uErr) {
        console.warn('[ProductionPurge] Users collection purge notice:', uErr);
      }

      // 4. Sanitize Firestore employees collection
      try {
        const empRef = collection(db, 'employees');
        const snap = await getDocs(empRef);
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const email = (data.email || '').toLowerCase().trim();
          if (!ALLOWED_PROD_EMAILS.has(email)) {
            await deleteDoc(doc(db, 'employees', docSnap.id));
          }
        }
        for (const emp of PROD_SYSTEM_EMPLOYEES) {
          await setDoc(doc(db, 'employees', emp.id), emp, { merge: true });
        }
      } catch (eErr) {
        console.warn('[ProductionPurge] Employees collection purge notice:', eErr);
      }
    }

    // 5. Notify the rest of the application
    window.dispatchEvent(
      new CustomEvent('domexit:dal_updated', { detail: { action: 'production_purged' } })
    );

    console.info('[ProductionPurge] Execution completed successfully.', stats);
    return {
      success: true,
      purgedCollections: stats,
      retainedUsers: PROD_SYSTEM_USERS.length,
    };
  } catch (err: any) {
    console.error('[ProductionPurge] Execution failed:', err);
    return {
      success: false,
      purgedCollections: stats,
      retainedUsers: PROD_SYSTEM_USERS.length,
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * One-time and programmatic migration script to clone demo/test data into `demo_*` collections
 * while leaving production canonical collections 100% clean and virgin.
 */
export async function migrateToSandbox(force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const MIGRATION_FLAG = 'domexit_sandbox_migrated_v5';
  if (!force && localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return true;
  }

  try {
    console.info('[SandboxMigration] Initiating dual-environment sandbox migration v5...');

    // 1. Process LocalStorage Caches for isolated collections
    for (const baseCol of ISOLATED_COLLECTIONS) {
      const sandboxKey = `domexit_fb_demo_${baseCol}`;
      const prodKey = `domexit_fb_${baseCol}`;

      const existingSandbox = localStorage.getItem(sandboxKey);
      let sandboxData: unknown[] = [];

      if (existingSandbox) {
        try {
          sandboxData = JSON.parse(existingSandbox);
        } catch {
          sandboxData = [];
        }
      }

      if (!sandboxData || sandboxData.length === 0) {
        if (SEED_DATA_MAP[baseCol]) {
          sandboxData = SEED_DATA_MAP[baseCol];
        }
        localStorage.setItem(sandboxKey, JSON.stringify(sandboxData));
      }

      // Ensure canonical production cache is pristine empty array or core users
      if (baseCol === 'users') {
        localStorage.setItem(prodKey, JSON.stringify(PROD_SYSTEM_USERS));
      } else if (baseCol === 'employees') {
        localStorage.setItem(prodKey, JSON.stringify(PROD_SYSTEM_EMPLOYEES));
      } else {
        localStorage.setItem(prodKey, '[]');
      }
    }

    // 2. Clone Firestore collections into demo_* and purge canonical collections
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        for (const baseCol of ISOLATED_COLLECTIONS) {
          if (baseCol === 'users' || baseCol === 'employees') continue;

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
              console.info(
                `[SandboxMigration] Migrated & purged ${snapshot.size} records from '${baseCol}' to 'demo_${baseCol}'`
              );
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
    window.dispatchEvent(new CustomEvent('domexit:dal_updated', { detail: { migration: 'sandbox_v5' } }));
    return true;
  } catch (err) {
    console.error('[SandboxMigration] Migration encountered an error:', err);
    return false;
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as {
    __DOMEXIT_MIGRATE__?: (force?: boolean) => Promise<boolean>;
    __DOMEXIT_PURGE_FIRESTORE__?: () => Promise<unknown>;
  }).__DOMEXIT_MIGRATE__ = migrateToSandbox;

  (window as unknown as {
    __DOMEXIT_PURGE_FIRESTORE__?: () => Promise<unknown>;
  }).__DOMEXIT_PURGE_FIRESTORE__ = purgeProductionDatabase;
}
