import React, { useMemo, useState, useEffect } from 'react';
import { Player, Category, Session, View, Game } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LoadingSpinner } from '../ui/LoadingSpinner';

declare const Recharts: any;

interface GlobalStatsViewProps {
  players: Player[];
  categories: Category[];
  sessions: Session[];
  navigate: (view: View) => void;
}

const getRankBadge = (rank: number) => {
    switch(rank) {
        case 1: return 'bg-green-500 text-slate-900 font-bold';
        case 2: return 'bg-blue-500 text-white';
        case 3: return 'bg-purple-500 text-white';
        default: return 'bg-slate-700 text-slate-300';
    }
}

export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ players, categories, sessions, navigate }) => {
    const [allGames, setAllGames] = useState<(Game & { sessionName: string })[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

     useEffect(() => {
        fb.getAllGames().then(games => {
            setAllGames(games);
            setIsLoading(false);
        });
    }, []);

    const globalLeaderboard = useMemo(() => {
        const scores: { [playerId: string]: number } = {};
        sessions.forEach(s => {
            Object.entries(s.totalScores).forEach(([pid, score]) => {
                // FIX: Operator '+' cannot be applied to types 'number' and 'unknown'.
                scores[pid] = (scores[pid] || 0) + (score as number);
            });
        });
        return players
            .map(p => ({ ...p, score: scores[p.id] || 0 }))
            .sort((a, b) => b.score - a.score);
    }, [sessions, players]);
    
    const sortedSessions = useMemo(() => [...sessions].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()), [sessions]);

    const timelineData = useMemo(() => {
        const data: any[] = [{ name: 'Start', ...players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        
        sortedSessions.forEach(session => {
            players.forEach(p => {
                cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (session.totalScores[p.id] || 0);
            });
            const dataPoint: any = { name: session.name };
            players.forEach(p => {
                dataPoint[p.name] = cumulativeScores[p.id];
            });
            data.push(dataPoint);
        });
        return data;
    }, [sortedSessions, players]);

    const categoryStats = useMemo(() => {
        if (!selectedCategoryId || !allGames) return null;

        const filteredGames = allGames.filter(g => g.categoryId === selectedCategoryId);
        
        const leaderboardScores: { [pid: string]: number } = {};
        filteredGames.forEach(g => {
            Object.entries(g.gameScores).forEach(([pid, score]) => {
                // FIX: Operator '+' cannot be applied to types 'number' and 'unknown'.
                leaderboardScores[pid] = (leaderboardScores[pid] || 0) + (score as number);
            });
        });
        const leaderboard = players
            .map(p => ({...p, score: leaderboardScores[p.id] || 0}))
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);

        const timelineData: any[] = [{ name: 'Start', ...players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        filteredGames.forEach(game => {
             players.forEach(p => {
                cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (game.gameScores[p.id] || 0);
            });
            const dataPoint: any = { name: `${game.name} (${game.sessionName})` };
            players.forEach(p => {
                dataPoint[p.name] = cumulativeScores[p.id];
            });
            timelineData.push(dataPoint);
        });
        
        return { leaderboard, timelineData };
    }, [selectedCategoryId, allGames, players]);


    if (isLoading) {
        return <LoadingSpinner text="Lade Statistiken..." />;
    }

    return (
        <>
            <Header title="Karriere-Statistiken" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            <div className="space-y-8">
                 <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h3 className="text-xl font-semibold mb-4">Ewige Bestenliste</h3>
                    <div className="space-y-3">
                        {globalLeaderboard.map((p, index) => (
                             <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg shadow-md">
                                <div className="w-10 text-center font-bold">
                                   <span className={`w-8 h-8 flex items-center justify-center rounded-full ${getRankBadge(index + 1)}`}>{index + 1}</span>
                                </div>
                                <div className="flex-grow flex items-center gap-3 ml-3">
                                   <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                                   <span className="font-bold text-lg text-slate-100">{p.name}</span>
                                </div>
                                <div className="text-2xl font-black text-white">{p.score} <span className="text-sm font-normal text-slate-400">Punkte</span></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h3 className="text-xl font-semibold mb-4">Punkteverlauf über alle Sessions</h3>
                    <div className="relative h-80 md:h-96 mb-8">
                        {timelineData.length > 1 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155' }} />
                                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                                {players.map(p => (
                                    <Line key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={2} dot={{r: 3}} activeDot={{r: 6}} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <h3 className="text-xl font-semibold mb-2 border-t border-slate-700 pt-6">Statistiken nach Kategorie</h3>
                    <p className="text-slate-400 mb-4">Wähle eine Kategorie, um die Bestenliste und den Punkteverlauf nur für diese Spiele anzuzeigen.</p>
                    <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 mb-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                        <option value="">Kategorie auswählen</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    
                    {selectedCategoryId && categoryStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-lg font-semibold mb-2">Bestenliste</h4>
                            <div className="space-y-2">
                                {categoryStats.leaderboard.length > 0 ? categoryStats.leaderboard.map((p, index) => (
                                    <div key={p.id} className="flex items-center bg-slate-800/50 p-2 rounded-lg">
                                        <div className="w-8 text-center font-bold">
                                           <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm ${getRankBadge(index + 1)}`}>{index + 1}</span>
                                        </div>
                                        <div className="flex-grow flex items-center gap-3 ml-2">
                                           <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
                                           <span className="font-bold text-slate-100">{p.name}</span>
                                        </div>
                                        <div className="text-lg font-black text-white">{p.score}</div>
                                    </div>
                                )) : <p className="text-slate-500">Keine Punkte in dieser Kategorie.</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold mb-2">Punkteverlauf</h4>
                            <div className="relative h-80">
                                 {categoryStats.timelineData.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={categoryStats.timelineData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                                            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155' }} />
                                            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                                            {players.filter(p => categoryStats.leaderboard.some(lp => lp.id === p.id)).map(p => (
                                                <Line key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={2} dot={{r: 2}} activeDot={{r: 5}} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                 ) : <div className="flex items-center justify-center h-full text-slate-500">Nicht genügend Daten für Grafik.</div>}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </>
    );
};
