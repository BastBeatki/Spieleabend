
import React, { useState, useMemo } from 'react';
import { Session, Game, PointUpdate, View } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { UndoIcon } from '../ui/Icons';

declare const Recharts: any;

interface LiveGameViewProps {
  session: Session;
  game: Game;
  updates: PointUpdate[];
  navigate: (view: View, data?: any) => void;
}

export const LiveGameView: React.FC<LiveGameViewProps> = ({ session, game, updates, navigate }) => {
    const [scoresToAdd, setScoresToAdd] = useState<{ [playerId: string]: number }>({});
    const [modal, setModal] =useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });

    const sortedPlayers = useMemo(() =>
        [...session.players].sort((a, b) => (game.gameScores[b.id] || 0) - (game.gameScores[a.id] || 0)),
        [game, session.players]
    );
    
    const chartData = useMemo(() => {
        const data: any[] = [{ name: 'Start', ...session.players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        
        updates.forEach((update, index) => {
            session.players.forEach(p => {
                cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (update.scores?.[p.id] || 0);
            });
            const dataPoint: any = { name: `Update ${index + 1}` };
            session.players.forEach(p => {
                dataPoint[p.name] = cumulativeScores[p.id];
            });
            data.push(dataPoint);
        });
        return data;
    }, [updates, session.players]);

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
            <Header title={game.name} onBack={() => navigate('scoreboard', { sessionId: session.id })} backText="Zurück zur Session" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <div className="bg-slate-800 p-6 rounded-lg shadow-xl mb-8">
                        <h3 className="text-xl font-semibold mb-4">Live-Ranking (Dieses Spiel)</h3>
                        <div className="space-y-3">{sortedPlayers.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg">
                                <div className="flex items-center gap-3">
                                     <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    <span className="font-bold text-slate-100">{p.name}</span>
                                </div>
                                <span className="text-xl font-black">{game.gameScores[p.id] || 0}</span>
                            </div>
                        ))}</div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                        <h3 className="text-xl font-semibold mb-4">Punkte hinzufügen</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">{session.players.map(p => (
                             <div key={p.id} className="bg-slate-700 p-4 rounded-lg flex flex-col items-center gap-2">
                                <label className="font-bold text-lg" style={{ color: p.color }}>{p.name}</label>
                                <div className="flex items-center justify-center gap-3 w-full">
                                    <button onClick={() => updateScore(p.id, (scoresToAdd[p.id] || 0) - 1)} className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors text-2xl font-bold flex items-center justify-center">-</button>
                                    <input type="number" value={scoresToAdd[p.id] || 0} onChange={e => updateScore(p.id, parseInt(e.target.value) || 0)} className="w-20 text-center bg-transparent border-none text-3xl font-black p-0 focus:ring-0"/>
                                    <button onClick={() => updateScore(p.id, (scoresToAdd[p.id] || 0) + 1)} className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors text-2xl font-bold flex items-center justify-center">+</button>
                                </div>
                            </div>
                        ))}</div>
                        <div className="flex gap-4">
                            <button onClick={handleUndo} className="w-1/3 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition duration-300" title="Letzte Eingabe rückgängig machen">
                                <UndoIcon />
                            </button>
                            <button onClick={handleUpdateScores} className="w-2/3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition duration-300">
                                Punkte aktualisieren
                            </button>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-semibold mb-4">Punkteverlauf (Dieses Spiel)</h3>
                    <div className="relative h-96">
                        {chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                                {session.players.map(p => <Line key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={2} />)}
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
                        { text: 'Abbrechen', onClick: () => modal.onConfirm!(false), className: 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-6 rounded-lg' },
                        { text: 'Bestätigen', onClick: () => modal.onConfirm!(true), className: 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg', autoFocus: true },
                    ] : [{ text: 'OK', onClick: () => setModal({isOpen: false, title: '', message: ''}), className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-lg', autoFocus: true }]
                }
            >
                <p>{modal.message}</p>
            </Modal>
        </>
    );
};
