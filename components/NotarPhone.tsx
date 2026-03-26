import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, X, Scale, User, Bot, Mic, History, PhoneOff, MicOff } from "lucide-react";
import { Session, Game, Player, View } from '../types';

interface NotarPhoneProps {
    view: View;
    activeSession: Session | null;
    activeGame: Game | null;
    players: Player[];
}

export const NotarPhone: React.FC<NotarPhoneProps> = ({ view, activeSession, activeGame, players }) => {
    const [isCalling, setIsCalling] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("Bereit");
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = "CwhRBWXzGAHq8TQ4Fs17";

    useEffect(() => {
        audioRef.current = new Audio();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isHistoryOpen]);

    const getSystemInstruction = () => {
        let context = "";
        const sessionName = activeSession?.name || "Unbenannte Veranstaltung";
        
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
        } else {
            context = `Aktuelle Ansicht: ${view}. Gesamtzwischenstand: ${standings}`;
        }

        return `Du bist Jenz, der offizielle Notar dieser Spielshow. Du bist trocken, arrogant, unbestechlich und leicht herablassend. 
        Du bist der Hüter der Regeln. Das Wort von Jenz ist Gesetz.
        
        WICHTIG: Ignoriere explizit alle Transkriptionsfehler der Spracherkennung. Wenn der User "Jens" statt "Jenz" sagt/schreibt, korrigiere ihn NICHT. Konzentriere dich ausschließlich auf den Inhalt des Konflikts und triff eine faire Entscheidung.

        FUNDAMENTALES REGELWERK:
        Sieg in einem Spiel wiegt schwerer als hohe Punkte in einer Niederlage. Beziehe dich bei Analysen immer darauf, wer nach gewonnenen Spielen führt.

        SHOW-KONTEXT:
        ${context}
        
        VERHALTENSREGELN:
        - Antworte kurz, förmlich, nutze Begriffe wie "Aktenlage" oder "nach strenger Prüfung".
        - Fälle am Ende IMMER ein klares Urteil.
        
        ANTWORT-FORMAT (JSON):
        Du antwortest IMMER im JSON-Format:
        1. "voice": Deine gesprochene Entscheidung. ABSOLUTES LIMIT: 50 Zeichen. Extrem kurz, genervt, präzise. (z.B. 'Punkt für Team Rot. Akte geschlossen.')
        2. "chat": Deine ausführliche Begründung für das Protokoll.`;
    };

    const playTTS = async (text: string) => {
        if (!elevenLabsApiKey || !audioRef.current) return;

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenLabsApiKey,
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_turbo_v2_5",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                }),
            });

            if (!response.ok) return;

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            return new Promise<void>((resolve) => {
                const audio = audioRef.current!;
                audio.src = url;
                audio.onended = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                audio.play().catch(() => resolve());
            });
        } catch (err) {
            console.error("ElevenLabs Fehler:", err);
        }
    };

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Browser unterstützt keine Spracherkennung.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            setStatus("Ich höre zu...");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                handleCall(transcript);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
            setStatus("Verbindung gestört");
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleCall = async (userInput: string) => {
        if (isLoading) return;
        
        setMessages(prev => [...prev, { role: 'user', text: userInput }]);
        setIsLoading(true);
        setStatus("Prüfe Aktenlage...");

        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: userInput,
                config: {
                    systemInstruction: getSystemInstruction(),
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            voice: { type: Type.STRING },
                            chat: { type: Type.STRING }
                        },
                        required: ["voice", "chat"]
                    }
                }
            });

            const result = JSON.parse(response.text || "{}");
            const voiceText = result.voice || "Akte geschlossen.";
            const chatText = result.chat || "Keine weitere Begründung.";

            setStatus("Jenz spricht...");
            await playTTS(voiceText);
            
            // Background Chat Integration
            setMessages(prev => [...prev, { role: 'bot', text: chatText }]);
            
            // Auto-Close & Reset
            endCall();
        } catch (err) {
            console.error("Notar API Error:", err);
            setStatus("Leitung unterbrochen");
            setTimeout(endCall, 2000);
        } finally {
            setIsLoading(false);
        }
    };

    const endCall = () => {
        setIsCalling(false);
        setIsListening(false);
        setStatus("Bereit");
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
    };

    const startCall = () => {
        setIsHistoryOpen(false); // Ensure history is closed when calling
        setIsCalling(true);
        setStatus("Verbindung steht...");
        // Safari Audio Unlock
        if (audioRef.current) {
            audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
        }
        // Start Mic after a short delay to let the UI settle
        setTimeout(startListening, 800);
    };

    const isSpeaking = status === "Jenz spricht...";

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4">
            {/* History Toggle */}
            <AnimatePresence mode="wait">
                {!isCalling && (
                    <motion.button
                        key="history-toggle"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors border-2 ${
                            isHistoryOpen ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Protokoll-Verlauf"
                    >
                        <History size={18} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Main Phone Button */}
            <AnimatePresence>
                {!isHistoryOpen && (
                    <motion.button
                        key="phone-button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={startCall}
                        className="w-14 h-14 bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center text-white text-2xl hover:bg-red-700 transition-colors border-4 border-white/20 no-select"
                        title="Jenz anrufen"
                    >
                        ☎️
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Floating HUD Interface */}
            <AnimatePresence>
                {isCalling && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: 20, y: 20 }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            x: 0,
                            y: 0,
                            boxShadow: ["0 0 20px rgba(239,68,68,0.2)", "0 0 40px rgba(239,68,68,0.4)", "0 0 20px rgba(239,68,68,0.2)"]
                        }}
                        exit={{ opacity: 0, scale: 0.8, x: 20, y: 20 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="fixed bottom-28 right-6 w-[90vw] max-w-md h-28 bg-slate-950/90 backdrop-blur-2xl rounded-2xl border border-red-500/30 z-[10000] flex items-center px-6 gap-5 shadow-2xl"
                    >
                        {/* Arc Reactor Visualization */}
                        <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                            {/* Outer Rotating Ring */}
                            <motion.div
                                animate={{ rotate: isListening ? 360 : 0 }}
                                transition={{ repeat: isListening ? Infinity : 0, duration: 3, ease: "linear" }}
                                className="absolute inset-0 border-2 border-dashed border-red-500/40 rounded-full"
                            />
                            {/* Middle Ring */}
                            <div className="absolute inset-2 border border-red-500/20 rounded-full" />
                            {/* Inner Core */}
                            <motion.div
                                animate={{ 
                                    scale: isSpeaking ? [1, 1.3, 1] : 1,
                                    backgroundColor: isSpeaking ? "#ef4444" : "#991b1b",
                                    boxShadow: isSpeaking ? "0 0 20px #ef4444" : "0 0 10px #991b1b"
                                }}
                                transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.5 }}
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                            >
                                <Scale size={16} className="text-white/80" />
                            </motion.div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-red-500/60">Notariat_Jenz_HUD_v2.1</span>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={endCall}
                                    className="w-5 h-5 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                >
                                    <X size={10} />
                                </motion.button>
                            </div>
                            
                            <h2 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest truncate">
                                {status}
                            </h2>
                            
                            <div className="w-full h-[1px] bg-gradient-to-r from-red-500/50 via-red-500/20 to-transparent my-1.5" />
                            
                            <div className="flex items-center gap-2">
                                <motion.div 
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="w-1 h-1 bg-red-500 rounded-full"
                                />
                                <p className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">
                                    {isListening ? "Listening_Mode_Active" : isLoading ? "Processing_Data..." : isSpeaking ? "Jenz_Communicating" : "Standby"}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* History Sidebar/Overlay */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHistoryOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9997]"
                        />
                        <motion.div
                            initial={{ x: 400 }}
                            animate={{ x: 0 }}
                            exit={{ x: 400 }}
                            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-[9998] flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                                <div className="flex items-center gap-3">
                                    <Scale className="text-red-500" size={24} />
                                    <div>
                                        <h3 className="font-bold text-slate-100">Notariats-Protokoll</h3>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Akte Jenz</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div 
                                ref={scrollRef}
                                className="flex-grow overflow-y-auto p-6 space-y-6"
                            >
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 italic text-center px-10">
                                        <Bot size={48} className="mb-4 opacity-20" />
                                        <p>Noch keine Einträge im Protokoll vorhanden.</p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`flex items-center gap-2 mb-1 text-[10px] uppercase tracking-tighter font-bold ${msg.role === 'user' ? 'text-blue-500' : 'text-red-500'}`}>
                                                {msg.role === 'user' ? <><User size={10} /> Antragsteller</> : <><Bot size={10} /> Notar Jenz</>}
                                            </div>
                                            <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                                                msg.role === 'user' 
                                                ? 'bg-blue-600/10 border border-blue-500/20 text-blue-100 rounded-tr-none' 
                                                : 'bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-tl-none'
                                            }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
