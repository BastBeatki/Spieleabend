
import * as mockService from './mockFirebase';

// The application now runs exclusively in a local-only (mock) mode
// as per user request. The logic for connecting to a live Firebase backend
// has been removed. All data is handled locally by the mock service.
// The import/export feature should be used for data persistence.

export const onAuth = mockService.onAuth;
export const subscribeToCollection = mockService.subscribeToCollection;
export const subscribeToSubCollection = mockService.subscribeToSubCollection;
export const subscribeToDocument = mockService.subscribeToDocument;
export const addDocument = mockService.addDocument;
export const updateDocument = mockService.updateDocument;
export const deleteDocument = mockService.deleteDocument;
export const startSession = mockService.startSession;
export const startGame = mockService.startGame;
export const updateScoresTransaction = mockService.updateScoresTransaction;
export const undoLastUpdateTransaction = mockService.undoLastUpdateTransaction;
export const deleteGameTransaction = mockService.deleteGameTransaction;
export const addPlayersToSessionTransaction = mockService.addPlayersToSessionTransaction;
export const deleteSession = mockService.deleteSession;
export const getAllGameNames = mockService.getAllGameNames;
export const getAllGames = mockService.getAllGames;
export const exportData = mockService.exportData;
export const importData = mockService.importData;
