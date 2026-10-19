import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';

/**
 * Live Firebase Configuration for DomExit Platform (Project: vet-teck-faa9b)
 */
const firebaseConfig = {
  apiKey: "AIzaSyBKhlYZoEH5YUk2v8SmqWqUh5PDaa3qqJY",
  authDomain: "vet-teck-faa9b.firebaseapp.com",
  databaseURL: "https://vet-teck-faa9b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vet-teck-faa9b",
  storageBucket: "vet-teck-faa9b.firebasestorage.app",
  messagingSenderId: "857641831751",
  appId: "1:857641831751:web:43684fcb31a261c7db5062",
  measurementId: "G-XT2XCZ1NKD"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.warn('[Firebase] Live Initialization fallback:', error);
  app = {} as FirebaseApp;
  db = {} as Firestore;
  auth = {} as Auth;
}

export { app, db, auth, googleProvider };
