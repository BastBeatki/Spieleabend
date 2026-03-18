import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (!apiKey || apiKey === "undefined" || apiKey === "") {
  console.error("CRITICAL: VITE_FIREBASE_API_KEY is missing. Please add it to your AI Studio Secrets.");
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: "spieleabend-scoreboard.firebaseapp.com",
  projectId: "spieleabend-scoreboard",
  storageBucket: "spieleabend-scoreboard.firebasestorage.app",
  messagingSenderId: "712352309922",
  appId: "1:712352309922:web:754407457ce5e0dd1f2dfb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, firebaseConfig };
