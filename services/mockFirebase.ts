
import { Player, Category, Session, Game, PointUpdate, FullBackup, Timestamp as ITimestamp, SessionPlayer } from '../types';
import * as dbService from './indexedDbService';

// In-memory state acts as a cache, loaded from IndexedDB on startup.
let dbState: {
    players: Player[];
    categories: Category[];
    sessions: (Omit<Session, 'id'> & { id: string; games: Game[] })[];
} = {
    players: [],
    categories: [],
    sessions: [],
};

type ListenerCallback = (data: any) => void;
const listeners = new Map<string, Set<ListenerCallback>>();

// Mock Timestamp that is compatible with Firebase's Timestamp
class MockTimestamp implements ITimestamp {
    constructor(private date: Date) {}
    static now = () => new MockTimestamp(new Date());
    static fromDate = (date: Date) => new MockTimestamp(date);
    toDate = () => this.date;
    toMillis = () => this.date.getTime();
}

// Recursive function to convert Date objects back to MockTimestamp instances after reading from DB
const deserializeTimestamps = (obj: any): any => {
    if (obj instanceof Date) {
        return MockTimestamp.fromDate(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(deserializeTimestamps);
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, deserializeTimestamps(value)])
        );
    }
    return obj;
};

// Recursive function to convert MockTimestamp instances to Date objects for IndexedDB storage
const serializeTimestamps = (obj: any): any => {
    if (obj instanceof MockTimestamp) {
        return obj.toDate();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeTimestamps);
    }
    if (typeof obj === 'object' && obj !== null) {
         return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, serializeTimestamps(value)])
        );
    }
    return obj;
};

const enrichSessionPlayers = (session: Session | Omit<Session, 'id'>, playerSource: Player[]) => {
    const playerMap = new Map(playerSource.map(p => [p.id, p]));
    session.players.forEach(sp => {
        const globalPlayer = playerMap.get(sp.id);
        if (globalPlayer) {
            sp.name = globalPlayer.name;
            sp.color = globalPlayer.color;
            sp.avatar = globalPlayer.avatar;
            sp.localAvatar = globalPlayer.localAvatar;
        }
    });
};

const loadDataFromDb = async () => {
    const players = await dbService.getAll<Player>('players');
    const categories = await dbService.getAll<Category>('categories');
    const sessions = await dbService.getAll<any>('sessions');

    dbState.players = players;
    dbState.categories = categories;
    // Convert Dates back to MockTimestamps after loading from DB
    dbState.sessions = deserializeTimestamps(sessions);
};

