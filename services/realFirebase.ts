
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    onSnapshot, 
    query, 
    orderBy, 
    updateDoc, 
    deleteDoc, 
    writeBatch, 
    Timestamp, 
    setDoc, 
    runTransaction, 
    getDoc, 
    limit,
    QueryConstraint,
    Firestore
} from 'firebase/firestore';
import { Player, Game, FullBackup } from '../types';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let appId: string;
let userId: string | null = null;

export const init = (firebaseApp: FirebaseApp, firestore: Firestore, firebaseAuth: Auth, firebaseAppId: string) => {
    app = firebaseApp;
    db = firestore;
    auth = firebaseAuth;
    appId = firebaseAppId;
}

export const onAuth = (callback: (user: User | null, error?: Error) => void) => {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            callback(user);
        } else {
            signInAnonymously(auth).catch(error => {
                console.error("Anonymous sign-in failed:", error);
                callback(null, error);
            });
        }
    });
};

const getBasePath = () => `artifacts/${appId}/users/${userId}`;

// Generic Collection Functions
export function subscribeToCollection<T>(collectionName: string, setData: (data: T[]) => void, options: { orderBy?: string | [string, "asc" | "desc"] } = {}) {
    if (!userId) return () => {};
    const constraints: QueryConstraint[] = [];
    if(options.orderBy) {
        if(Array.isArray(options.orderBy)){
            constraints.push(orderBy(options.orderBy[0], options.orderBy[1]));
        } else {
            constraints.push(orderBy(options.orderBy));
        }
    }
    const q = query(collection(db, `${getBasePath()}/${collectionName}`), ...constraints);
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
        setData(data);
    });
}

export function subscribeToSubCollection<T>(path: string, setData: (data: T[]) => void, options: { orderBy?: [string, "asc" | "desc"] } = {}) {
    if (!userId) return () => {};
    const constraints: QueryConstraint[] = [];
    if(options.orderBy) {
       constraints.push(orderBy(options.orderBy[0], options.orderBy[1]));
    }
    const fullPath = `${getBasePath()}/${path}`;
    const q = query(collection(db, fullPath), ...constraints);

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
        setData(data);
    });
}

export function subscribeToDocument<T>(collectionPath: string, docId: string, setData: (data: T | null) => void) {
    if (!userId) return () => {};
    const pathSegments = collectionPath.split('/');
    pathSegments.push(docId);
    const fullPath = `${getBasePath()}/${pathSegments.join('/')}`;
    
    const docRef = doc(db, fullPath);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            setData({ id: doc.id, ...doc.data() } as T);
        } else {
            setData(null);
        }
    });
}

export const addDocument = async (collectionName: string, data: object) => {
    if (!userId) throw new Error("User not authenticated");
    return addDoc(collection(db, `${getBasePath()}/${collectionName}`), data);
};

export const updateDocument = async (collectionName: string, docId: string, data: object) => {
    if (!userId) throw new Error("User not authenticated");
    const docRef = doc(db, `${getBasePath()}/${collectionName}/${docId}`);
    return updateDoc(docRef, data);
};

export const deleteDocument = async (collectionName: string, docId: string) => {
    if (!userId) throw new Error("User not authenticated");
    const docRef = doc(db, `${getBasePath()}/${collectionName}/${docId}`);
    return deleteDoc(docRef);
};

// Specific Logic
export const startSession = async (sessionName: string, selectedPlayers: Player[]) => {
    const totalScores = selectedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
    const sessionPlayers = selectedPlayers.map(({ id, name, color }) => ({ id, name, color }));
    
    return addDocument('sessions', {
        name: sessionName,
        players: sessionPlayers,
        totalScores,
        createdAt: Timestamp.now()
    });
};

