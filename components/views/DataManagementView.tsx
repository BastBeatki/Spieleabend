import React, { useState, useRef } from 'react';
import { Player, Category, View } from '../../types';
import * as fb from '../../services/firebaseService';
import { Header } from '../ui/Header';
import { Modal } from '../ui/Modal';
import { EditIcon, TrashIcon, SaveIcon, CancelIcon, PlayerAvatar } from '../ui/Icons';


interface DataManagementViewProps {
  players: Player[];
  categories: Category[];
  navigate: (view: View) => void;
}

// Helper function to process and resize images
const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 128;
                let { width, height } = img;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Could not get canvas context');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); // Use jpeg for smaller size
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


export const DataManagementView: React.FC<DataManagementViewProps> = ({ players, categories, navigate }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    
    const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
    const [editingPlayerName, setEditingPlayerName] = useState('');
    const [editingPlayerColor, setEditingPlayerColor] = useState('');
    const [editingPlayerAvatar, setEditingPlayerAvatar] = useState<string | undefined>();
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            await fb.updateDocument('players', editingPlayerId, { name: editingPlayerName, color: editingPlayerColor, avatar: editingPlayerAvatar });
            setEditingPlayerId(null);
            setEditingPlayerAvatar(undefined);
        } catch (e) { console.error(e); }
    };

    const handleDeletePlayer = (id: string, name: string) => {
        showConfirm(`Spieler "${name}" löschen?`, 'Der Spieler wird nur aus der globalen Liste entfernt. In alten Sessions bleibt er für die Statistik erhalten.', async (confirmed) => {
            closeModal();
            if (confirmed) await fb.deleteDocument('players', id);
        });
    };

     const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                showAlert('Bild zu groß', 'Bitte wähle ein Bild, das kleiner als 2MB ist.');
                return;
            }
            try {
                const base64 = await processImage(file);
                setEditingPlayerAvatar(base64);
            } catch (error) {
                showAlert('Fehler bei der Bildverarbeitung', 'Das Bild konnte nicht verarbeitet werden.');
            }
        }
    };

    return (
        <>
            <Header title="Stammdaten-Verwaltung" onBack={() => navigate('home')} backText="Zurück zur Übersicht" />
            
             <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800 mb-6">
                <h3 className="text-xl font-semibold mb-4">Spieler</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                   {players.map(p => (
                       <div key={p.id} className="bg-slate-800/80 p-3 rounded-lg flex justify-between items-center group">
                            {editingPlayerId === p.id ? (
                                <div className="flex-grow flex items-center gap-4">
                                    <div className="flex flex-col items-center gap-1">
                                        <PlayerAvatar avatar={editingPlayerAvatar} size={64} />
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
                                        <div className='flex gap-2'>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-400 hover:underline">Ändern</button>
                                            {editingPlayerAvatar && <button onClick={() => setEditingPlayerAvatar('')} className="text-xs text-red-400 hover:underline">Entfernen</button>}
                                        </div>
                                    </div>
                                    <div className="flex-grow space-y-2">
                                        <input type="text" value={editingPlayerName} onChange={e => setEditingPlayerName(e.target.value)} className="w-full bg-slate-700 text-white border-2 border-slate-600 rounded-lg py-2 px-3" />
                                        <input type="color" value={editingPlayerColor} onChange={e => setEditingPlayerColor(e.target.value)} className="w-full h-10 p-1 bg-slate-700 border-2 border-slate-600 rounded-lg cursor-pointer" />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <PlayerAvatar avatar={p.avatar} localAvatar={p.localAvatar} size={48} />
                                    <span className="font-bold text-lg" style={{color: p.color}}>{p.name}</span>
                                </div>
                            )}
                            <div className="flex gap-2 ml-4">
                                {editingPlayerId === p.id ? (
                                     <>
                                        <button onClick={handleUpdatePlayer} className="text-blue-400 hover:text-blue-300 p-1"><SaveIcon /></button>
                                        <button onClick={() => {setEditingPlayerId(null); setEditingPlayerAvatar(undefined)}} className="text-red-400 hover:text-red-300 p-1"><CancelIcon /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setEditingPlayerId(p.id); setEditingPlayerName(p.name); setEditingPlayerColor(p.color); setEditingPlayerAvatar(p.avatar || (p.localAvatar ? `/images/players/${p.localAvatar}`: undefined) ); }} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 p-1"><EditIcon /></button>
                                        <button onClick={() => handleDeletePlayer(p.id, p.name)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1"><TrashIcon /></button>
                                    </>
                                )}
                            </div>
                       </div>
                   ))}
                </div>
             </div>

            <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
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