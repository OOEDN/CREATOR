import React, { useState } from 'react';
import { ContentItem, ContentStatus, ContentType, Platform } from '../types';
import {
    CheckCircle, XCircle, MessageSquare, Send, Eye, Film, Image as ImageIcon,
    Clock, ChevronDown, ChevronUp, Sparkles, ArrowRight, AlertCircle
} from 'lucide-react';

interface PendingReviewProps {
    contentItems: ContentItem[];
    onUpdateContent: (id: string, updates: Partial<ContentItem>) => void;
    onNavigate: (view: string) => void;
    onNotifyRevision?: (item: ContentItem, note: string) => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; emoji: string; label: string }> = {
    [ContentStatus.Raw]: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', emoji: '📦', label: 'Pending Review' },
    [ContentStatus.Editing]: { bg: 'bg-amber-500/10', text: 'text-amber-400', emoji: '✂️', label: 'Changes Requested' },
    [ContentStatus.Approved]: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', emoji: '✅', label: 'Approved' },
    [ContentStatus.Ready]: { bg: 'bg-blue-500/10', text: 'text-blue-400', emoji: '🟢', label: 'Ready' },
    [ContentStatus.Posted]: { bg: 'bg-purple-500/10', text: 'text-purple-400', emoji: '🚀', label: 'Posted' },
};

