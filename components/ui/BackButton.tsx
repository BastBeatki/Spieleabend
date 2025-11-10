
import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
  >
    {children}
  </button>
);
