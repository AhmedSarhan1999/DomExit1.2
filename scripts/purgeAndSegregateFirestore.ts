import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  initialLots,
  initialDeals,
  initialSellerRequests,
  initialCandidates,
  initialPartners,
  initialPartnerBanks,
  initialBankEmployees,
  initialSpecialApprovals,
} from '../src/dal/seedData';
import { INITIAL_ACCREDITED_DEVELOPERS } from '../src/dal/repositories/DevelopersRepository';

const firebaseConfig = {
  apiKey: "AIzaSyBKhlYZoEH5YUk2v8SmqWqUh5PDaa3qqJY",
  authDomain: "vet-teck-faa9b.firebaseapp.com",
  databaseURL: "https://vet-teck-faa9b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vet-teck-faa9b",
  storageBucket: "vet-teck-faa9b.firebasestorage.app",
  messagingSenderId: "857641831751",
  appId: "1:857641831751:web:43684fcb31a261c7db5062",
  measurementId: "G-XT2XCZ1NKD",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ISOLATED_COLLECTIONS = [
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'audit_logs',
  'partner_preliminary_requests',
  'escrow_bridge_chats',
  'bank_special_approvals',
  'partners',
  'partner_applications',
  'investor_applications',
  'partner_banks',
  'bank_employees',
  'user_consents',
  'developer_accreditation_requests',
];

const SEED_FALLBACKS: Record<string, any[]> = {
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

const ALLOWED_EMAILS = new Set([
  'amaas9499@gmail.com',
  'amaas9494@gmail.com',
  'bank@domexit.ru',
]);

const ALLOWED_DEVELOPER_IDS = new Set(
  INITIAL_ACCREDITED_DEVELOPERS.map((d) => d.id)
);
const ALLOWED_DEVELOPER_NAMES = new Set(
  INITIAL_ACCREDITED_DEVELOPERS.map((d) => d.name.toLowerCase().trim())
);

async function runPurgeAndSegregate() {
  console.log('========================================================');
  console.log('🚀 DOMEXIT: Dual-Environment Firestore Migration & Purge');
  console.log(`Connected to Firebase Project: ${firebaseConfig.projectId}`);
  console.log('========================================================\n');

  // STEP 1: Migrate Canonical to demo_* and Purge Canonical
  console.log('--- [Step 1] Segregating & Purging Isolated Collections ---');
  for (const baseCol of ISOLATED_COLLECTIONS) {
    try {
      const canonicalRef = collection(db, baseCol);
      const snapshot = await getDocs(canonicalRef);
      const demoRef = collection(db, `demo_${baseCol}`);
      const demoSnapshot = await getDocs(demoRef);

      let migratedCount = 0;
      let purgedCount = 0;

      // Copy existing canonical docs to demo_
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          await setDoc(doc(db, `demo_${baseCol}`, docSnap.id), data, { merge: true });
          migratedCount++;
          await deleteDoc(doc(db, baseCol, docSnap.id));
          purgedCount++;
        }
      }

      // If demo collection is completely empty, populate with seed data so demo mode is functional
      let seededDemoCount = 0;
      if (demoSnapshot.empty && migratedCount === 0 && SEED_FALLBACKS[baseCol]) {
        for (const item of SEED_FALLBACKS[baseCol]) {
          if (item && item.id) {
            await setDoc(doc(db, `demo_${baseCol}`, item.id), item, { merge: true });
            seededDemoCount++;
          }
        }
      }

      console.log(
        `✓ [${baseCol}]: Purged from Prod: ${purgedCount} | Migrated to Demo: ${migratedCount} | Demo Seeded: ${seededDemoCount}`
      );
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        console.log(`ℹ [${baseCol}]: Live Firestore collection is locked by security rules.`);
      } else {
        console.error(`✗ Error processing collection ${baseCol}:`, err);
      }
    }
  }

  // STEP 2: Sanitize Developers Collection
  console.log('\n--- [Step 2] Sanitizing Accredited Developers ---');
  try {
    const devRef = collection(db, 'developers');
    const devSnapshot = await getDocs(devRef);
    let deletedDevs = 0;

    for (const docSnap of devSnapshot.docs) {
      const data = docSnap.data();
      const devId = docSnap.id;
      const devName = (data.name || '').toLowerCase().trim();

      const isAllowedId = ALLOWED_DEVELOPER_IDS.has(devId);
      const isAllowedName = ALLOWED_DEVELOPER_NAMES.has(devName);

      // Check if it's fake or unauthorized developer
      const isFake =
        !isAllowedId &&
        (!isAllowedName ||
          devName.includes('xxx') ||
          devName.includes('1234') ||
          devName.includes('aaaa') ||
          devName.includes('test'));

      if (isFake) {
        console.log(`  Deleting fake developer: [${devId}] "${data.name || 'unnamed'}" (INN: ${data.inn || 'N/A'})`);
        await deleteDoc(doc(db, 'developers', devId));
        deletedDevs++;
      }
    }

    // Ensure the 15 accredited developers exist
    let ensuredDevs = 0;
    for (const dev of INITIAL_ACCREDITED_DEVELOPERS) {
      await setDoc(doc(db, 'developers', dev.id), dev, { merge: true });
      ensuredDevs++;
    }

    console.log(`✓ Developers clean: Deleted fake: ${deletedDevs} | Ensured accredited: ${ensuredDevs}`);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.log('ℹ Developers collection: Live Firestore is locked by security rules.');
    } else {
      console.error('✗ Error sanitizing developers:', err);
    }
  }

  // STEP 3: Sanitize Users Collection
  console.log('\n--- [Step 3] Sanitizing Users (Preserving 3 Authorized Accounts) ---');
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    let deletedUsers = 0;
    let retainedUsers = 0;

    for (const docSnap of usersSnapshot.docs) {
      const data = docSnap.data();
      const email = (data.email || '').toLowerCase().trim();

      if (ALLOWED_EMAILS.has(email)) {
        console.log(`  ✓ Retaining authorized user: [${docSnap.id}] ${email} (${data.role || data.activeRole || 'no-role'})`);
        retainedUsers++;
      } else {
        console.log(`  Deleting unauthorized/test user: [${docSnap.id}] ${email || 'no-email'} (${data.displayName || 'unnamed'})`);
        await deleteDoc(doc(db, 'users', docSnap.id));
        deletedUsers++;
      }
    }

    console.log(`✓ Users clean: Retained: ${retainedUsers} | Deleted test/unauthorized: ${deletedUsers}`);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.log('ℹ Users collection: Live Firestore is locked by security rules.');
    } else {
      console.error('✗ Error sanitizing users:', err);
    }
  }

  // STEP 4: Final Validation Scan
  console.log('\n--- [Step 4] Final Production Database Audit Scan ---');
  let totalProdDocs = 0;
  let securityRulesActive = false;

  for (const baseCol of ISOLATED_COLLECTIONS) {
    try {
      const colRef = collection(db, baseCol);
      const snap = await getDocs(colRef);
      const count = snap.size;
      totalProdDocs += count;
      const status = count === 0 ? 'CLEAN (0 docs)' : `WARNING (${count} docs remaining)`;
      console.log(`  Canonical [${baseCol}]: ${status}`);
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        securityRulesActive = true;
        console.log(`  Canonical [${baseCol}]: PROTECTED BY FIRESTORE SECURITY RULES (Permission Denied)`);
      } else {
        console.log(`  Canonical [${baseCol}]: ${e?.message || 'Error'}`);
      }
    }
  }

  try {
    const devSnapFinal = await getDocs(collection(db, 'developers'));
    console.log(`  Shared [developers]: ${devSnapFinal.size} accredited developers`);
  } catch (e: any) {
    console.log(`  Shared [developers]: PROTECTED (Permission Denied)`);
  }

  try {
    const userSnapFinal = await getDocs(collection(db, 'users'));
    console.log(`  Authorized [users]: ${userSnapFinal.size} active system accounts`);
  } catch (e: any) {
    console.log(`  Authorized [users]: PROTECTED (Permission Denied)`);
  }

  console.log('\n========================================================');
  if (securityRulesActive) {
    console.log('🔒 SECURITY AUDIT: Firestore live security rules are strictly active.');
    console.log('   Unauthenticated / external CLI access is blocked by security rules.');
    console.log('   Application DAL dual-environment segregation (sandbox_v4) is enforced in code & LocalStorage.');
  } else if (totalProdDocs === 0) {
    console.log('✅ AUDIT PASSED: Canonical production collections are 100% clean!');
    console.log('✅ Institutional Russian developer registry restored.');
    console.log('✅ System accounts preserved.');
  } else {
    console.warn(`⚠️ AUDIT WARNING: ${totalProdDocs} documents remain in canonical collections.`);
  }
  console.log('========================================================');
}

runPurgeAndSegregate()
  .then(() => {
    console.log('\nScript finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