const notify = (path: string) => {
    const cbs = listeners.get(path);
    if (!cbs) return;

    const pathParts = path.split('/');
    const pathLength = pathParts.length;

    switch (pathLength) {
        // Root collection: 'players'
        case 1: {
            const [collectionName] = pathParts;
            const data = (dbState as any)[collectionName] || [];
            cbs.forEach(cb => cb(data));
            break;
        }
        // Document in root collection: 'sessions/sid'
        case 2: {
            const [collectionName, docId] = pathParts;
            const collection = (dbState as any)[collectionName];
            const doc = collection?.find((d: any) => d.id === docId);
            cbs.forEach(cb => cb(doc || null));
            break;
        }
        // Subcollection: 'sessions/sid/games'
        case 3: {
            const [collectionName, docId, subCollectionName] = pathParts;
            if (collectionName === 'sessions' && subCollectionName === 'games') {
                const session = dbState.sessions.find(s => s.id === docId);
                const data = session?.games ?? [];
                cbs.forEach(cb => cb(data));
            }
            break;
        }
        // Document in subcollection: 'sessions/sid/games/gid'
        case 4: {
            const [collectionName, docId, subCollectionName, subDocId] = pathParts;
            if (collectionName === 'sessions' && subCollectionName === 'games') {
                const session = dbState.sessions.find(s => s.id === docId);
                const game = session?.games.find(g => g.id === subDocId);
                cbs.forEach(cb => cb(game || null));
            }
            break;
        }
        // Sub-sub-collection: 'sessions/sid/games/gid/pointUpdates'
        case 5: {
            const [collectionName, docId, subCollectionName, subDocId, subSubCollectionName] = pathParts;
            if (collectionName === 'sessions' && subCollectionName === 'games' && subSubCollectionName === 'pointUpdates') {
                const session = dbState.sessions.find(s => s.id === docId);
                const game = session?.games.find(g => g.id === subDocId);
                const data = game?.pointUpdates ?? [];
                cbs.forEach(cb => cb(data));
            }
            break;
        }
    }
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// --- MOCK SERVICE IMPLEMENTATION ---
let isInitialized = false;

export const onAuth = (callback: (user: object | null, error?: Error) => void) => {
    const init = async () => {
        if (!isInitialized) {
            try {
                // FIX: Removed call to dbService.openDB() as it's not exported and is called implicitly by dbService methods.
                await loadDataFromDb();
                isInitialized = true;
            } catch (e) {
                console.error("Failed to initialize local database:", e);
                callback(null, e as Error);
                return;
            }
        }
        callback({ uid: 'mockUser' });
    }
    setTimeout(init, 100);
    return () => {};
};

export function subscribeToCollection<T>(collectionName: string, setData: (data: T[]) => void, options: any = {}) {
    if (!listeners.has(collectionName)) listeners.set(collectionName, new Set());
    
    const listener = (data: T[]) => {
        let processedData = [...data];
        if (options.orderBy) {
            const key = Array.isArray(options.orderBy) ? options.orderBy[0] : options.orderBy;
            const dir = Array.isArray(options.orderBy) ? options.orderBy[1] : 'asc';
             processedData.sort((a: any, b: any) => {
                const valA = a[key] instanceof MockTimestamp ? a[key].toMillis() : a[key];
                const valB = b[key] instanceof MockTimestamp ? b[key].toMillis() : b[key];
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setData(processedData);
    };
    
    listeners.get(collectionName)!.add(listener);
    listener((dbState as any)[collectionName] || []);
    return () => listeners.get(collectionName)?.delete(listener);
}

export function subscribeToSubCollection<T>(path: string, setData: (data: T[]) => void, options: any = {}) {
     const pathParts = path.split('/');
     
    if (!listeners.has(path)) listeners.set(path, new Set());
    
    const listener = (data: T[]) => {
        const processedData = [...data];
         if (options.orderBy) {
            const [key, dir] = options.orderBy;
            processedData.sort((a: any, b: any) => {
                const valA = a[key] instanceof MockTimestamp ? a[key].toMillis() : a[key];
                const valB = b[key] instanceof MockTimestamp ? b[key].toMillis() : b[key];
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setData(processedData);
    };

    listeners.get(path)!.add(listener);

    let collectionData: any[] = [];
    if (pathParts.length === 3 && pathParts[0] === 'sessions' && pathParts[2] === 'games') {
        const [, sessionId] = pathParts;
        const parentDoc = dbState.sessions.find(d => d.id === sessionId);
        collectionData = parentDoc ? parentDoc.games || [] : [];
    } else if (pathParts.length === 5 && pathParts[0] === 'sessions' && pathParts[2] === 'games' && pathParts[4] === 'pointUpdates') {
        const [, sessionId, , gameId] = pathParts;
        const session = dbState.sessions.find(s => s.id === sessionId);
        const game = session?.games.find(g => g.id === gameId);
        collectionData = game ? game.pointUpdates || [] : [];
    }
    
    listener(collectionData);
    return () => listeners.get(path)?.delete(listener);
}

export function subscribeToDocument<T>(collectionPath: string, docId: string, setData: (data: T | null) => void) {
    const pathParts = collectionPath.split('/');
    const fullPath = `${collectionPath}/${docId}`;
    
    const listener = (docData: T | null) => {
        setData(docData ? { ...docData } as T : null);
    };

    if (!listeners.has(fullPath)) listeners.set(fullPath, new Set());
    listeners.get(fullPath)!.add(listener);
    
    let docData: any | null = null;
    if (pathParts.length === 1) {
        docData = (dbState as any)[pathParts[0]]?.find((d: any) => d.id === docId) || null;
    } else if (pathParts.length === 3) {
         const [parentCollection, parentId, subCollection] = pathParts;
         if (parentCollection === 'sessions' && subCollection === 'games') {
             const parentDoc = dbState.sessions.find(d => d.id === parentId);
             docData = parentDoc?.games?.find((d: any) => d.id === docId) as T || null;
        }
    }
    listener(docData);
    
    return () => listeners.get(fullPath)?.delete(listener);
}

export const addDocument = async (collectionName: string, data: any) => {
    const newDoc = { ...data, id: generateId(), createdAt: MockTimestamp.now() };
    (dbState as any)[collectionName].push(newDoc);
    await dbService.put(collectionName, serializeTimestamps(newDoc));
    notify(collectionName);
    return { id: newDoc.id };
};

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
    const collection = (dbState as any)[collectionName];
    const docIndex = collection.findIndex((d: any) => d.id === docId);
    if (docIndex > -1) {
        const updatedDoc = { ...collection[docIndex], ...data };
        collection[docIndex] = updatedDoc;
        await dbService.put(collectionName, serializeTimestamps(updatedDoc));
        
        notify(collectionName);
        notify(`${collectionName}/${docId}`);

        if (collectionName === 'players') {
            dbState.sessions.forEach(s => enrichSessionPlayers(s, dbState.players));
            await dbService.putAll('sessions', serializeTimestamps(dbState.sessions));
            notify('sessions');
            dbState.sessions.forEach(s => notify(`sessions/${s.id}`));
        }
    }
};

export const deleteDocument = async (collectionName: string, docId: string) => {
    const collection = (dbState as any)[collectionName];
    const docIndex = collection.findIndex((d: any) => d.id === docId);
    if (docIndex > -1) {
        collection.splice(docIndex, 1);
        await dbService.deleteItem(collectionName, docId);
        notify(collectionName);
    }
};

export const startSession = async (sessionName: string, selectedPlayers: Player[], coverImage?: string) => {
    const totalScores = selectedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
    const sessionPlayers: SessionPlayer[] = selectedPlayers.map(({ id, name, color, avatar, localAvatar }) => ({ id, name, color, avatar, localAvatar }));
    
    const newSession = {
        id: generateId(),
        name: sessionName,
        players: sessionPlayers,
        totalScores,
        createdAt: MockTimestamp.now(),
        games: [],
        coverImage,
    };
    dbState.sessions.push(newSession);
    await dbService.put('sessions', serializeTimestamps(newSession));
    notify('sessions');
    return { id: newSession.id };
};

export const startGame = async (sessionId: string, gameData: any) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Session not found");
    const gameNumber = session.games.length + 1;
    const newGame: Game = {
        ...gameData,
        id: generateId(),
        gameNumber,
        createdAt: MockTimestamp.now(),
        pointUpdates: []
    };
    session.games.push(newGame);
    await dbService.put('sessions', serializeTimestamps(session));
    notify(`sessions`);
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
    return { id: newGame.id };
};

export const updateScoresTransaction = async (sessionId: string, gameId: string, scoresToAdd: { [p: string]: number }) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    const game = session?.games.find(g => g.id === gameId);
    if (!session || !game) throw new Error("Not found");

    for (const [pId, score] of Object.entries(scoresToAdd)) {
        session.totalScores[pId] = (session.totalScores[pId] || 0) + Number(score);
        game.gameScores[pId] = (game.gameScores[pId] || 0) + Number(score);
    }
    if (!game.pointUpdates) game.pointUpdates = [];
    game.pointUpdates.push({ id: generateId(), scores: scoresToAdd, createdAt: MockTimestamp.now() });
    
    await dbService.put('sessions', serializeTimestamps(session));
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
    notify(`sessions/${sessionId}/games/${gameId}`);
    notify(`sessions/${sessionId}/games/${gameId}/pointUpdates`);
};

export const undoLastUpdateTransaction = async (sessionId: string, gameId: string) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    const game = session?.games.find(g => g.id === gameId);
    if (!session || !game || !game.pointUpdates || game.pointUpdates.length === 0) throw new Error("Cannot undo");
    
    const lastUpdate = game.pointUpdates.pop();
    if (lastUpdate && lastUpdate.scores) {
        for (const [pId, score] of Object.entries(lastUpdate.scores)) {
            session.totalScores[pId] -= (Number(score) || 0);
            game.gameScores[pId] -= (Number(score) || 0);
        }
    }
    
    await dbService.put('sessions', serializeTimestamps(session));
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
    notify(`sessions/${sessionId}/games/${gameId}`);
    notify(`sessions/${sessionId}/games/${gameId}/pointUpdates`);
};

export const deleteGameTransaction = async (sessionId: string, gameId: string) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    const gameIndex = session?.games.findIndex(g => g.id === gameId);
    if (!session || gameIndex === undefined || gameIndex < 0) throw new Error("Not found");
    
    const game = session.games[gameIndex];
    for(const [pId, score] of Object.entries(game.gameScores)) {
        session.totalScores[pId] -= (Number(score) || 0);
    }
    session.games.splice(gameIndex, 1);
    
    await dbService.put('sessions', serializeTimestamps(session));
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
};

export const addPlayersToSessionTransaction = async (sessionId: string, newPlayers: Player[]) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Not found");
    
    newPlayers.forEach(p => {
        if (!session.players.some(sp => sp.id === p.id)) {
            session.players.push(p);
            session.totalScores[p.id] = 0;
            session.games.forEach(g => {
                g.gameScores[p.id] = 0;
            });
        }
    });
    
    await dbService.put('sessions', serializeTimestamps(session));
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
};


export const deleteSession = async (sessionId: string) => {
    const sessionIndex = dbState.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex > -1) {
        dbState.sessions.splice(sessionIndex, 1);
        await dbService.deleteItem('sessions', sessionId);
        notify('sessions');
    }
};

