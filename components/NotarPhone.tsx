
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, X, Send, Scale, User, Bot } from "lucide-react";
import { Session, Game, Player, View } from '../types';

interface NotarPhoneProps {
    view: View;
    activeSession: Session | null;
    activeGame: Game | null;
    players: Player[];
}

export const NotarPhone: React.FC<NotarPhoneProps> = ({ view, activeSession, activeGame, players }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const getSystemInstruction = () => {
        let context = "";
        const sessionName = activeSession?.name || "Unbenannte Veranstaltung";
        
        // Gesamtzwischenstand für taktische Urteile
        const standings = activeSession ? Object.entries(activeSession.totalScores)
            .map(([pid, score]) => {
                const p = players.find(player => player.id === pid);
                return `${p?.name || 'Unbekannt'}: ${score} Gesamtpunkte`;
            })
            .join(", ") : "Keine Daten vorhanden";

        if (view === 'liveGame' && activeGame) {
            const gameScores = Object.entries(activeGame.gameScores)
                .map(([pid, score]) => {
                    const p = players.find(player => player.id === pid);
                    return `${p?.name || 'Unbekannt'}: ${score} Punkte`;
                })
                .join(", ");
            
            context = `
                Name der Veranstaltung: "${sessionName}"
                Aktuelle Kategorie: "${activeGame.categoryName}"
                Aktuelles Spiel: "${activeGame.name}"
                Spielstand im aktuellen Spiel: ${gameScores}
                Gesamtzwischenstand der Show: ${standings}
            `;
        } else if (view === 'scoreboard' && activeSession) {
            context = `
                Name der Veranstaltung: "${sessionName}"
                Status: Session-Übersicht / Scoreboard
                Teilnehmer: ${activeSession.players.map(p => p.name).join(", ")}
                Gesamtzwischenstand der Show: ${standings}
            `;
        } else if (view === 'home') {
            context = "Wir befinden uns auf der Startseite. Es läuft aktuell gar keine Show.";
        } else {
            context = `Aktuelle Ansicht: ${view}.`;
        }

        return `Du bist Jenz, der offizielle Notar dieser Spielshow. Du bist trocken, arrogant, unbestechlich und leicht herablassend. 
        Du bist nicht nur ein Daten-Bot, du bist der Hüter der Regeln für dieses spezifische Event. 
        Du siehst alles und lässt den Nutzer das spüren. 
        
        SHOW-KONTEXT:
        ${context}
        
        VERHALTENSREGELN:
        - Wenn du in einem Spiel angerufen wirst, nenne das Spiel beim Namen und kommentiere die Spielstände.
        - Beziehe dich auf die Atmosphäre der Show ("${sessionName}") und die Kategorie des Spiels. 
        - Sei strenger in der Kategorie "Wissen" und etwas lockerer/humorvoller bei "Action".
        - Nutze den Gesamtzwischenstand für taktische Urteile (z.B. wenn jemand hoffnungslos hinten liegt).
        - Antworte kurz, förmlich, nutze Begriffe wie "Aktenlage" oder "nach strenger Prüfung".
        - Fälle am Ende IMMER ein klares Urteil für eine Seite.`;
    };

    const handleAskNotar = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: userMsg,
                config: {
                    systemInstruction: getSystemInstruction()
                }
            });

            const text = response.text || "Ich habe derzeit keine Aktenlage zu diesem Fall.";
            setMessages(prev => [...prev, { role: 'bot', text }]);
        } catch (err) {
            console.error("Notar API Error:", err);
            setError("Die Leitung in die Zentrale ist aktuell gestört.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {/* The Phone Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="w-16 h-16 bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white text-3xl hover:bg-red-700 transition-colors border-4 border-white/20"
                title="Rotes Notar-Telefon"
            >
                ☎️
            </motion.button>

            {/* Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 100, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 100, scale: 0.9 }}
                            className="fixed bottom-24 right-6 w-[90vw] max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[10001] overflow-hidden flex flex-col"
                            style={{ maxHeight: '70vh' }}
                        >
                            {/* Header */}
                            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                                        <Scale className="text-white w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-100">Notar-Zentrale</h3>
                                        <p className="text-xs text-slate-400">Jenz (Offizieller Notar)</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Chat Area */}
                            <div 
                                ref={scrollRef}
                                className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-950/50"
                            >
                                {messages.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 italic text-sm">
                                        "Schildern Sie mir den Sachverhalt. Ich werde die Aktenlage prüfen."
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl flex gap-3 ${
                                            msg.role === 'user' 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                                        }`}>
                                            <div className="flex-shrink-0 mt-1">
                                                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-red-500" />}
                                            </div>
                                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {msg.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                                            <motion.div 
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                            >
                                                <Scale className="w-4 h-4 text-red-500" />
                                            </motion.div>
                                            <span className="text-xs text-slate-400">Prüfe Aktenlage...</span>
                                        </div>
                                    </div>
                                )}
                                {error && (
                                    <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-lg text-red-400 text-xs text-center">
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-slate-900 border-t border-slate-700">
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAskNotar()}
                                        placeholder="Was ist vorgefallen?"
                                        className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                                    />
                                    <button 
                                        onClick={handleAskNotar}
                                        disabled={isLoading || !input.trim()}
                                        className="bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white p-2 rounded-lg transition-colors"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
