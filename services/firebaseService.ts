
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import * as realService from './realFirebase';
import * as mockService from './mockFirebase';

declare global {
    var __firebase_config: string | undefined;
    var __app_id: string | undefined;
}

let isFirebaseAvailable = false;

try {
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR_API_KEY')) {
        throw new Error("Firebase configuration not provided or invalid.");
    }
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'scoreboard-dev';

    realService.init(app, db, auth, appId);
    isFirebaseAvailable = true;
    console.log("Firebase initialized successfully. Running in online mode.");

} catch (e: any) {
    console.warn("Firebase initialization failed, falling back to mock mode.", e.message);
    isFirebaseAvailable = false;
}

const service = isFirebaseAvailable ? realService : mockService;

export const isMockMode = !isFirebaseAvailable;

export const onAuth = service.onAuth;
export const subscribeToCollection = service.subscribeToCollection;
export const subscribeToSubCollection = service.subscribeToSubCollection;
export const subscribeToDocument = service.subscribeToDocument;
export const addDocument = service.addDocument;
export const updateDocument = service.updateDocument;
export const deleteDocument = service.deleteDocument;
export const startSession = service.startSession;
export const startGame = service.startGame;
export const updateScoresTransaction = service.updateScoresTransaction;
export const undoLastUpdateTransaction = service.undoLastUpdateTransaction;
export const deleteGameTransaction = service.deleteGameTransaction;
export const addPlayersToSessionTransaction = service.addPlayersToSessionTransaction;
export const deleteSession = service.deleteSession;
export const getAllGameNames = service.getAllGameNames;
export const getAllGames = service.getAllGames;
export const exportData = service.exportData;
export const importData = service.importData;