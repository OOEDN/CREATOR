import React, { useState, useEffect, useMemo } from 'react';
import { Star, Crown, TrendingUp, Search, Plus, X, Check, ArrowRight, ExternalLink, Calendar, Mail, BarChart3, Shield, Target, RefreshCw, Filter, MessageSquare, Flame } from 'lucide-react';
import { Creator, CreatorStatus, AppSettings } from '../types';

interface LongTermCreatorsProps {
    creators: Creator[];
    appSettings: AppSettings;
    onNavigate: (view: string) => void;
    onUpdateCreator: (id: string, updates: Partial<Creator>) => void;
}

type Tier = 'core' | 'rising' | 'prospect' | 'all';

const LongTermCreators: React.FC<LongTermCreatorsProps> = ({ creators, appSettings, onNavigate, onUpdateCreator }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState<Tier>('all');
    const [showNotes, setShowNotes] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    // Categorize creators based on engagement signals
    const categorized = useMemo(() => {
        const active = creators.filter(c => c.status === CreatorStatus.Active || c.status === CreatorStatus.LongTerm);
        return {
            core: active.filter(c => {
                // "Core" = flagged as important OR have had multiple shipments OR have extensive notes
                return c.flagged || (c.shipments && c.shipments.length >= 2) || (c.notes && c.notes.length > 100);
            }),
            rising: active.filter(c => {
                // "Rising" = active, have had at least one shipment, but not yet "core"
                const isCore = c.flagged || (c.shipments && c.shipments.length >= 2) || (c.notes && c.notes.length > 100);
                return !isCore && (c.shipments && c.shipments.length >= 1);
            }),
            prospect: active.filter(c => {
                // "Prospect" = active but no shipments yet — still being evaluated
                const isCore = c.flagged || (c.shipments && c.shipments.length >= 2) || (c.notes && c.notes.length > 100);
                const isRising = !isCore && (c.shipments && c.shipments.length >= 1);
                return !isCore && !isRising;
            }),
        };
    }, [creators]);

    const getDisplayList = () => {
        let list: Creator[];
        switch (filterTier) {
            case 'core': list = categorized.core; break;
            case 'rising': list = categorized.rising; break;
            case 'prospect': list = categorized.prospect; break;
            default: list = [...categorized.core, ...categorized.rising, ...categorized.prospect];
        }
        if (searchTerm) {
            list = list.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return list;
    };

    const getTierLabel = (c: Creator) => {
        if (categorized.core.includes(c)) return { label: 'Core Partner', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Crown };
        if (categorized.rising.includes(c)) return { label: 'Rising', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: TrendingUp };
        return { label: 'Prospect', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Target };
    };

    const getInitialColor = (name: string) => {
        const colors = ['from-amber-500/30 to-orange-500/30', 'from-emerald-500/30 to-teal-500/30', 'from-blue-500/30 to-cyan-500/30', 'from-purple-500/30 to-pink-500/30', 'from-rose-500/30 to-red-500/30', 'from-indigo-500/30 to-violet-500/30'];
        return colors[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
    };

    const handleSaveNote = (id: string) => {
        onUpdateCreator(id, { notes: noteText });
        setShowNotes(null);
        setNoteText('');
    };

    const displayList = getDisplayList();

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-neutral-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                            <Crown className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">Long-Term Partners</h2>
                            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                {categorized.core.length} Core · {categorized.rising.length} Rising · {categorized.prospect.length} Prospects
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate('active')} className="px-4 py-2 rounded-xl bg-neutral-800 text-white font-bold text-xs hover:bg-neutral-700 transition-all flex items-center gap-2">
                            <ArrowRight size={14} /> View All Creators
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-4 flex gap-2">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search partners..."
                            className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:border-amber-500/50 outline-none"
                        />
                    </div>
                    <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1">
                        {[
                            { id: 'all' as Tier, label: 'All', count: categorized.core.length + categorized.rising.length + categorized.prospect.length },
                            { id: 'core' as Tier, label: '👑 Core', count: categorized.core.length },
                            { id: 'rising' as Tier, label: '📈 Rising', count: categorized.rising.length },
                            { id: 'prospect' as Tier, label: '🎯 Prospects', count: categorized.prospect.length },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterTier(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterTier === tab.id ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-500 hover:text-white'}`}
                            >
                                {tab.label} <span className="ml-1 opacity-60">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Creator Cards */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                {displayList.length === 0 && (
                    <div className="p-16 text-center">
                        <Crown size={32} className="mx-auto mb-3 text-neutral-700" />
                        <p className="text-sm text-neutral-400 font-bold">No creators match this filter</p>
                        <p className="text-xs text-neutral-600 mt-1">Try a different tier or search term</p>
                    </div>
                )}
                {displayList.map(creator => {
                    const tier = getTierLabel(creator);
                    const TierIcon = tier.icon;
                    return (
                        <div key={creator.id} className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 hover:border-amber-500/30 transition-all group">
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getInitialColor(creator.name)} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                                    {creator.profileImage ? (
                                        <img src={creator.profileImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-lg font-black text-white/80">{creator.name[0]}</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-white">{creator.name}</span>
                                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${tier.color} flex items-center gap-1`}>
                                            <TierIcon size={8} /> {tier.label}
                                        </span>
                                        {creator.flagged && <Flame size={12} className="text-amber-500" />}
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-neutral-400">
                                        {creator.email && <span className="flex items-center gap-1"><Mail size={9} /> {creator.email}</span>}
                                        {creator.platform && <span>@{creator.platform}</span>}
                                    </div>
                                    {creator.notes && (
                                        <p className="text-[11px] text-neutral-500 mt-2 line-clamp-2">{creator.notes}</p>
                                    )}
                                    {/* Stats row */}
                                    <div className="flex items-center gap-4 mt-3">
                                        <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">
                                            {creator.shipments?.length || 0} Shipments
                                        </span>
                                        <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">
                                            ${creator.rate || 0} Rate
                                        </span>
                                        <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold capitalize">
                                            {creator.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => onUpdateCreator(creator.id, { flagged: !creator.flagged })}
                                        className={`p-2.5 rounded-lg border transition-all ${creator.flagged ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-neutral-800 text-neutral-600 hover:text-amber-400 hover:border-amber-500/30'}`}
                                        title={creator.flagged ? 'Unmark as core' : 'Mark as core partner'}
                                    >
                                        <Star size={14} className={creator.flagged ? 'fill-amber-400' : ''} />
                                    </button>
                                    <button
                                        onClick={() => { setShowNotes(creator.id); setNoteText(creator.notes || ''); }}
                                        className="p-2.5 rounded-lg border border-neutral-800 text-neutral-600 hover:text-white hover:border-neutral-600 transition-all"
                                        title="Edit notes"
                                    >
                                        <MessageSquare size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Notes Modal */}
            {showNotes && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Partner Notes</h3>
                            <button onClick={() => setShowNotes(null)}><X size={18} className="text-neutral-500 hover:text-white" /></button>
                        </div>
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Why is this creator a good long-term fit? Content quality, reliability, audience match..."
                            className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-white focus:border-amber-500/50 outline-none min-h-[200px] resize-y"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowNotes(null)} className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold">Cancel</button>
                            <button onClick={() => handleSaveNote(showNotes)} className="px-6 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all">Save Notes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LongTermCreators;
