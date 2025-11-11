// import { Timestamp } from 'firebase/firestore'; // Decoupled for mocking

export interface Timestamp {
    toDate: () => Date;
    toMillis: () => number;
}

export interface Player {
    id: string;
    name: string;
    color: string;
    avatar?: string;
}

export interface SessionPlayer {
    id: string;
    name: string;
    color: string;
    avatar?: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface Session {
    id: string;
    name: string;
    createdAt: Timestamp;
    players: SessionPlayer[];
    totalScores: { [playerId: string]: number };
    coverImage?: string;
}

export interface Game {
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    gameNumber: number;
    createdAt: Timestamp;
    gameScores: { [playerId:string]: number };
    pointUpdates?: PointUpdate[];
}

export interface PointUpdate {
    id: string;
    scores: { [playerId: string]: number };
    createdAt: Timestamp;
}

export type View = 'loading' | 'home' | 'sessionSetup' | 'scoreboard' | 'liveGame' | 'dataManagement' | 'globalStats';

// For Import/Export
interface BaseDoc {
    _id: string;
}

interface PlayerDoc extends BaseDoc {
    name: string;
    color: string;
    avatar?: string;
}

interface CategoryDoc extends BaseDoc {
    name: string;
}

interface PointUpdateDoc extends BaseDoc {
    scores: { [playerId: string]: number };
    createdAt: string; // ISO String
}

interface GameDoc extends BaseDoc {
    name: string;
    categoryId: string;
    categoryName: string;
    gameNumber: number;
    createdAt: string; // ISO String
    gameScores: { [playerId:string]: number };
    pointUpdates: PointUpdateDoc[];
}

interface SessionDoc extends BaseDoc {
    name: string;
    createdAt: string; // ISO String
    players: SessionPlayer[];
    totalScores: { [playerId: string]: number };
    games: GameDoc[];
    coverImage?: string;
}

export interface FullBackup {
    players: PlayerDoc[];
    categories: CategoryDoc[];
    sessions: SessionDoc[];
}