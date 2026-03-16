import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Loader2, Sparkles, Database, MessageSquare, Mic, MicOff, Brain, Paperclip, Image as ImageIcon, Film } from 'lucide-react';
import { Creator, Campaign, ContentItem, TeamMessage, TeamTask, BetaTest, BetaRelease } from '../types';
import { auraChat, getAuraGreeting } from '../services/aura/auraCore';
import { restoreSessionFromSTM, getSessionConversation, clearSessionConversation, addToSessionConversation } from '../services/aura/auraMemory';

interface GlobalChatProps {
    appState: {
        creators: Creator[];
        campaigns: Campaign[];
        content: ContentItem[];
        teamTasks?: TeamTask[];
        teamMessages?: TeamMessage[];
        betaTests?: BetaTest[];
        betaReleases?: BetaRelease[];
    };
    creators: Creator[];
    campaigns: Campaign[];
    content: ContentItem[];
    teamMessages?: TeamMessage[];
    teamTasks?: TeamTask[];
    betaTests?: BetaTest[];
    betaReleases?: BetaRelease[];
    onSendTeamMessage?: (msg: TeamMessage) => void;
    currentUser?: string;
    brandInfo?: string;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    mediaPreview?: string; // data URL for display
    mediaType?: 'image' | 'video';
}

