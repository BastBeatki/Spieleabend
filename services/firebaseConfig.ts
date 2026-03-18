import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
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