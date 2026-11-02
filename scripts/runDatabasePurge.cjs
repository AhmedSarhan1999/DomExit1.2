const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  writeBatch
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBKhlYZoEH5YUk2v8SmqWqUh5PDaa3qqJY',
  authDomain: 'vet-teck-faa9b.firebaseapp.com',
  databaseURL: 'https://vet-teck-faa9b-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'vet-teck-faa9b',
  storageBucket: 'vet-teck-faa9b.firebasestorage.app',
  messagingSenderId: '857641831751',
  appId: '1:857641831751:web:43684fcb31a261c7db5062'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 12 collections to be wiped completely
const COLLECTIONS_TO_WIPE = [
  'audit_logs',
  'deals',
  'lots',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'bank_credit_limits',
  'bank_special_approvals',
  'developer_accreditation_requests',
  'partner_preliminary_requests',
  'user_consents'
];

async function wipeCollection(colName) {
  const colRef = collection(db, colName);
  const snap = await getDocs(colRef);
  if (snap.empty) {
    console.log(`[Wipe] Collection "${colName}" is already empty (0 docs).`);
    return 0;
  }

  console.log(`[Wipe] Purging ${snap.size} documents from "${colName}"...`);
  // Firestore allows up to 500 operations per batch
  const docs = snap.docs;
  let deletedCount = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deletedCount += chunk.length;
  }
  console.log(`[Wipe] Successfully purged ${deletedCount} documents from "${colName}".`);
  return deletedCount;
}

async function sanitizeUsers() {
  console.log('\n--- SANITIZING USERS COLLECTION ---');
  const snap = await getDocs(collection(db, 'users'));
  
  for (const d of snap.docs) {
    const data = d.data();
    const email = (data.email || '').trim().toLowerCase();
    const name = (data.name || '').trim();

    // 1. Delete ceo@domexit.ru or alexander@domexit.ru
    if (email === 'ceo@domexit.ru' || email === 'alexander@domexit.ru') {
      console.log(`[Users] Deleting mock user document [${d.id}]: ${email}`);
      await deleteDoc(d.ref);
      continue;
    }

    // 2. Delete duplicate Viktor Sergeyevich for amaas9499@gmail.com
    if (email === 'amaas9499@gmail.com' && (name.includes('Виктор') || data.clientCode === 'DEX-000001' && d.id !== 'usr-owner-001')) {
      console.log(`[Users] Deleting duplicate owner document [${d.id}]: ${name}`);
      await deleteDoc(d.ref);
      continue;
    }

    // 3. Delete any other unlinked user documents
    if (email !== 'amaas9499@gmail.com' && email !== 'amaas9494@gmail.com' && email !== 'bank@domexit.ru') {
      console.log(`[Users] Deleting unrecognized mock user document [${d.id}]: ${email}`);
      await deleteDoc(d.ref);
      continue;
    }
  }

  // Canonical Owner document: usr-owner-001
  console.log('[Users] Setting canonical Owner record for amaas9499@gmail.com (Ahmed Abdallah)...');
  await setDoc(doc(db, 'users', 'usr-owner-001'), {
    id: 'usr-owner-001',
    clientCode: 'DEX-104662',
    name: 'Ahmed Abdallah',
    email: 'amaas9499@gmail.com',
    role: 'owner',
    currentRole: 'owner',
    activeRole: 'owner',
    roles: ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'],
    phone: '+7 (812) 900-00-01',
    telegram: '@domexit_owner',
    isInvestorApproved: true,
    isPartnerApproved: true,
    registeredAt: '2025-01-01T00:00:00Z',
    partnerRefCode: 'PARTNER-MASTER-OWNER',
    favorites: []
  }, { merge: true });

  // Canonical Employee document: usr-staff-002
  console.log('[Users] Setting canonical Employee record for amaas9494@gmail.com (Алексей Смирнов)...');
  await setDoc(doc(db, 'users', 'usr-staff-002'), {
    id: 'usr-staff-002',
    clientCode: 'DEX-000002',
    name: 'Алексей Смирнов',
    email: 'amaas9494@gmail.com',
    role: 'employee',
    currentRole: 'employee',
    activeRole: 'employee',
    roles: ['employee'],
    phone: '+7 (921) 888-11-22',
    telegram: '@domexit_smirnov',
    assignedEmployeeId: 'emp-1',
    isInvestorApproved: false,
    isPartnerApproved: false,
    registeredAt: '2025-02-01T00:00:00Z',
    favorites: []
  }, { merge: true });

  // Canonical Bank Officer document: nuKBWAun7CSvqSKuh8suTZyofJq1
  console.log('[Users] Setting canonical Bank Officer record for bank@domexit.ru (Игорь Владимирович Соколов)...');
  await setDoc(doc(db, 'users', 'nuKBWAun7CSvqSKuh8suTZyofJq1'), {
    id: 'nuKBWAun7CSvqSKuh8suTZyofJq1',
    clientCode: 'DEX-000004',
    name: 'Игорь Владимирович Соколов (Сбербанк)',
    email: 'bank@domexit.ru',
    role: 'bank',
    currentRole: 'bank',
    activeRole: 'bank',
    roles: ['bank'],
    phone: '+7 (812) 500-11-00',
    telegram: '@bank_sber_escrow',
    isInvestorApproved: false,
    isPartnerApproved: false,
    registeredAt: '2025-02-15T00:00:00Z',
    partnerRefCode: 'PARTNER-777',
    favorites: []
  }, { merge: true });
}

