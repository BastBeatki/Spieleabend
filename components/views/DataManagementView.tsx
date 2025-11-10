import React, { useState } from 'react';
import { Player, Category, View } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';
import { EditIcon, TrashIcon, SaveIcon, CancelIcon } from '../ui/Icons';


interface DataManagementViewProps {
  players: Player[];
  categories: Category[];
  navigate: (view: View) => void;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({ players, categories, navigate }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [editingPlayerName, setEditingPlayerName] = useState('');
    const [editingPlayerColor, setEditingPlayerColor] = useState('');

    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });

    const showConfirm = (title: string, message: string, onConfirm: (confirmed: boolean) => void) => {
        setModal({ isOpen: true, title, message, onConfirm });
    };

    const showAlert = (title: string, message: string) => {
        setModal({ isOpen: true, title, message });
    };

    const closeModal = () => {
        setModal({ isOpen: false, title: '', message: '' });
    };

    // Category Logic
    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await fb.addDocument('categories', { name: newCategoryName });
            setNewCategoryName('');
        } catch (e) { console.error(e); }
    };

    const handleUpdateCategory = async () => {
        if (!editingCategoryId || !editingCategoryName.trim()) return;
        try {
            await fb.updateDocument('categories', editingCategoryId, { name: editingCategoryName });
            setEditingCategoryId(null);
        } catch (e) { console.error(e); }
    };
    
    const handleDeleteCategory = (id: string, name: string) => {
        showConfirm(`Kategorie "${name}" löschen?`, 'Runden mit dieser Kategorie bleiben erhalten, aber die Verknüpfung geht verloren.', async (confirmed) => {
            closeModal();
            if (confirmed) await fb.deleteDocument('categories', id);
        });
    };

    // Player Logic
    const handleUpdatePlayer = async () => {
        if (!editingPlayerId || !editingPlayerName.trim()) return;
        try {
            await fb.updateDocument('players', editingPlayerId, { name: editingPlayerName, color: editingPlayerColor });
            setEditingPlayerId(null);
        } catch (e) { console.error(e); }
    };

    const handleDeletePlayer = (id: string, name: string) => {
        showConfirm(`Spieler "${name}" löschen?`, 'Der Spieler wird nur aus der globalen Liste entfernt. In alten Sessions bleibt er für die Statistik erhalten.', async (confirmed) => {
            closeModal();
            if (confirmed) await fb.deleteDocument('players', id);
        });
    };

    return (
        <>
            <Header title="Stammdaten-Verwaltung" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            
            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-6">
                 <h3 className="text-xl font-semibold mb-4">Kategorien</h3>
                 <div className="flex gap-4 mb-4">
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-grow bg-slate-800 text-white border-2 border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Neue Kategorie hinzufügen"/>
                    <button onClick={handleSaveCategory} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-5 rounded-lg">Speichern</button>
                 </div>
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {categories.map(c => (
                        <div key={c.id} className="bg-slate-800/80 p-3 rounded-lg flex justify-between items-center group">
                            {editingCategoryId === c.id ? (
                                <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="flex-grow bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-1 px-2"/>
                            ) : (
                                <span>{c.name}</span>
                            )}
                            <div className="flex gap-2 ml-4">
                                {editingCategoryId === c.id ? (
                                    <>
                                        <button onClick={handleUpdateCategory} className="text-blue-400 hover:text-blue-300 p-1"><SaveIcon /></button>
                                        <button onClick={() => setEditingCategoryId(null)} className="text-red-400 hover:text-red-300 p-1"><CancelIcon /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setEditingCategoryId(c.id); setEditingCategoryName(c.name); }} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 p-1"><EditIcon /></button>
                                        <button onClick={() => handleDeleteCategory(c.id, c.name)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"><TrashIcon /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
             </div>

             <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
                <h3 className="text-xl font-semibold mb-4">Spieler</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                   {players.map(p => (
                       <div key={p.id} className="bg-slate-800/80 p-3 rounded-lg flex justify-between items-center group">
                            {editingPlayerId === p.id ? (
                                <div className="flex-grow flex items-center gap-2">
                                    <input type="text" value={editingPlayerName} onChange={e => setEditingPlayerName(e.target.value)} className="flex-grow bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-1 px-2" />
                                    <input type="color" value={editingPlayerColor} onChange={e => setEditingPlayerColor(e.target.value)} className="w-10 h-8 p-0 bg-transparent border-none rounded-lg cursor-pointer" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    <span className="font-bold">{p.name}</span>
                                </div>
                            )}
                            <div className="flex gap-2 ml-4">
                                {editingPlayerId === p.id ? (
                                     <>
                                        <button onClick={handleUpdatePlayer} className="text-blue-400 hover:text-blue-300 p-1"><SaveIcon /></button>
                                        <button onClick={() => setEditingPlayerId(null)} className="text-red-400 hover:text-red-300 p-1"><CancelIcon /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setEditingPlayerId(p.id); setEditingPlayerName(p.name); setEditingPlayerColor(p.color) }} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 p-1"><EditIcon /></button>
                                        <button onClick={() => handleDeletePlayer(p.id, p.name)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"><TrashIcon /></button>
                                    </>
                                )}
                            </div>
                       </div>
                   ))}
                </div>
             </div>
             <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                onClose={closeModal}
                buttons={
                    modal.onConfirm
                    ? [
                        { text: 'Abbrechen', onClick: () => modal.onConfirm!(false), className: 'bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 px-6 rounded-lg' },
                        { text: 'Bestätigen', onClick: () => modal.onConfirm!(true), className: 'bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md hover:shadow-lg shadow-red-500/20 hover:shadow-red-500/40', autoFocus: true },
                    ]
                    : [{ text: 'OK', onClick: closeModal, className: 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-8 rounded-lg transition-all shadow-md hover:shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40', autoFocus: true }]
                }
            >
               <p>{modal.message}</p>
            </Modal>
        </>
    );
};
