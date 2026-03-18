import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageSquare, User, AtSign, Mic, MicOff } from 'lucide-react';
import { TeamMessage } from '../types';
import { sendPushNotification } from '../services/pushService';

interface TeamChatWidgetProps {
    teamMessages: TeamMessage[];
    onSendTeamMessage: (msg: TeamMessage) => void;
    currentUser: string;
    teamEmails?: string[];
}

const TeamChatWidget: React.FC<TeamChatWidgetProps> = ({ teamMessages = [], onSendTeamMessage, currentUser, teamEmails = [] }) => {
    // Filter out creator messages — team comms is internal only
    const internalMessages = teamMessages.filter(m => !m.isCreatorMessage && !m.creatorId);
    const [inputText, setInputText] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const toggleVoice = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Speech recognition not supported in this browser.'); return; }
        if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }
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
    };

    useEffect(() => {
        scrollToBottom();
    }, [internalMessages]);

    // Extract unique team names from emails + messages
    const allTeamNames = React.useMemo(() => {
        const names = new Set<string>();
        teamEmails.forEach(e => names.add(e.split('@')[0]));
        internalMessages.forEach(m => {
            if (m.sender) names.add(m.sender.split('@')[0]);
        });
        names.delete(currentUser.split('@')[0]); // Don't suggest self
        return Array.from(names).filter(Boolean);
    }, [teamEmails, internalMessages, currentUser]);

    const filteredMentions = allTeamNames.filter(name =>
        name.toLowerCase().includes(mentionFilter.toLowerCase())
    );

    const handleInputChange = (value: string) => {
        setInputText(value);
        // Check if user is typing @mention
        const lastAt = value.lastIndexOf('@');
        if (lastAt !== -1 && (lastAt === 0 || value[lastAt - 1] === ' ')) {
            const afterAt = value.slice(lastAt + 1);
            if (!afterAt.includes(' ')) {
                setMentionFilter(afterAt);
                setShowMentions(true);
                setMentionIndex(0);
                return;
            }
        }
        setShowMentions(false);
    };

    const insertMention = (name: string) => {
        const lastAt = inputText.lastIndexOf('@');
        const before = inputText.slice(0, lastAt);
        setInputText(`${before}@${name} `);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions && filteredMentions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => Math.min(prev + 1, filteredMentions.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredMentions[mentionIndex]);
                return;
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
        }
    };

    const handleSend = () => {
        if (!inputText.trim()) return;

        // Extract all @mentions from the message
        const mentionMatches = inputText.match(/@(\w+)/g) || [];
        const mentions = mentionMatches.map(m => m.slice(1)); // Remove @ prefix

        const newMsg: TeamMessage = {
            id: crypto.randomUUID(),
            sender: currentUser,
            text: inputText,
            timestamp: new Date().toISOString(),
            mentions: mentions.length > 0 ? mentions : undefined
        };
        onSendTeamMessage(newMsg);

        // Fire push notification
        const senderName = currentUser.split('@')[0];
        if (mentions.length > 0) {
            sendPushNotification(
                `@${mentions.join(', @')} mentioned by ${senderName}`,
                inputText,
                '/',
                'ooedn-mention'
            ).catch(() => { });
        } else {
            sendPushNotification(
                `${senderName} in Team Chat`,
                inputText,
                '/',
                'ooedn-chat'
            ).catch(() => { });
        }

        setInputText('');
        setShowMentions(false);
    };

    // Render message text with highlighted @mentions
    const renderText = (text: string) => {
        try {
            const parts = text.split(/(@\w+)/g);
            return parts.map((part, i) =>
                part.startsWith('@') ? (
                    <span key={i} className="text-blue-400 font-bold">{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                )
            );
        } catch {
            return text;
        }
    };

    return (
        <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 flex flex-col h-[400px] shadow-2xl relative overflow-hidden group">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                    <MessageSquare size={16} /> Team Comms
                </h3>
                <div className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full flex items-center gap-1">
                    <User size={10} /> {currentUser.split('@')[0]}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {internalMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-2 opacity-50">
                        <MessageSquare size={24} />
                        <p className="text-xs font-bold uppercase">No messages yet</p>
                    </div>
                )}
                {internalMessages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === currentUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] text-neutral-500 font-bold uppercase">{msg.sender.split('@')[0]}</span>
                            <span className="text-[8px] text-neutral-700">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs font-medium leading-relaxed ${msg.sender === currentUser
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-neutral-800 text-white rounded-tl-sm border border-neutral-700'
                            }`}>
                            {renderText(msg.text)}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-800 relative">
                {/* @Mention Autocomplete Dropdown */}
                {showMentions && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden shadow-2xl z-50 max-h-[150px] overflow-y-auto">
                        {filteredMentions.map((name, i) => (
                            <button
                                key={name}
                                onClick={() => insertMention(name)}
                                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${i === mentionIndex
                                    ? 'bg-blue-600 text-white'
                                    : 'text-neutral-300 hover:bg-neutral-800'
                                    }`}
                            >
                                <AtSign size={12} className="text-blue-400" />
                                <span className="font-bold">{name}</span>
                            </button>
                        ))}
                    </div>
                )}

                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-2 bg-black border border-neutral-800 rounded-xl p-1 pl-3 focus-within:border-blue-500 transition-colors"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message team... (type @ to mention)"
                        className="flex-1 bg-transparent text-xs text-white focus:outline-none py-2"
                    />
                    <button
                        type="button"
                        onClick={toggleVoice}
                        className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                        title={isListening ? 'Stop dictating' : 'Dictate message'}
                    >
                        {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TeamChatWidget;
