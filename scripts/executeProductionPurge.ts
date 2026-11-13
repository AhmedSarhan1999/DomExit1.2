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

// Canonical production collections to purge 100% clean
const PURGE_CANONICAL_COLLECTIONS = [
  'partners',
  'partner_applications',
  'investor_applications',
  'developers',
  'developer_accreditation_requests',
  'bank_special_approvals',
  'bank_employees',
  'partner_banks',
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'audit_logs',
  'user_consents',
  'partner_preliminary_requests',
  'escrow_bridge_chats',
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
  developers: INITIAL_ACCREDITED_DEVELOPERS,
};

const PROD_ALLOWED_EMAILS = new Set([
  'amaas9499@gmail.com',
  'amaas9494@gmail.com',
]);

const PROD_SYSTEM_USERS = [
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

const PROD_SYSTEM_EMPLOYEES = [
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

async function runProductionPurge() {
  console.log('========================================================');
  console.log('🚀 DOMEXIT: PRODUCTION DATABASE PURGE & SEGREGATION');
  console.log(`Connected to Firebase Project: ${firebaseConfig.projectId}`);
  console.log('========================================================\n');

  let securityRulesActive = false;

  // STEP 1: Purge Canonical Collections & Ensure Demo Copies
  console.log('--- [Step 1] Purging Canonical Collections (Target: 0 docs) ---');
  for (const baseCol of PURGE_CANONICAL_COLLECTIONS) {
    try {
      const canonicalRef = collection(db, baseCol);
      const snapshot = await getDocs(canonicalRef);
      const demoRef = collection(db, `demo_${baseCol}`);
      const demoSnapshot = await getDocs(demoRef);

      let migratedCount = 0;
      let purgedCount = 0;

      // Copy existing canonical docs to demo_* if needed
      if (!snapshot.empty) {
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          await setDoc(doc(db, `demo_${baseCol}`, docSnap.id), data, { merge: true });
          migratedCount++;
          await deleteDoc(doc(db, baseCol, docSnap.id));
          purgedCount++;
        }
      }

      // If demo collection is completely empty, populate with seed data so demo mode remains functional
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
        securityRulesActive = true;
        console.log(`ℹ [${baseCol}]: Firestore collection is locked by security rules (permission-denied).`);
      } else {
        console.error(`✗ Error processing collection ${baseCol}:`, err?.message || err);
      }
    }
  }

  // STEP 2: Sanitize Users Collection to Strictly the 2 Core Accounts
  console.log('\n--- [Step 2] Sanitizing Users (Preserving strictly 2 Production Accounts) ---');
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    let deletedUsers = 0;
    let retainedUsers = 0;

    for (const docSnap of usersSnapshot.docs) {
      const data = docSnap.data();
      const email = (data.email || '').toLowerCase().trim();

      if (PROD_ALLOWED_EMAILS.has(email)) {
        console.log(`  ✓ Retaining authorized account: [${docSnap.id}] ${email} (${data.role || 'no-role'})`);
        retainedUsers++;
      } else {
        console.log(`  Deleting dummy/unauthorized user: [${docSnap.id}] ${email || 'no-email'}`);
        await deleteDoc(doc(db, 'users', docSnap.id));
        deletedUsers++;
      }
    }

    // Ensure 2 core production users exist
    for (const u of PROD_SYSTEM_USERS) {
      await setDoc(doc(db, 'users', u.id), u, { merge: true });
    }

    console.log(`✓ Users clean: Retained: ${retainedUsers} | Deleted test/unauthorized: ${deletedUsers}`);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      securityRulesActive = true;
      console.log('ℹ Users collection: Firestore is locked by security rules (permission-denied).');
    } else {
      console.error('✗ Error sanitizing users:', err?.message || err);
    }
  }

  // STEP 3: Sanitize Employees Collection to Strictly Алексей Смирнов
  console.log('\n--- [Step 3] Sanitizing Employees (Preserving strictly Алексей Смирнов) ---');
  try {
    const empRef = collection(db, 'employees');
    const empSnapshot = await getDocs(empRef);
    let deletedEmployees = 0;

    for (const docSnap of empSnapshot.docs) {
      const data = docSnap.data();
      const email = (data.email || '').toLowerCase().trim();

      if (!PROD_ALLOWED_EMAILS.has(email)) {
        console.log(`  Deleting test/dummy employee: [${docSnap.id}] ${data.name || 'unnamed'} (${email})`);
        await deleteDoc(doc(db, 'employees', docSnap.id));
        deletedEmployees++;
      }
    }

    for (const emp of PROD_SYSTEM_EMPLOYEES) {
      await setDoc(doc(db, 'employees', emp.id), emp, { merge: true });
    }

    console.log(`✓ Employees clean: Deleted test employees: ${deletedEmployees}`);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      securityRulesActive = true;
      console.log('ℹ Employees collection: Firestore is locked by security rules (permission-denied).');
    } else {
      console.error('✗ Error sanitizing employees:', err?.message || err);
    }
  }

  // STEP 4: Validation Summary
  console.log('\n--- [Step 4] Final Production Database Audit Scan ---');
  let totalProdDocs = 0;

  for (const baseCol of PURGE_CANONICAL_COLLECTIONS) {
    try {
      const colRef = collection(db, baseCol);
      const snap = await getDocs(colRef);
      const count = snap.size;
      totalProdDocs += count;
      const status = count === 0 ? 'CLEAN (0 docs)' : `WARNING (${count} docs remaining)`;
      console.log(`  Canonical [${baseCol}]: ${status}`);
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        console.log(`  Canonical [${baseCol}]: PROTECTED BY FIRESTORE SECURITY RULES`);
      } else {
        console.log(`  Canonical [${baseCol}]: ${e?.message || 'Error'}`);
      }
    }
  }

  console.log('\n========================================================');
  if (securityRulesActive) {
    console.log('🔒 SECURITY NOTICE: Firestore live security rules prevent unauthenticated CLI access.');
    console.log('   The application runtime (DAL Gateway + useEnvironmentStore) strictly enforces');
    console.log('   the clean production environment and 0 auto-seed policy in code.');
    console.log('   Browser hook window.__DOMEXIT_PURGE_FIRESTORE__() is also available in the client.');
  } else if (totalProdDocs === 0) {
    console.log('✅ AUDIT PASSED: Canonical production collections are 100% clean (0 docs)!');
    console.log('✅ Core production accounts preserved.');
  } else {
    console.warn(`⚠️ AUDIT WARNING: ${totalProdDocs} documents remain in canonical collections.`);
  }
  console.log('========================================================');
}

runProductionPurge()
  .then(() => {
    console.log('\nPurge script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Purge script encountered an error:', err);
    process.exit(1);
  });