export const startGame = async (sessionId: string, gameData: Omit<Game, 'id' | 'createdAt' | 'gameNumber'>) => {
    if (!userId) throw new Error("User not authenticated");
    const gamesCollectionRef = collection(db, `${getBasePath()}/sessions/${sessionId}/games`);
    const gamesSnapshot = await getDocs(gamesCollectionRef);
    const gameNumber = gamesSnapshot.size + 1;

    return addDoc(gamesCollectionRef, {
        ...gameData,
        gameNumber,
        createdAt: Timestamp.now()
    });
};

export const updateScoresTransaction = async (sessionId: string, gameId: string, scoresToAdd: { [playerId: string]: number }) => {
    if (!userId) throw new Error("User not authenticated");
    const sessionRef = doc(db, `${getBasePath()}/sessions/${sessionId}`);
    const gameRef = doc(db, `${getBasePath()}/sessions/${sessionId}/games/${gameId}`);
    
    return runTransaction(db, async (transaction) => {
        const [sessionDoc, gameDoc] = await Promise.all([transaction.get(sessionRef), transaction.get(gameRef)]);
        if (!sessionDoc.exists() || !gameDoc.exists()) throw "Session or game not found";

        const newSessionScores = { ...sessionDoc.data().totalScores };
        const newGameScores = { ...gameDoc.data().gameScores };

        for (const [playerId, score] of Object.entries(scoresToAdd)) {
            newSessionScores[playerId] = (newSessionScores[playerId] || 0) + score;
            newGameScores[playerId] = (newGameScores[playerId] || 0) + score;
        }

        transaction.update(sessionRef, { totalScores: newSessionScores });
        transaction.update(gameRef, { gameScores: newGameScores });

        const updateRef = doc(collection(gameRef, 'pointUpdates'));
        transaction.set(updateRef, { scores: scoresToAdd, createdAt: Timestamp.now() });
    });
};

export const undoLastUpdateTransaction = async (sessionId: string, gameId: string) => {
    if (!userId) throw new Error("User not authenticated");
    const sessionRef = doc(db, `${getBasePath()}/sessions/${sessionId}`);
    const gameRef = doc(db, `${getBasePath()}/sessions/${sessionId}/games/${gameId}`);
    const updatesQuery = query(collection(gameRef, 'pointUpdates'), orderBy("createdAt", "desc"), limit(1));
    
    const updatesSnapshot = await getDocs(updatesQuery);
    if (updatesSnapshot.empty) throw new Error("No updates to undo.");

    const lastUpdateDoc = updatesSnapshot.docs[0];
    const scoresToUndo = lastUpdateDoc.data().scores;

    return runTransaction(db, async (transaction) => {
        const [sessionDoc, gameDoc] = await Promise.all([transaction.get(sessionRef), transaction.get(gameRef)]);
        if (!sessionDoc.exists() || !gameDoc.exists()) throw "Session or game not found.";
        
        const newTotalScores = { ...sessionDoc.data().totalScores };
        const newGameScores = { ...gameDoc.data().gameScores };

        if (scoresToUndo) {
            for (const [playerId, score] of Object.entries(scoresToUndo)) {
                newTotalScores[playerId] = (newTotalScores[playerId] || 0) - (score as number || 0);
                newGameScores[playerId] = (newGameScores[playerId] || 0) - (score as number || 0);
            }
        }

        transaction.update(sessionRef, { totalScores: newTotalScores });
        transaction.update(gameRef, { gameScores: newGameScores });
        transaction.delete(lastUpdateDoc.ref);
    });
};

