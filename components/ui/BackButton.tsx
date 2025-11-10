
import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg transition duration-300"
  >
    {children}
  </button>
);