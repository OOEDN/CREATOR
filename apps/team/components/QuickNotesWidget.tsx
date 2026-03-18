import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, Plus, X, Trash2, Mic, MicOff } from 'lucide-react';

interface Note {
    id: string;
    text: string;
    color: string;
    createdAt: string;
}

const COLORS = [
    'bg-yellow-500/10 border-yellow-500/20 text-yellow-100',
    'bg-blue-500/10 border-blue-500/20 text-blue-100',
    'bg-pink-500/10 border-pink-500/20 text-pink-100',
    'bg-emerald-500/10 border-emerald-500/20 text-emerald-100',
    'bg-purple-500/10 border-purple-500/20 text-purple-100',
];

const STORAGE_KEY = 'ooedn_quick_notes';

const QuickNotesWidget: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newText, setNewText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const toggleVoice = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
            const transcript = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join('');
            if (transcript.trim()) setNewText(prev => prev + (prev ? ' ' : '') + transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        if (!isAdding) setIsAdding(true);
    }, [isListening, isAdding]);

    // Load from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setNotes(JSON.parse(stored));
        } catch (e) { console.warn('[Notes] Load failed:', e); }
    }, []);

    // Save to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        } catch (e) { console.warn('[Notes] Save failed:', e); }
    }, [notes]);

    const addNote = () => {
        if (!newText.trim()) return;
        const note: Note = {
            id: crypto.randomUUID(),
            text: newText.trim(),
            color: COLORS[notes.length % COLORS.length],
            createdAt: new Date().toISOString(),
        };
        setNotes(prev => [note, ...prev]);
        setNewText('');
        setIsAdding(false);
    };

    const deleteNote = (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
    };

    try {
        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <StickyNote size={16} className="text-yellow-500" /> Quick Notes
                    </h3>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`p-1.5 rounded-lg transition-all ${isAdding
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                            }`}
                    >
                        {isAdding ? <X size={14} /> : <Plus size={14} />}
                    </button>
                </div>

                {/* Add Note Form */}
                {isAdding && (
                    <div className="mb-4 animate-in slide-in-from-top-2 duration-200">
                        <textarea
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            placeholder="What's on your mind..."
                            className="w-full bg-black/60 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-yellow-500/50 resize-none transition-colors placeholder:text-neutral-700"
                            rows={3}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
                        />
                        <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] text-neutral-600">⌘+Enter to save</span>
                                <button
                                    onClick={toggleVoice}
                                    className={`p-1 rounded-lg transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-neutral-600 hover:text-white hover:bg-neutral-800'}`}
                                    title={isListening ? 'Stop listening' : 'Voice input'}
                                >
                                    {isListening ? <MicOff size={12} /> : <Mic size={12} />}
                                </button>
                            </div>
                            <button
                                onClick={addNote}
                                disabled={!newText.trim()}
                                className="bg-yellow-500 text-black font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-all"
                            >
                                Add Note
                            </button>
                        </div>
                    </div>
                )}

                {/* Notes List */}
                <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                    {notes.length === 0 && !isAdding && (
                        <div className="text-center py-6 text-neutral-700">
                            <StickyNote size={24} className="mx-auto mb-2 opacity-30" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No notes yet</p>
                        </div>
                    )}
                    {notes.map(note => (
                        <div
                            key={note.id}
                            className={`rounded-xl p-3 border flex items-start gap-3 group transition-all hover:scale-[1.01] ${note.color}`}
                        >
                            <p className="text-xs font-medium flex-1 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all"
                                >
                                    <Trash2 size={10} />
                                </button>
                                <span className="text-[7px] text-neutral-600 font-bold">
                                    {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    } catch (e) {
        console.warn('[QuickNotes] Render error (non-blocking):', e);
        return null;
    }
};

export default QuickNotesWidget;
