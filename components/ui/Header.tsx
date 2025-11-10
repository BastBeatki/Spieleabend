
import React from 'react';
import { BackButton } from './BackButton';

interface HeaderProps {
    title: string;
    onBack: () => void;
    backText: string;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, backText }) => (
    <header className="mb-8 flex justify-between items-center">
        <h2 className="text-4xl font-extrabold text-slate-100 truncate pr-4">{title}</h2>
        <BackButton onClick={onBack}>{backText}</BackButton>
    </header>
);