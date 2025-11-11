import React from 'react';
import { BackButton } from './BackButton';

interface HeaderProps {
    title: string;
    onBack: () => void;
    backText: string;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, backText }) => (
    <header className="mb-8 flex items-center gap-4">
        <BackButton onClick={onBack}>{backText}</BackButton>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 truncate">{title}</h2>
    </header>
);
