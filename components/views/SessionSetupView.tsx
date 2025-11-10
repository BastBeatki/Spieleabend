
import React, { useState, useMemo } from 'react';
import { Player, View } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';

interface SessionSetupViewProps {
  players: Player[];
  navigate: (view: View, data?: any) => void;
}

export const SessionSetupView: React.FC<SessionSetupViewProps> = ({ players, navigate }) => {
    const [sessionName, setSessionName] = useState('');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
    const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerColor, setNewPlayerColor] = useState('#3b82f6');
    const [error, setError] = useState('');

    const isStartDisabled = useMemo(() => {
        return !sessionName.trim() || selectedPlayerIds.size < 2;
    }, [sessionName, selectedPlayerIds]);

    const handlePlayerSelection = (playerId: string) => {
        const newSelection = new Set(selectedPlayerIds);
        if (newSelection.has(playerId)) {
            newSelection.delete(playerId);
        } else {
            newSelection.add(playerId);
        }
        setSelectedPlayerIds(newSelection);
    };

    const handleStartSession = async () => {
        if (isStartDisabled) return;
        try {
            const selectedPlayers = players.filter(p => selectedPlayerIds.has(p.id));
            const docRef = await fb.startSession(sessionName, selectedPlayers);
            navigate('scoreboard', { sessionId: docRef.id });
        } catch (e) {
            console.error("Error starting session:", e);
            setError('Session konnte nicht gestartet werden.');
        }
    };
    
    const handleSavePlayer = async () => {
        if (!newPlayerName.trim()) {
            setError('Bitte gib einen Spielernamen ein.');
            return;
        }
        try {
            await fb.addDocument('players', { name: newPlayerName, color: newPlayerColor });
            setPlayerModalOpen(false);
            setNewPlayerName('');
            setError('');
        } catch(e) {
            setError('Spieler konnte nicht gespeichert werden.');
        }
    };

    return (
        <>
            <Header title="Neue Session konfigurieren" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                <div className="mb-6">
                    <label htmlFor="sessionNameInput" className="block text-lg font-medium mb-2">Name der Session</label>
                    <input
                        type="text"
                        id="sessionNameInput"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500"
                        placeholder="z.B. Quizabend Januar"
                    />
                </div>
                <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">Spieler auswählen</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {players.length > 0 ? players.map(p => (
                            <label key={p.id} className="flex items-center bg-slate-700 p-3 rounded-lg cursor-pointer hover:bg-slate-600 transition">
                                <input
                                    type="checkbox"
                                    checked={selectedPlayerIds.has(p.id)}
                                    onChange={() => handlePlayerSelection(p.id)}
                                    className="h-6 w-6 rounded border-slate-500 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-4 text-lg" style={{ color: p.color }}>{p.name}</span>
                            </label>
                        )) : <p className="text-slate-400">Noch keine Spieler angelegt. Füge einen neuen Spieler hinzu.</p>}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={() => setPlayerModalOpen(true)} className="w-full sm:w-auto bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-5 rounded-lg transition duration-300">
                        Neuen Spieler anlegen
                    </button>
                    <button onClick={handleStartSession} disabled={isStartDisabled} className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg text-lg transition duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed">
                        Session starten
                    </button>
                </div>
            </div>
             <Modal
                isOpen={isPlayerModalOpen}
                title="Neuen Spieler anlegen"
                onClose={() => setPlayerModalOpen(false)}
                buttons={[
                    { text: 'Abbrechen', onClick: () => setPlayerModalOpen(false), className: 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-5 rounded-lg' },
                    { text: 'Speichern', onClick: handleSavePlayer, className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg', autoFocus: true },
                ]}
            >
                <div className="space-y-4 text-left">
                     {error && <p className="text-red-400 text-center">{error}</p>}
                    <div>
                        <label htmlFor="playerNameInput" className="block text-lg font-medium mb-2">Name des Spielers</label>
                        <input type="text" id="playerNameInput" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500" placeholder="Max Mustermann" />
                    </div>
                    <div>
                        <label htmlFor="playerColorInput" className="block text-lg font-medium mb-2">Farbe</label>
                        <input type="color" id="playerColorInput" value={newPlayerColor} onChange={e => setNewPlayerColor(e.target.value)} className="w-full h-12 p-1 bg-slate-700 border-2 border-slate-600 rounded-lg cursor-pointer" />
                    </div>
                </div>
            </Modal>
        </>
    );
};