async function sanitizeDevelopers() {
  console.log('\n--- SANITIZING DEVELOPERS COLLECTION ---');
  const snap = await getDocs(collection(db, 'developers'));
  console.log(`[Developers] Purging ${snap.size} legacy/dummy developer records...`);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }

  // Canonical Accredited Russian Developers (ПИК, Setl Group, ЛСР, Эталон, ФСК, Самолёт)
  const accreditedDevelopers = [
    {
      id: 'dev-pik',
      name: 'ПИК',
      legalName: 'ПАО «ПИК СЗ»',
      inn: '7701360732',
      rating: 'A++',
      reliabilityScore: 98,
      city: 'msk',
      headquarters: 'Москва',
      foundedYear: 1994,
      escrowBank: 'Сбербанк',
      status: 'active',
      isFederalAccredited: true,
      description: 'Крупнейший девелопер России. 100% проектов аккредитованы в банках по эскроу-счетам 214-ФЗ.',
      logoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'dev-setl',
      name: 'Setl Group',
      legalName: 'ООО «Сэтл Групп»',
      inn: '7810245481',
      rating: 'A++',
      reliabilityScore: 99,
      city: 'spb',
      headquarters: 'Санкт-Петербург',
      foundedYear: 1994,
      escrowBank: 'Сбербанк',
      status: 'active',
      isFederalAccredited: true,
      description: 'Лидер девелоперского рынка Санкт-Петербурга и Северо-Западного региона с безупречной историей сдачи.',
      logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'dev-lsr',
      name: 'ЛСР',
      legalName: 'ПАО «Группа ЛСР»',
      inn: '7838360491',
      rating: 'A++',
      reliabilityScore: 97,
      city: 'spb',
      headquarters: 'Санкт-Петербург',
      foundedYear: 1993,
      escrowBank: 'ВТБ',
      status: 'active',
      isFederalAccredited: true,
      description: 'Один из старейших девелоперов РФ, системообразующее строительное предприятие федерального значения.',
      logoUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'dev-etalon',
      name: 'Эталон',
      legalName: 'ПАО «Группа Эталон»',
      inn: '7814116230',
      rating: 'A+',
      reliabilityScore: 95,
      city: 'spb',
      headquarters: 'Санкт-Петербург / Москва',
      foundedYear: 1987,
      escrowBank: 'Сбербанк',
      status: 'active',
      isFederalAccredited: true,
      description: 'Федеральная девелоперская группа с проектами бизнес- и комфорт-класса в СПб и Москве.',
      logoUrl: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'dev-fsk',
      name: 'ФСК',
      legalName: 'Группа компаний «ФСК»',
      inn: '7705704608',
      rating: 'A+',
      reliabilityScore: 94,
      city: 'msk',
      headquarters: 'Москва',
      foundedYear: 2005,
      escrowBank: 'ВТБ',
      status: 'active',
      isFederalAccredited: true,
      description: 'Крупный многопрофильный девелопер с портфелем объектов в Москве, МО, СПб и Калужской области.',
      logoUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'dev-samolet',
      name: 'Самолёт',
      legalName: 'ПАО «ГК Самолёт»',
      inn: '7731476100',
      rating: 'A+',
      reliabilityScore: 96,
      city: 'msk',
      headquarters: 'Москва',
      foundedYear: 2012,
      escrowBank: 'Сбербанк',
      status: 'active',
      isFederalAccredited: true,
      description: 'Быстрорастущая PropTech-корпорация федерального масштаба с масштабным земельным банком.',
      logoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=160&q=80'
    }
  ];

  for (const dev of accreditedDevelopers) {
    await setDoc(doc(db, 'developers', dev.id), dev);
    console.log(`[Developers] Created accredited developer: ${dev.name} (${dev.legalName})`);
  }
}

