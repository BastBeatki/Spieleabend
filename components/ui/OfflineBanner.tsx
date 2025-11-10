
import React from 'react';
import { WarningIcon } from './Icons';

export const OfflineBanner: React.FC = () => (
    <div className="bg-amber-500/10 border-l-4 border-amber-500 text-amber-300 p-4 rounded-md mb-6 flex items-start gap-3">
        <WarningIcon className="h-6 w-6 text-amber-400 flex-shrink-0 mt-1" />
        <div>
            <h4 className="font-bold">Offline-Modus</h4>
            <p className="text-sm">
                Keine Verbindung zur Datenbank. Die App läuft im lokalen Demo-Modus. Änderungen werden nicht gespeichert.
            </p>
        </div>
    </div>
);
