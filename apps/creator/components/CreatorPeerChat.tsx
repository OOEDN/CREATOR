import React, { useState, useRef, useEffect } from 'react';
import { Creator, Campaign, PeerMessage } from '../../../shared/types';
import { Send, Smile, Users, MessageCircle, Search } from 'lucide-react';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    creators: Creator[];
    peerMessages: PeerMessage[];
    onSendPeerMessage: (toCreatorId: string, text: string) => void;
}

const quickEmojis = ['👍', '🔥', '💜', '🎉', '✅', '📹', '💪', '🚀'];

const CreatorPeerChat: React.FC<Props> = ({ creator, campaigns, creators, peerMessages, onSendPeerMessage }) => {
    const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageSent, setMessageSent] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Find peers: creators who share at least one campaign
    const myCampaignIds = campaigns
        .filter(c => c.assignedCreatorIds?.includes(creator.id))
        .map(c => c.id);

    const peers = creators.filter(c => {
        if (c.id === creator.id) return false;
        const theirCampaignIds = campaigns
            .filter(camp => camp.assignedCreatorIds?.includes(c.id))
            .map(camp => camp.id);
        return theirCampaignIds.some(id => myCampaignIds.includes(id));
    });

    const filteredPeers = searchQuery
        ? peers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : peers;

    // Get conversation with selected peer
    const conversation = selectedPeerId
        ? peerMessages.filter(m =>
            (m.fromCreatorId === creator.id && m.toCreatorId === selectedPeerId) ||
            (m.fromCreatorId === selectedPeerId && m.toCreatorId === creator.id)
        ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        : [];

    // Unread count per peer
    const getUnreadCount = (peerId: string) => {
        return peerMessages.filter(m =>
            m.fromCreatorId === peerId && m.toCreatorId === creator.id && !m.readAt
        ).length;
    };

    // Last message preview
    const getLastMessage = (peerId: string) => {
        const msgs = peerMessages.filter(m =>
            (m.fromCreatorId === creator.id && m.toCreatorId === peerId) ||
            (m.fromCreatorId === peerId && m.toCreatorId === creator.id)
        );
        return msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    };

    // Shared campaign names
    const getSharedCampaigns = (peerId: string) => {
        return campaigns.filter(c =>
            c.assignedCreatorIds?.includes(creator.id) && c.assignedCreatorIds?.includes(peerId)
        ).map(c => c.title);
    };

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [conversation.length]);

    const handleSend = () => {
        if (!input.trim() || !selectedPeerId) return;
        onSendPeerMessage(selectedPeerId, input);
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

    const selectedPeer = selectedPeerId ? creators.find(c => c.id === selectedPeerId) : null;

    return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)]">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <Users size={24} className="text-teal-400" /> Creator Community
                </h2>
                <p className="text-neutral-500 text-xs mt-1">Chat with fellow creators on your campaigns</p>
            </div>

            <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl flex overflow-hidden shadow-2xl h-[calc(100%-60px)]">
                {/* Peer List (Left) */}
                <div className="w-[260px] border-r border-neutral-800 flex flex-col">
                    {/* Search */}
                    <div className="p-3 border-b border-neutral-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search creators..."
                                className="w-full bg-black border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Peer List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredPeers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                                <div className="text-4xl mb-3">👥</div>
                                <p className="text-neutral-400 text-xs font-bold text-center">No fellow creators yet</p>
                                <p className="text-neutral-600 text-[10px] text-center mt-1">You'll see creators who share campaigns with you here</p>
                            </div>
                        ) : (
                            filteredPeers.map(peer => {
                                const unread = getUnreadCount(peer.id);
                                const lastMsg = getLastMessage(peer.id);
                                const shared = getSharedCampaigns(peer.id);
                                const isSelected = selectedPeerId === peer.id;

                                return (
                                    <button
                                        key={peer.id}
                                        onClick={() => setSelectedPeerId(peer.id)}
                                        className={`w-full p-3 flex items-start gap-3 hover:bg-neutral-800/50 transition-all text-left border-b border-neutral-800/50 ${
                                            isSelected ? 'bg-teal-500/10 border-l-2 border-l-purple-500' : ''
                                        }`}
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-white font-black text-xs flex-shrink-0 overflow-hidden">
                                            {peer.profileImage ? (
                                                <img src={peer.profileImage} alt={peer.name} className="w-full h-full object-cover" />
                                            ) : (
                                                peer.name[0]?.toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-xs font-bold truncate ${isSelected ? 'text-teal-300' : 'text-white'}`}>{peer.name}</p>
                                                {unread > 0 && (
                                                    <span className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-[9px] font-black text-white">{unread}</span>
                                                )}
                                            </div>
                                            {lastMsg && (
                                                <p className="text-[10px] text-neutral-500 truncate mt-0.5">{lastMsg.text}</p>
                                            )}
                                            {shared.length > 0 && (
                                                <p className="text-[9px] text-teal-400/60 truncate mt-0.5">📋 {shared[0]}{shared.length > 1 ? ` +${shared.length - 1}` : ''}</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area (Right) */}
                <div className="flex-1 flex flex-col">
                    {!selectedPeer ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="text-5xl mb-3">💬</div>
                            <p className="text-neutral-400 text-sm font-bold">Select a creator to chat</p>
                            <p className="text-neutral-600 text-[10px] mt-1">Connect with fellow creators on shared campaigns</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-neutral-800 bg-gradient-to-r from-teal-600/5 to-cyan-500/5 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm overflow-hidden">
                                    {selectedPeer.profileImage ? (
                                        <img src={selectedPeer.profileImage} alt={selectedPeer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedPeer.name[0]?.toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-white">{selectedPeer.name}</p>
                                    <p className="text-[10px] text-neutral-500">
                                        {getSharedCampaigns(selectedPeer.id).join(', ') || 'Shared campaign'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <span className="text-[9px] text-emerald-400 font-bold uppercase">Creator</span>
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {conversation.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                                        <div className="text-5xl mb-3">👋</div>
                                        <p className="text-neutral-400 text-sm font-bold">Start a conversation</p>
                                        <p className="text-neutral-600 text-[10px]">Say hello to {selectedPeer.name}!</p>
                                    </div>
                                ) : (
                                    conversation.map((msg, idx) => {
                                        const isMe = msg.fromCreatorId === creator.id;
                                        const showAvatar = idx === 0 || conversation[idx - 1]?.fromCreatorId !== msg.fromCreatorId;
                                        return (
                                            <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? '' : 'mt-0.5'}`}>
                                                {!isMe && showAvatar && (
                                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-1 overflow-hidden">
                                                        {selectedPeer.profileImage ? (
                                                            <img src={selectedPeer.profileImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            selectedPeer.name[0]?.toUpperCase()
                                                        )}
                                                    </div>
                                                )}
                                                {!isMe && !showAvatar && <div className="w-7" />}
                                                <div className={`max-w-[75%] ${isMe ? 'order-first' : ''}`}>
                                                    <div className={`p-3 rounded-2xl ${isMe
                                                        ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-br-md shadow-lg shadow-teal-500/10'
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

                            {/* Emoji Bar */}
                            {showEmoji && (
                                <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-900/50 flex items-center gap-1 flex-wrap">
                                    {quickEmojis.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => { setInput(prev => prev + emoji); setShowEmoji(false); }}
                                            className="text-lg p-1.5 hover:bg-neutral-800 rounded-lg transition-all hover:scale-125 active:scale-90"
                                            title={emoji}
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
                                        placeholder={`Message ${selectedPeer.name}...`}
                                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 transition-all"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim()}
                                        className="p-3 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-20 shadow-lg shadow-teal-500/20 active:scale-90"
                                        title="Send message"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreatorPeerChat;
