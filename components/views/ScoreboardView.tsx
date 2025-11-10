import React, { useState, useMemo } from 'react';
import { Session, Game, Player, Category, View, SessionPlayer } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrashIcon } from '../ui/Icons';

declare const Recharts: any;

interface ScoreboardViewProps {
  session: Session;
  games: Game[];
  players: Player[];
  categories: Category[];
  allGameNames: string[];
  navigate: (view: View, data?: any) => void;
  refreshGameNames: () => void;
}

const getRankBadge = (rank: number) => {
    switch(rank) {
        case 1: return 'bg-amber-400 text-slate-900';
        case 2: return 'bg-slate-400 text-slate-900';
        case 3: return 'bg-orange-400 text-slate-900';
        default: return 'bg-slate-600 text-slate-200';
    }
}

export const ScoreboardView: React.FC<ScoreboardViewProps> = ({ session, games, players, categories, allGameNames, navigate, refreshGameNames }) => {
    const [gameName, setGameName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });

    const sortedPlayers = useMemo(() => 
        [...session.players].sort((a, b) => (session.totalScores[b.id] || 0) - (session.totalScores[a.id] || 0)),
        [session]
    );

    const chartData = useMemo(() => {
        const sortedGames = [...games].sort((a,b) => a.gameNumber - b.gameNumber);
        const data: any[] = [{ name: 'Start', ...session.players.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        
        sortedGames.forEach(game => {
            session.players.forEach(p => {
                cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (game.gameScores[p.id] || 0);
            });
            const dataPoint: any = { name: `${game.gameNumber}. ${game.name}` };
            session.players.forEach(p => {
                dataPoint[p.name] = cumulativeScores[p.id];
            });
            data.push(dataPoint);
        });
        return data;
    }, [games, session.players]);
    
    const categoryStats = useMemo(() => {
        const stats: {[catId: string]: { name: string, scores: {[pId: string]: number} }} = {};
        games.forEach(game => {
            if(!stats[game.categoryId]) stats[game.categoryId] = { name: game.categoryName, scores: {} };
            Object.entries(game.gameScores).forEach(([pId, score]) => {
                // FIX: Operator '+' cannot be applied to types 'number' and 'unknown'.
                stats[game.categoryId].scores[pId] = (stats[game.categoryId].scores[pId] || 0) + (score as number);
            });
        });
        return Object.values(stats);
    }, [games]);

    const handleStartGame = async () => {
        if (!gameName.trim()) return;
        let finalCategoryId = categoryId;
        let finalCategoryName = categories.find(c => c.id === categoryId)?.name || '';

        if (categoryId === '__new__') {
            if (!newCategoryName.trim()) return;
            const newCat = await fb.addDocument('categories', { name: newCategoryName });
            finalCategoryId = newCat.id;
            finalCategoryName = newCategoryName;
        }
        
        if(!finalCategoryId) return;

        const gameScores = session.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
        const gameData = { name: gameName, categoryId: finalCategoryId, categoryName: finalCategoryName, gameScores };

        const newGame = await fb.startGame(session.id, gameData);
        refreshGameNames();
        navigate('liveGame', { sessionId: session.id, gameId: newGame.id });
    };
    
    const handleSaveSessionPlayers = async (newPlayerIds: string[]) => {
        const playersToAdd = players.filter(p => newPlayerIds.includes(p.id));
        if (playersToAdd.length === 0) {
            setPlayerModalOpen(false);
            return;
        }
        await fb.addPlayersToSessionTransaction(session.id, playersToAdd);
        setPlayerModalOpen(false);
    };

    const handleDeleteGame = (gameId: string, gameName: string) => {
        setModal({
            isOpen: true,
            title: `Spiel "${gameName}" löschen?`,
            message: 'Die Punkte werden von der Session abgezogen.',
            onConfirm: async (confirmed) => {
                if (confirmed) {
                    await fb.deleteGameTransaction(session.id, gameId);
                }
                setModal({ isOpen: false, title: '', message: '' });
            }
        });
    }

    const availablePlayersToAdd = players.filter(p => !session.players.some(sp => sp.id === p.id));
    
    return (
        <>
            <Header title={session.name} onBack={() => navigate('home')} backText="Zurück zur Übersicht" />

            <div className="bg-slate-800 p-6 rounded-lg shadow-xl mb-8">
                <h3 className="text-xl font-semibold mb-4">Session-Ranking</h3>
                <div className="space-y-3">{sortedPlayers.map((p, i) => (
                     <div key={p.id} className="flex items-center bg-slate-700 p-3 rounded-lg shadow-md">
                        <div className="w-10 text-center font-bold"><span className={`w-8 h-8 flex items-center justify-center rounded-full ${getRankBadge(i+1)}`}>{i+1}</span></div>
                        <div className="flex-grow flex items-center gap-3 ml-3">
                           <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                           <span className="font-bold text-lg text-slate-100">{p.name}</span>
                        </div>
                        <div className="text-2xl font-black text-white">{session.totalScores[p.id] || 0} <span className="text-sm font-normal text-slate-400">Punkte</span></div>
                    </div>
                ))}</div>
                <button onClick={() => setPlayerModalOpen(true)} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    Spieler zu dieser Session hinzufügen
                </button>
            </div>

            <div className="bg-slate-800 p-6 rounded-lg shadow-xl mb-8">
                 <h3 className="text-xl font-semibold mb-4">Neues Spiel starten</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="text" list="gameNameList" value={gameName} onChange={e => setGameName(e.target.value)} className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-3 px-4" placeholder="Name des Spiels" />
                    <datalist id="gameNameList">{allGameNames.map(name => <option key={name} value={name} />)}</datalist>
                    <div>
                         <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-3 px-4">
                            <option value="">Kategorie auswählen</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value="__new__">Neue Kategorie anlegen...</option>
                         </select>
                         {categoryId === '__new__' && <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-3 px-4 mt-2" placeholder="Neue Kategorie..."/>}
                    </div>
                 </div>
                 <button onClick={handleStartGame} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition duration-300">Spiel starten</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-semibold mb-4">Punkteverlauf (Session)</h3>
                    <div className="relative h-80">
                        {chartData.length > 1 && (
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
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <h3 className="text-xl font-semibold mb-4">Statistik nach Kategorie (Session)</h3>
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2">{categoryStats.map(cat => (
                        <div key={cat.name} className="bg-slate-700 p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">{cat.name}</h4>
                            {/* FIX: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type. */}
                            <div className="space-y-1">{Object.entries(cat.scores).sort(([,a],[,b]) => (b as number) - (a as number)).map(([pId, score]) => {
                                const player = session.players.find(p => p.id === pId);
                                return player ? <div key={pId} className="flex justify-between text-sm"><span style={{color: player.color}}>{player.name}</span><span className="font-bold">{score as number} Pkt</span></div> : null;
                            })}</div>
                        </div>
                    ))}</div>
                </div>
            </div>
             <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <h3 className="text-xl font-semibold mb-4">Gespielte Spiele</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">{games.map(g => (
                    <div key={g.id} className="item-container bg-slate-700 p-4 rounded-lg group">
                         <div className="flex justify-between items-center cursor-pointer" onClick={() => navigate('liveGame', { sessionId: session.id, gameId: g.id })}>
                            <h4 className="font-semibold text-lg">{g.gameNumber}. {g.name} <span className="text-xs text-slate-400 font-normal ml-2">{g.categoryName}</span></h4>
                            {/* FIX: Operator '+' cannot be applied to types 'unknown' and 'unknown'. */}
                            <span className="text-lg font-bold">{(Object.values(g.gameScores) as number[]).reduce((a, b) => a + b, 0)} Pkt</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <div className="text-sm text-yellow-400">🏆 {
                                Object.entries(g.gameScores)
                                // FIX: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
                                .sort(([,a],[,b])=>(b as number)-(a as number))
                                // FIX: Operator '>' cannot be applied to types 'unknown' and 'number'.
                                .filter(([,score],_,arr) => (score as number) > 0 && (score as number) === (arr[0][1] as number))
                                .map(([pId])=>session.players.find(p=>p.id===pId)?.name).join(', ')
                            }</div>
                             <button onClick={() => handleDeleteGame(g.id, g.name)} className="delete-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"><TrashIcon size={20} /></button>
                        </div>
                    </div>
                ))}</div>
            </div>

            <ManageSessionPlayersModal 
                isOpen={isPlayerModalOpen} 
                onClose={() => setPlayerModalOpen(false)} 
                onSave={handleSaveSessionPlayers} 
                availablePlayers={availablePlayersToAdd}
            />
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

const ManageSessionPlayersModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (pids: string[]) => void, availablePlayers: Player[]}> = ({isOpen, onClose, onSave, availablePlayers}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const togglePlayer = (id: string) => {
        const newIds = new Set(selectedIds);
        if(newIds.has(id)) newIds.delete(id); else newIds.add(id);
        setSelectedIds(newIds);
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Spieler hinzufügen" buttons={[
            {text: 'Abbrechen', onClick: onClose, className: 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-5 rounded-lg'},
            {text: 'Speichern', onClick: () => onSave(Array.from(selectedIds)), className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg'}
        ]}>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-6 text-left">
                {availablePlayers.length > 0 ? availablePlayers.map(p => (
                     <label key={p.id} className="flex items-center bg-slate-700 p-3 rounded-lg cursor-pointer hover:bg-slate-600 transition">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => togglePlayer(p.id)} className="h-6 w-6 rounded border-slate-500 bg-slate-800 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-4 text-lg" style={{ color: p.color }}>{p.name}</span>
                    </label>
                )) : <p className="text-slate-400 text-center">Keine weiteren Spieler zum Hinzufügen verfügbar.</p>}
             </div>
        </Modal>
    );
}
