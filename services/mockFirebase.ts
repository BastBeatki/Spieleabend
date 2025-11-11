import { mockBackupData } from './mockData';
import { Player, Category, Session, Game, PointUpdate, FullBackup, Timestamp as ITimestamp, SessionPlayer } from '../types';

// In-memory state
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

const enrichSessionPlayers = (session: Session | Omit<Session, 'id'>) => {
    const playerMap = new Map(dbState.players.map(p => [p.id, p]));
    session.players.forEach(sp => {
        const globalPlayer = playerMap.get(sp.id);
        if (globalPlayer) {
            sp.name = globalPlayer.name;
            sp.color = globalPlayer.color;
            sp.avatar = globalPlayer.avatar;
        }
    });
};


const initializeMockData = () => {
    // 1. Load players and categories first.
    dbState.players = mockBackupData.players.map(p => ({ ...p, id: p._id }));
    dbState.categories = mockBackupData.categories.map(c => ({ ...c, id: c._id }));

    // 2. Load sessions and enrich player data within them.
    dbState.sessions = mockBackupData.sessions.map(s => {
        const games = s.games.map(g => ({
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
        
        enrichSessionPlayers(sessionWithGames);

        return sessionWithGames;
    });
};


const notify = (path: string) => {
    const cbs = listeners.get(path);
    if (!cbs) return;

    const pathParts = path.split('/');
    if (pathParts.length > 1) { // subcollection or document
        const [collectionName, docId, subCollectionName, _subDocId, subSubCollectionName] = pathParts;
        
        if (subSubCollectionName) { // sub-sub-collection e.g. sessions/sid/games/gid/pointUpdates
            const parentSession = dbState.sessions.find(s => s.id === docId);
            const parentGame = parentSession?.games.find(g => g.id === _subDocId);
            const data = parentGame?.pointUpdates ?? [];
            cbs.forEach(cb => cb(data));
        } else if (subCollectionName) { // subcollection
            const parentDoc = (dbState as any)[collectionName]?.find((d: any) => d.id === docId);
            const data = parentDoc ? parentDoc.games : [];
            cbs.forEach(cb => cb(data));
        } else { // document
             const parentDoc = (dbState as any)[collectionName]?.find((d: any) => d.id === docId);
             cbs.forEach(cb => cb(parentDoc || null));
        }
    } else { // root collection
        const data = (dbState as any)[path] || [];
        cbs.forEach(cb => cb(data));
    }
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// --- MOCK SERVICE IMPLEMENTATION ---

export const onAuth = (callback: (user: object | null, error?: Error) => void) => {
    setTimeout(() => callback({ uid: 'mockUser' }), 100);
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
        // Create a new array to avoid mutating dbState and to ensure React detects changes.
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
    
    const listener = () => {
        let docData: any | null = null;
        if (pathParts.length === 1) { // Root collection document
            docData = (dbState as any)[pathParts[0]]?.find((d: any) => d.id === docId) || null;
        } else if (pathParts.length === 3) { // Subcollection document
            const [parentCollection, parentId, subCollection] = pathParts;
             if (parentCollection === 'sessions' && subCollection === 'games') {
                 const parentDoc = dbState.sessions.find(d => d.id === parentId);
                 docData = parentDoc?.games?.find((d: any) => d.id === docId) as T || null;
            }
        }
        // Return a shallow copy to ensure React detects changes.
        setData(docData ? { ...docData } as T : null);
    };

    const notificationPath = collectionPath;
    if (!listeners.has(notificationPath)) listeners.set(notificationPath, new Set());
    listeners.get(notificationPath)!.add(listener);

    listener(); // Initial call
    
    return () => listeners.get(notificationPath)?.delete(listener);
}

export const addDocument = async (collectionName: string, data: any) => {
    const newDoc = { ...data, id: generateId() };
    (dbState as any)[collectionName].push(newDoc);
    notify(collectionName);
    return { id: newDoc.id };
};

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
    const collection = (dbState as any)[collectionName];
    const docIndex = collection.findIndex((d: any) => d.id === docId);
    if (docIndex > -1) {
        collection[docIndex] = { ...collection[docIndex], ...data };
        
        // If a player is updated, we need to enrich all sessions again.
        if (collectionName === 'players') {
            dbState.sessions.forEach(enrichSessionPlayers);
            notify('sessions');
            dbState.sessions.forEach(s => notify(`sessions/${s.id}`));
        } else {
            notify(collectionName);
             if (collectionName === 'sessions') {
                notify(`sessions/${docId}`);
            }
        }
    }
};

export const deleteDocument = async (collectionName: string, docId: string) => {
    const collection = (dbState as any)[collectionName];
    const docIndex = collection.findIndex((d: any) => d.id === docId);
    if (docIndex > -1) {
        collection.splice(docIndex, 1);
        notify(collectionName);
    }
};

export const startSession = async (sessionName: string, selectedPlayers: Player[], coverImage?: string) => {
    const totalScores = selectedPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
    const sessionPlayers: SessionPlayer[] = selectedPlayers.map(({ id, name, color, avatar }) => ({ id, name, color, avatar }));
    
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
        session.totalScores[pId] = (session.totalScores[pId] || 0) + score;
        game.gameScores[pId] = (game.gameScores[pId] || 0) + score;
    }
    if (!game.pointUpdates) game.pointUpdates = [];
    game.pointUpdates.push({ id: generateId(), scores: scoresToAdd, createdAt: MockTimestamp.now() });

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
            session.totalScores[pId] -= (score as number || 0);
            game.gameScores[pId] -= (score as number || 0);
        }
    }
    
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
        session.totalScores[pId] -= (score || 0);
    }
    session.games.splice(gameIndex, 1);
    
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
};

export const addPlayersToSessionTransaction = async (sessionId: string, newPlayers: Player[]) => {
    const session = dbState.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Not found");
    
    newPlayers.forEach(p => {
        session.players.push(p);
        session.totalScores[p.id] = 0;
        session.games.forEach(g => {
            g.gameScores[p.id] = 0;
        });
    });
    
    notify('sessions');
    notify(`sessions/${sessionId}`);
    notify(`sessions/${sessionId}/games`);
};


export const deleteSession = async (sessionId: string) => {
    const sessionIndex = dbState.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex > -1) {
        dbState.sessions.splice(sessionIndex, 1);
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
            avatar: p.avatar
        })),
        categories: dbState.categories.map(c => ({
            _id: c.id,
            name: c.name
        })),
        sessions: dbState.sessions.map(s => ({
            _id: s.id,
            name: s.name,
            createdAt: s.createdAt.toDate().toISOString(),
            players: s.players,
            totalScores: s.totalScores,
            coverImage: s.coverImage,
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
    dbState.players = data.players.map(p => ({ ...p, id: p._id }));
    dbState.categories = data.categories.map(c => ({ ...c, id: c._id }));
    dbState.sessions = data.sessions.map(s => {
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
        enrichSessionPlayers(sessionWithGames);
        return sessionWithGames;
    });

    // Notify all top-level listeners to refresh views
    notify('players');
    notify('categories');
    notify('sessions');
    // Also notify individual sessions in case a view is open
    dbState.sessions.forEach(s => notify(`sessions/${s.id}`));
};


// Initialize mock data on load
initializeMockData();