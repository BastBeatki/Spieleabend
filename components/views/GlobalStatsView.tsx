import React, { useMemo, useState, useEffect } from 'react';
import { Player, Category, Session, View, Game } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area } from 'recharts';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ChartModeToggle, CustomChartTooltip } from '../ui/ChartModeToggle';
import { PlayerAvatar } from '../ui/Icons';

declare const Recharts: any;

interface GlobalStatsViewProps {
  players: Player[];
  categories: Category[];
  sessions: Session[];
  navigate: (view: View) => void;
}

const getRankBadge = (rank: number) => {
    switch(rank) {
        case 1: return 'from-green-400 to-emerald-600';
        case 2: return 'from-blue-400 to-cyan-600';
        case 3: return 'from-purple-400 to-indigo-600';
        default: return 'from-slate-600 to-slate-700';
    }
}

const getRankText = (rank: number) => {
     switch(rank) {
        case 1: return 'text-slate-900 font-bold';
        default: return 'text-white';
    }
}


export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ players, categories, sessions, navigate }) => {
    const [allGames, setAllGames] = useState<(Game & { sessionName: string })[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [chartMode, setChartMode] = useState<'perSession' | 'cumulative'>('perSession');

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
            const dataPoint: any = { name: session.name };
            if (chartMode === 'cumulative') {
                 players.forEach(p => {
                    cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (session.totalScores[p.id] || 0);
                    dataPoint[p.name] = cumulativeScores[p.id];
                });
            } else { // 'perSession'
                players.forEach(p => {
                    dataPoint[p.name] = session.totalScores[p.id] || 0;
                });
            }
            data.push(dataPoint);
        });
        return data;
    }, [sortedSessions, players, chartMode]);

    const categoryStats = useMemo(() => {
        if (!selectedCategoryId || !allGames) return null;

        const filteredGames = allGames.filter(g => g.categoryId === selectedCategoryId);
        const sortedFilteredGames = [...filteredGames].sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis());
        
        const leaderboardScores: { [pid: string]: number } = {};
        filteredGames.forEach(g => {
            Object.entries(g.gameScores).forEach(([pid, score]) => {
                leaderboardScores[pid] = (leaderboardScores[pid] || 0) + (score as number);
            });
        });
        const leaderboard = players
            .map(p => ({...p, score: leaderboardScores[p.id] || 0}))
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);

        const timelineData: any[] = [{ name: 'Start', ...players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        sortedFilteredGames.forEach(game => {
            const dataPoint: any = { name: `${game.name} (${game.sessionName})` };
            if (chartMode === 'cumulative') {
                 players.forEach(p => {
                    cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (game.gameScores[p.id] || 0);
                    dataPoint[p.name] = cumulativeScores[p.id];
                });
            } else { // 'perGame'
                players.forEach(p => {
                    dataPoint[p.name] = game.gameScores[p.id] || 0;
                });
            }
            // FIX: Use the correct variable name 'timelineData' instead of 'data'.
            timelineData.push(dataPoint);
        });

        return { leaderboard, timelineData };

    }, [allGames, selectedCategoryId, players, chartMode]);

    if (isLoading) return <LoadingSpinner text="Lade Statistiken..." />;

    return (
        <>
            <Header title="Karriere-Statistiken" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            
            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <h3 className="text-xl font-semibold mb-4">Gesamt-Leaderboard</h3>
                <div className="space-y-3">{globalLeaderboard.map((p, i) => (
                     <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg shadow-md">
                        <div className="w-10 text-center font-bold"><span className={`w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br ${getRankBadge(i+1)} ${getRankText(i+1)}`}>{i+1}</span></div>
                        <div className="flex-grow flex items-center gap-3 ml-3">
                           <PlayerAvatar avatar={p.avatar} size={40} />
                           <span className="font-bold text-lg text-slate-100">{p.name}</span>
                        </div>
                        <div className="text-2xl font-black text-white">{p.score} <span className="text-sm font-normal text-slate-400">Punkte</span></div>
                    </div>
                ))}</div>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                 <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h3 className="text-xl font-semibold">Punkteverlauf (Gesamt)</h3>
                    <ChartModeToggle
                        currentMode={chartMode}
                        onChange={(mode) => setChartMode(mode as 'perSession' | 'cumulative')}
                        options={[
                            { value: 'perSession', label: 'Pro Session' },
                            { value: 'cumulative', label: 'Kumulativ' },
                        ]}
                    />
                </div>
                <div className="relative h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                             <defs>
                                {players.map(p => (
                                    <linearGradient key={`color-${p.id}`} id={`color-${p.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={p.color} stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor={p.color} stopOpacity={0}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
                            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12, angle: -20, textAnchor: 'end', height: 60 }} />
                            <YAxis stroke="#64748b" />
                            <Tooltip content={<CustomChartTooltip />} />
                            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                            {players.map(p => (
                                <React.Fragment key={p.id}>
                                    <Area type="monotone" dataKey={p.name} stroke="transparent" fill={`url(#color-${p.id.replace(/[^a-zA-Z0-9]/g, '')})`} />
                                    <Line type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} dot={{r: 2, fill: p.color, strokeWidth: 0}} activeDot={{r: 6, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 4}} />
                                </React.Fragment>
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <h3 className="text-xl font-semibold mb-4">Statistiken nach Kategorie</h3>
                <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 mb-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Wähle eine Kategorie...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCategoryId && categoryStats && (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                             <h4 className="font-semibold mb-2">Leaderboard: {categories.find(c=>c.id === selectedCategoryId)?.name}</h4>
                              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">{categoryStats.leaderboard.map((p, i) => (
                                <div key={p.id} className="flex items-center justify-between bg-slate-800/80 p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <PlayerAvatar avatar={p.avatar} size={32} />
                                        <span className="font-bold text-slate-100">{p.name}</span>
                                    </div>
                                    <span className="text-xl font-black">{p.score}</span>
                                </div>
                            ))}</div>
                        </div>
                        <div>
                             <h4 className="font-semibold mb-2">Punkteverlauf: {categories.find(c=>c.id === selectedCategoryId)?.name}</h4>
                            <div className="relative h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={categoryStats.timelineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <defs>
                                            {players.map(p => (
                                                <linearGradient key={`color-${p.id}-cat`} id={`color-${p.id.replace(/[^a-zA-Z0-9]/g, '')}-cat`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={p.color} stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor={p.color} stopOpacity={0}/>
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
                                        <XAxis dataKey="name" stroke="#64748b" tick={false} />
                                        <YAxis stroke="#64748b" />
                                        <Tooltip content={<CustomChartTooltip />} />
                                        <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                                        {players.map(p => (
                                            <React.Fragment key={p.id}>
                                                <Area type="monotone" dataKey={p.name} stroke="transparent" fill={`url(#color-${p.id.replace(/[^a-zA-Z0-9]/g, '')}-cat)`} />
                                                <Line type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} dot={{r: 2, fill: p.color, strokeWidth: 0}} activeDot={{r: 6}} />
                                            </React.Fragment>
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                     </div>
                )}
            </div>
        </>
    );
}