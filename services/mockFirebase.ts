import { mockBackupData } from './mockData';
import { Player, Category, Session, Game, PointUpdate, FullBackup, Timestamp as ITimestamp, SessionPlayer } from '../types';
import { idbService } from './indexedDbService';

type ListenerCallback = (data: any) => void;
const listeners = new Map<string, Set<ListenerCallback>>();

// A mock Timestamp class that is compatible with Firebase's Timestamp interface.
class MockTimestamp implements ITimestamp {
    constructor(private date: Date) {}
    static now = () => new MockTimestamp(new Date());
    static fromDate = (date: Date) => new MockTimestamp(date);
    toDate = () => this.date;
    toMillis = () => this.date.getTime();
}

// Helper to convert plain JS objects from IDB back into objects with MockTimestamp instances.
// IndexedDB stores native Date objects, but the app expects the MockTimestamp class instance.
const fromDb = (obj: any): any => {
    if (!obj) return obj;
    // Deep copy to avoid mutating the object in place and convert ISO strings to Date objects
    const newObj = JSON.parse(JSON.stringify(obj));
    const convert = (o: any) => {
        for (const key in o) {
            if (o.hasOwnProperty(key)) {
                // Check if the value is a string that looks like a Date
                if (typeof o[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(o[key])) {
                    o[key] = MockTimestamp.fromDate(new Date(o[key]));
                } else if (o[key] instanceof Date) { // Or if it's already a Date object
                    o[key] = MockTimestamp.fromDate(o[key]);
                } else if (typeof o[key] === 'object' && o[key] !== null) {
                    convert(o[key]);
                }
            }
        }
    };
    convert(newObj);
    return newObj;
};

// Helper to convert objects with MockTimestamp instances to plain JS objects with native Date objects for IDB storage.
const toDb = (obj: any): any => {
    // Deep copy to ensure the original object is not mutated
    const storableObj = JSON.parse(JSON.stringify(obj));
    const convert = (o: any) => {
        for (const key in o) {
            if (o.hasOwnProperty(key)) {
                // The MockTimestamp class is identified by having a `toDate` method.
                if (o[key] && typeof o[key].toDate === 'function') {
                    o[key] = o[key].toDate();
                } else if (typeof o[key] === 'object' && o[key] !== null) {
                    convert(o[key]);
                }
            }
        }
    };
    convert(storableObj);
    return storableObj;
};

const notify = async (path: string) => {
    const cbs = listeners.get(path);
    if (!cbs) return;

    const pathParts = path.split('/');
    if (pathParts.length > 1) {
        const [collectionName, docId, subCollectionName, subDocId] = pathParts;
        if (pathParts[0] === 'sessions' && subCollectionName === 'games' && subDocId && pathParts[4] === 'pointUpdates') {
             const session = await idbService.get<Session & { games: Game[] }>('sessions', docId);
             const game = session?.games.find(g => g.id === subDocId);
             const data = game?.pointUpdates ?? [];
             cbs.forEach(cb => cb(data.map(fromDb)));
        } else if (pathParts[0] === 'sessions' && subCollectionName === 'games') {
             const session = await idbService.get<Session & { games: Game[] }>('sessions', docId);
             const data = session?.games ?? [];
             cbs.forEach(cb => cb(data.map(fromDb)));
        } else {
             const doc = await idbService.get(collectionName, docId);
             cbs.forEach(cb => cb(doc ? fromDb(doc) : null));
        }
    } else {
        const data = await idbService.getAll(path);
        cbs.forEach(cb => cb(data.map(fromDb)));
    }
};

const generateId = () => Math.random().toString(36).substring(2, 15);

const initializeMockData = async () => {
    const players = await idbService.getAll<Player>('players');
    if (players.length === 0) {
        console.log("IndexedDB is empty. Populating with initial mock data.");
        
        const playersToStore = mockBackupData.players.map(p => ({ ...p, id: p._id }));
        const categoriesToStore = mockBackupData.categories.map(c => ({ ...c, id: c._id }));
        const sessionsToStore = mockBackupData.sessions.map(s => {
            const games = s.games.map(g => ({
                ...g,
                id: g._id,
                createdAt: new Date(g.createdAt),
                pointUpdates: (g.pointUpdates || []).map(pu => ({ ...pu, id: pu._id, createdAt: new Date(pu.createdAt) }))
            }));
            return { ...s, id: s._id, createdAt: new Date(s.createdAt), games };
        });

        await idbService.bulkPut('players', playersToStore);
        await idbService.bulkPut('categories', categoriesToStore);
        await idbService.bulkPut('sessions', sessionsToStore);
    }
};

const enrichSessionPlayers = async (session: Session | Omit<Session, 'id'>) => {
    const allPlayers = await idbService.getAll<Player>('players');
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
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

let isInitialized = false;

export const onAuth = (callback: (user: object | null, error?: Error) => void) => {
    (async () => {
        if (!isInitialized) {
            await initializeMockData();
            isInitialized = true;
        }
        callback({ uid: 'mockUser' });
    })();
    return () => {};
};

export function subscribeToCollection<T>(collectionName: string, setData: (data: T[]) => void, options: any = {}) {
    const listener = async () => {
        let data = await idbService.getAll<T>(collectionName);
        if (options.orderBy) {
            const key = Array.isArray(options.orderBy) ? options.orderBy[0] : options.orderBy;
            const dir = Array.isArray(options.orderBy) ? options.orderBy[1] : 'asc';
             data.sort((a: any, b: any) => {
                const valA = a[key] instanceof Date ? a[key].getTime() : a[key];
                const valB = b[key] instanceof Date ? b[key].getTime() : b[key];
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setData(data.map(fromDb));
    };

    if (!listeners.has(collectionName)) listeners.set(collectionName, new Set());
    listeners.get(collectionName)!.add(listener);
    listener();
    return () => listeners.get(collectionName)?.delete(listener);
}

export function subscribeToSubCollection<T>(path: string, setData: (data: T[]) => void, options: any = {}) {
    const listener = async () => {
        const pathParts = path.split('/');
        let collectionData: any[] = [];
        if (pathParts[0] === 'sessions' && pathParts[2] === 'games') {
             const session = await idbService.get<Session & {games: Game[]}>(pathParts[0], pathParts[1]);
             collectionData = session?.games ?? [];
        } else if (pathParts[0] === 'sessions' && pathParts[2] === 'games' && pathParts[4] === 'pointUpdates') {
            const session = await idbService.get<Session & {games: Game[]}>(pathParts[0], pathParts[1]);
            const game = session?.games.find(g => g.id === pathParts[3]);
            collectionData = game?.pointUpdates ?? [];
        }

        if (options.orderBy) {
            const [key, dir] = options.orderBy;
            collectionData.sort((a: any, b: any) => {
                const valA = a[key] instanceof Date ? a[key].getTime() : a[key];
                const valB = b[key] instanceof Date ? b[key].getTime() : b[key];
                if (valA < valB) return dir === 'asc' ? -1 : 1;
                if (valA > valB) return dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setData(collectionData.map(fromDb));
    };
    
    if (!listeners.has(path)) listeners.set(path, new Set());
    listeners.get(path)!.add(listener);
    listener();
    return () => listeners.get(path)?.delete(listener);
}

export function subscribeToDocument<T>(collectionPath: string, docId: string, setData: (data: T | null) => void) {
    const pathParts = collectionPath.split('/');
    const listener = async () => {
        let docData: any | null = null;
        if (pathParts.length === 1) {
            docData = await idbService.get(collectionPath, docId);
        } else if (pathParts.length === 3 && pathParts[0] === 'sessions' && pathParts[2] === 'games') {
             const session = await idbService.get<Session & {games: Game[]}>(pathParts[0], pathParts[1]);
             docData = session?.games.find(g => g.id === docId) || null;
        }
        setData(docData ? fromDb(docData) : null);
    };

    const notificationPath = collectionPath;
    if (!listeners.has(notificationPath)) listeners.set(notificationPath, new Set());
    listeners.get(notificationPath)!.add(listener);
    listener();
    return () => listeners.get(notificationPath)?.delete(listener);
}

export const addDocument = async (collectionName: string, data: any) => {
    const newDoc = { ...data, id: generateId() };
    await idbService.put(collectionName, toDb(newDoc));
    await notify(collectionName);
    return { id: newDoc.id };
};

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
    const doc = await idbService.get<any>(collectionName, docId);
    if (doc) {
        const updatedDoc = { ...doc, ...data };
        await idbService.put(collectionName, toDb(updatedDoc));
        
        if (collectionName === 'players') {
            const sessions = await idbService.getAll<Session>('sessions');
            for(const session of sessions) {
                await enrichSessionPlayers(session);
                await idbService.put('sessions', toDb(session));
            }
            await notify('sessions');
            sessions.forEach(s => notify(`sessions/${s.id}`));
        } else {
            await notify(collectionName);
             if (collectionName === 'sessions') {
                await notify(`sessions/${docId}`);
            }
        }
    }
};

export const deleteDocument = async (collectionName: string, docId: string) => {
    await idbService.remove(collectionName, docId);
    await notify(collectionName);
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
    await idbService.put('sessions', toDb(newSession));
    await notify('sessions');
    return { id: newSession.id };
};

export const startGame = async (sessionId: string, gameData: any) => {
    const session = await idbService.get<Session & { games: Game[] }>('sessions', sessionId);
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
    await idbService.put('sessions', toDb(session));
    await notify('sessions');
    await notify(`sessions/${sessionId}`);
    await notify(`sessions/${sessionId}/games`);
    return { id: newGame.id };
};

export const updateScoresTransaction = async (sessionId: string, gameId: string, scoresToAdd: { [p: string]: number }) => {
    const session = await idbService.get<Session & { games: Game[] }>('sessions', sessionId);
    const game = session?.games.find(g => g.id === gameId);
    if (!session || !game) throw new Error("Not found");

    for (const [pId, score] of Object.entries(scoresToAdd)) {
        session.totalScores[pId] = (session.totalScores[pId] || 0) + score;
        game.gameScores[pId] = (game.gameScores[pId] || 0) + score;
    }
    if (!game.pointUpdates) game.pointUpdates = [];
    game.pointUpdates.push({ id: generateId(), scores: scoresToAdd, createdAt: MockTimestamp.now() as any });

    await idbService.put('sessions', toDb(session));
    await notify('sessions');
    await notify(`sessions/${sessionId}`);
    await notify(`sessions/${sessionId}/games`);
    await notify(`sessions/${sessionId}/games/${gameId}`);
    await notify(`sessions/${sessionId}/games/${gameId}/pointUpdates`);
};

export const undoLastUpdateTransaction = async (sessionId: string, gameId: string) => {
    const session = fromDb(await idbService.get<Session & { games: Game[] }>('sessions', sessionId));
    const game = session?.games.find(g => g.id === gameId);
    if (!session || !game || !game.pointUpdates || game.pointUpdates.length === 0) throw new Error("Cannot undo");
    
    const lastUpdate = game.pointUpdates.pop();
    if (lastUpdate && lastUpdate.scores) {
        for (const [pId, score] of Object.entries(lastUpdate.scores)) {
            session.totalScores[pId] -= (score as number || 0);
            game.gameScores[pId] -= (score as number || 0);
        }
    }
    
    await idbService.put('sessions', toDb(session));
    await notify('sessions');
    await notify(`sessions/${sessionId}`);
    await notify(`sessions/${sessionId}/games`);
    await notify(`sessions/${sessionId}/games/${gameId}`);
    await notify(`sessions/${sessionId}/games/${gameId}/pointUpdates`);
};

export const deleteGameTransaction = async (sessionId: string, gameId: string) => {
    const session = fromDb(await idbService.get<Session & { games: Game[] }>('sessions', sessionId));
    const gameIndex = session?.games.findIndex(g => g.id === gameId);
    if (!session || gameIndex === undefined || gameIndex < 0) throw new Error("Not found");
    
    const game = session.games[gameIndex];
    for(const [pId, score] of Object.entries(game.gameScores)) {
        // FIX: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
        session.totalScores[pId] -= (score as number || 0);
    }
    session.games.splice(gameIndex, 1);
    
    await idbService.put('sessions', toDb(session));
    await notify('sessions');
    await notify(`sessions/${sessionId}`);
    await notify(`sessions/${sessionId}/games`);
};

export const addPlayersToSessionTransaction = async (sessionId: string, newPlayers: Player[]) => {
    const session = fromDb(await idbService.get<Session & { games: Game[] }>('sessions', sessionId));
    if (!session) throw new Error("Not found");
    
    newPlayers.forEach(p => {
        session.players.push(p);
        session.totalScores[p.id] = 0;
        session.games.forEach(g => {
            g.gameScores[p.id] = 0;
        });
    });
    
    await idbService.put('sessions', toDb(session));
    await notify('sessions');
    await notify(`sessions/${sessionId}`);
    await notify(`sessions/${sessionId}/games`);
};

export const deleteSession = async (sessionId: string) => {
    await idbService.remove('sessions', sessionId);
    await notify('sessions');
};

export const getAllGameNames = async (): Promise<string[]> => {
    const sessions = await idbService.getAll<Session & { games: Game[] }>('sessions');
    const allNames = new Set<string>();
    sessions.forEach(s => s.games.forEach(g => allNames.add(g.name)));
    return Array.from(allNames).sort();
};

export const getAllGames = async (): Promise<(Game & {sessionId: string, sessionName: string})[]> => {
    const sessions = await idbService.getAll<Session & { games: Game[] }>('sessions');
    const allGames: (Game & {sessionId: string, sessionName: string})[] = [];
    sessions.forEach(s => {
        s.games.forEach(g => {
            allGames.push({
                ...g,
                sessionId: s.id,
                sessionName: s.name,
            });
        });
    });
    // FIX: Corrected invalid type conversion from Timestamp to Date. The runtime type is Date, but the defined type is Timestamp. Casting via 'unknown' resolves this.
    return allGames.sort((a,b) => (a.createdAt as unknown as Date).getTime() - (b.createdAt as unknown as Date).getTime());
};

export const exportData = async (): Promise<FullBackup> => {
    const players = await idbService.getAll<Player>('players');
    const categories = await idbService.getAll<Category>('categories');
    const sessions = await idbService.getAll<Session & { games: Game[] }>('sessions');

    const backup: FullBackup = {
        players: players.map(p => ({ ...p, _id: p.id })),
        categories: categories.map(c => ({ ...c, _id: c.id })),
        sessions: sessions.map(s => ({
            ...s,
            _id: s.id,
            // FIX: Corrected invalid type conversion from Timestamp to Date. The runtime type is Date, but the defined type is Timestamp. Casting via 'unknown' resolves this.
            createdAt: (s.createdAt as unknown as Date).toISOString(),
            games: s.games.map(g => ({
                ...g,
                _id: g.id,
                // FIX: Corrected invalid type conversion from Timestamp to Date. The runtime type is Date, but the defined type is Timestamp. Casting via 'unknown' resolves this.
                createdAt: (g.createdAt as unknown as Date).toISOString(),
                pointUpdates: (g.pointUpdates || []).map((pu: PointUpdate) => ({
                    ...pu,
                    _id: pu.id,
                    createdAt: (pu.createdAt as any).toDate().toISOString(),
                }))
            }))
        })) as any,
    };
    return JSON.parse(JSON.stringify(backup));
};

export const importData = async (data: FullBackup) => {
    await idbService.clear('players');
    await idbService.clear('categories');
    await idbService.clear('sessions');

    const playersToStore = data.players.map(p => ({ ...p, id: p._id }));
    const categoriesToStore = data.categories.map(c => ({ ...c, id: c._id }));
    const sessionsToStore = data.sessions.map(s => {
        const games = (s.games || []).map(g => ({
            ...g,
            id: g._id,
            createdAt: new Date(g.createdAt),
            pointUpdates: (g.pointUpdates || []).map(pu => ({ ...pu, id: pu._id, createdAt: new Date(pu.createdAt) }))
        }));
        return { ...s, id: s._id, createdAt: new Date(s.createdAt), games };
    });

    await idbService.bulkPut('players', playersToStore);
    await idbService.bulkPut('categories', categoriesToStore);
    await idbService.bulkPut('sessions', sessionsToStore);
    
    await notify('players');
    await notify('categories');
    await notify('sessions');
};
