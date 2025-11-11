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

const getGameWinnerIds = (gameScores: { [playerId: string]: number }): string[] => {
    const scores = Object.entries(gameScores);
    if (scores.length === 0) return [];

    const maxScore = scores.reduce((max, [, score]) => Math.max(max, Number(score)), -Infinity);

    if (maxScore <= 0) return []; 

    return scores
        .filter(([, score]) => Number(score) === maxScore)
        .map(([playerId]) => playerId);
};

export const GlobalStatsView: React.FC<GlobalStatsViewProps> = ({ players, categories, sessions, navigate }) => {
    const [allGames, setAllGames] = useState<(Game & { sessionName: string })[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [chartMode, setChartMode] = useState<'perSession' | 'cumulative'>('perSession');
    const [categoryChartMode, setCategoryChartMode] = useState<'perGame' | 'cumulative'>('perGame');


     useEffect(() => {
        fb.getAllGames().then(games => {
            setAllGames(games);
            setIsLoading(false);
        });
    }, []);

    const globalLeaderboard = useMemo(() => {
        if (!allGames) return [];

        const gamesBySession = allGames.reduce((acc, game) => {
            if (!acc[game.sessionId]) acc[game.sessionId] = [];
            acc[game.sessionId].push(game);
            return acc;
        }, {} as { [sessionId: string]: Game[] });

        const getSessionWinnerIds = (session: Session, gamesInSession: Game[]): string[] => {
            if (gamesInSession.length === 0) return [];
            
            const gamesWon: { [playerId: string]: number } = {};
            session.players.forEach(p => gamesWon[p.id] = 0);
            gamesInSession.forEach(game => {
                getGameWinnerIds(game.gameScores).forEach(winnerId => {
                    if (gamesWon[winnerId] !== undefined) gamesWon[winnerId]++;
                });
            });

            const maxWins = Math.max(...Object.values(gamesWon));
            
            let potentialWinners = session.players.filter(p => gamesWon[p.id] === maxWins);

            if (potentialWinners.length > 1 || maxWins === 0) {
                 if (maxWins === 0) potentialWinners = [...session.players];
                const maxScoreInTie = Math.max(...potentialWinners.map(p => session.totalScores[p.id] || 0));
                 if (maxScoreInTie <= 0 && maxWins === 0) return [];
                return potentialWinners.filter(p => (session.totalScores[p.id] || 0) === maxScoreInTie).map(p => p.id);
            }
            return potentialWinners.map(p => p.id);
        };
        
        const playerStats: { [playerId: string]: { sessionsWon: number; totalScore: number } } = {};
        players.forEach(p => {
            playerStats[p.id] = { sessionsWon: 0, totalScore: 0 };
        });

        sessions.forEach(s => {
            const gamesInSession = gamesBySession[s.id] || [];
            const winnerIds = getSessionWinnerIds(s, gamesInSession);
            winnerIds.forEach(id => {
                if(playerStats[id]) playerStats[id].sessionsWon++;
            });
            Object.entries(s.totalScores).forEach(([pid, score]) => {
                if (playerStats[pid]) {
                    playerStats[pid].totalScore += Number(score);
                }
            });
        });
        
        return players
            .map(p => ({ ...p, ...playerStats[p.id] }))
            .sort((a, b) => {
                if (b.sessionsWon !== a.sessionsWon) {
                    return b.sessionsWon - a.sessionsWon;
                }
                return b.totalScore - a.totalScore;
            });

    }, [sessions, players, allGames]);

    const { gameWinsLeaderboard, categoryWinsLeaderboard } = useMemo(() => {
        if (!allGames || !players.length) {
            return { gameWinsLeaderboard: [], categoryWinsLeaderboard: [] };
        }

        // --- Calculate Game Wins ---
        const gameWinStats: { [playerId: string]: { gamesWon: number } } = {};
        players.forEach(p => {
            gameWinStats[p.id] = { gamesWon: 0 };
        });

        allGames.forEach(game => {
            const winnerIds = getGameWinnerIds(game.gameScores);
            winnerIds.forEach(winnerId => {
                if (gameWinStats[winnerId]) {
                    gameWinStats[winnerId].gamesWon++;
                }
            });
        });

        const finalGameWinsLeaderboard = players
            .map(p => ({ ...p, ...gameWinStats[p.id] }))
            .sort((a, b) => b.gamesWon - a.gamesWon);

        // --- Calculate Category Wins (Dominance) ---
        const winsByCategory: { [catId: string]: { [pId: string]: number } } = {};

        allGames.forEach(game => {
            if (!winsByCategory[game.categoryId]) {
                winsByCategory[game.categoryId] = {};
            }
            const winnerIds = getGameWinnerIds(game.gameScores);
            winnerIds.forEach(winnerId => {
                if (players.some(p => p.id === winnerId)) {
                     winsByCategory[game.categoryId][winnerId] = (winsByCategory[game.categoryId][winnerId] || 0) + 1;
                }
            });
        });

        const categoryDominance: { [pId: string]: number } = {};
        players.forEach(p => (categoryDominance[p.id] = 0));

        Object.values(winsByCategory).forEach(playerWins => {
            const scores = Object.values(playerWins);
            if (scores.length === 0) return;
            
            const maxWins = Math.max(...scores);
            if (maxWins > 0) {
                Object.entries(playerWins).forEach(([playerId, wins]) => {
                    if (wins === maxWins) {
                        if (categoryDominance[playerId] !== undefined) {
                            categoryDominance[playerId]++;
                        }
                    }
                });
            }
        });

        const finalCategoryWinsLeaderboard = players
            .map(p => ({ ...p, categoriesWon: categoryDominance[p.id] || 0 }))
            .sort((a, b) => b.categoriesWon - a.categoriesWon);

        return {
            gameWinsLeaderboard: finalGameWinsLeaderboard,
            categoryWinsLeaderboard: finalCategoryWinsLeaderboard,
        };
    }, [allGames, players]);
    
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
        
        const playerStats: { [pid: string]: { gamesWon: number; score: number } } = {};
        players.forEach(p => {
            playerStats[p.id] = { gamesWon: 0, score: 0 };
        });

        filteredGames.forEach(g => {
            Object.entries(g.gameScores).forEach(([pid, score]) => {
                if (playerStats[pid]) playerStats[pid].score += Number(score);
            });
            const winnerIds = getGameWinnerIds(g.gameScores);
            winnerIds.forEach(winnerId => {
                 if (playerStats[winnerId]) playerStats[winnerId].gamesWon++;
            });
        });
        
        const leaderboard = players
            .map(p => ({...p, ...playerStats[p.id]}))
            .filter(p => p.gamesWon > 0 || p.score > 0)
            .sort((a, b) => {
                if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                return b.score - a.score;
            });
        
        const sortedFilteredGames = [...filteredGames].sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis());
        const categoryTimelineData: any[] = [{ name: 'Start', ...players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        sortedFilteredGames.forEach(game => {
            const dataPoint: any = { name: `${game.name} (${game.sessionName})` };
            if (categoryChartMode === 'cumulative') {
                 players.forEach(p => {
                    cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (game.gameScores[p.id] || 0);
                    dataPoint[p.name] = cumulativeScores[p.id];
                });
            } else { // 'perGame'
                players.forEach(p => {
                    dataPoint[p.name] = game.gameScores[p.id] || 0;
                });
            }
            categoryTimelineData.push(dataPoint);
        });

        return { leaderboard, timelineData: categoryTimelineData };

    }, [allGames, selectedCategoryId, players, categoryChartMode]);

    if (isLoading) return <LoadingSpinner text="Lade Statistiken..." />;

    return (
        <>
            <Header title="Karriere-Statistiken" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            
            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <h3 className="text-xl font-semibold mb-4">Gesamt-Leaderboard (nach Session-Siegen)</h3>
                <div className="space-y-3">{globalLeaderboard.map((p, i) => (
                     <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg shadow-md">
                        <div className="w-10 text-center font-bold"><span className={`w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br ${getRankBadge(i+1)} ${getRankText(i+1)}`}>{i+1}</span></div>
                        <div className="flex-grow flex items-center gap-4 ml-3">
                           <PlayerAvatar avatar={p.avatar} size={48} />
                           <span className="font-bold text-lg text-slate-100">{p.name}</span>
                        </div>
                        <div className="text-right flex items-baseline justify-end gap-4">
                           <div className="text-2xl font-black text-white">{p.sessionsWon} <span className="text-sm font-normal text-slate-400">Siege</span></div>
                           <div className="text-lg font-semibold text-slate-300">{p.totalScore.toLocaleString('de-DE')} <span className="text-xs font-normal text-slate-400">Pkt.</span></div>
                        </div>
                    </div>
                ))}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h3 className="text-xl font-semibold mb-4">Spiele gewonnen</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {gameWinsLeaderboard.map((p, i) => (
                            <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg">
                                <div className="w-8 text-center font-bold text-slate-400">{i + 1}.</div>
                                <div className="flex-grow flex items-center gap-3 ml-2">
                                    <PlayerAvatar avatar={p.avatar} size={40} />
                                    <span className="font-bold text-md text-slate-100">{p.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-white">{p.gamesWon}</span>
                                    <span className="text-sm font-normal text-slate-400 ml-1">Spiele</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <h3 className="text-xl font-semibold mb-4">Kategorien gewonnen</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {categoryWinsLeaderboard.map((p, i) => (
                            <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg">
                                <div className="w-8 text-center font-bold text-slate-400">{i + 1}.</div>
                                <div className="flex-grow flex items-center gap-3 ml-2">
                                    <PlayerAvatar avatar={p.avatar} size={40} />
                                    <span className="font-bold text-md text-slate-100">{p.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-white">{p.categoriesWon}</span>
                                    <span className="text-sm font-normal text-slate-400 ml-1">Kategorien</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
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
                                    <div className="flex items-center gap-4">
                                        <PlayerAvatar avatar={p.avatar} size={40} />
                                        <span className="font-bold text-lg text-slate-100">{p.name}</span>
                                    </div>
                                    <div className="text-right flex items-baseline justify-end gap-4">
                                       <span className="text-lg font-bold">{p.gamesWon} Siege</span>
                                       <span className="text-md font-semibold text-slate-300">{p.score.toLocaleString('de-DE')} <span className="text-xs font-normal text-slate-400">Pkt.</span></span>
                                    </div>
                                </div>
                            ))}</div>
                        </div>
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                                <h4 className="font-semibold">Punkteverlauf</h4>
                                <ChartModeToggle
                                    currentMode={categoryChartMode}
                                    onChange={(mode) => setCategoryChartMode(mode as 'perGame' | 'cumulative')}
                                    options={[
                                        { value: 'perGame', label: 'Pro Spiel' },
                                        { value: 'cumulative', label: 'Kumulativ' },
                                    ]}
                                />
                            </div>
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