export const getAllGameNames = async (): Promise<string[]> => {
    const allNames = new Set<string>();
    dbState.sessions.forEach(s => s.games.forEach(g => allNames.add(g.name)));
    return Array.from(allNames).sort();
};

export const getAllGames = async (): Promise<(Game & {sessionId: string, sessionName: string})[]> => {
    const allGames: (Game & {sessionId: string, sessionName: string})[] = [];
    dbState.sessions.forEach(s => {
        s.games.forEach(g => {
            allGames.push({
                ...g,
                sessionId: s.id,
                sessionName: s.name,
            });
        });
    });
    return allGames.sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis());
};

export const exportData = async (): Promise<FullBackup> => {
    const backup: FullBackup = {
        players: dbState.players.map(p => ({
            _id: p.id,
            name: p.name,
            color: p.color,
            avatar: p.avatar,
            localAvatar: p.localAvatar
        })),
        categories: dbState.categories.map(c => ({
            _id: c.id,
            name: c.name
        })),
        sessions: dbState.sessions.map(s => ({
            _id: s.id,
            name: s.name,
            createdAt: s.createdAt.toDate().toISOString(),
            players: s.players.map(({ id, name, color, avatar, localAvatar }) => ({ id, name, color, avatar, localAvatar })),
            totalScores: s.totalScores,
            coverImage: s.coverImage,
            localCoverImage: s.localCoverImage,
            games: s.games.map(g => ({
                _id: g.id,
                name: g.name,
                categoryId: g.categoryId,
                categoryName: g.categoryName,
                gameNumber: g.gameNumber,
                createdAt: g.createdAt.toDate().toISOString(),
                gameScores: g.gameScores,
                pointUpdates: (g.pointUpdates || []).map((pu: PointUpdate) => ({
                    _id: pu.id,
                    scores: pu.scores,
                    createdAt: pu.createdAt.toDate().toISOString(),
                }))
            }))
        }))
    };
    return JSON.parse(JSON.stringify(backup));
};