export const deleteGameTransaction = async (sessionId: string, gameId: string) => {
     if (!userId) throw new Error("User not authenticated");
    const sessionRef = doc(db, `${getBasePath()}/sessions/${sessionId}`);
    const gameRef = doc(db, `${getBasePath()}/sessions/${sessionId}/games/${gameId}`);
    
    return runTransaction(db, async (transaction) => {
        const [sessionDoc, gameDoc] = await Promise.all([transaction.get(sessionRef), transaction.get(gameRef)]);
        if (!sessionDoc.exists() || !gameDoc.exists()) throw "Session or game not found.";
        
        const gameScores = gameDoc.data().gameScores;
        const newTotalScores = { ...sessionDoc.data().totalScores };
        for (const [playerId, score] of Object.entries(gameScores)) {
            newTotalScores[playerId] = (newTotalScores[playerId] || 0) - (score as number || 0);
        }
        
        transaction.update(sessionRef, { totalScores: newTotalScores });

        const updatesSnapshot = await getDocs(collection(gameRef, 'pointUpdates'));
        updatesSnapshot.forEach(updateDoc => transaction.delete(updateDoc.ref));
        
        transaction.delete(gameRef);
    });
};

export const addPlayersToSessionTransaction = async (sessionId: string, newPlayers: Player[]) => {
    if (!userId) throw new Error("User not authenticated");
    const sessionRef = doc(db, `${getBasePath()}/sessions/${sessionId}`);

    return runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw "Session not found";

        const sessionData = sessionDoc.data();
        const updatedPlayers = [...sessionData.players, ...newPlayers.map(({ id, name, color }) => ({ id, name, color }))];
        const updatedTotalScores = { ...sessionData.totalScores };
        newPlayers.forEach(p => updatedTotalScores[p.id] = 0);
        
        transaction.update(sessionRef, { players: updatedPlayers, totalScores: updatedTotalScores });
        
        const gamesSnapshot = await getDocs(collection(sessionRef, 'games'));
        gamesSnapshot.forEach(gameDoc => {
             const updatedGameScores = {...gameDoc.data().gameScores};
             newPlayers.forEach(p => updatedGameScores[p.id] = 0);
             transaction.update(gameDoc.ref, { gameScores: updatedGameScores });
        });
    });
};

export const deleteSession = async (sessionId: string) => {
    if (!userId) throw new Error("User not authenticated");
    const sessionRef = doc(db, `${getBasePath()}/sessions/${sessionId}`);
    const gamesSnapshot = await getDocs(collection(sessionRef, 'games'));
    
    for (const gameDoc of gamesSnapshot.docs) {
        const updatesSnapshot = await getDocs(collection(gameDoc.ref, 'pointUpdates'));
        if (!updatesSnapshot.empty) {
            const batch = writeBatch(db);
            updatesSnapshot.forEach(updDoc => batch.delete(updDoc.ref));
            await batch.commit();
        }
        await deleteDoc(gameDoc.ref);
    }
    
    await deleteDoc(sessionRef);
};


export const getAllGameNames = async (): Promise<string[]> => {
    if (!userId) return [];
    const allNames = new Set<string>();
    const sessionsSnapshot = await getDocs(collection(db, `${getBasePath()}/sessions`));
    for (const sessionDoc of sessionsSnapshot.docs) {
        const gamesSnapshot = await getDocs(collection(sessionDoc.ref, 'games'));
        gamesSnapshot.forEach(gameDoc => {
            allNames.add(gameDoc.data().name);
        });
    }
    return Array.from(allNames).sort();
};

export const getAllGames = async (): Promise<(Game & {sessionId: string, sessionName: string})[]> => {
    if (!userId) return [];
    const games: (Game & {sessionId: string, sessionName: string})[] = [];
    const sessionsSnapshot = await getDocs(collection(db, `${getBasePath()}/sessions`));
    for (const sessionDoc of sessionsSnapshot.docs) {
        const session = sessionDoc.data();
        const gamesSnapshot = await getDocs(collection(sessionDoc.ref, 'games'));
        gamesSnapshot.forEach(gameDoc => {
            games.push({ 
                id: gameDoc.id, 
                ...gameDoc.data(), 
                sessionId: sessionDoc.id, 
                sessionName: session.name 
            } as any);
        });
    }
    return games.sort((a,b) => (a.createdAt as Timestamp).toMillis() - (b.createdAt as Timestamp).toMillis());
};

