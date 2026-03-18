import React, { useState, useRef, useEffect } from 'react';
import { Creator, Campaign, ContentItem } from '../../../shared/types';
import { askAura, getAuraGreeting, AuraMode } from '../../../shared/services/aura/auraCore';
import {
    Bot, Send, Sparkles, Loader2, X, Lightbulb, PenTool,
    Target, Maximize2, Minimize2, MessageCircle
} from 'lucide-react';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    contentItems: ContentItem[];
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
}

const QUICK_ACTIONS = [
    { label: 'Content ideas', icon: Lightbulb, prompt: 'Give me 3 fresh content ideas for my current campaigns. Make them unique and on-brand.' },
    { label: 'Write a caption', icon: PenTool, prompt: 'Help me write a viral caption for my latest content. Keep it short, punchy, and engaging.' },
    { label: 'What\'s next?', icon: Target, prompt: 'Based on my campaigns and tasks, what should I focus on next? Prioritize by deadlines.' },
];

const CreatorAIChat: React.FC<Props> = ({ creator, campaigns, contentItems }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length, isThinking]);

    // Greeting when first opened
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            const greeting = getAuraGreeting(creator.name);
            setMessages([{
                id: 'greeting',
                role: 'assistant',
                text: greeting,
                timestamp: new Date().toISOString(),
            }]);
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length, creator.name]);

    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creator.id));
    const myContent = contentItems.filter(c => c.creatorId === creator.id || c.creatorName === creator.name);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isThinking) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        try {
            const response = await askAura(text, {
                creators: [creator],
                campaigns: myCampaigns,
                content: myContent,
                currentUser: creator.name,
                currentView: 'Creator Portal',
                additionalContext: `This is ${creator.name}, a content creator partnering with OOEDN.`,
            }, {
                mode: 'creator-chat' as AuraMode,
            });

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: response.text,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err) {
            const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                text: 'Oops, something went wrong on my end. Try again in a sec! 🔄',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleQuickAction = (prompt: string) => {
        sendMessage(prompt);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-teal-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-110 active:scale-95 transition-all group"
                title="Chat with Coco AI"
            >
                <Bot size={24} className="text-white group-hover:rotate-12 transition-transform" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0a0a0f] animate-pulse" />
            </button>
        );
    }

    return (
        <div
            className={`fixed z-50 bg-neutral-950 border border-neutral-800 flex flex-col shadow-2xl shadow-teal-500/10 transition-all duration-300 ${
                isExpanded
                    ? 'inset-4 rounded-3xl'
                    : 'bottom-6 right-6 w-[400px] h-[560px] rounded-2xl'
            }`}
        >
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-gradient-to-r from-teal-600/10 to-cyan-500/10 flex items-center gap-3 rounded-t-2xl flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                    <Bot size={18} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-black text-white flex items-center gap-2">
                        Coco <Sparkles size={12} className="text-teal-400" />
                    </p>
                    <p className="text-[10px] text-neutral-500">Your AI creative partner</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
                        title={isExpanded ? 'Minimize' : 'Expand'}
                    >
                        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        onClick={() => { setIsOpen(false); setIsExpanded(false); }}
                        className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
                        title="Close chat"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot size={12} className="text-white" />
                            </div>
                        )}
                        <div className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.role === 'user'
                                ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-br-md shadow-lg shadow-teal-500/10'
                                : 'bg-neutral-900 text-neutral-200 rounded-bl-md border border-neutral-800'
                        }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex gap-2 justify-start">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot size={12} className="text-white" />
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-md p-3 flex items-center gap-2">
                            <Loader2 size={14} className="text-teal-400 animate-spin" />
                            <span className="text-xs text-neutral-500">Thinking...</span>
                        </div>
                    </div>
                )}

                {/* Quick Actions — show when no user messages yet */}
                {messages.length <= 1 && !isThinking && (
                    <div className="space-y-2 pt-2">
                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Quick Actions</p>
                        {QUICK_ACTIONS.map(action => (
                            <button
                                key={action.label}
                                onClick={() => handleQuickAction(action.prompt)}
                                className="w-full flex items-center gap-3 p-3 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-teal-500/30 hover:bg-teal-500/5 transition-all text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                                    <action.icon size={14} className="text-teal-400" />
                                </div>
                                <span className="text-xs font-bold text-neutral-400 group-hover:text-teal-300 transition-colors">{action.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-950/80 flex-shrink-0 rounded-b-2xl">
                <div className="flex items-center gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                        placeholder="Ask Coco anything..."
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 focus:shadow-lg focus:shadow-teal-500/5 transition-all"
                        disabled={isThinking}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isThinking}
                        className="p-3 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-20 shadow-lg shadow-teal-500/20 active:scale-90"
                        title="Send message"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreatorAIChat;
