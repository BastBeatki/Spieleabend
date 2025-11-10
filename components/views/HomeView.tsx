
import React, { useState } from 'react';
import { Session, View, FullBackup } from '../../types';
import * as fb from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { ExportIcon, ImportIcon, TrashIcon } from '../ui/Icons';

interface HomeViewProps {
  sessions: Session[];
  navigate: (view: View, data?: any) => void;
  setView: (view: View) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ sessions, navigate, setView }) => {
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm?: (confirmed: boolean) => void }>({ isOpen: false, title: '', message: '' });
    const importFileInputRef = React.useRef<HTMLInputElement>(null);

    const showConfirm = (title: string, message: string, onConfirm: (confirmed: boolean) => void) => {
        setModal({ isOpen: true, title, message, onConfirm });
    };

    const showAlert = (title: string, message: string) => {
        setModal({ isOpen: true, title, message });
    };

    const closeModal = () => {
        setModal({ isOpen: false, title: '', message: '' });
    };

    const handleDeleteSession = (sessionId: string, sessionName: string) => {
        showConfirm(
            `Session "${sessionName}" löschen?`,
            'Möchtest du diese Session und alle zugehörigen Runden wirklich endgültig löschen?',
            async (confirmed) => {
                closeModal();
                if (confirmed) {
                    try {
                        await fb.deleteSession(sessionId);
                    } catch (e) {
                        console.error("Error deleting session:", e);
                        showAlert("Fehler", "Session konnte nicht gelöscht werden.");
                    }
                }
            }
        );
    };
    
    const handleExport = async () => {
        showAlert("Export wird vorbereitet", "Sammle alle Daten für den Export. Dies kann einen Moment dauern...");
        try {
            const data = await fb.exportData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scoreboard-backup-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showAlert("Export erfolgreich", "Deine Daten wurden als JSON-Datei heruntergeladen.");
        } catch (e) {
            console.error(e);
            showAlert("Export fehlgeschlagen", "Ein Fehler ist aufgetreten.");
        }
    };

    const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as FullBackup;
                if (!data.players || !data.categories || !data.sessions) {
                    throw new Error("Invalid backup file structure.");
                }
                showConfirm("Daten importieren?", "ACHTUNG: Dies wird ALLE deine aktuellen Daten löschen und durch die Daten aus der Backup-Datei ersetzen. Dieser Vorgang kann nicht rückgängig gemacht werden.",
                async (confirmed) => {
                    closeModal();
                    if (confirmed) {
                        setView('loading');
                        try {
                            await fb.importData(data);
                            showAlert("Import erfolgreich", "Alle Daten wurden erfolgreich wiederhergestellt.");
                        } catch(err) {
                            console.error(err);
                            showAlert("Import fehlgeschlagen", "Ein schwerwiegender Fehler ist aufgetreten.");
                        } finally {
                            setView('home');
                        }
                    }
                });
            } catch (err) {
                showAlert("Import fehlgeschlagen", "Die ausgewählte Datei ist keine gültige Backup-Datei.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };

    return (
    <>
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">Spieleabend Scoreboard</h1>
        <p className="text-slate-400 mt-2">Willkommen zurück! Starte eine neue Session oder sieh dir alte an.</p>
      </header>
      <button
        onClick={() => navigate('sessionSetup')}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition duration-300 shadow-lg mb-4"
      >
        Neue Session starten
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => navigate('dataManagement')}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-5 rounded-lg transition duration-300"
        >
          Stammdaten-Verwaltung
        </button>
        <button
          onClick={() => navigate('globalStats')}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-5 rounded-lg transition duration-300"
        >
          Karriere-Statistiken
        </button>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button onClick={handleExport} className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 px-5 rounded-lg transition duration-300 flex items-center justify-center gap-2">
            <ExportIcon /> Daten exportieren (Backup)
        </button>
        <button onClick={() => importFileInputRef.current?.click()} className="w-full bg-yellow-600 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-5 rounded-lg transition duration-300 flex items-center justify-center gap-2">
            <ImportIcon /> Daten importieren
        </button>
        <input type="file" ref={importFileInputRef} onChange={handleImportFileSelect} className="hidden" accept=".json"/>
      </div>
      <div>
        <h2 className="text-2xl font-semibold border-b-2 border-slate-700 pb-2 mb-4">Vergangene Sessions</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {sessions.length > 0 ? sessions.map(s => (
            <div key={s.id} className="item-container bg-slate-800 p-4 rounded-lg flex justify-between items-center group">
              <div className="cursor-pointer flex-grow" onClick={() => navigate('scoreboard', { sessionId: s.id })}>
                <h3 className="font-bold text-lg">{s.name}</h3>
                <p className="text-sm text-slate-400">{s.createdAt.toDate().toLocaleDateString('de-DE')}</p>
              </div>
              <button
                className="delete-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-2 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id, s.name); }}
              >
                <TrashIcon />
              </button>
            </div>
          )) : <p className="text-slate-500">Noch keine Sessions gespielt.</p>}
        </div>
      </div>
        <Modal
            isOpen={modal.isOpen}
            title={modal.title}
            onClose={closeModal}
            buttons={
                modal.onConfirm
                ? [
                    { text: 'Abbrechen', onClick: () => modal.onConfirm!(false), className: 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-6 rounded-lg' },
                    { text: 'Bestätigen', onClick: () => modal.onConfirm!(true), className: 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg', autoFocus: true },
                ]
                : [{ text: 'OK', onClick: closeModal, className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-lg', autoFocus: true }]
            }
        >
           <p>{modal.message}</p>
        </Modal>
    </>
  );
};
