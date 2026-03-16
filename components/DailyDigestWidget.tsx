import React, { useState } from 'react';
import { AlertTriangle, Clock, MessageSquare, Truck, CheckCircle, ArrowRight, Brain, Loader2, Sparkles, DollarSign, Video, UserCheck } from 'lucide-react';
import { Creator, TeamTask, TeamMessage, ContentItem, ContentStatus, ShipmentStatus, PaymentStatus } from '../types';
import { auraDigest } from '../services/aura/auraCore';

interface DailyDigestWidgetProps {
    creators: Creator[];
    teamTasks: TeamTask[];
    teamMessages: TeamMessage[];
    contentItems?: ContentItem[];
    currentUser: string;
    onNavigate: (view: string) => void;
}

const DailyDigestWidget: React.FC<DailyDigestWidgetProps> = ({
    creators, teamTasks, teamMessages, contentItems = [], currentUser, onNavigate
}) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // Overdue tasks
        const overdueTasks = teamTasks.filter(t =>
            t.status !== 'Done' && t.dueDate && t.dueDate < today
        );

        // My pending tasks
        const myTasks = teamTasks.filter(t =>
            t.status !== 'Done' && t.assignedTo.toLowerCase().includes(currentUser.split('@')[0].toLowerCase())
        );

        // Pending shipments (Preparing or Issue)
        const pendingShipments = creators.flatMap(c =>
            (c.shipments || []).filter(s =>
                s.status === ShipmentStatus.Preparing || s.status === ShipmentStatus.Issue
            )
        );

        // Creators with payment requested (Processing status)
        const pendingPayments = creators.filter(c => c.paymentStatus === PaymentStatus.Processing);

        // Recent messages (last 24 hours)
        const recentMessages = teamMessages.filter(m =>
            m.timestamp > yesterday && m.sender !== currentUser
        );

        // Messages mentioning me
        const myMentions = teamMessages.filter(m =>
            m.timestamp > yesterday &&
            m.mentions?.some(mention =>
                currentUser.toLowerCase().includes(mention.toLowerCase())
            )
        );

        // Videos pending review (Raw status, uploaded from creator portal = cloud storage)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const pendingReviewVideos = contentItems.filter(c =>
            c.status === ContentStatus.Raw && c.uploadDate > weekAgo &&
            c.creatorId && c.creatorId !== 'team' && (c.submittedByCreator || c.storageType === 'cloud')
        );

        // Unread creator messages in last 24h (exclude already-read messages)
        const creatorMessages = teamMessages.filter(m =>
            m.timestamp > yesterday && m.isCreatorMessage && !m.readByTeam
        );

        // Upcoming deadlines (next 3 days)
        const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const upcomingDeadlines = teamTasks.filter(t =>
            t.status !== 'Done' && t.dueDate && t.dueDate >= today && t.dueDate <= threeDaysOut
        );

        const items = [
            {
                show: pendingReviewVideos.length > 0,
                icon: <Video size={14} className="text-fuchsia-400 animate-pulse" />,
                label: `${pendingReviewVideos.length} video${pendingReviewVideos.length !== 1 ? 's' : ''} pending review`,
                color: 'text-fuchsia-400',
                bgColor: 'bg-fuchsia-500/10 border-fuchsia-500/20',
                action: () => onNavigate('pending-review')
            },
            {
                show: creatorMessages.length > 0,
                icon: <UserCheck size={14} className="text-emerald-400" />,
                label: `${creatorMessages.length} message${creatorMessages.length !== 1 ? 's' : ''} from creators`,
                color: 'text-emerald-400',
                bgColor: 'bg-emerald-500/10 border-emerald-500/20',
                action: () => onNavigate('dashboard')
            },
            {
                show: overdueTasks.length > 0,
                icon: <AlertTriangle size={14} className="text-red-400" />,
                label: `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}`,
                color: 'text-red-400',
                bgColor: 'bg-red-500/10 border-red-500/20',
                action: () => onNavigate('team')
            },
            {
                show: myTasks.length > 0,
                icon: <Clock size={14} className="text-amber-400" />,
                label: `${myTasks.length} task${myTasks.length !== 1 ? 's' : ''} assigned to you`,
                color: 'text-amber-400',
                bgColor: 'bg-amber-500/10 border-amber-500/20',
                action: () => onNavigate('team')
            },
            {
                show: pendingShipments.length > 0,
                icon: <Truck size={14} className="text-blue-400" />,
                label: `${pendingShipments.length} shipment${pendingShipments.length !== 1 ? 's' : ''} need attention`,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/10 border-blue-500/20',
                action: () => onNavigate('active:shipments')
            },
            {
                show: pendingPayments.length > 0,
                icon: <DollarSign size={14} className="text-amber-400" />,
                label: `${pendingPayments.length} creator${pendingPayments.length !== 1 ? 's' : ''} awaiting payment`,
                color: 'text-amber-400',
                bgColor: 'bg-amber-500/10 border-amber-500/20',
                action: () => onNavigate('payments')
            },
            {
                show: myMentions.length > 0,
                icon: <MessageSquare size={14} className="text-purple-400" />,
                label: `${myMentions.length} message${myMentions.length !== 1 ? 's' : ''} mentioning you`,
                color: 'text-purple-400',
                bgColor: 'bg-purple-500/10 border-purple-500/20',
                action: () => onNavigate('dashboard')
            },
            {
                show: upcomingDeadlines.length > 0,
                icon: <Clock size={14} className="text-cyan-400" />,
                label: `${upcomingDeadlines.length} deadline${upcomingDeadlines.length !== 1 ? 's' : ''} in next 3 days`,
                color: 'text-cyan-400',
                bgColor: 'bg-cyan-500/10 border-cyan-500/20',
                action: () => onNavigate('team')
            },
        ].filter(item => item.show);

        // If nothing to show, show a clean "all clear" state
        if (items.length === 0) {
            return (
                <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 mb-8 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle size={20} className="text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">All clear today</p>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">No pending items • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                        📋 Daily Digest • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                    <AuraBriefingButton creators={creators} currentUser={currentUser} />
                </div>
                <div className="flex flex-wrap gap-3">
                    {items.map((item, i) => (
                        <button
                            key={i}
                            onClick={item.action}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 ${item.bgColor}`}
                        >
                            {item.icon}
                            <span className={item.color}>{item.label}</span>
                            <ArrowRight size={10} className="opacity-50" />
                        </button>
                    ))}
                </div>
            </div>
        );
    } catch (e) {
        // Safety: never crash the app
        console.warn('[DailyDigest] Render error (non-blocking):', e);
        return null;
    }
};

export default DailyDigestWidget;

// ── Coco Briefing Button (inline subcomponent) ──
const AuraBriefingButton: React.FC<{ creators: Creator[]; currentUser: string }> = ({ creators, currentUser }) => {
    const [briefing, setBriefing] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const cache_key = 'coco_daily_briefing_' + new Date().toISOString().split('T')[0];

    // Check cache on mount
    React.useEffect(() => {
        try {
            const cached = sessionStorage.getItem(cache_key);
            if (cached) setBriefing(cached);
        } catch { /* ignore */ }
    }, []);

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const result = await auraDigest({ creators, campaigns: [], content: [] }, currentUser);
            setBriefing(result);
            try { sessionStorage.setItem(cache_key, result); } catch { /* ignore */ }
        } catch (e) {
            setBriefing('Could not generate briefing right now. Try again in a moment.');
        }
        setIsLoading(false);
    };

    if (briefing) {
        return (
            <div className="w-full mt-3 mb-1 p-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/15 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                    <Brain size={12} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Coco's Morning Brief</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">{briefing}</p>
            </div>
        );
    }

    return (
        <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold hover:from-emerald-500/20 hover:to-teal-500/20 transition-all disabled:opacity-50"
        >
            {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />}
            {isLoading ? 'Thinking...' : 'Coco Brief'}
        </button>
    );
};
