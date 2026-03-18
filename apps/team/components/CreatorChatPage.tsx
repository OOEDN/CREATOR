import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, MessageSquare, Search, ArrowLeft, Circle, Mic, MicOff, CheckCheck, Pin, PinOff, Filter, Users, Star, Clock, Bell, Mail, User, Briefcase, Hash, ChevronDown } from 'lucide-react';
import { Creator, TeamMessage } from '../../../shared/types';

interface CreatorChatPageProps {
    teamMessages: TeamMessage[];
    creators: Creator[];
    currentUser: string;
    onSendMessage: (msg: TeamMessage) => void;
    onMarkRead: (creatorId: string) => void;
}

type ThreadFilter = 'all' | 'unread' | 'pinned';

const CreatorChatPage: React.FC<CreatorChatPageProps> = ({ teamMessages, creators, currentUser, onSendMessage, onMarkRead }) => {
    const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
    const [pinnedThreads, setPinnedThreads] = useState<Set<string>>(() => {
        try { const saved = localStorage.getItem('ooedn_pinned_threads'); return saved ? new Set(JSON.parse(saved)) : new Set(); }
        catch { return new Set(); }
    });
    const [isListening, setIsListening] = useState(false);
    const [showCreatorInfo, setShowCreatorInfo] = useState(true);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Save pinned threads
    useEffect(() => {
        try { localStorage.setItem('ooedn_pinned_threads', JSON.stringify([...pinnedThreads])); } catch {}
    }, [pinnedThreads]);

    // Only creator messages (has creatorId)
    const creatorMessages = useMemo(() => teamMessages.filter(m => m.creatorId), [teamMessages]);

    // Group by creator into threads
    const threadMap = useMemo(() => {
        const map = new Map<string, { creator: Creator | undefined; messages: TeamMessage[]; lastMsg: TeamMessage; unread: number }>();
        creatorMessages.forEach(m => {
            if (!m.creatorId) return;
            const existing = map.get(m.creatorId);
            if (existing) {
                existing.messages.push(m);
                if (new Date(m.timestamp) > new Date(existing.lastMsg.timestamp)) existing.lastMsg = m;
                if (m.isCreatorMessage && !m.readByTeam) existing.unread++;
            } else {
                map.set(m.creatorId, {
                    creator: creators.find(c => c.id === m.creatorId),
                    messages: [m],
                    lastMsg: m,
                    unread: m.isCreatorMessage && !m.readByTeam ? 1 : 0
                });
            }
        });
        return map;
    }, [creatorMessages, creators]);

    // Sort threads: pinned first, then by last message time
    const threads = useMemo(() => {
        const arr = Array.from(threadMap.entries())
            .map(([id, data]) => ({ id, ...data, pinned: pinnedThreads.has(id) }))
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime();
            });
        return arr;
    }, [threadMap, pinnedThreads]);

    // Apply filters
    const filteredThreads = useMemo(() => {
        let result = threads;
        if (searchTerm) result = result.filter(t => t.creator?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.creator?.email?.toLowerCase().includes(searchTerm.toLowerCase()));
        if (threadFilter === 'unread') result = result.filter(t => t.unread > 0);
        if (threadFilter === 'pinned') result = result.filter(t => t.pinned);
        return result;
    }, [threads, searchTerm, threadFilter]);

    const selectedThread = selectedCreatorId ? threadMap.get(selectedCreatorId) : null;
    const selectedMessages = useMemo(() =>
        selectedThread ? [...selectedThread.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : []
    , [selectedThread]);

    const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

    // Scroll to bottom
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedMessages.length, selectedCreatorId]);

    // Mark as read on select
    useEffect(() => {
        if (selectedCreatorId && selectedThread && selectedThread.unread > 0) onMarkRead(selectedCreatorId);
    }, [selectedCreatorId]);

    // Focus input
    useEffect(() => { if (selectedCreatorId) inputRef.current?.focus(); }, [selectedCreatorId]);

    const handleSend = () => {
        if (!inputText.trim() || !selectedCreatorId) return;
        onSendMessage({
            id: crypto.randomUUID(),
            creatorId: selectedCreatorId,
            sender: currentUser,
            text: inputText.trim(),
            timestamp: new Date().toISOString(),
            isCreatorMessage: false,
        });
        setInputText('');
        inputRef.current?.focus();
    };

    const togglePin = (id: string) => {
        setPinnedThreads(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleVoice = useCallback(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
        const rec = new SR();
        rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
        rec.onresult = (e: any) => { const t = Array.from(e.results).slice(e.resultIndex).map((r: any) => r[0].transcript).join(''); if (t.trim()) setInputText(p => p + (p ? ' ' : '') + t); };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec; rec.start(); setIsListening(true);
    }, [isListening]);

    const formatTime = (iso: string) => {
        try {
            const d = new Date(iso), now = new Date(), diff = now.getTime() - d.getTime(), hrs = Math.floor(diff / 3600000);
            if (hrs < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (hrs < 24) return `${hrs}h ago`;
            if (hrs < 48) return 'Yesterday';
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    const getInitials = (name?: string) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

    const selectedCreator = selectedThread?.creator;

    return (
        <div className="flex h-[calc(100vh-80px)] bg-black rounded-3xl overflow-hidden border border-neutral-800">

            {/* ─── LEFT PANEL: Thread List ─── */}
            <div className={`${selectedCreatorId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] lg:w-[380px] border-r border-neutral-800 bg-ooedn-dark flex-shrink-0`}>
                {/* Header */}
                <div className="p-4 border-b border-neutral-800">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-black text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                                <MessageSquare size={16} className="text-fuchsia-400" />
                            </div>
                            Creator Chat
                        </h2>
                        {totalUnread > 0 && (
                            <span className="bg-fuchsia-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                {totalUnread}
                            </span>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search creators..."
                            className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 bg-neutral-900 rounded-lg p-0.5">
                        {([
                            { key: 'all' as ThreadFilter, label: 'All', icon: MessageSquare, count: threads.length },
                            { key: 'unread' as ThreadFilter, label: 'Unread', icon: Bell, count: threads.filter(t => t.unread > 0).length },
                            { key: 'pinned' as ThreadFilter, label: 'Pinned', icon: Pin, count: threads.filter(t => t.pinned).length },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setThreadFilter(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    threadFilter === tab.key
                                        ? 'bg-fuchsia-500 text-black shadow-md'
                                        : 'text-neutral-500 hover:text-white'
                                }`}
                            >
                                <tab.icon size={10} />
                                {tab.label}
                                {tab.count > 0 && <span className={`ml-0.5 text-[8px] ${threadFilter === tab.key ? 'text-black/60' : 'text-neutral-600'}`}>({tab.count})</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Thread List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredThreads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600 space-y-2 p-6">
                            <Users size={28} className="opacity-20" />
                            <p className="text-[11px] font-bold uppercase">
                                {threadFilter === 'unread' ? 'All caught up!' : threadFilter === 'pinned' ? 'No pinned conversations' : 'No creator conversations yet'}
                            </p>
                            <p className="text-[10px] text-neutral-700 text-center">
                                {threadFilter === 'all' ? 'Messages from creators will appear here' : 'Try changing your filter'}
                            </p>
                        </div>
                    ) : (
                        filteredThreads.map(thread => (
                            <div key={thread.id} className="relative group">
                                <button
                                    onClick={() => setSelectedCreatorId(thread.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800/40 transition-all text-left hover:bg-neutral-900/60 ${
                                        selectedCreatorId === thread.id ? 'bg-fuchsia-500/5 border-l-2 border-l-fuchsia-500' : ''
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${
                                            thread.unread > 0 ? 'bg-fuchsia-500/20 text-fuchsia-400 ring-2 ring-fuchsia-500/30' : 'bg-neutral-800 text-neutral-500'
                                        }`}>{getInitials(thread.creator?.name)}</div>
                                        {thread.unread > 0 && (
                                            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fuchsia-500 rounded-full flex items-center justify-center shadow-lg shadow-fuchsia-500/50">
                                                <span className="text-[7px] text-black font-black">{thread.unread}</span>
                                            </div>
                                        )}
                                        {thread.pinned && <Pin size={8} className="absolute -bottom-0.5 -right-0.5 text-amber-400" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={`text-xs font-bold truncate ${thread.unread > 0 ? 'text-white' : 'text-neutral-400'}`}>
                                                {thread.creator?.name || 'Unknown'}
                                            </span>
                                            <span className="text-[8px] text-neutral-600 flex-shrink-0 ml-2">
                                                {formatTime(thread.lastMsg.timestamp)}
                                            </span>
                                        </div>
                                        <p className={`text-[10px] truncate ${thread.unread > 0 ? 'text-neutral-300' : 'text-neutral-600'}`}>
                                            {!thread.lastMsg.isCreatorMessage && <span className="text-fuchsia-400/60">You: </span>}
                                            {thread.lastMsg.text}
                                        </p>
                                    </div>
                                </button>

                                {/* Pin button on hover */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); togglePin(thread.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-500 hover:text-amber-400 transition-all"
                                    title={thread.pinned ? 'Unpin' : 'Pin to top'}
                                >
                                    {thread.pinned ? <PinOff size={10} /> : <Pin size={10} />}
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Thread stats footer */}
                <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
                    <div className="flex items-center justify-between text-[9px] text-neutral-600 uppercase font-bold tracking-wider">
                        <span>{threads.length} conversations</span>
                        <span>{totalUnread} unread</span>
                    </div>
                </div>
            </div>

            {/* ─── CENTER PANEL: Conversation ─── */}
            <div className={`${selectedCreatorId ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-black min-w-0`}>
                {selectedCreatorId && selectedThread ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-800 bg-ooedn-dark/60 flex-shrink-0">
                            <button onClick={() => setSelectedCreatorId(null)} className="md:hidden p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-9 h-9 rounded-full bg-fuchsia-500/20 flex items-center justify-center font-black text-xs text-fuchsia-400">
                                {getInitials(selectedCreator?.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white truncate">{selectedCreator?.name || 'Unknown Creator'}</p>
                                <p className="text-[10px] text-neutral-500 truncate">{selectedMessages.length} messages • {selectedCreator?.email || ''}</p>
                            </div>
                            <button
                                onClick={() => setShowCreatorInfo(!showCreatorInfo)}
                                className={`hidden lg:flex p-2 rounded-lg transition-all ${showCreatorInfo ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                                title="Toggle creator info"
                            >
                                <User size={16} />
                            </button>
                        </div>

                        {/* Messages + Optional Info Sidebar */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Messages */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar">
                                    {selectedMessages.map((msg, i) => {
                                        const isCreator = msg.isCreatorMessage;
                                        const showDate = i === 0 || new Date(msg.timestamp).toDateString() !== new Date(selectedMessages[i - 1].timestamp).toDateString();
                                        return (
                                            <React.Fragment key={msg.id}>
                                                {showDate && (
                                                    <div className="flex items-center gap-3 my-3">
                                                        <div className="flex-1 h-px bg-neutral-800/50" />
                                                        <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-widest px-2">
                                                            {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <div className="flex-1 h-px bg-neutral-800/50" />
                                                    </div>
                                                )}
                                                <div className={`flex ${isCreator ? 'justify-start' : 'justify-end'}`}>
                                                    <div className="max-w-[75%]">
                                                        {isCreator && (
                                                            <span className="text-[9px] text-neutral-600 font-bold ml-1 mb-0.5 block">
                                                                {selectedCreator?.name?.split(' ')[0]}
                                                            </span>
                                                        )}
                                                        <div className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                                                            isCreator
                                                                ? 'bg-neutral-800/70 text-neutral-200 rounded-tl-sm border border-neutral-700/40'
                                                                : 'bg-fuchsia-500 text-black rounded-tr-sm font-medium'
                                                        }`}>
                                                            {msg.text}
                                                        </div>
                                                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isCreator ? '' : 'justify-end'}`}>
                                                            <span className="text-[8px] text-neutral-700">
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {!isCreator && <CheckCheck size={9} className="text-fuchsia-300" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="px-4 py-3 border-t border-neutral-800/60 bg-ooedn-dark/20 flex-shrink-0">
                                    <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-1 pl-4 focus-within:border-fuchsia-500/40 transition-colors">
                                        <input
                                            ref={inputRef}
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            placeholder={`Reply to ${selectedCreator?.name?.split(' ')[0] || 'creator'}...`}
                                            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none py-2 min-w-0"
                                        />
                                        <button type="button" onClick={toggleVoice}
                                            className={`p-2 rounded-xl transition-all flex-shrink-0 ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}>
                                            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                                        </button>
                                        <button type="submit" disabled={!inputText.trim()}
                                            className="p-2 bg-fuchsia-500 text-black rounded-xl hover:bg-fuchsia-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex-shrink-0">
                                            <Send size={15} />
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* ─── RIGHT PANEL: Creator Info Sidebar ─── */}
                            {showCreatorInfo && selectedCreator && (
                                <div className="hidden lg:flex flex-col w-[260px] border-l border-neutral-800 bg-ooedn-dark/40 overflow-y-auto custom-scrollbar flex-shrink-0">
                                    <div className="p-5 border-b border-neutral-800 text-center">
                                        <div className="w-16 h-16 rounded-full bg-fuchsia-500/20 flex items-center justify-center font-black text-xl text-fuchsia-400 mx-auto mb-3">
                                            {getInitials(selectedCreator.name)}
                                        </div>
                                        <p className="text-sm font-bold text-white">{selectedCreator.name}</p>
                                        <p className="text-[10px] text-neutral-500 mt-1">{selectedCreator.email}</p>
                                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase">
                                            <Circle size={5} fill="currentColor" /> {selectedCreator.status || 'Active'}
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Quick Stats */}
                                        <div>
                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">Quick Info</h4>
                                            <div className="space-y-2">
                                                {selectedCreator.platform && (
                                                    <div className="flex items-center gap-2 text-[11px]">
                                                        <Hash size={11} className="text-neutral-600" />
                                                        <span className="text-neutral-400">Platform:</span>
                                                        <span className="text-white font-bold">{selectedCreator.platform}</span>
                                                    </div>
                                                )}
                                                {selectedCreator.niche && (
                                                    <div className="flex items-center gap-2 text-[11px]">
                                                        <Star size={11} className="text-neutral-600" />
                                                        <span className="text-neutral-400">Niche:</span>
                                                        <span className="text-white font-bold">{selectedCreator.niche}</span>
                                                    </div>
                                                )}
                                                {selectedCreator.followers != null && (
                                                    <div className="flex items-center gap-2 text-[11px]">
                                                        <Users size={11} className="text-neutral-600" />
                                                        <span className="text-neutral-400">Followers:</span>
                                                        <span className="text-white font-bold">{selectedCreator.followers?.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Conversation Stats */}
                                        <div>
                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">Conversation</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-neutral-900 rounded-lg p-2 text-center">
                                                    <p className="text-base font-black text-white">{selectedMessages.length}</p>
                                                    <p className="text-[8px] text-neutral-600 uppercase font-bold">Messages</p>
                                                </div>
                                                <div className="bg-neutral-900 rounded-lg p-2 text-center">
                                                    <p className="text-base font-black text-white">
                                                        {selectedMessages.filter(m => m.isCreatorMessage).length}
                                                    </p>
                                                    <p className="text-[8px] text-neutral-600 uppercase font-bold">From Creator</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Activity */}
                                        <div>
                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">Activity</h4>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px]">
                                                    <Clock size={10} className="text-neutral-600" />
                                                    <span className="text-neutral-500">First msg:</span>
                                                    <span className="text-neutral-400">{selectedMessages[0] ? formatTime(selectedMessages[0].timestamp) : '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px]">
                                                    <Clock size={10} className="text-neutral-600" />
                                                    <span className="text-neutral-500">Last msg:</span>
                                                    <span className="text-neutral-400">{selectedMessages.length > 0 ? formatTime(selectedMessages[selectedMessages.length - 1].timestamp) : '—'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pin */}
                                        <button
                                            onClick={() => togglePin(selectedCreatorId!)}
                                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                pinnedThreads.has(selectedCreatorId!)
                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-amber-500/30 hover:text-amber-400'
                                            }`}
                                        >
                                            {pinnedThreads.has(selectedCreatorId!) ? <><PinOff size={12} /> Unpin</> : <><Pin size={12} /> Pin Conversation</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 space-y-4">
                        <div className="w-24 h-24 rounded-3xl bg-neutral-900/50 flex items-center justify-center border border-neutral-800/50">
                            <MessageSquare size={36} className="opacity-20" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-bold text-neutral-500">Select a conversation</p>
                            <p className="text-[11px] text-neutral-700 max-w-[240px]">
                                Choose a creator from the list to view and respond to their messages
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-[9px] text-neutral-700 uppercase font-bold">
                            <span className="flex items-center gap-1"><MessageSquare size={9} /> {threads.length} threads</span>
                            <span className="flex items-center gap-1"><Bell size={9} /> {totalUnread} unread</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatorChatPage;
