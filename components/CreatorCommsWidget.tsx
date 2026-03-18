import React, { useState, useRef, useEffect } from 'react';
import { TeamMessage, Creator } from '../types';
import { Send, MessageCircle, User, ChevronLeft, Bell, Mail, Megaphone } from 'lucide-react';

interface CreatorCommsWidgetProps {
    teamMessages: TeamMessage[];
    creators: Creator[];
    onSendMessage: (msg: TeamMessage) => void;
    onMarkRead: (creatorId: string) => void;
    onPushNotify: (creatorIds: string[], title: string, body: string) => void;
    onEmailCreators: (creatorIds: string[], subject: string, body: string) => void;
    currentUser: string;
}

const CreatorCommsWidget: React.FC<CreatorCommsWidgetProps> = ({
    teamMessages = [], creators = [], onSendMessage, onMarkRead, onPushNotify, onEmailCreators, currentUser
}) => {
    const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [broadcastType, setBroadcastType] = useState<'push' | 'email'>('push');
    const bottomRef = useRef<HTMLDivElement>(null);

    // Get all creator messages grouped by creator
    const creatorMessages = teamMessages.filter(m => m.isCreatorMessage || m.creatorId);
    const creatorIds = [...new Set(creatorMessages.map(m => m.creatorId).filter(Boolean))] as string[];

    // Get threads: all messages for a specific creator (both directions)
    const getThread = (creatorId: string) =>
        teamMessages.filter(m => m.creatorId === creatorId).sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

    const getCreatorName = (creatorId: string) => {
        const creator = creators.find(c => c.id === creatorId);
        return creator?.name || 'Unknown Creator';
    };

    const getLastMessage = (creatorId: string) => {
        const thread = getThread(creatorId);
        return thread[thread.length - 1];
    };

    const getUnreadCount = (creatorId: string) => {
        const thread = getThread(creatorId);
        return thread.filter(m => m.isCreatorMessage && !(m as any).readByTeam).length;
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedCreatorId, teamMessages]);

    // Mark messages as read when a thread is opened
    useEffect(() => {
        if (selectedCreatorId) {
            onMarkRead(selectedCreatorId);
        }
    }, [selectedCreatorId]);

    const handleSendReply = () => {
        if (!replyText.trim() || !selectedCreatorId) return;
        const msg: TeamMessage = {
            id: `msg-${Date.now()}`,
            sender: currentUser,
            text: replyText.trim(),
            timestamp: new Date().toISOString(),
            creatorId: selectedCreatorId,
            creatorName: getCreatorName(selectedCreatorId),
            isCreatorMessage: false,
        };
        onSendMessage(msg);
        setReplyText('');
    };

    const handleBroadcast = () => {
        if (!broadcastBody.trim()) return;
        const allCreatorIds = creators.map(c => c.id);
        if (broadcastType === 'push') {
            onPushNotify(allCreatorIds, broadcastTitle || 'OOEDN Update', broadcastBody);
        } else {
            onEmailCreators(allCreatorIds, broadcastTitle || 'OOEDN Update', broadcastBody);
        }
        setShowBroadcast(false);
        setBroadcastTitle('');
        setBroadcastBody('');
    };

    const formatTime = (iso: string) => {
        try {
            const d = new Date(iso);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch { return ''; }
    };

    // --- BROADCAST MODAL ---
    if (showBroadcast) {
        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Megaphone size={16} className="text-teal-400" /> Broadcast to All Creators
                    </h3>
                    <button onClick={() => setShowBroadcast(false)} className="text-neutral-500 hover:text-white text-xs font-bold">Cancel</button>
                </div>
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setBroadcastType('push')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${broadcastType === 'push' ? 'bg-teal-500 text-black' : 'bg-neutral-800 text-neutral-500'}`}>
                        <Bell size={12} className="inline mr-1" /> Push Notification
                    </button>
                    <button onClick={() => setBroadcastType('email')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${broadcastType === 'email' ? 'bg-teal-500 text-black' : 'bg-neutral-800 text-neutral-500'}`}>
                        <Mail size={12} className="inline mr-1" /> Email
                    </button>
                </div>
                <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)}
                    placeholder={broadcastType === 'push' ? 'Notification Title' : 'Email Subject'}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 mb-3" />
                <textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)}
                    placeholder="Your message to all creators..."
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 h-28 resize-none mb-3" />
                <button onClick={handleBroadcast} disabled={!broadcastBody.trim()}
                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-30 transition-all active:scale-95">
                    <Megaphone size={14} /> Send to {creators.length} Creators
                </button>
            </div>
        );
    }

    // --- THREAD VIEW ---
    if (selectedCreatorId) {
        const thread = getThread(selectedCreatorId);
        const creatorName = getCreatorName(selectedCreatorId);

        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl shadow-2xl flex flex-col" style={{ height: '500px' }}>
                {/* Header */}
                <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
                    <button onClick={() => setSelectedCreatorId(null)} className="text-neutral-500 hover:text-white transition-colors" title="Back">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-black font-black text-sm">
                        {creatorName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-white">{creatorName}</p>
                        <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest">Creator Chat</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onPushNotify([selectedCreatorId], 'OOEDN', 'You have a new message!')}
                            className="p-2 bg-teal-500/10 rounded-lg text-teal-400 hover:bg-teal-500/20 transition-all" title="Send Push">
                            <Bell size={14} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {thread.length === 0 && (
                        <div className="text-center py-12">
                            <MessageCircle size={32} className="text-neutral-700 mx-auto mb-2" />
                            <p className="text-neutral-600 text-xs">No messages yet. Send the first message!</p>
                        </div>
                    )}
                    {thread.map(msg => (
                        <div key={msg.id} className={`flex ${msg.isCreatorMessage ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] ${msg.isCreatorMessage
                                ? 'bg-teal-500/10 border border-teal-500/20 rounded-2xl rounded-bl-md'
                                : 'bg-teal-500/10 border border-teal-500/20 rounded-2xl rounded-br-md'
                                } p-3`}>
                                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${msg.isCreatorMessage ? 'text-teal-400' : 'text-teal-400'}`}>
                                    {msg.isCreatorMessage ? `👤 ${msg.creatorName || creatorName}` : msg.sender}
                                </p>
                                <p className="text-sm text-white leading-relaxed">{msg.text}</p>
                                <p className="text-[8px] text-neutral-600 mt-1">{formatTime(msg.timestamp)}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Reply Input */}
                <div className="p-3 border-t border-neutral-800 flex gap-2">
                    <input value={replyText} onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                        placeholder={`Reply to ${creatorName}...`}
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50" />
                    <button onClick={handleSendReply} disabled={!replyText.trim()}
                        className="bg-gradient-to-r from-teal-600 to-cyan-500 text-black p-2.5 rounded-xl hover:from-teal-400 hover:to-cyan-400 disabled:opacity-30 transition-all active:scale-95" title="Send">
                        <Send size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // --- INBOX VIEW ---
    return (
        <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col h-[280px] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <MessageCircle size={16} className="text-teal-400" /> Creator Comms
                    {creatorIds.length > 0 && <span className="text-[10px] text-neutral-500 font-mono ml-1">{creatorIds.length} threads</span>}
                </h3>
                <button onClick={() => setShowBroadcast(true)}
                    className="text-[9px] font-black uppercase tracking-widest text-teal-400 hover:text-white transition-colors flex items-center gap-1 bg-teal-500/10 px-3 py-1.5 rounded-lg">
                    <Megaphone size={10} /> Broadcast
                </button>
            </div>

            {creatorIds.length === 0 ? (
                <div className="text-center py-8">
                    <MessageCircle size={36} className="text-neutral-700 mx-auto mb-3" />
                    <p className="text-neutral-500 text-sm font-bold">No creator messages yet</p>
                    <p className="text-neutral-700 text-[10px] mt-1">When creators send messages, they'll appear here</p>
                </div>
            ) : (
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    {creatorIds.map(creatorId => {
                        const lastMsg = getLastMessage(creatorId);
                        const unread = getUnreadCount(creatorId);
                        const name = getCreatorName(creatorId);
                        return (
                            <button key={creatorId} onClick={() => setSelectedCreatorId(creatorId)}
                                className="w-full text-left p-3 bg-black/30 border border-neutral-800 rounded-xl hover:border-teal-500/30 transition-all group flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-black text-sm flex-shrink-0">
                                    {name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black text-white group-hover:text-teal-400 transition-colors">{name}</p>
                                        {lastMsg && <span className="text-[8px] text-neutral-600">{formatTime(lastMsg.timestamp)}</span>}
                                    </div>
                                    {lastMsg && (
                                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                                            {lastMsg.isCreatorMessage ? '' : 'You: '}{lastMsg.text}
                                        </p>
                                    )}
                                </div>
                                {unread > 0 && (
                                    <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-[9px] font-black text-black">{unread}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CreatorCommsWidget;
