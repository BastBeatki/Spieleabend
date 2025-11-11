import React, { useState, useMemo } from 'react';
import { Session, Game, PointUpdate, View, Player, SessionPlayer } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area } from 'recharts';
import { UndoIcon, PlayerAvatar, BuzzerIcon } from '../ui/Icons';
import { ChartModeToggle, CustomChartTooltip } from '../ui/ChartModeToggle';
import { BuzzerView } from './BuzzerView';

declare const Recharts: any;

interface LiveGameViewProps {
  session: Session;
  game: Game;
  updates: PointUpdate[];
  players: Player[];
  navigate: (view: View, data?: any) => void;
}

export const LiveGameView: React.FC<LiveGameViewProps> = ({ session, game, updates, players, navigate }) => {
    const [scoresToAdd, setScoresToAdd] = useState<{ [playerId: string]: number }>({});
    const [modal, setModal] =useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });
    const [chartMode, setChartMode] = useState<'cumulative' | 'perUpdate'>('cumulative');
    const [isBuzzerActive, setIsBuzzerActive] = useState(false);
    
    const enrichedSessionPlayers: SessionPlayer[] = useMemo(() => {
        const globalPlayerMap = new Map(players.map(p => [p.id, p]));
        // FIX: Explicitly specify the type of `sessionPlayer` as `SessionPlayer` in the map function.
        // This resolves a TypeScript type inference issue where `sessionPlayer` was being treated
        // as `unknown`, leading to errors when accessing its properties. The logic enriches
        // session players with the latest global player data if available.
        return session.players.map((sessionPlayer: SessionPlayer) => {
            const globalPlayer = globalPlayerMap.get(sessionPlayer.id);
            if (globalPlayer) {
                // Enrich session player with potentially updated global data
                return {
                    id: sessionPlayer.id,
                    name: globalPlayer.name,
                    color: globalPlayer.color,
                    avatar: globalPlayer.avatar || sessionPlayer.avatar,
                };
            }
            // If global player is not found (e.g., has been deleted),
            // use the player data stored within the session.
            // Reconstruct the object to ensure it's a clean SessionPlayer instance.
            return {
                id: sessionPlayer.id,
                name: sessionPlayer.name,
                color: sessionPlayer.color,
                avatar: sessionPlayer.avatar,
            };
        });
    }, [session.players, players]);


    const sortedPlayers = useMemo(() =>
        [...enrichedSessionPlayers].sort((a, b) => (game.gameScores[b.id] || 0) - (game.gameScores[a.id] || 0)),
        [game.gameScores, enrichedSessionPlayers]
    );
    
    const chartData = useMemo(() => {
        const data: any[] = [{ name: 'Start', ...enrichedSessionPlayers.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        
        updates.forEach((update, index) => {
            const dataPoint: any = { name: `Update ${index + 1}` };
            if (chartMode === 'cumulative') {
                enrichedSessionPlayers.forEach(p => {
                    cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (update.scores?.[p.id] || 0);
                    dataPoint[p.name] = cumulativeScores[p.id];
                });
            } else { // 'perUpdate'
                enrichedSessionPlayers.forEach(p => {
                    dataPoint[p.name] = update.scores?.[p.id] || 0;
                });
            }
            data.push(dataPoint);
        });
        return data;
    }, [updates, enrichedSessionPlayers, chartMode]);

    const updateScore = (playerId: string, value: number) => {
        setScoresToAdd(prev => ({ ...prev, [playerId]: value }));
    };
    
    const handleUpdateScores = async () => {
        const hasScores = Object.values(scoresToAdd).some(s => s !== 0);
        if (!hasScores) {
            setModal({isOpen: true, title: 'Keine Punkte', message: 'Bitte trage Punkte ein.'});
            return;
        }
        await fb.updateScoresTransaction(session.id, game.id, scoresToAdd);
        setScoresToAdd({});
    };
    
    const handleUndo = () => {
        if (updates.length === 0) {
            setModal({isOpen: true, title: 'Fehler', message: 'Es gibt nichts zum Rückgängigmachen.'});
            return;
        }
        setModal({
            isOpen: true, 
            title: 'Eingabe rückgängig machen?',
            message: 'Möchtest du die letzte Punktevergabe wirklich rückgängig machen?',
            onConfirm: async (confirmed) => {
                if(confirmed) await fb.undoLastUpdateTransaction(session.id, game.id);
                setModal({isOpen: false, title: '', message: ''});
            }
        });
    }

    return (
        <>
            {isBuzzerActive && <BuzzerView players={enrichedSessionPlayers} onClose={() => setIsBuzzerActive(false)} />}
            <Header title={game.name} onBack={() => navigate('scoreboard', { sessionId: session.id })} backText="Zurück zur Session" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div>
                    <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                        <h3 className="text-xl font-semibold mb-4">Live-Ranking</h3>
                        <div className="space-y-3">{sortedPlayers.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-800/80 p-3 rounded-lg">
                                <div className="flex items-center gap-4">
                                     <PlayerAvatar avatar={p.avatar} size={40} />
                                    <span className="font-bold text-slate-100">{p.name}</span>
                                </div>
                                <span className="text-xl font-black">{game.gameScores[p.id] || 0}</span>
                            </div>
                        ))}</div>
                    </div>
                    <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                        <h3 className="text-xl font-semibold mb-4">Punkte hinzufügen</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">{enrichedSessionPlayers.map(p => (
                             <div key={p.id} className="bg-slate-800/80 p-4 rounded-lg flex flex-col items-center gap-2">
                                <label className="font-bold text-lg" style={{ color: p.color }}>{p.name}</label>
                                <div className="flex items-center justify-center gap-3 w-full">
                                    <button onClick={() => updateScore(p.id, (scoresToAdd[p.id] || 0) - 1)} className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors text-2xl font-bold flex items-center justify-center">-</button>
                                    <input type="number" value={scoresToAdd[p.id] || 0} onChange={e => updateScore(p.id, parseInt(e.target.value) || 0)} className="w-20 text-center bg-transparent border-none text-3xl font-black p-0 focus:ring-0"/>
                                    <button onClick={() => updateScore(p.id, (scoresToAdd[p.id] || 0) + 1)} className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors text-2xl font-bold flex items-center justify-center">+</button>
                                </div>
                            </div>
                        ))}</div>
                        <div className="flex gap-4">
                            <button onClick={handleUndo} className="flex-shrink-0 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-amber-400 hover:border-amber-500/50 hover:text-amber-300 font-bold py-3 px-5 rounded-lg text-lg transition-all duration-300" title="Letzte Eingabe rückgängig machen">
                                <UndoIcon />
                            </button>
                             <button onClick={() => setIsBuzzerActive(true)} className="flex-shrink-0 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-yellow-500 hover:text-yellow-400 font-bold py-3 px-5 rounded-lg text-lg transition-all duration-300" title="Buzzerrunde starten">
                                <BuzzerIcon />
                            </button>
                            <button onClick={handleUpdateScores} className="flex-grow bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]">
                                Punkte aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h3 className="text-xl font-semibold">Punkteverlauf</h3>
                        <ChartModeToggle
                            currentMode={chartMode}
                            onChange={(mode) => setChartMode(mode as 'cumulative' | 'perUpdate')}
                            options={[
                                { value: 'perUpdate', label: 'Pro Update' },
                                { value: 'cumulative', label: 'Kumulativ' },
                            ]}
                        />
                    </div>
                    <div className="relative h-96">
                        {chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <defs>
                                    {enrichedSessionPlayers.map(p => (
                                        <linearGradient key={`color-${p.id}`} id={`color-${p.id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={p.color} stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor={p.color} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
                                <XAxis dataKey="name" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                                {enrichedSessionPlayers.map(p => (
                                    <React.Fragment key={p.id}>
                                        <Area type="monotone" dataKey={p.name} stroke="transparent" fill={`url(#color-${p.id.replace(/[^a-zA-Z0-9]/g, '')})`} />
                                        <Line type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} dot={{r: 2, fill: p.color, strokeWidth: 0}} activeDot={{r: 6, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 4}} />
                                    </React.Fragment>
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
             <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                onClose={() => setModal({isOpen: false, title: '', message: ''})}
                buttons={
                    modal.onConfirm ? [
                        { text: 'Abbrechen', onClick: () => modal.onConfirm!(false), className: 'bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-6 rounded-lg' },
                        { text: 'Bestätigen', onClick: () => modal.onConfirm!(true), className: 'bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md hover:shadow-lg shadow-red-500/20 hover:shadow-red-500/40', autoFocus: true },
                    ] : [{ text: 'OK', onClick: () => setModal({isOpen: false, title: '', message: ''}), className: 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-8 rounded-lg transition-all shadow-md hover:shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40', autoFocus: true }]
                }
            >
                <p>{modal.message}</p>
            </Modal>
        </>
    );
};