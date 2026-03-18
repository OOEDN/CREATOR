import React, { useState, useRef, useEffect } from 'react';
import { Creator, TeamMessage } from '../../../shared/types';
import { Send, Smile, Sparkles, MessageCircle, Heart, Zap } from 'lucide-react';

interface Props {
    creator: Creator;
    messages: TeamMessage[];
    onSendMessage: (text: string) => void;
}

const quickEmojis = ['👍', '🔥', '💜', '🎉', '✅', '📹', '💰', '🚀'];

const CreatorChat: React.FC<Props> = ({ creator, messages, onSendMessage }) => {
    const [input, setInput] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Show ALL messages in this creator's thread (both directions)
    // creatorId is set on both creator→team AND team→creator messages
    const relevantMessages = messages.filter(m =>
        m.creatorId === creator.id ||
        m.sender === 'OOEDN Team' ||
        m.isSystem
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [relevantMessages.length]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
        setMessageSent(true);
        setTimeout(() => setMessageSent(false), 1500);
    };

    const formatTime = (iso: string) => {
        try {
            const d = new Date(iso);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
            <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-neutral-800 bg-gradient-to-r from-teal-600/5 to-cyan-500/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-teal-500/20">
                        <MessageCircle size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-white flex items-center gap-2">OOEDN Team Chat <Sparkles size={12} className="text-teal-400" /></p>
                        <p className="text-[10px] text-neutral-500">Messages between you and the team • Direct line 💬</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] text-emerald-400 font-bold uppercase">Online</span>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {relevantMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20">
                            <div className="text-5xl mb-3">💬</div>
                            <p className="text-neutral-400 text-sm font-bold">No messages yet</p>
                            <p className="text-neutral-600 text-[10px]">Say hello to the OOEDN team! They're here to help 🤝</p>
                        </div>
                    ) : (
                        relevantMessages.map((msg, idx) => {
                            const isMe = msg.sender === creator.name;
                            const showAvatar = idx === 0 || relevantMessages[idx - 1]?.sender !== msg.sender;
                            return (
                                <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? '' : 'mt-0.5'}`}>
                                    {!isMe && showAvatar && (
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-[9px] font-black text-black flex-shrink-0 mt-1">
                                            {msg.sender?.[0]?.toUpperCase() || 'T'}
                                        </div>
                                    )}
                                    {!isMe && !showAvatar && <div className="w-7" />}
                                    <div className={`max-w-[75%] ${isMe ? 'order-first' : ''}`}>
                                        {!isMe && showAvatar && (
                                            <p className="text-[9px] font-bold text-teal-400 mb-0.5 ml-1">{msg.sender}</p>
                                        )}
                                        <div className={`p-3 rounded-2xl ${isMe
                                            ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-black rounded-br-md shadow-lg shadow-teal-500/10'
                                            : 'bg-neutral-800/80 text-white rounded-bl-md border border-neutral-700'
                                            }`}>
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                        </div>
                                        <p className={`text-[8px] mt-0.5 mx-1 ${isMe ? 'text-right text-neutral-600' : 'text-neutral-600'}`}>
                                            {formatTime(msg.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {messageSent && (
                        <div className="flex justify-end">
                            <span className="text-[9px] text-teal-400 font-bold animate-pulse">Sent ✨</span>
                        </div>
                    )}
                </div>

                {/* Quick Emoji Bar */}
                {showEmoji && (
                    <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-900/50 flex items-center gap-1 flex-wrap">
                        {quickEmojis.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => { setInput(prev => prev + emoji); setShowEmoji(false); }}
                                className="text-lg p-1.5 hover:bg-neutral-800 rounded-lg transition-all hover:scale-125 active:scale-90"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-neutral-800 bg-neutral-950/50">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowEmoji(!showEmoji)}
                            className={`p-2.5 rounded-xl transition-all ${showEmoji ? 'bg-teal-500/20 text-teal-400' : 'text-neutral-600 hover:text-white hover:bg-neutral-800'}`}
                            title="Quick emoji"
                        >
                            <Smile size={16} />
                        </button>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 focus:shadow-lg focus:shadow-teal-500/5 transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="p-3 bg-gradient-to-r from-teal-600 to-cyan-500 text-black rounded-xl hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-20 shadow-lg shadow-teal-500/20 active:scale-90"
                            title="Send message"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreatorChat;
