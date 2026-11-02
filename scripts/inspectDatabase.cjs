const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

const TARGET_COLLECTIONS = [
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
  'user_consents',
  'developers',
  'employees',
  'bank_employees',
  'market_settings',
  'users'
];

async function inspectAll() {
  console.log('=== INSPECTING LIVE FIRESTORE COLLECTIONS ===');
  for (const colName of TARGET_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Collection "${colName}": ${snap.size} documents`);
      if (snap.size > 0 && snap.size <= 5) {
        snap.forEach(d => console.log(`   - [${d.id}]:`, JSON.stringify(d.data()).slice(0, 100) + '...'));
      } else if (snap.size > 5) {
        console.log(`   - Total count: ${snap.size}, Sample IDs:`, snap.docs.slice(0, 5).map(d => d.id).join(', '));
      }
    } catch (e) {
      console.error(`Collection "${colName}" error:`, e.message);
    }
  }
}

inspectAll();
