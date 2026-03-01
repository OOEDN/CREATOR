import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, Send, Search, ArrowLeft, Users, Loader2, RefreshCw, ChevronRight, Circle, X, Plus, Check, Clock, MessageSquare, Zap, Sparkles, Mic, MicOff, SpellCheck, Trash2, Archive, Brain } from 'lucide-react';
import { Creator, AppSettings } from '../types';
import {
    sendEmail, sendBulkEmail, getThreadsForContact,
    getThread, getInboxSummary, searchEmails,
    markThreadAsRead, trashThread, archiveThread,
    EmailThread, EmailMessage
} from '../services/gmailService';
import { polishEmailDraft, checkSpellingGrammar } from '../services/geminiService';
import { auraDraftEmail } from '../services/aura/auraCore';

const TEAM_EMAIL = 'create@ooedn.com';

// ── Voice-to-Text Hook ──
const useSpeechToText = (onResult: (text: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const toggle = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Speech recognition not supported in this browser.'); return; }

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
            if (transcript.trim()) onResult(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [isListening, onResult]);

    return { isListening, toggle };
};

interface CreatorInboxProps {
    creators: Creator[];
    appSettings: AppSettings;
    userEmail: string | null;
}

type InboxView = 'inbox' | 'thread' | 'compose' | 'bulk';

const CreatorInbox: React.FC<CreatorInboxProps> = ({ creators, appSettings, userEmail }) => {
    const [inboxView, setInboxView] = useState<InboxView>('inbox');
    const [threads, setThreads] = useState<EmailThread[]>([]);
    const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Compose state
    const [composeTo, setComposeTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<string | null>(null);

    // Reply state
    const [replyBody, setReplyBody] = useState('');

    // Bulk state
    const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
    const [bulkSubject, setBulkSubject] = useState('');
    const [bulkBody, setBulkBody] = useState('');
    const [bulkProgress, setBulkProgress] = useState<string | null>(null);

    // AI Editor state
    const [isPolishing, setIsPolishing] = useState(false);
    const [spellResults, setSpellResults] = useState<{ original: string; corrected: string; reason: string }[] | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isAuraDrafting, setIsAuraDrafting] = useState(false);

    // Creator filter for inbox
    const [filterCreator, setFilterCreator] = useState<string>('');

    const token = appSettings.googleCloudToken;
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    // Voice-to-text for compose
    const composeMic = useSpeechToText(useCallback((text: string) => {
        setComposeBody(prev => prev + (prev ? ' ' : '') + text);
    }, []));
    // Voice-to-text for reply
    const replyMic = useSpeechToText(useCallback((text: string) => {
        setReplyBody(prev => prev + (prev ? ' ' : '') + text);
    }, []));
    // Voice-to-text for bulk
    const bulkMic = useSpeechToText(useCallback((text: string) => {
        setBulkBody(prev => prev + (prev ? ' ' : '') + text);
    }, []));

    // AI Email helpers
    const handlePolish = async (body: string, setter: (v: string) => void) => {
        if (!body.trim()) return;
        setIsPolishing(true);
        setSpellResults(null);
        try {
            const result = await polishEmailDraft(body, appSettings.brandInfo);
            if (result) setter(result);
        } catch (e) { console.warn('[AI] Polish failed:', e); }
        setIsPolishing(false);
    };

    const handleSpellCheck = async (body: string) => {
        if (!body.trim()) return;
        setIsChecking(true);
        setSpellResults(null);
        try {
            const results = await checkSpellingGrammar(body);
            setSpellResults(results);
        } catch (e) { console.warn('[AI] Spell check failed:', e); }
        setIsChecking(false);
    };

    // Coco Voice Email Draft — speak intent, get structured email
    const handleAuraDraft = async () => {
        const input = composeBody.trim();
        if (!input) return;
        setIsAuraDrafting(true);
        try {
            const draft = await auraDraftEmail(input, creators, appSettings.brandInfo);
            if (draft) {
                if (draft.to) setComposeTo(draft.to);
                if (draft.subject) setComposeSubject(draft.subject);
                if (draft.body) setComposeBody(draft.body);
            } else {
                // Fallback: just polish what's there
                const result = await polishEmailDraft(input, appSettings.brandInfo);
                if (result) setComposeBody(result);
            }
        } catch (e) { console.warn('[Coco] Draft failed:', e); }
        setIsAuraDrafting(false);
    };

    const creatorsWithEmail = creators.filter(c => c.email && c.email.trim() !== '');

    // Load inbox on mount
    useEffect(() => {
        if (token && userEmail) {
            loadInbox();
        }
        // Check for compose prefill (from campaign Email Brief)
        const prefill = sessionStorage.getItem('compose_prefill');
        if (prefill) {
            try {
                const { to, subject, body } = JSON.parse(prefill);
                setComposeTo(to || '');
                setComposeSubject(subject || '');
                setComposeBody(body || '');
                setInboxView('compose');
                sessionStorage.removeItem('compose_prefill');
            } catch (e) { sessionStorage.removeItem('compose_prefill'); }
        }
    }, [token, userEmail]);

    const loadInbox = async () => {
        if (!token || !userEmail) return;
        setIsLoading(true);
        setError(null);
        try {
            if (filterCreator) {
                const creator = creators.find(c => c.id === filterCreator);
                if (creator?.email) {
                    const result = await getThreadsForContact(token, creator.email, TEAM_EMAIL);
                    setThreads(result);
                }
            } else {
                const result = await getInboxSummary(token, TEAM_EMAIL);
                setThreads(result);
            }
        } catch (e: any) {
            console.error('[Inbox] Load failed:', e);
            setError(e.message || 'Failed to load inbox');
        }
        setIsLoading(false);
    };

    const handleSearch = async () => {
        if (!token || !userEmail || !searchTerm.trim()) return;
        setIsLoading(true);
        try {
            const result = await searchEmails(token, searchTerm, TEAM_EMAIL);
            setThreads(result);
        } catch (e: any) {
            setError(e.message);
        }
        setIsLoading(false);
    };

    const openThread = async (thread: EmailThread) => {
        if (!token || !userEmail) return;
        setIsLoading(true);
        try {
            const full = await getThread(token, thread.id, TEAM_EMAIL);
            if (full) {
                setSelectedThread(full);
                setInboxView('thread');
                // Auto mark-as-read in Gmail and update local state
                if (thread.unread) {
                    markThreadAsRead(token, thread.id).then(ok => {
                        if (ok) {
                            setThreads(prev => prev.map(t =>
                                t.id === thread.id ? { ...t, unread: false } : t
                            ));
                        }
                    });
                }
            }
        } catch (e: any) {
            setError(e.message);
        }
        setIsLoading(false);
    };

    const handleTrash = async (threadId: string) => {
        if (!token || !confirm('Move this thread to Trash?')) return;
        const ok = await trashThread(token, threadId);
        if (ok) {
            setThreads(prev => prev.filter(t => t.id !== threadId));
            setSelectedThread(null);
            setInboxView('inbox');
        }
    };

    const handleArchive = async (threadId: string) => {
        if (!token) return;
        const ok = await archiveThread(token, threadId);
        if (ok) {
            setThreads(prev => prev.filter(t => t.id !== threadId));
            setSelectedThread(null);
            setInboxView('inbox');
        }
    };

    const handleComposeSend = async () => {
        if (!token || !composeTo || !composeSubject || !composeBody) return;
        setIsSending(true);
        setSendStatus(null);
        try {
            await sendEmail(token, composeTo, composeSubject, composeBody);
            setSendStatus('✅ Sent successfully!');
            setTimeout(() => {
                setInboxView('inbox');
                setComposeTo('');
                setComposeSubject('');
                setComposeBody('');
                setSendStatus(null);
                loadInbox();
            }, 1500);
        } catch (e: any) {
            setSendStatus(`❌ Failed: ${e.message}`);
        }
        setIsSending(false);
    };

    const handleReply = async () => {
        if (!token || !selectedThread || !replyBody) return;
        setIsSending(true);
        try {
            const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];
            const replyTo = lastMsg.isFromMe ? lastMsg.to : lastMsg.from;
            const subject = selectedThread.subject.startsWith('Re:') ? selectedThread.subject : `Re: ${selectedThread.subject}`;
            await sendEmail(token, replyTo, subject, replyBody, selectedThread.id);
            setReplyBody('');
            // Refresh thread
            if (userEmail) {
                const refreshed = await getThread(token, selectedThread.id, TEAM_EMAIL);
                if (refreshed) setSelectedThread(refreshed);
            }
        } catch (e: any) {
            setError(e.message);
        }
        setIsSending(false);
    };

    const handleBulkSend = async () => {
        if (!token || selectedCreators.size === 0 || !bulkSubject || !bulkBody) return;
        setIsSending(true);
        setBulkProgress('Starting deployment...');
        try {
            const recipients = creatorsWithEmail
                .filter(c => selectedCreators.has(c.id))
                .map(c => ({ email: c.email!, name: c.name }));

            const result = await sendBulkEmail(
                token, recipients, bulkSubject, bulkBody,
                (done, total, name) => setBulkProgress(`Deploying ${done + 1}/${total}: ${name}...`)
            );
            setBulkProgress(`✅ Deployed! ${result.sent} sent, ${result.failed} failed`);
            setTimeout(() => {
                setInboxView('inbox');
                setSelectedCreators(new Set());
                setBulkSubject('');
                setBulkBody('');
                setBulkProgress(null);
            }, 3000);
        } catch (e: any) {
            setBulkProgress(`❌ Error: ${e.message}`);
        }
        setIsSending(false);
    };

    const toggleCreator = (id: string) => {
        setSelectedCreators(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedCreators(new Set(creatorsWithEmail.map(c => c.id)));
    };

    const matchCreator = (email: string) => {
        return creators.find(c => c.email && email.toLowerCase().includes(c.email.toLowerCase()));
    };

    const formatDate = (iso: string) => {
        try {
            const d = new Date(iso);
            const now = new Date();
            if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch { return iso; }
    };

    const extractName = (fromHeader: string) => {
        const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
        return match ? match[1].trim() : fromHeader.split('@')[0];
    };

    const getInitialColor = (name: string) => {
        const colors = [
            'from-emerald-500/30 to-teal-500/30',
            'from-purple-500/30 to-pink-500/30',
            'from-blue-500/30 to-cyan-500/30',
            'from-amber-500/30 to-orange-500/30',
            'from-rose-500/30 to-red-500/30',
            'from-indigo-500/30 to-violet-500/30',
        ];
        const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
        return colors[idx];
    };

    const unreadCount = threads.filter(t => t.unread).length;

    // ─── Render ───
    if (!token || !userEmail) {
        return (
            <div className="flex-1 flex items-center justify-center text-neutral-500">
                <div className="text-center">
                    <Mail size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Sign in to access email</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-neutral-800 flex-shrink-0 bg-gradient-to-b from-neutral-900/50 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {inboxView !== 'inbox' && (
                            <button onClick={() => { setInboxView('inbox'); setSelectedThread(null); }} className="p-2 rounded-lg hover:bg-neutral-800 transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                            <Mail className="text-emerald-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">
                                {inboxView === 'inbox' && 'Creator Inbox'}
                                {inboxView === 'thread' && (selectedThread?.subject || 'Thread')}
                                {inboxView === 'compose' && 'Compose Email'}
                                {inboxView === 'bulk' && 'Deploy to Creators'}
                            </h2>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-emerald-500/70 font-mono">{TEAM_EMAIL}</span>
                                {inboxView === 'inbox' && unreadCount > 0 && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                        {unreadCount} unread
                                    </span>
                                )}
                                {inboxView === 'inbox' && (
                                    <span className="text-[9px] text-neutral-400 font-mono">{threads.length} conversations</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {inboxView === 'inbox' && (
                            <>
                                <button onClick={() => setInboxView('compose')} className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                                    <Plus size={14} /> Compose
                                </button>
                                <button onClick={() => setInboxView('bulk')} className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2">
                                    <Zap size={14} /> Deploy
                                </button>
                                <button onClick={loadInbox} disabled={isLoading} className="p-2 rounded-lg hover:bg-neutral-800 transition-colors" title="Refresh">
                                    <RefreshCw size={16} className={isLoading ? 'animate-spin text-emerald-500' : 'text-neutral-500'} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search / Filter — only on inbox */}
                {inboxView === 'inbox' && (
                    <div className="mt-4 flex gap-2">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Search creator conversations..."
                                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:border-emerald-500/50 outline-none backdrop-blur-sm"
                            />
                        </div>
                        <select
                            value={filterCreator}
                            onChange={e => { setFilterCreator(e.target.value); setTimeout(loadInbox, 100); }}
                            className="bg-neutral-900/80 border border-neutral-800 rounded-xl px-3 text-xs text-white focus:border-emerald-500/50 outline-none backdrop-blur-sm"
                        >
                            <option value="">All Creators</option>
                            {creatorsWithEmail.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* ─── INBOX VIEW ─── */}
                {inboxView === 'inbox' && (
                    <div>
                        {isLoading && threads.length === 0 && (
                            <div className="p-16 text-center text-neutral-500">
                                <Loader2 className="animate-spin mx-auto mb-3" size={28} />
                                <p className="text-sm font-medium">Loading conversations...</p>
                                <p className="text-[10px] text-neutral-400 mt-1">Fetching from {TEAM_EMAIL}</p>
                            </div>
                        )}
                        {!isLoading && threads.length === 0 && (
                            <div className="p-16 text-center text-neutral-500">
                                <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 flex items-center justify-center mx-auto mb-4">
                                    <Mail size={28} className="text-neutral-500" />
                                </div>
                                <p className="text-sm font-bold text-neutral-400">No conversations yet</p>
                                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                                    Send your first email to a creator to start building your inbox
                                </p>
                                <button onClick={() => setInboxView('compose')} className="mt-4 px-4 py-2 bg-emerald-500 text-black rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all">
                                    Compose First Email
                                </button>
                            </div>
                        )}
                        {threads.map((thread, idx) => {
                            const creator = thread.participantEmail ? matchCreator(thread.participantEmail) : null;
                            const lastMsg = thread.messages?.[thread.messages.length - 1];
                            const fromName = lastMsg ? extractName(lastMsg.from) : '';
                            const displayName = creator?.name || fromName || thread.participantEmail || 'Unknown';
                            const initial = displayName[0]?.toUpperCase() || '?';
                            return (
                                <button
                                    key={thread.id}
                                    onClick={() => openThread(thread)}
                                    className={`w-full text-left px-6 py-4 hover:bg-white/[0.02] transition-all flex items-start gap-4 group border-b border-neutral-800/30
                                        ${thread.unread ? 'bg-emerald-500/[0.03]' : ''}
                                        ${idx === 0 ? '' : ''}
                                    `}
                                >
                                    {/* Avatar */}
                                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getInitialColor(displayName)} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg`}>
                                        <span className="text-sm font-black text-white/80">{initial}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`text-sm truncate ${thread.unread ? 'font-black text-white' : 'font-medium text-neutral-300'}`}>
                                                    {displayName}
                                                </span>
                                                {creator && (
                                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">Creator</span>
                                                )}
                                                {thread.messageCount > 1 && (
                                                    <span className="text-[9px] text-neutral-400 flex items-center gap-0.5 flex-shrink-0">
                                                        <MessageSquare size={8} /> {thread.messageCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                                                    <Clock size={9} /> {formatDate(thread.lastMessageDate)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={`text-xs truncate mt-1 ${thread.unread ? 'text-neutral-200 font-medium' : 'text-neutral-500'}`}>
                                            {thread.subject}
                                        </p>
                                        <p className="text-[11px] text-neutral-400 truncate mt-0.5 leading-relaxed">
                                            {lastMsg?.isFromMe ? <span className="text-emerald-500/50 mr-1">You:</span> : null}
                                            {thread.snippet}
                                        </p>
                                    </div>

                                    {/* Indicators */}
                                    <div className="flex items-center gap-2 mt-2 flex-shrink-0">
                                        {thread.unread && <Circle size={8} className="text-emerald-500 fill-emerald-500" />}
                                        <ChevronRight size={14} className="text-neutral-800 group-hover:text-neutral-500 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ─── THREAD VIEW ─── */}
                {inboxView === 'thread' && selectedThread && (
                    <div className="p-6 space-y-4">
                        <div className="mb-6 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800/50">
                            <div className="flex items-start justify-between">
                                <h3 className="text-lg font-bold text-white flex-1">{selectedThread.subject}</h3>
                                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                                    <button
                                        onClick={() => handleArchive(selectedThread.id)}
                                        className="p-2 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                        title="Archive (remove from inbox)"
                                    >
                                        <Archive size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleTrash(selectedThread.id)}
                                        className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                        title="Move to Trash"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-neutral-500 flex items-center gap-1"><MessageSquare size={10} /> {selectedThread.messageCount} messages</span>
                                <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock size={10} /> {formatDate(selectedThread.lastMessageDate)}</span>
                            </div>
                        </div>
                        {selectedThread.messages.map((msg, i) => {
                            const senderName = msg.isFromMe ? TEAM_EMAIL : extractName(msg.from);
                            return (
                                <div key={msg.id} className={`p-5 rounded-2xl border transition-all ${msg.isFromMe
                                    ? 'bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/15 ml-12'
                                    : 'bg-neutral-900/70 border-neutral-800 mr-12'
                                    }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg ${msg.isFromMe ? 'bg-emerald-500/20' : `bg-gradient-to-br ${getInitialColor(senderName)}`} flex items-center justify-center`}>
                                                <span className="text-[10px] font-black text-white/80">
                                                    {msg.isFromMe ? '✉' : senderName[0]?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-neutral-300">{senderName}</span>
                                                {msg.isFromMe && <span className="text-[8px] text-emerald-500/50 ml-2">(you)</span>}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-neutral-500">{formatDate(msg.date)}</span>
                                    </div>
                                    <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                        {msg.body || msg.snippet}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Reply box */}
                        <div className="mt-8 p-5 bg-neutral-900/50 rounded-2xl border border-neutral-800 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <Send size={12} className="text-emerald-500" />
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Reply as {TEAM_EMAIL}</span>
                            </div>
                            <textarea
                                value={replyBody}
                                onChange={e => setReplyBody(e.target.value)}
                                placeholder="Type your reply..."
                                className="w-full bg-transparent text-sm text-white resize-none outline-none min-h-[120px] placeholder-neutral-700 leading-relaxed"
                            />
                            {/* AI Toolbar for Reply */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <button
                                    onClick={() => handlePolish(replyBody, setReplyBody)}
                                    disabled={isPolishing || !replyBody.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold hover:bg-purple-500/20 transition-all disabled:opacity-30"
                                >
                                    {isPolishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Polish
                                </button>
                                <button
                                    onClick={replyMic.toggle}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${replyMic.isListening
                                        ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                                        : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                                        }`}
                                >
                                    {replyMic.isListening ? <MicOff size={12} /> : <Mic size={12} />}
                                    {replyMic.isListening ? 'Stop' : 'Voice'}
                                </button>
                            </div>
                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-neutral-800">
                                <span className="text-[9px] text-neutral-700">Press Cmd+Enter to send</span>
                                <button
                                    onClick={handleReply}
                                    disabled={!replyBody.trim() || isSending}
                                    className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                                >
                                    {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Send Reply
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── COMPOSE VIEW ─── */}
                {inboxView === 'compose' && (
                    <div className="p-6 space-y-5">
                        {/* Sending as banner */}
                        <div className="p-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/15 rounded-xl flex items-center gap-3 text-xs">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Mail size={14} className="text-emerald-500" />
                            </div>
                            <div>
                                <span className="text-neutral-400">Sending from </span>
                                <span className="font-bold text-emerald-400">{TEAM_EMAIL}</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">To</label>
                            <div className="relative">
                                <input
                                    value={composeTo}
                                    onChange={e => setComposeTo(e.target.value)}
                                    placeholder="Email address or start typing a creator name..."
                                    list="creator-emails"
                                    className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 text-sm text-white focus:border-emerald-500/50 outline-none"
                                />
                                <datalist id="creator-emails">
                                    {creatorsWithEmail.map(c => (
                                        <option key={c.id} value={c.email!}>{c.name} ({c.email})</option>
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Subject</label>
                            <input
                                value={composeSubject}
                                onChange={e => setComposeSubject(e.target.value)}
                                placeholder="Content Opportunity: [Campaign Name]"
                                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 text-sm text-white focus:border-emerald-500/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Message</label>
                            <textarea
                                ref={bodyRef}
                                value={composeBody}
                                onChange={e => { setComposeBody(e.target.value); setSpellResults(null); }}
                                placeholder="Write your message here..."
                                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 text-sm text-white focus:border-emerald-500/50 outline-none min-h-[250px] resize-y leading-relaxed"
                            />
                            {/* AI Toolbar */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <button
                                    onClick={handleAuraDraft}
                                    disabled={isAuraDrafting || !composeBody.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:from-emerald-500/20 hover:to-teal-500/20 transition-all disabled:opacity-30"
                                >
                                    {isAuraDrafting ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                                    Coco Draft
                                </button>
                                <button
                                    onClick={() => handlePolish(composeBody, setComposeBody)}
                                    disabled={isPolishing || !composeBody.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold hover:bg-purple-500/20 transition-all disabled:opacity-30"
                                >
                                    {isPolishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Polish
                                </button>
                                <button
                                    onClick={() => handleSpellCheck(composeBody)}
                                    disabled={isChecking || !composeBody.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500/20 transition-all disabled:opacity-30"
                                >
                                    {isChecking ? <Loader2 size={12} className="animate-spin" /> : <SpellCheck size={12} />}
                                    Spelling
                                </button>
                                <button
                                    onClick={composeMic.toggle}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${composeMic.isListening
                                        ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                                        : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                                        }`}
                                >
                                    {composeMic.isListening ? <MicOff size={12} /> : <Mic size={12} />}
                                    {composeMic.isListening ? 'Stop' : 'Voice'}
                                </button>
                            </div>
                            {/* Spell Check Results */}
                            {spellResults && spellResults.length > 0 && (
                                <div className="mt-2 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Corrections Found</span>
                                        <button onClick={() => setSpellResults(null)} className="text-neutral-500 hover:text-white"><X size={12} /></button>
                                    </div>
                                    {spellResults.map((r, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10px]">
                                            <span className="text-red-400 line-through flex-shrink-0">{r.original}</span>
                                            <span className="text-emerald-400">→ {r.corrected}</span>
                                            <span className="text-neutral-500 ml-auto">({r.reason})</span>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            let fixed = composeBody;
                                            spellResults.forEach(r => { fixed = fixed.replace(r.original, r.corrected); });
                                            setComposeBody(fixed);
                                            setSpellResults(null);
                                        }}
                                        className="mt-1 text-[9px] font-bold text-blue-400 hover:underline"
                                    >
                                        Apply All Fixes
                                    </button>
                                </div>
                            )}
                            {spellResults && spellResults.length === 0 && (
                                <div className="mt-2 p-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg text-[10px] text-emerald-400 font-bold flex items-center gap-2">
                                    <Check size={12} /> No spelling or grammar issues found!
                                </div>
                            )}
                        </div>

                        {sendStatus && (
                            <div className={`p-3 rounded-xl text-sm font-medium ${sendStatus.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {sendStatus}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setInboxView('inbox')} className="px-6 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:bg-neutral-900 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleComposeSend}
                                disabled={!composeTo || !composeSubject || !composeBody || isSending}
                                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Send Email
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── BULK DEPLOY VIEW ─── */}
                {inboxView === 'bulk' && (
                    <div className="p-6 space-y-5">
                        {/* Sending as banner */}
                        <div className="p-3 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/15 rounded-xl flex items-center gap-3 text-xs">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Zap size={14} className="text-purple-400" />
                            </div>
                            <div>
                                <span className="text-neutral-400">Deploy emails from </span>
                                <span className="font-bold text-purple-400">{TEAM_EMAIL}</span>
                                <span className="text-neutral-400 ml-2">• Use {'{name}'} to personalize</span>
                            </div>
                        </div>

                        {/* Creator selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                    Select Recipients ({selectedCreators.size}/{creatorsWithEmail.length})
                                </label>
                                <button onClick={selectAll} className="text-[10px] text-purple-400 hover:underline font-bold">
                                    Select All
                                </button>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto bg-neutral-900/50 border border-neutral-800 rounded-xl p-2 space-y-1 custom-scrollbar">
                                {creatorsWithEmail.length === 0 && (
                                    <p className="text-xs text-neutral-500 p-3">No creators have email addresses. Add emails in their profiles first.</p>
                                )}
                                {creatorsWithEmail.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleCreator(c.id)}
                                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${selectedCreators.has(c.id) ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-neutral-800/50 border border-transparent'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedCreators.has(c.id) ? 'bg-purple-500 border-purple-500' : 'border-neutral-700'}`}>
                                            {selectedCreators.has(c.id) && <Check size={11} className="text-white" />}
                                        </div>
                                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getInitialColor(c.name)} flex items-center justify-center`}>
                                            <span className="text-[9px] font-black text-white/80">{c.name[0]}</span>
                                        </div>
                                        <span className="text-sm text-white font-medium">{c.name}</span>
                                        <span className="text-[10px] text-neutral-400 ml-auto">{c.email}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Subject</label>
                            <input
                                value={bulkSubject}
                                onChange={e => setBulkSubject(e.target.value)}
                                placeholder="New Content Strategy: [Campaign Name]"
                                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 text-sm text-white focus:border-purple-500/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Message Body</label>
                            <textarea
                                value={bulkBody}
                                onChange={e => setBulkBody(e.target.value)}
                                placeholder={`Hi {name},\n\nWe have a new content opportunity we'd love for you to be part of...\n\nBest,\nThe OOEDN Team`}
                                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 text-sm text-white focus:border-purple-500/50 outline-none min-h-[200px] resize-y leading-relaxed"
                            />
                            {/* AI Toolbar for Bulk */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <button
                                    onClick={() => handlePolish(bulkBody, setBulkBody)}
                                    disabled={isPolishing || !bulkBody.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold hover:bg-purple-500/20 transition-all disabled:opacity-30"
                                >
                                    {isPolishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    Polish Draft
                                </button>
                                <button
                                    onClick={bulkMic.toggle}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${bulkMic.isListening
                                        ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                                        : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                                        }`}
                                >
                                    {bulkMic.isListening ? <MicOff size={12} /> : <Mic size={12} />}
                                    {bulkMic.isListening ? 'Stop' : 'Voice'}
                                </button>
                            </div>
                        </div>

                        {bulkProgress && (
                            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${bulkProgress.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : bulkProgress.includes('❌') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                                {!bulkProgress.includes('✅') && !bulkProgress.includes('❌') && <Loader2 size={14} className="animate-spin" />}
                                {bulkProgress}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setInboxView('inbox')} className="px-6 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:bg-neutral-900 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkSend}
                                disabled={selectedCreators.size === 0 || !bulkSubject || !bulkBody || isSending}
                                className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg shadow-purple-500/20"
                            >
                                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                Deploy to {selectedCreators.size} Creator{selectedCreators.size !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatorInbox;
