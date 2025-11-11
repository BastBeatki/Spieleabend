
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Player, Category, Session, Game, PointUpdate, View, FullBackup } from './types';
import * as fb from './services/firebaseService';
import { HomeView } from './components/views/HomeView';
import { SessionSetupView } from './components/views/SessionSetupView';
import { DataManagementView } from './components/views/DataManagementView';
import { GlobalStatsView } from './components/views/GlobalStatsView';
import { ScoreboardView } from './components/views/ScoreboardView';
import { LiveGameView } from './components/views/LiveGameView';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

const App: React.FC = () => {
    const [view, setView] = useState<View>('loading');
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [allGameNames, setAllGameNames] = useState<string[]>([]);

    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [activeSessionGames, setActiveSessionGames] = useState<Game[]>([]);
    
    const [activeGame, setActiveGame] = useState<Game | null>(null);
    const [activeGameUpdates, setActiveGameUpdates] = useState<PointUpdate[]>([]);

    const [unsubscribes, setUnsubscribes] = useState<(() => void)[]>([]);

    const clearSubscriptions = useCallback(() => {
        unsubscribes.forEach(unsub => unsub());
        setUnsubscribes([]);
    }, [unsubscribes]);

    useEffect(() => {
        const authUnsubscribe = fb.onAuth(async (user, error) => {
            if (error) {
                // This error won't happen in the new local-only mode.
                console.error("Authentication failed:", error);
            }

            if (user) {
                clearSubscriptions();
                const newUnsubscribes: (() => void)[] = [];
                newUnsubscribes.push(fb.subscribeToCollection<Player>('players', setPlayers, { orderBy: 'name' }));
                newUnsubscribes.push(fb.subscribeToCollection<Category>('categories', setCategories, { orderBy: 'name' }));
                newUnsubscribes.push(fb.subscribeToCollection<Session>('sessions', setSessions, { orderBy: ['createdAt', 'desc'] }));
                
                fb.getAllGameNames().then(setAllGameNames);
                
                setUnsubscribes(newUnsubscribes);
                if(view === 'loading') {
                    setView('home');
                }
            } else {
                 setView('loading');
            }
        });

        return () => {
            authUnsubscribe();
            clearSubscriptions();
        };
    }, []);

    const navigate = (newView: View, data?: any) => {
        clearSubscriptions();
        
        const newUnsubscribes: (() => void)[] = [];
        newUnsubscribes.push(fb.subscribeToCollection<Player>('players', setPlayers, { orderBy: 'name' }));
        newUnsubscribes.push(fb.subscribeToCollection<Category>('categories', setCategories, { orderBy: 'name' }));
        newUnsubscribes.push(fb.subscribeToCollection<Session>('sessions', setSessions, { orderBy: ['createdAt', 'desc'] }));
        
        if (newView === 'scoreboard' && data.sessionId) {
            newUnsubscribes.push(fb.subscribeToDocument<Session>('sessions', data.sessionId, setActiveSession));
            newUnsubscribes.push(fb.subscribeToSubCollection<Game>(`sessions/${data.sessionId}/games`, setActiveSessionGames, { orderBy: ['gameNumber', 'asc'] }));
        } else {
            setActiveSession(null);
            setActiveSessionGames([]);
        }

        if (newView === 'liveGame' && data.sessionId && data.gameId) {
            newUnsubscribes.push(fb.subscribeToDocument<Session>('sessions', data.sessionId, setActiveSession));
            newUnsubscribes.push(fb.subscribeToDocument<Game>(`sessions/${data.sessionId}/games`, data.gameId, setActiveGame));
            newUnsubscribes.push(fb.subscribeToSubCollection<PointUpdate>(`sessions/${data.sessionId}/games/${data.gameId}/pointUpdates`, setActiveGameUpdates, { orderBy: ['createdAt', 'asc'] }));
        } else {
            setActiveGame(null);
            setActiveGameUpdates([]);
        }

        setUnsubscribes(newUnsubscribes);
        setView(newView);
    };

    const sortedActiveSessionGames = useMemo(() => 
        [...activeSessionGames].sort((a, b) => b.gameNumber - a.gameNumber),
        [activeSessionGames]
    );

    const renderView = () => {
        switch (view) {
            case 'home':
                return <HomeView sessions={sessions} navigate={navigate} setView={setView} />;
            case 'sessionSetup':
                return <SessionSetupView players={players} navigate={navigate} />;
            case 'dataManagement':
                return <DataManagementView players={players} categories={categories} navigate={navigate} />;
            case 'globalStats':
                return <GlobalStatsView players={players} categories={categories} sessions={sessions} navigate={navigate} />;
            case 'scoreboard':
                if (!activeSession) return <LoadingSpinner text="Lade Session..." />;
                return <ScoreboardView 
                    session={activeSession} 
                    games={sortedActiveSessionGames} 
                    players={players} 
                    categories={categories}
                    allGameNames={allGameNames}
                    navigate={navigate} 
                    refreshGameNames={() => fb.getAllGameNames().then(setAllGameNames)}
                />;
            case 'liveGame':
                if (!activeGame || !activeSession) return <LoadingSpinner text="Lade Spiel..." />;
                return <LiveGameView
                    session={activeSession}
                    game={activeGame}
                    updates={activeGameUpdates}
                    players={players}
                    navigate={navigate}
                />
            default:
                return <LoadingSpinner text="Scoreboard wird geladen..." />;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col">
            {renderView()}
        </div>
    );
};

export default App;
