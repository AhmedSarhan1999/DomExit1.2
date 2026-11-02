const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc } = require('firebase/firestore');

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

async function inspectUsers() {
  const snap = await getDocs(collection(db, 'users'));
  console.log('Total users:', snap.size);
  snap.forEach(d => {
    console.log(d.id, JSON.stringify(d.data()));
  });
  process.exit(0);
}

inspectUsers();
