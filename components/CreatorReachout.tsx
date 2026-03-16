import React, { useState, useMemo } from 'react';
import { Search, UserPlus, Phone, MessageSquare, CheckCircle, ArrowRight, X, Filter, Calendar, StickyNote, RefreshCw, ExternalLink } from 'lucide-react';
import { Creator, CreatorStatus, ReachoutStatus, AppSettings } from '../types';
import { PLATFORM_ICONS, RATING_COLORS } from '../constants';

interface CreatorReachoutProps {
    creators: Creator[];
    appSettings: AppSettings;
    onUpdateCreator: (id: string, updates: Partial<Creator>) => void;
    onNavigate: (view: string) => void;
}

type TabFilter = 'all' | ReachoutStatus.Queued | ReachoutStatus.Contacted | ReachoutStatus.Responded | ReachoutStatus.Reactivated;

const TAB_CONFIG: { id: TabFilter; label: string; icon: React.ReactNode; color: string; bgActive: string }[] = [
    { id: 'all', label: 'All', icon: <Filter size={14} />, color: 'text-white', bgActive: 'bg-white/10 border-white/20' },
    { id: ReachoutStatus.Queued, label: 'Queued', icon: <UserPlus size={14} />, color: 'text-amber-400', bgActive: 'bg-amber-500/10 border-amber-500/30' },
    { id: ReachoutStatus.Contacted, label: 'Contacted', icon: <Phone size={14} />, color: 'text-blue-400', bgActive: 'bg-blue-500/10 border-blue-500/30' },
    { id: ReachoutStatus.Responded, label: 'Responded', icon: <MessageSquare size={14} />, color: 'text-purple-400', bgActive: 'bg-purple-500/10 border-purple-500/30' },
    { id: ReachoutStatus.Reactivated, label: 'Reactivated', icon: <CheckCircle size={14} />, color: 'text-emerald-400', bgActive: 'bg-emerald-500/10 border-emerald-500/30' },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
    [ReachoutStatus.Queued]: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    [ReachoutStatus.Contacted]: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    [ReachoutStatus.Responded]: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    [ReachoutStatus.Reactivated]: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

const AVATAR_COLORS = [
    'bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-rose-600',
    'bg-indigo-600', 'bg-amber-600', 'bg-cyan-600', 'bg-violet-600',
];

const CreatorReachout: React.FC<CreatorReachoutProps> = ({ creators, appSettings, onUpdateCreator, onNavigate }) => {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    // Only show creators that have been tagged for reachout
    const reachoutCreators = useMemo(() => {
        return creators.filter(c =>
            c.reachoutStatus &&
            c.reachoutStatus !== ReachoutStatus.None
        );
    }, [creators]);

    const filtered = useMemo(() => {
        let list = reachoutCreators;
        if (activeTab !== 'all') {
            list = list.filter(c => c.reachoutStatus === activeTab);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.handle.toLowerCase().includes(q) ||
                c.reachoutNote?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [reachoutCreators, activeTab, search]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: reachoutCreators.length };
        for (const s of [ReachoutStatus.Queued, ReachoutStatus.Contacted, ReachoutStatus.Responded, ReachoutStatus.Reactivated]) {
            c[s] = reachoutCreators.filter(cr => cr.reachoutStatus === s).length;
        }
        return c;
    }, [reachoutCreators]);

    const getHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return Math.abs(hash);
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    const handleAdvanceStatus = (creator: Creator) => {
        const pipeline: ReachoutStatus[] = [ReachoutStatus.Queued, ReachoutStatus.Contacted, ReachoutStatus.Responded, ReachoutStatus.Reactivated];
        const idx = pipeline.indexOf(creator.reachoutStatus || ReachoutStatus.Queued);
        const next = pipeline[Math.min(idx + 1, pipeline.length - 1)];
        const updates: Partial<Creator> = {
            reachoutStatus: next,
            reachoutDate: new Date().toISOString(),
        };
        // If reactivated, also set status back to Active
        if (next === ReachoutStatus.Reactivated) {
            updates.status = CreatorStatus.Active;
        }
        onUpdateCreator(creator.id, updates);
    };

    const handleRemoveFromReachout = (id: string) => {
        const creator = creators.find(c => c.id === id);
        const creatorName = creator?.name || 'This creator';
        if (!window.confirm(`Return "${creatorName}" to the Active Roster?\n\nThey will be removed from Reachout and placed back into the active creator pool.`)) return;

        onUpdateCreator(id, {
            reachoutStatus: ReachoutStatus.None,
            reachoutNote: undefined,
            reachoutDate: undefined,
            status: CreatorStatus.Active, // Ensure creator goes back to active roster
        });

        // Navigate to active roster and search for the creator so user can SEE them
        alert(`✅ "${creatorName}" has been returned to the Active Roster!`);
        onNavigate('active');
    };

    const handleSaveNote = (id: string) => {
        onUpdateCreator(id, { reachoutNote: noteText });
        setEditingNote(null);
        setNoteText('');
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return ''; }
    };

    const nextStatusLabel = (status?: ReachoutStatus) => {
        switch (status) {
            case ReachoutStatus.Queued: return 'Mark Contacted';
            case ReachoutStatus.Contacted: return 'Mark Responded';
            case ReachoutStatus.Responded: return 'Reactivate';
            case ReachoutStatus.Reactivated: return 'Done ✓';
            default: return 'Advance';
        }
    };

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                            <UserPlus size={20} className="text-amber-400" />
                        </div>
                        Creator Reachout
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 ml-[52px]">
                        {reachoutCreators.length} creator{reachoutCreators.length !== 1 ? 's' : ''} tagged for reactivation
                    </p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search creators..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                </div>
            </div>

            {/* STATUS TABS */}
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap
              ${activeTab === tab.id
                                ? `${tab.bgActive} ${tab.color}`
                                : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-white/10' : 'bg-neutral-800'}`}>
                            {counts[tab.id] || 0}
                        </span>
                    </button>
                ))}
            </div>

            {/* EMPTY STATE */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6">
                        <UserPlus size={32} className="text-neutral-700" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-2">
                        {reachoutCreators.length === 0 ? 'No Creators Tagged Yet' : 'No Results'}
                    </h3>
                    <p className="text-xs text-neutral-500 max-w-sm">
                        {reachoutCreators.length === 0
                            ? 'Open a creator\'s profile and click "Tag for Reachout" to start building your reactivation list.'
                            : 'Try adjusting your search or filter to find tagged creators.'}
                    </p>
                </div>
            )}

            {/* CREATOR LIST */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map(creator => {
                    const badge = STATUS_BADGE[creator.reachoutStatus || ReachoutStatus.Queued];
                    const initials = getInitials(creator.name);
                    const colorIndex = getHash(creator.name) % AVATAR_COLORS.length;
                    const hasRealImage = creator.profileImage && creator.profileImage.length > 10 && !creator.profileImage.includes('picsum.photos/seed');
                    const isEditing = editingNote === creator.id;

                    return (
                        <div
                            key={creator.id}
                            className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {hasRealImage ? (
                                        <img src={creator.profileImage} alt={creator.name} className="w-12 h-12 rounded-xl object-cover border-2 border-neutral-800" crossOrigin="anonymous" />
                                    ) : (
                                        <div className={`w-12 h-12 rounded-xl ${AVATAR_COLORS[colorIndex]} border-2 border-neutral-800 flex items-center justify-center text-lg font-black text-white uppercase tracking-tighter`}>
                                            {initials}
                                        </div>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 bg-neutral-900 rounded-full w-5 h-5 flex items-center justify-center text-[9px] border border-neutral-700">
                                        {PLATFORM_ICONS[creator.platform]}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-black text-white uppercase tracking-tighter text-sm truncate">{creator.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${badge.bg} ${badge.text} ${badge.border}`}>
                                            {creator.reachoutStatus}
                                        </span>
                                        {creator.rating && (
                                            <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-widest ${RATING_COLORS[creator.rating]}`}>
                                                {creator.rating}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{creator.handle}</p>

                                    {/* Reachout Note */}
                                    {isEditing ? (
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                value={noteText}
                                                onChange={e => setNoteText(e.target.value)}
                                                placeholder="Why are you reaching out? e.g. 'Loved their IG reels'"
                                                className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/40"
                                                autoFocus
                                                onKeyDown={e => e.key === 'Enter' && handleSaveNote(creator.id)}
                                            />
                                            <button onClick={() => handleSaveNote(creator.id)} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-black uppercase hover:bg-amber-500/20 transition-colors border border-amber-500/20">Save</button>
                                            <button title="Cancel" onClick={() => { setEditingNote(null); setNoteText(''); }} className="px-2 py-1.5 text-neutral-500 hover:text-white transition-colors"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="mt-2 flex items-start gap-2">
                                            <StickyNote size={12} className="text-neutral-600 mt-0.5 flex-shrink-0" />
                                            <button
                                                onClick={() => { setEditingNote(creator.id); setNoteText(creator.reachoutNote || ''); }}
                                                className="text-[10px] text-neutral-400 italic hover:text-white transition-colors text-left leading-relaxed"
                                            >
                                                {creator.reachoutNote || 'Click to add a note...'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Date */}
                                    {creator.reachoutDate && (
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <Calendar size={10} className="text-neutral-600" />
                                            <span className="text-[9px] text-neutral-600">Tagged {formatDate(creator.reachoutDate)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    {creator.reachoutStatus !== ReachoutStatus.Reactivated && (
                                        <button
                                            onClick={() => handleAdvanceStatus(creator)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            <ArrowRight size={12} />
                                            {nextStatusLabel(creator.reachoutStatus)}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRemoveFromReachout(creator.id)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        <RefreshCw size={12} />
                                        Return to Pool
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CreatorReachout;
