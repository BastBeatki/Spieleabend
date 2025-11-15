import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Session, Game, Player, Category, View, SessionPlayer } from '../../types';
import * as fb from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area } from 'recharts';
import { TrashIcon, PlayerAvatar, EditIcon, UserIcon, CancelIcon, SaveIcon } from '../ui/Icons';
import { ChartModeToggle, CustomChartTooltip } from '../ui/ChartModeToggle';
import { BackButton } from '../ui/BackButton';

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

const processSessionImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 480;
                let { width, height } = img;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Could not get canvas context');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            if (event.target?.result) {
                img.src = event.target.result as string;
            } else {
                reject('Could not read image file.');
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const getGameWinnerIds = (gameScores: { [playerId: string]: number }): string[] => {
    const scores = Object.entries(gameScores);
    if (scores.length === 0) return [];

    const maxScore = scores.reduce((max, [, score]) => Math.max(max, Number(score)), -Infinity);

    if (maxScore <= 0) return [];

    return scores
        .filter(([, score]) => Number(score) === maxScore)
        .map(([playerId]) => playerId);
};


export const ScoreboardView: React.FC<ScoreboardViewProps> = ({ session, games, players, categories, allGameNames, navigate, refreshGameNames }) => {
    const [gameName, setGameName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [chartMode, setChartMode] = useState<'cumulative' | 'perGame'>('cumulative');
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });

    const enrichedSessionPlayers = useMemo(() => session.players, [session.players]);

    const playerStats = useMemo(() => {
        const stats: { [playerId: string]: { gamesWon: number } } = {};
        session.players.forEach(p => {
            stats[p.id] = { gamesWon: 0 };
        });

        games.forEach(game => {
            const winnerIds = getGameWinnerIds(game.gameScores);
            winnerIds.forEach(winnerId => {
                if (stats[winnerId]) {
                    stats[winnerId].gamesWon += 1;
                }
            });
        });
        return stats;
    }, [games, session.players]);

    const sortedPlayers = useMemo(() =>
        [...enrichedSessionPlayers].sort((a, b) => {
            const statsA = playerStats[a.id];
            const statsB = playerStats[b.id];
            const scoreA = session.totalScores[a.id] || 0;
            const scoreB = session.totalScores[b.id] || 0;

            if (statsB.gamesWon !== statsA.gamesWon) {
                return statsB.gamesWon - statsA.gamesWon;
            }
            return scoreB - scoreA;
        }),
        [session.totalScores, enrichedSessionPlayers, playerStats]
    );

    const chartData = useMemo(() => {
        const sortedGames = [...games].sort((a,b) => a.gameNumber - b.gameNumber);
        const data: any[] = [{ name: 'Start', ...enrichedSessionPlayers.reduce((acc, p) => ({...acc, [p.name]: 0}), {}) }];
        const cumulativeScores: { [pid: string]: number } = {};
        
        sortedGames.forEach(game => {
            const dataPoint: any = { name: `${game.gameNumber}. ${game.name}` };
             if (chartMode === 'cumulative') {
                enrichedSessionPlayers.forEach(p => {
                    cumulativeScores[p.id] = (cumulativeScores[p.id] || 0) + (game.gameScores[p.id] || 0);
                    dataPoint[p.name] = cumulativeScores[p.id];
                });
            } else { // 'perGame'
                enrichedSessionPlayers.forEach(p => {
                    dataPoint[p.name] = game.gameScores[p.id] || 0;
                });
            }
            data.push(dataPoint);
        });
        return data;
    }, [games, enrichedSessionPlayers, chartMode]);
    
    const categoryStats = useMemo(() => {
        const stats: {[catId: string]: { name: string, scores: {[pId: string]: number} }} = {};
        games.forEach(game => {
            if(!stats[game.categoryId]) stats[game.categoryId] = { name: game.categoryName, scores: {} };
            Object.entries(game.gameScores).forEach(([pId, score]) => {
                stats[game.categoryId].scores[pId] = (stats[game.categoryId].scores[pId] || 0) + Number(score);
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
    
    const imageSrc = session.coverImage || (session.localCoverImage ? `/images/sessions/${session.localCoverImage}` : undefined);

    return (
        <>
            <div className="flex justify-between items-center mb-8 gap-4">
                <BackButton onClick={() => navigate('home')}>Zurück</BackButton>

                <div className="flex items-center gap-4 flex-grow justify-center min-w-0">
                    <div className="w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 hidden sm:block">
                        {imageSrc ? (
                            <img src={imageSrc} alt={session.name} className="w-full h-full object-cover"/>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <UserIcon size={32} />
                            </div>
                        )}
                    </div>
                    <div className="text-center sm:text-left min-w-0">
                        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100 truncate" title={session.name}>{session.name}</h2>
                        <p className="text-slate-400 text-sm">
                            {session.createdAt.toDate().toLocaleDateString('de-DE')}
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={() => setEditModalOpen(true)} 
                    className="flex-shrink-0 flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg transition duration-300"
                >
                    <EditIcon />
                    <span className="hidden md:inline">Bearbeiten</span>
                </button>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <h3 className="text-xl font-semibold mb-4">Session-Ranking</h3>
                <div className="space-y-3">{sortedPlayers.map((p, i) => (
                     <div key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg shadow-md">
                        <div className="w-10 text-center font-bold"><span className={`w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br ${getRankBadge(i+1)} ${getRankText(i+1)}`}>{i+1}</span></div>
                        <div className="flex-grow flex items-center gap-4 ml-3">
                           <PlayerAvatar avatar={p.avatar} localAvatar={p.localAvatar} size={48} />
                           <span className="font-bold text-lg text-slate-100">{p.name}</span>
                        </div>
                        <div className="text-right flex items-baseline justify-end gap-4">
                           <div className="text-xl font-black text-white">{playerStats[p.id]?.gamesWon || 0} <span className="text-sm font-normal text-slate-400">Siege</span></div>
                           <div className="text-lg font-semibold text-slate-300">{(session.totalScores[p.id] || 0).toLocaleString('de-DE')} <span className="text-xs font-normal text-slate-400">Pkt.</span></div>
                        </div>
                    </div>
                ))}</div>
                {availablePlayersToAdd.length > 0 && (
                    <button onClick={() => setPlayerModalOpen(true)} className="mt-4 w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-4 rounded-lg transition duration-300">
                        Spieler zu dieser Session hinzufügen
                    </button>
                )}
            </div>

             <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h3 className="text-xl font-semibold">Punkteverlauf (Session)</h3>
                        <ChartModeToggle
                        currentMode={chartMode}
                        onChange={(mode) => setChartMode(mode as 'cumulative' | 'perGame')}
                        options={[
                            { value: 'perGame', label: 'Pro Spiel' },
                            { value: 'cumulative', label: 'Kumulativ' },
                        ]}
                    />
                </div>
                <div className="relative h-80">
                    {chartData.length > 1 && (
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
                            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#64748b" />
                            <Tooltip content={<CustomChartTooltip />} />
                            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                            {enrichedSessionPlayers.map(p => (
                                <React.Fragment key={p.id}>
                                    <Area type="monotone" dataKey={p.name} stroke="transparent" fill={`url(#color-${p.id.replace(/[^a-zA-Z0-9]/g, '')})`} hide />
                                    <Line type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} dot={{r: 2, fill: p.color, strokeWidth: 0}} activeDot={{r: 6, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 4}} />
                                </React.Fragment>
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                 <h3 className="text-xl font-semibold mb-4">Neues Spiel starten</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="text" list="gameNameList" value={gameName} onChange={e => setGameName(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Name des Spiels" />
                    <datalist id="gameNameList">{allGameNames.map(name => <option key={name} value={name} />)}</datalist>
                    <div>
                         <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                            <option value="">Kategorie auswählen</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value="__new__">Neue Kategorie anlegen...</option>
                         </select>
                         {categoryId === '__new__' && <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 mt-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Neue Kategorie..."/>}
                    </div>
                 </div>
                 <button onClick={handleStartGame} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]">Spiel starten</button>
            </div>
            
             <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-8">
                <h3 className="text-xl font-semibold mb-4">Gespielte Spiele</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">{games.map(g => (
                    <div key={g.id} className="group bg-slate-800/80 p-4 rounded-lg transition-all duration-300 border border-transparent hover:border-blue-500/30">
                         <div className="flex justify-between items-center cursor-pointer" onClick={() => navigate('liveGame', { sessionId: session.id, gameId: g.id })}>
                            <h4 className="font-semibold text-lg">{g.gameNumber}. {g.name} <span className="text-xs text-slate-400 font-normal ml-2">{g.categoryName}</span></h4>
                            <span className="text-lg font-bold">{Object.values(g.gameScores).reduce((a: number, b: number) => a + b, 0)} Pkt</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <div className="text-sm text-blue-400">🏆 {
                                getGameWinnerIds(g.gameScores)
                                .map(pId => enrichedSessionPlayers.find(p => p.id === pId)?.name)
                                .join(', ') || 'Niemand'
                            }</div>
                             <button onClick={() => handleDeleteGame(g.id, g.name)} className="delete-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"><TrashIcon size={20} /></button>
                        </div>
                    </div>
                ))}</div>
            </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                <h3 className="text-xl font-semibold mb-4">Statistik nach Kategorie (Session)</h3>
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">{categoryStats.map(cat => (
                    <div key={cat.name} className="bg-slate-800/80 p-3 rounded-lg">
                        <h4 className="font-semibold mb-2">{cat.name}</h4>
                        <div className="space-y-1">{Object.entries(cat.scores).sort(([,a],[,b]) => Number(b) - Number(a)).map(([pId, score]) => {
                            const player = enrichedSessionPlayers.find(p => p.id === pId);
                            return player ? <div key={pId} className="flex justify-between text-sm"><span style={{color: player.color}}>{player.name}</span><span className="font-bold">{score} Pkt</span></div> : null;
                        })}</div>
                    </div>
                ))}</div>
            </div>

            <ManageSessionPlayersModal 
                isOpen={isPlayerModalOpen} 
                onClose={() => setPlayerModalOpen(false)} 
                onSave={handleSaveSessionPlayers} 
                availablePlayers={availablePlayersToAdd}
            />
            <EditSessionModal 
                isOpen={isEditModalOpen}
                onClose={() => setEditModalOpen(false)}
                session={session}
            />
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

const ManageSessionPlayersModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (pids: string[]) => void, availablePlayers: Player[]}> = ({isOpen, onClose, onSave, availablePlayers}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const togglePlayer = (id: string) => {
        const newIds = new Set(selectedIds);
        if(newIds.has(id)) newIds.delete(id); else newIds.add(id);
        setSelectedIds(newIds);
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Spieler hinzufügen" buttons={[
            {text: 'Abbrechen', onClick: onClose, className: 'bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-5 rounded-lg'},
            {text: 'Speichern', onClick: () => onSave(Array.from(selectedIds)), className: 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg transition-all shadow-md hover:shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40'}
        ]}>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-6 text-left">
                {availablePlayers.length > 0 ? availablePlayers.map(p => (
                     <label key={p.id} className="flex items-center bg-slate-800/80 p-3 rounded-lg cursor-pointer hover:bg-slate-700/80 transition">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => togglePlayer(p.id)} className="h-6 w-6 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" />
                        <div className="ml-4 flex items-center gap-4">
                            <PlayerAvatar avatar={p.avatar} localAvatar={p.localAvatar} size={40} />
                            <span className="text-lg" style={{ color: p.color }}>{p.name}</span>
                        </div>
                    </label>
                )) : <p className="text-slate-400 text-center">Keine weiteren Spieler zum Hinzufügen verfügbar.</p>}
             </div>
        </Modal>
    );
}

const EditSessionModal: React.FC<{isOpen: boolean, onClose: () => void, session: Session}> = ({isOpen, onClose, session}) => {
    const [name, setName] = useState(session.name);
    const [coverImage, setCoverImage] = useState(session.coverImage);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(session.name);
            setCoverImage(session.coverImage || (session.localCoverImage ? `/images/sessions/${session.localCoverImage}` : undefined));
            setError('');
        }
    }, [isOpen, session]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Bild zu groß (max. 2MB).');
                return;
            }
            try {
                const base64 = await processSessionImage(file);
                setCoverImage(base64);
                setError('');
            } catch (error) {
                setError('Bild konnte nicht verarbeitet werden.');
            }
        }
    };
    
    const handleSave = async () => {
        if(!name.trim()) {
            setError('Der Session-Name darf nicht leer sein.');
            return;
        }
        await fb.updateDocument('sessions', session.id, { name, coverImage });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Session bearbeiten" buttons={[
            {text: 'Abbrechen', onClick: onClose, className: 'bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-5 rounded-lg'},
            {text: 'Speichern', onClick: handleSave, className: 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg'}
        ]}>
            <div className="space-y-4 text-left">
                {error && <p className="text-red-400 text-center pb-2">{error}</p>}
                <div>
                    <label htmlFor="sessionNameEdit" className="block text-sm font-medium mb-1">Session-Name</label>
                    <input type="text" id="sessionNameEdit" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                     <label className="block text-sm font-medium mb-1">Titelbild</label>
                     <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative group">
                        {coverImage ? (
                            <img src={coverImage} alt="Session Vorschau" className="w-full h-full object-cover"/>
                        ) : (
                            <div className="text-slate-500">Kein Bild</div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                            <button onClick={() => fileInputRef.current?.click()} className="text-white hover:text-blue-400">Ändern</button>
                            {coverImage && <button onClick={() => setCoverImage('')} className="text-white hover:text-red-400">Entfernen</button>}
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
                </div>
            </div>
        </Modal>
    )
}