export const importData = async (data: FullBackup) => {
    // 1. Clear everything
    await dbService.clear('players');
    await dbService.clear('categories');
    await dbService.clear('sessions');

    // 2. Load and transform data for in-memory state
    const newPlayers = data.players.map(p => ({ ...p, id: p._id }));
    const newCategories = data.categories.map(c => ({ ...c, id: c._id }));
    const newSessions = data.sessions.map(s => {
        const games = (s.games || []).map(g => ({
            ...g,
            id: g._id,
            createdAt: MockTimestamp.fromDate(new Date(g.createdAt)),
            pointUpdates: (g.pointUpdates || []).map(pu => ({
                ...pu,
                id: pu._id,
                createdAt: MockTimestamp.fromDate(new Date(pu.createdAt))
            }))
        }));
         const sessionWithGames = {
            ...s,
            id: s._id,
            createdAt: MockTimestamp.fromDate(new Date(s.createdAt)),
            games,
        };
        enrichSessionPlayers(sessionWithGames, newPlayers);
        return sessionWithGames;
    });

    dbState.players = newPlayers;
    dbState.categories = newCategories;
    dbState.sessions = newSessions;

    // 3. Persist the new state to IndexedDB (with Dates instead of MockTimestamps)
    await dbService.putAll('players', serializeTimestamps(dbState.players));
    await dbService.putAll('categories', serializeTimestamps(dbState.categories));
    await dbService.putAll('sessions', serializeTimestamps(dbState.sessions));

    // 4. Notify all listeners to refresh views
    notify('players');
    notify('categories');
    notify('sessions');
    dbState.sessions.forEach(s => {
        notify(`sessions/${s.id}`);
        notify(`sessions/${s.id}/games`);
    });
};