async function sanitizeStaff() {
  console.log('\n--- SANITIZING EMPLOYEES & BANK EMPLOYEES ---');
  
  // Clean employees: keep only emp-1
  const empSnap = await getDocs(collection(db, 'employees'));
  for (const d of empSnap.docs) {
    if (d.id !== 'emp-1') {
      console.log(`[Employees] Removing unlinked employee doc [${d.id}]`);
      await deleteDoc(d.ref);
    }
  }

  // Canonical emp-1
  console.log('[Employees] Setting canonical emp-1 for Алексей Смирнов...');
  await setDoc(doc(db, 'employees', 'emp-1'), {
    id: 'emp-1',
    name: 'Алексей Смирнов',
    email: 'amaas9494@gmail.com',
    role: 'Ведущий куратор отдела выходов',
    phone: '+7 (812) 409-32-11',
    telegram: '@domexit_smirnov',
    whatsapp: '+7 (812) 409-32-11',
    bio: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    activeLotsCount: 0,
    closedDealsCount: 0,
    avgSpeedDays: 8.0,
    status: 'active',
    allowedSidebarTabs: ['pipeline', 'packaging', 'legal_audit', 'matchmaker', 'profile'],
    permissions: ['legal_audit', 'packaging', 'matchmaker', 'closing']
  });

  // Clean bank_employees: keep only bank-emp-1
  const bankEmpSnap = await getDocs(collection(db, 'bank_employees'));
  for (const d of bankEmpSnap.docs) {
    if (d.id !== 'bank-emp-1') {
      console.log(`[BankEmployees] Removing unlinked bank employee doc [${d.id}]`);
      await deleteDoc(d.ref);
    }
  }

  // Canonical bank-emp-1
  console.log('[BankEmployees] Setting canonical bank-emp-1 for Игорь Владимирович Соколов...');
  await setDoc(doc(db, 'bank_employees', 'bank-emp-1'), {
    id: 'bank-emp-1',
    name: 'Игорь Владимирович Соколов',
    email: 'bank@domexit.ru',
    phone: '+7 (812) 500-11-00',
    role: 'Кредитный офицер / Руководитель эскроу-направления',
    bankName: 'Сбербанк',
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z'
  });
}

async function verifyMarketSettingsImmutable() {
  console.log('\n--- VERIFYING IMMUTABLE MARKET SETTINGS ---');
  const snap = await getDocs(collection(db, 'market_settings'));
  if (snap.empty) {
    console.log('[MarketSettings] Initializing canonical market settings...');
    await setDoc(doc(db, 'market_settings', 'market_parameters'), {
      id: 'market_parameters',
      cbrKeyRatePercent: 21.0,
      familyMortgageRatePercent: 6.0,
      developerPenaltyPercent: 15.0,
      buyerCommissionPercent: 2.5,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Ahmed Abdallah (Владелец / CEO)'
    });
  } else {
    console.log(`[MarketSettings] Preserved untouched (${snap.size} document).`);
    snap.forEach(d => console.log('   Data:', JSON.stringify(d.data()).slice(0, 120) + '...'));
  }
}

async function runPurge() {
  console.log('================================================================');
  console.log('DOMEXIT PLATFORM DATABASE PURGE & SANITIZATION SCRIPT (152-FZ)');
  console.log('================================================================\n');

  let totalWiped = 0;
  for (const col of COLLECTIONS_TO_WIPE) {
    totalWiped += await wipeCollection(col);
  }

  await sanitizeUsers();
  await sanitizeDevelopers();
  await sanitizeStaff();
  await verifyMarketSettingsImmutable();

  console.log('\n================================================================');
  console.log(`PURGE COMPLETE! Total documents wiped across 12 collections: ${totalWiped}`);
  console.log('All users, staff, and accredited developers sanitized.');
  console.log('Market settings verified immutable.');
  console.log('================================================================\n');
  process.exit(0);
}

runPurge().catch(err => {
  console.error('Fatal purge error:', err);
  process.exit(1);
});
