'use client';

/**
 * Firebase client — the browser side of the real-time layer.
 * The backend (Admin SDK) writes; the dashboard/inbox subscribe here via
 * onSnapshot listeners. Config is public by design.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = !!firebaseConfig.projectId;

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

export function getDb(): Firestore | null {
  if (!firebaseEnabled) return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!dbInstance) dbInstance = getFirestore(app);
  return dbInstance;
}