export const exportData = async (): Promise<FullBackup> => {
    if (!userId) throw new Error("User not authenticated");
    
    const playersSnapshot = await getDocs(collection(db, `${getBasePath()}/players`));
    const categoriesSnapshot = await getDocs(collection(db, `${getBasePath()}/categories`));
    const sessionsSnapshot = await getDocs(collection(db, `${getBasePath()}/sessions`));
    
    const data: FullBackup = {
        players: playersSnapshot.docs.map(d => ({...d.data(), _id: d.id})) as any,
        categories: categoriesSnapshot.docs.map(d => ({...d.data(), _id: d.id})) as any,
        sessions: []
    };

    for (const sessionDoc of sessionsSnapshot.docs) {
        const sessionData = {...sessionDoc.data(), _id: sessionDoc.id};
        sessionData.createdAt = (sessionData.createdAt as Timestamp).toDate().toISOString();

        const gamesSnapshot = await getDocs(collection(db, sessionDoc.ref.path, 'games'));
        const games = [];
        for(const gameDoc of gamesSnapshot.docs) {
            const gameData = {...gameDoc.data(), _id: gameDoc.id};
            gameData.createdAt = (gameData.createdAt as Timestamp).toDate().toISOString();

            const updatesSnapshot = await getDocs(collection(db, gameDoc.ref.path, 'pointUpdates'));
            gameData.pointUpdates = updatesSnapshot.docs.map(updateDoc => {
                const updateData = {...updateDoc.data(), _id: updateDoc.id};
                updateData.createdAt = (updateData.createdAt as Timestamp).toDate().toISOString();
                return updateData;
            });
            games.push(gameData);
        }
        sessionData.games = games;
        data.sessions.push(sessionData as any);
    }
    return data;
};

export const importData = async (data: FullBackup) => {
    if (!userId) throw new Error("User not authenticated");

    // 1. Delete all existing data
    const collectionsToDelete = ['players', 'categories', 'sessions'];
    for (const collName of collectionsToDelete) {
        const snapshot = await getDocs(collection(db, `${getBasePath()}/${collName}`));
        for (const docToDelete of snapshot.docs) {
            if (collName === 'sessions') {
                await deleteSession(docToDelete.id); // Handles subcollections
            } else {
                await deleteDoc(docToDelete.ref);
            }
        }
    }

    // 2. Import new data
    const batch = writeBatch(db);
    data.players.forEach(p => {
        const docRef = doc(db, `${getBasePath()}/players`, p._id);
        const { _id, ...playerData } = p;
        batch.set(docRef, playerData);
    });
    data.categories.forEach(c => {
        const docRef = doc(db, `${getBasePath()}/categories`, c._id);
        const { _id, ...catData } = c;
        batch.set(docRef, catData);
    });
    await batch.commit();

    for (const session of data.sessions) {
        const { _id, games, ...sessionData } = session;
        const sessionRef = doc(db, `${getBasePath()}/sessions`, _id);
        await setDoc(sessionRef, {
            ...sessionData,
            createdAt: Timestamp.fromDate(new Date(sessionData.createdAt))
        });

        if (games) {
            for(const game of games) {
                const {_id: gameId, pointUpdates, ...gameData} = game;
                const gameRef = doc(collection(sessionRef, 'games'), gameId);
                await setDoc(gameRef, {
                    ...gameData,
                    createdAt: Timestamp.fromDate(new Date(gameData.createdAt))
                });

                if (pointUpdates) {
                    const updatesBatch = writeBatch(db);
                    pointUpdates.forEach(update => {
                         const {_id: updateId, ...updateData} = update;
                         const updateRef = doc(collection(gameRef, 'pointUpdates'), updateId);
                         updatesBatch.set(updateRef, {
                             ...updateData,
                             createdAt: Timestamp.fromDate(new Date(updateData.createdAt))
                         });
                    });
                    await updatesBatch.commit();
                }
            }
        }
    }
};