const PendingReview: React.FC<PendingReviewProps> = ({ contentItems, onUpdateContent, onNavigate, onNotifyRevision }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'changes' | 'approved'>('pending');

    // Only show content that was UPLOADED FROM the creator portal
    // submittedByCreator flag is set during creator upload — works regardless of GCS success
    // Also check storageType === 'cloud' for backward compat with items before the flag was added
    const creatorContent = contentItems.filter(c =>
        c.creatorId && c.creatorId !== 'team' && (c.submittedByCreator || c.storageType === 'cloud')
    );

    const filteredContent = creatorContent.filter(c => {
        if (filter === 'pending') return c.status === ContentStatus.Raw;
        if (filter === 'changes') return c.status === ContentStatus.Editing;
        if (filter === 'approved') return c.status === ContentStatus.Approved;
        return true; // 'all'
    }).sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    const pendingCount = creatorContent.filter(c => c.status === ContentStatus.Raw).length;
    const changesCount = creatorContent.filter(c => c.status === ContentStatus.Editing).length;
    const approvedCount = creatorContent.filter(c => c.status === ContentStatus.Approved).length;

    const handleApprove = (id: string) => {
        onUpdateContent(id, {
            status: ContentStatus.Approved,
            approvedByTeam: true,
            approvedAt: new Date().toISOString(),
            approvedBy: 'Team',
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'Team',
        });
    };

    const handleRequestChanges = (id: string, note?: string) => {
        const updates: Partial<ContentItem> = {
            status: ContentStatus.Editing,
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'Team',
        };
        // If there's a note, add it
        if (note) {
            const item = contentItems.find(c => c.id === id);
            const teamNote = {
                id: crypto.randomUUID(),
                user: 'Team',
                text: note,
                date: new Date().toISOString(),
            };
            updates.teamNotes = [...(item?.teamNotes || []), teamNote];
        }
        onUpdateContent(id, updates);
        // Notify creator about the revision request
        if (onNotifyRevision) {
            const item = contentItems.find(c => c.id === id);
            if (item) onNotifyRevision(item, note || 'Changes requested by the team.');
        }
    };

    const handleAddNote = (id: string) => {
        if (!noteText.trim()) return;
        const item = contentItems.find(c => c.id === id);
        const note = {
            id: crypto.randomUUID(),
            user: 'Team',
            text: noteText.trim(),
            date: new Date().toISOString(),
        };
        onUpdateContent(id, {
            teamNotes: [...(item?.teamNotes || []), note],
        });
        setNoteText('');
    };

    const formatDate = (iso: string) => {
        try {
            const d = new Date(iso);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffHrs = Math.floor(diffMs / 3600000);
            if (diffHrs < 1) return 'Just now';
            if (diffHrs < 24) return `${diffHrs}h ago`;
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                            <Eye size={20} className="text-fuchsia-400" />
                        </div>
                        Content Review
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 ml-[52px]">Review, approve, or request changes on creator submissions</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-800">
                <button
                    onClick={() => setFilter('pending')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-fuchsia-500 text-black shadow-lg shadow-fuchsia-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    📦 Pending {pendingCount > 0 && <span className="bg-black/30 text-white px-1.5 py-0.5 rounded-md text-[9px]">{pendingCount}</span>}
                </button>
                <button
                    onClick={() => setFilter('changes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filter === 'changes' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    ✂️ Changes Requested {changesCount > 0 && <span className="bg-black/30 text-white px-1.5 py-0.5 rounded-md text-[9px]">{changesCount}</span>}
                </button>
                <button
                    onClick={() => setFilter('approved')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filter === 'approved' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    ✅ Approved {approvedCount > 0 && <span className="bg-black/30 text-white px-1.5 py-0.5 rounded-md text-[9px]">{approvedCount}</span>}
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    All {creatorContent.length > 0 && <span className="bg-black/30 text-white px-1.5 py-0.5 rounded-md text-[9px]">{creatorContent.length}</span>}
                </button>
            </div>

            {/* Empty State */}
            {filteredContent.length === 0 && (
                <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mx-auto mb-4">
                        {filter === 'pending' ? <Eye size={28} className="text-fuchsia-400" /> :
                            filter === 'changes' ? <AlertCircle size={28} className="text-amber-400" /> :
                                filter === 'approved' ? <CheckCircle size={28} className="text-emerald-400" /> :
                                    <Sparkles size={28} className="text-neutral-500" />}
                    </div>
                    <p className="text-white font-bold text-sm">
                        {filter === 'pending' ? 'No content pending review' :
                            filter === 'changes' ? 'No items awaiting creator changes' :
                                filter === 'approved' ? 'No approved content yet' :
                                    'No creator submissions yet'}
                    </p>
                    <p className="text-neutral-600 text-[10px] mt-1">
                        {filter === 'pending' ? 'Creator uploads will appear here for your review' :
                            'Items will appear here as their status changes'}
                    </p>
                </div>
            )}

            {/* Review Queue */}
            <div className="space-y-3">
                {filteredContent.map(item => {
                    const isExpanded = expandedId === item.id;
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG[ContentStatus.Raw];
                    const notes = item.teamNotes || [];

                    return (
                        <div key={item.id} className={`bg-ooedn-gray border rounded-2xl overflow-hidden transition-all ${item.status === ContentStatus.Raw ? 'border-fuchsia-500/30' :
                            item.status === ContentStatus.Editing ? 'border-amber-500/30' :
                                'border-neutral-800'
                            }`}>
                            {/* Header Row */}
                            <div
                                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-neutral-800/30 transition-colors"
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            >
                                {/* Type Icon */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === ContentType.Video ? 'bg-purple-500/10' : 'bg-blue-500/10'
                                    }`}>
                                    {item.type === ContentType.Video ?
                                        <Film size={20} className="text-purple-400" /> :
                                        <ImageIcon size={20} className="text-blue-400" />}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-black text-white truncate">{item.title}</p>
                                        {notes.length > 0 && (
                                            <span className="flex items-center gap-0.5 text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                                                <MessageSquare size={8} /> {notes.length}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-neutral-500">
                                        by <span className="text-white font-bold">@{item.creatorName || 'Unknown'}</span> • {item.platform} • {formatDate(item.uploadDate)}
                                    </p>
                                </div>

                                {/* Status Badge */}
                                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg ${sc.bg} ${sc.text} flex items-center gap-1 flex-shrink-0`}>
                                    {sc.emoji} {sc.label}
                                </span>

                                {/* Quick Actions (visible without expanding) */}
                                {item.status === ContentStatus.Raw && (
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleApprove(item.id); }}
                                            className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all"
                                            title="Approve"
                                        >
                                            <CheckCircle size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedId(item.id); }}
                                            className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-all"
                                            title="Request Changes"
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                    </div>
                                )}

                                {isExpanded ? <ChevronUp size={14} className="text-neutral-600 flex-shrink-0" /> : <ChevronDown size={14} className="text-neutral-600 flex-shrink-0" />}
                            </div>

                            {/* Expanded Panel */}
                            {isExpanded && (
                                <div className="border-t border-neutral-800 p-5 space-y-4 bg-black/20">
                                    {/* Action Buttons */}
                                    {(item.status === ContentStatus.Raw || item.status === ContentStatus.Editing) && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(item.id)}
                                                className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={16} /> Approve Content
                                            </button>
                                            <button
                                                onClick={() => handleRequestChanges(item.id, noteText.trim() || undefined)}
                                                className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={16} /> Request Changes
                                            </button>
                                        </div>
                                    )}

                                    {/* MEDIA PREVIEW */}
                                    {item.fileUrl && (() => {
                                        // Route GCS URLs through server proxy for CORS/ACL compat
                                        const isGcs = item.fileUrl.includes('storage.googleapis.com');
                                        const mediaSrc = isGcs
                                            ? `/api/media-proxy?url=${encodeURIComponent(item.fileUrl)}`
                                            : item.fileUrl;
                                        return (
                                            <div className="bg-black/50 rounded-xl border border-neutral-800 overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Eye size={10} /> Quick Preview
                                                    </span>
                                                    {item.revisionCount && item.revisionCount > 0 && (
                                                        <span className="text-[9px] font-bold bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-lg">
                                                            Revision #{item.revisionCount}
                                                        </span>
                                                    )}
                                                    <a
                                                        href={mediaSrc}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[9px] text-fuchsia-400 hover:text-fuchsia-300 font-bold flex items-center gap-1"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        Open Full ↗
                                                    </a>
                                                </div>
                                                {item.type === ContentType.Video ? (
                                                    <video
                                                        src={mediaSrc}
                                                        controls
                                                        preload="metadata"
                                                        className="w-full max-h-[400px] bg-black"
                                                        style={{ objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    <img
                                                        src={mediaSrc}
                                                        alt={item.title}
                                                        className="w-full max-h-[400px] object-contain bg-black"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Note Input */}
                                    <div>
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 block flex items-center gap-1">
                                            <MessageSquare size={10} /> Add Note for Creator
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddNote(item.id);
                                                }}
                                                placeholder="Type feedback, adjustments, or instructions..."
                                                className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-fuchsia-500/50"
                                            />
                                            <button
                                                onClick={() => handleAddNote(item.id)}
                                                disabled={!noteText.trim()}
                                                className="px-4 bg-fuchsia-500 text-black rounded-xl hover:bg-fuchsia-400 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-1 font-bold text-xs"
                                            >
                                                <Send size={14} /> Send
                                            </button>
                                        </div>
                                    </div>

                                    {/* Notes Timeline */}
                                    {notes.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                <Clock size={10} /> Conversation ({notes.length})
                                            </p>
                                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                                {notes.map(note => (
                                                    <div
                                                        key={note.id}
                                                        className={`p-3 rounded-xl border text-xs ${note.isCreatorReply
                                                            ? 'bg-purple-500/5 border-purple-500/15 ml-4'
                                                            : 'bg-blue-500/5 border-blue-500/15 mr-4'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between mb-1">
                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${note.isCreatorReply ? 'text-purple-400' : 'text-blue-400'
                                                                }`}>
                                                                {note.isCreatorReply ? `💬 ${note.user} (Creator)` : `📣 ${note.user}`}
                                                            </span>
                                                            <span className="text-[8px] text-neutral-600">{formatDate(note.date)}</span>
                                                        </div>
                                                        <p className="text-neutral-300 leading-relaxed">{note.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* File Info */}
                                    <div className="flex items-center gap-4 pt-2 border-t border-neutral-800/50">
                                        <span className="text-[9px] text-neutral-600 uppercase tracking-widest">
                                            {item.type} • {item.platform}
                                        </span>
                                        {item.storageType === 'cloud' && (
                                            <span className="text-[9px] text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                <Sparkles size={8} /> Stored in Cloud
                                            </span>
                                        )}
                                        {item.reviewedAt && (
                                            <span className="text-[9px] text-neutral-600 uppercase tracking-widest">
                                                Last reviewed: {formatDate(item.reviewedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PendingReview;
