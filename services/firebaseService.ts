
import { app, db, auth, firebaseConfig } from './firebaseConfig';
import * as realService from './realFirebase';

// Initialize the real Firebase service with our configuration
realService.init(app, db, auth, firebaseConfig.appId);

export const onAuth = realService.onAuth;
export const subscribeToCollection = realService.subscribeToCollection;
export const subscribeToSubCollection = realService.subscribeToSubCollection;
export const subscribeToDocument = realService.subscribeToDocument;
export const addDocument = realService.addDocument;
export const updateDocument = realService.updateDocument;
export const deleteDocument = realService.deleteDocument;
export const startSession = realService.startSession;
export const startGame = realService.startGame;
export const updateScoresTransaction = realService.updateScoresTransaction;
export const undoLastUpdateTransaction = realService.undoLastUpdateTransaction;
export const deleteGameTransaction = realService.deleteGameTransaction;
export const addPlayersToSessionTransaction = realService.addPlayersToSessionTransaction;
export const deleteSession = realService.deleteSession;
export const getAllGameNames = realService.getAllGameNames;
export const getAllGames = realService.getAllGames;
export const exportData = realService.exportData;
export const importData = realService.importData;
