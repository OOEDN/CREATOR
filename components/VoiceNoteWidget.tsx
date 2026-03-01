import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Square, Volume2 } from 'lucide-react';

interface VoiceNote {
    id: string;
    audioBase64: string;
    duration: number; // seconds
    createdAt: string;
    label?: string;
}

const STORAGE_KEY = 'ooedn_voice_notes';

const VoiceNoteWidget: React.FC = () => {
    const [notes, setNotes] = useState<VoiceNote[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [playProgress, setPlayProgress] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // Load from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setNotes(JSON.parse(stored));
        } catch (e) { console.warn('[VoiceNotes] Load failed:', e); }
    }, []);

    // Save to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        } catch (e) { console.warn('[VoiceNotes] Save failed:', e); }
    }, [notes]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    const note: VoiceNote = {
                        id: crypto.randomUUID(),
                        audioBase64: base64,
                        duration: recordingTime,
                        createdAt: new Date().toISOString(),
                    };
                    setNotes(prev => [note, ...prev]);
                    setRecordingTime(0);
                };
                reader.readAsDataURL(blob);
            };

            mediaRecorder.start(250); // Collect data every 250ms
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (e) {
            console.warn('[VoiceNotes] Mic access denied:', e);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);
    };

    const playNote = (note: VoiceNote) => {
        // Stop any current playback
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        if (playingId === note.id) {
            setPlayingId(null);
            setPlayProgress(0);
            return;
        }

        const audio = new Audio(note.audioBase64);
        audioRef.current = audio;
        setPlayingId(note.id);

        const updateProgress = () => {
            if (audio.duration && isFinite(audio.duration)) {
                setPlayProgress((audio.currentTime / audio.duration) * 100);
            }
            if (!audio.paused) {
                animFrameRef.current = requestAnimationFrame(updateProgress);
            }
        };

        audio.onended = () => {
            setPlayingId(null);
            setPlayProgress(0);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };

        audio.play().then(() => {
            animFrameRef.current = requestAnimationFrame(updateProgress);
        }).catch(e => console.warn('[VoiceNotes] Playback error:', e));
    };

    const deleteNote = (id: string) => {
        if (playingId === id) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            setPlayingId(null);
            setPlayProgress(0);
        }
        setNotes(prev => prev.filter(n => n.id !== id));
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    try {
        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Volume2 size={16} className="text-cyan-400" /> Calm Center
                    </h3>
                    <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">
                        {notes.length} note{notes.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Recording Control */}
                <div className="mb-4">
                    {isRecording ? (
                        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
                            <button
                                onClick={stopRecording}
                                className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center hover:bg-red-400 transition-all shadow-lg shadow-red-500/30 active:scale-95"
                            >
                                <Square size={16} className="text-white fill-white" />
                            </button>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-red-400">Recording...</p>
                                <p className="text-[10px] text-red-300/70 font-mono">{formatTime(recordingTime)}</p>
                            </div>
                            <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 bg-red-500 rounded-full"
                                        style={{
                                            height: `${8 + Math.random() * 16}px`,
                                            animation: `pulse ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={startRecording}
                            className="w-full flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 rounded-xl hover:border-cyan-500/40 transition-all group active:scale-[0.98]"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
                                <Mic size={18} className="text-white" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold text-white">Record Voice Note</p>
                                <p className="text-[9px] text-neutral-500">Tap to start recording</p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Voice Notes List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {notes.length === 0 && !isRecording && (
                        <div className="text-center py-6 text-neutral-700">
                            <Mic size={24} className="mx-auto mb-2 opacity-30" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No voice notes yet</p>
                            <p className="text-[9px] text-neutral-600 mt-1">Record your thoughts, reminders, and ideas</p>
                        </div>
                    )}
                    {notes.map(note => {
                        const isPlaying = playingId === note.id;
                        return (
                            <div
                                key={note.id}
                                className={`rounded-xl p-3 border flex items-center gap-3 group transition-all ${isPlaying
                                        ? 'bg-cyan-500/10 border-cyan-500/30'
                                        : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                                    }`}
                            >
                                {/* Play/Pause Button */}
                                <button
                                    onClick={() => playNote(note)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isPlaying
                                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                            : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                        }`}
                                >
                                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                </button>

                                {/* Waveform / Progress */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                        {[...Array(20)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-1 rounded-full transition-all duration-150 ${isPlaying && (i / 20) * 100 <= playProgress
                                                        ? 'bg-cyan-400'
                                                        : 'bg-neutral-700'
                                                    }`}
                                                style={{
                                                    height: `${4 + (Math.sin(i * 0.8 + (note.id.charCodeAt(0) || 0)) * 0.5 + 0.5) * 12}px`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-neutral-500 font-mono">
                                            {formatTime(note.duration)}
                                        </span>
                                        <span className="text-[8px] text-neutral-600 font-bold">
                                            {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-all flex-shrink-0"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    } catch (e) {
        console.warn('[VoiceNotes] Render error (non-blocking):', e);
        return null;
    }
};

export default VoiceNoteWidget;
