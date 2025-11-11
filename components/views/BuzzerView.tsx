import React, { useState, useMemo } from 'react';
import { SessionPlayer } from '../../types';
import { PlayerAvatar } from '../ui/Icons';

interface BuzzerViewProps {
  players: SessionPlayer[];
  onClose: () => void;
}

export const BuzzerView: React.FC<BuzzerViewProps> = ({ players, onClose }) => {
  const [buzzedPlayer, setBuzzedPlayer] = useState<SessionPlayer | null>(null);

  const handleBuzz = (player: SessionPlayer) => {
    if (!buzzedPlayer) {
      setBuzzedPlayer(player);
    }
  };

  const handleReset = () => {
    setBuzzedPlayer(null);
  };
  
  const TwoPlayerLayout = () => (
    <div className="flex flex-col md:flex-row gap-4 h-full">
        {players.map(player => (
            <div key={player.id} className="flex-1 h-full w-full rounded-2xl overflow-hidden">
                <button
                    onClick={() => handleBuzz(player)}
                    disabled={!!buzzedPlayer}
                    className={`relative w-full h-full flex flex-col items-center justify-center text-white font-extrabold text-4xl sm:text-5xl transition-all duration-300 ease-in-out transform border-4
                    ${buzzedPlayer && buzzedPlayer.id !== player.id ? 'opacity-30' : ''}
                    ${buzzedPlayer && buzzedPlayer.id === player.id ? 'scale-105 border-white shadow-[0_0_40px_rgba(255,255,255,0.8)]' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: player.color }}
                >
                    <PlayerAvatar avatar={player.avatar} size={80} className="mb-4" />
                    <span>{player.name}</span>
                </button>
            </div>
        ))}
    </div>
  );

  const MultiPlayerLayout = () => {
    const gridClasses = useMemo(() => {
        const count = players.length;
        if (count <= 2) return 'grid-cols-1 md:grid-cols-2'; // Fallback
        if (count === 3) return 'grid-cols-1 md:grid-cols-3';
        if (count === 4) return 'grid-cols-2';
        if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
        if (count <= 8) return 'grid-cols-2 md:grid-cols-4';
        return 'grid-cols-3 md:grid-cols-4';
    }, [players.length]);
      
    return (
        <div className={`grid gap-4 h-full ${gridClasses}`}>
            {players.map(player => (
                 <button
                    key={player.id}
                    onClick={() => handleBuzz(player)}
                    disabled={!!buzzedPlayer}
                    className={`relative flex flex-col items-center justify-center rounded-2xl text-white font-extrabold text-4xl sm:text-5xl transition-all duration-300 ease-in-out transform border-4
                    ${buzzedPlayer && buzzedPlayer.id !== player.id ? 'opacity-30' : ''}
                    ${buzzedPlayer && buzzedPlayer.id === player.id ? 'scale-105 border-white shadow-[0_0_40px_rgba(255,255,255,0.8)]' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: player.color }}
                >
                    <PlayerAvatar avatar={player.avatar} size={80} className="mb-4" />
                    <span>{player.name}</span>
                </button>
            ))}
        </div>
    );
  };


  return (
    <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col">
      <div className="flex-grow w-full h-full">
        {players.length === 2 ? <TwoPlayerLayout /> : <MultiPlayerLayout />}
      </div>

      {buzzedPlayer && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-fade-in">
          <div className="text-center">
             <PlayerAvatar avatar={buzzedPlayer.avatar} size={128} className="mb-4 border-4 border-white" />
            <h2 className="text-6xl font-black mb-8" style={{ color: buzzedPlayer.color }}>
              {buzzedPlayer.name}
            </h2>
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition"
              >
                Reset
              </button>
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition"
              >
                Buzzerrunde beenden
              </button>
            </div>
          </div>
        </div>
      )}
       {!buzzedPlayer && (
         <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg transition duration-300">
                Beenden
            </button>
        </div>
       )}
    </div>
  );
};