const GlobalChat: React.FC<GlobalChatProps> = ({ appState, teamMessages = [], onSendTeamMessage, currentUser = 'Anonymous', brandInfo }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'ai' | 'team'>('ai');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [attachedMedia, setAttachedMedia] = useState<{ dataUrl: string; base64: string; mimeType: string; type: 'image' | 'video' } | null>(null);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const teamEndRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    // Close on click outside panel
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        // Delay to avoid catching the open-click itself
        const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
    }, [isOpen]);

    // Listen for 'coco-open' events from other components (e.g., CampaignBoard "Ask Coco" button)
    useEffect(() => {
        const handleCocoOpen = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setIsOpen(true);
            setMode('ai');
            if (detail?.context) {
                // Add context as a user message and trigger a response
                const ctxMsg: Message = { id: crypto.randomUUID(), role: 'user', text: detail.context };
                setMessages(prev => [...prev, ctxMsg]);
                // Auto-send to Coco
                (async () => {
                    setIsLoading(true);
                    try {
                        const responseText = await auraChat(detail.context, appState, brandInfo, currentUser);
                        const aiMsg: Message = { id: crypto.randomUUID(), role: 'model', text: responseText || "I'm ready to help with this campaign!" };
                        setMessages(prev => [...prev, aiMsg]);
                    } catch {
                        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Something went wrong. Try again in a sec." }]);
                    } finally {
                        setIsLoading(false);
                    }
                })();
            }
        };
        window.addEventListener('coco-open', handleCocoOpen);
        return () => window.removeEventListener('coco-open', handleCocoOpen);
    }, [appState, brandInfo, currentUser]);

    // Initialize Coco with greeting and restore memory
    useEffect(() => {
        if (!initialized) {
            restoreSessionFromSTM();
            const savedConvo = getSessionConversation();
            if (savedConvo.length > 0) {
                // Restore previous conversation
                const restored: Message[] = savedConvo.map((turn, i) => ({
                    id: `restored-${i}`,
                    role: turn.role,
                    text: turn.text,
                }));
                setMessages(restored);
            } else {
                // Fresh greeting
                const greeting = getAuraGreeting(currentUser);
                setMessages([{ id: 'init', role: 'model', text: greeting }]);
            }
            setInitialized(true);
        }
    }, [initialized, currentUser]);

    const toggleVoice = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
            const transcript = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join('');
            if (transcript.trim()) setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [isListening]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        teamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, mode, teamMessages]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        if (mode === 'team' && onSendTeamMessage) {
            const newMsg: TeamMessage = {
                id: crypto.randomUUID(),
                sender: currentUser,
                text: inputText,
                timestamp: new Date().toISOString()
            };
            onSendTeamMessage(newMsg);
            setInputText('');
            return;
        }

        if (isLoading) return;

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: inputText, mediaPreview: attachedMedia?.dataUrl, mediaType: attachedMedia?.type };
        const mediaParts = attachedMedia ? [{ mimeType: attachedMedia.mimeType, data: attachedMedia.base64 }] : undefined;
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setAttachedMedia(null);
        setIsLoading(true);

        try {
            const responseText = await auraChat(userMsg.text || (attachedMedia?.type === 'video' ? 'What is happening in this video?' : 'What do you see in this image?'), appState, brandInfo, currentUser, mediaParts);
            const aiMsg: Message = { id: crypto.randomUUID(), role: 'model', text: responseText || "I couldn't process that." };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Something went wrong on my end. Try again in a sec." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        clearSessionConversation();
        setAttachedMedia(null);
        const greeting = getAuraGreeting(currentUser);
        setMessages([{ id: 'fresh', role: 'model', text: greeting }]);
    };

    const handleMediaAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) return;
        const maxSize = isVideo ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) { alert(`File must be under ${isVideo ? '20' : '10'}MB`); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            setAttachedMedia({ dataUrl, base64, mimeType: file.type, type: isVideo ? 'video' : 'image' });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-[100] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black p-4 rounded-full shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105 flex items-center gap-2 font-bold group"
                >
                    <Brain size={24} className="group-hover:animate-pulse" />
                    <span className="hidden md:inline">Coco</span>
                </button>
            )}

            {isOpen && (
                <div ref={panelRef} className="fixed bottom-6 right-6 z-[100] w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-ooedn-dark border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in">

                    {/* Header with Toggles */}
                    <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-emerald-500/20 flex justify-between items-center">
                        <div className="flex gap-2 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                            <button onClick={() => setMode('ai')} className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${mode === 'ai' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow' : 'text-neutral-500 hover:text-white'}`}>
                                <Brain size={12} /> Coco
                            </button>
                            <button onClick={() => setMode('team')} className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${mode === 'team' ? 'bg-blue-500 text-white shadow' : 'text-neutral-500 hover:text-white'}`}>
                                <MessageSquare size={12} /> Team
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            {mode === 'ai' && (
                                <button
                                    onClick={handleClearChat}
                                    className="text-neutral-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-neutral-800 transition-all"
                                    title="Clear conversation"
                                >
                                    <Sparkles size={14} />
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-all cursor-pointer"
                                title="Close Coco (Esc)"
                                aria-label="Close Coco panel"
                            >
                                <X size={22} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 custom-scrollbar">
                        {mode === 'ai' ? (
                            <>
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'model' && (
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                                                <Brain size={12} className="text-emerald-400" />
                                            </div>
                                        )}
                                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-emerald-600 text-white rounded-tr-sm'
                                            : 'bg-neutral-800 text-neutral-200 rounded-tl-sm border border-neutral-700'
                                            }`}>
                                            {msg.mediaPreview && msg.mediaType === 'video' && (
                                                <video src={msg.mediaPreview} controls className="max-w-full max-h-40 rounded-lg mb-2 border border-white/20" />
                                            )}
                                            {msg.mediaPreview && msg.mediaType !== 'video' && (
                                                <img src={msg.mediaPreview} alt="Attached" className="max-w-full max-h-40 rounded-lg mb-2 border border-white/20" />
                                            )}
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mr-2 flex-shrink-0">
                                            <Brain size={12} className="text-emerald-400 animate-pulse" />
                                        </div>
                                        <div className="bg-neutral-800 rounded-2xl p-3 flex items-center gap-2 text-neutral-400 text-xs">
                                            <Loader2 size={14} className="animate-spin" /> Coco is thinking...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        ) : (
                            <>
                                {teamMessages.length === 0 && <p className="text-center text-neutral-500 text-xs mt-10">No messages yet. Start chatting!</p>}
                                {teamMessages.map(msg => (
                                    <div key={msg.id} className={`flex flex-col ${msg.sender === currentUser ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[9px] text-neutral-500 font-bold uppercase mb-1 ml-1">{msg.sender}</span>
                                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.sender === currentUser
                                            ? 'bg-blue-600 text-white rounded-tr-sm'
                                            : 'bg-neutral-800 text-neutral-200 rounded-tl-sm border border-neutral-700'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={teamEndRef} />
                            </>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-neutral-900 border-t border-neutral-800">
                        {/* Media preview */}
                        {attachedMedia && mode === 'ai' && (
                            <div className="mb-2 flex items-center gap-2 bg-neutral-800 rounded-lg p-2 border border-emerald-500/30">
                                {attachedMedia.type === 'video' ? (
                                    <div className="w-12 h-12 rounded-md bg-neutral-700 flex items-center justify-center"><Film size={20} className="text-emerald-400" /></div>
                                ) : (
                                    <img src={attachedMedia.dataUrl} alt="Attached" className="w-12 h-12 object-cover rounded-md" />
                                )}
                                <span className="text-xs text-neutral-400 flex-1 truncate">{attachedMedia.type === 'video' ? 'Video' : 'Image'} attached</span>
                                <button onClick={() => setAttachedMedia(null)} className="text-neutral-500 hover:text-red-400 p-1"><X size={14} /></button>
                            </div>
                        )}
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex items-center gap-2 bg-black border border-neutral-700 rounded-full p-1 pl-4 focus-within:border-emerald-500 transition-colors"
                        >
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={mode === 'ai' ? (attachedMedia ? `Ask about this ${attachedMedia.type}...` : 'Ask Coco anything...') : 'Message team...'}
                                className="flex-1 bg-transparent text-sm text-white focus:outline-none py-2"
                            />
                            {mode === 'ai' && (
                                <>
                                    <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaAttach} className="hidden" />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`p-2 rounded-full transition-all ${attachedMedia ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'}`}
                                        title="Attach image or video"
                                    >
                                        <Paperclip size={16} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={toggleVoice}
                                className={`p-2 rounded-full transition-all ${isListening ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-neutral-500 hover:text-white'}`}
                                title={isListening ? 'Stop listening' : 'Voice input'}
                            >
                                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                            <button
                                type="submit"
                                disabled={(!inputText.trim() && !attachedMedia) || (mode === 'ai' && isLoading)}
                                className={`p-2 rounded-full text-black transition-colors ${mode === 'ai' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400' : 'bg-blue-500 hover:bg-blue-400'} disabled:opacity-50`}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalChat;