import React, { useState, useEffect, useRef } from 'react';
import { Creator, Campaign, ContentItem, ContentStatus, TeamMessage } from '../../types';
import {
    LayoutDashboard, MessageCircle, Upload, CreditCard, Package, Briefcase,
    ArrowRight, Bell, BellOff, Zap, Trophy, TrendingUp, Calendar, Sparkles, Star, AlertTriangle, CheckCircle
} from 'lucide-react';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    contentItems: ContentItem[];
    teamMessages: TeamMessage[];
    onNavigate: (view: string) => void;
    onEnableNotifications?: () => void;
}

// Fun confetti component
const Confetti: React.FC<{ active: boolean }> = ({ active }) => {
    if (!active) return null;
    const colors = ['#a855f7', '#facc15', '#34d399', '#f472b6', '#60a5fa'];
    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute animate-confetti"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `-${Math.random() * 20}px`,
                        width: `${6 + Math.random() * 8}px`,
                        height: `${6 + Math.random() * 8}px`,
                        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${2 + Math.random() * 2}s`,
                    }}
                />
            ))}
            <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti 3s ease-in-out forwards; }
      `}</style>
        </div>
    );
};

// Animated number counter
const AnimatedNumber: React.FC<{ value: number; prefix?: string; duration?: number }> = ({
    value, prefix = '', duration = 1500
}) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (value === 0) { setDisplay(0); return; }
        const step = value / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
            current += step;
            if (current >= value) { setDisplay(value); clearInterval(timer); }
            else setDisplay(Math.floor(current));
        }, 16);
        return () => clearInterval(timer);
    }, [value, duration]);
    return <span>{prefix}{display.toLocaleString()}</span>;
};

const CreatorDashboard: React.FC<Props> = ({ creator, campaigns, contentItems, teamMessages, onNavigate, onEnableNotifications }) => {
    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creator.id));
    const myContent = contentItems.filter(c => c.creatorId === creator.id || c.creatorName === creator.name);
    const needsEditing = myContent.filter(c => c.status === ContentStatus.Editing);
    const recentlyApproved = myContent.filter(c => c.status === ContentStatus.Approved);
    const pendingTasks = myCampaigns.flatMap(c => c.tasks?.filter(t => !t.isDone) || []);
    const allTasks = myCampaigns.flatMap(c => c.tasks || []);
    const completedTasks = allTasks.filter(t => t.isDone).length;
    const allDone = allTasks.length > 0 && completedTasks === allTasks.length;
    const [showConfetti, setShowConfetti] = useState(false);
    const confettiShownRef = useRef(false);

    // Trigger confetti when all tasks done
    useEffect(() => {
        if (allDone && !confettiShownRef.current) {
            confettiShownRef.current = true;
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
        }
    }, [allDone]);

    const feedbackCount = myContent.reduce((acc, c) => acc + (c.teamNotes?.length || 0), 0);
    const newCampaigns = myCampaigns.filter(c => !c.acceptedByCreatorIds?.includes(creator.id));

    // Time-based greeting
    const hour = new Date().getHours();
    const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🔥' : hour < 21 ? '🌙' : '✨';
    const greetingText = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Night owl mode';

    // Streak calculation (simplified — days since dateAdded or lastActiveDate)
    const daysSinceJoin = Math.floor((Date.now() - new Date(creator.dateAdded).getTime()) / (1000 * 60 * 60 * 24));
    const streak = Math.min(daysSinceJoin + 1, 30); // Cap at 30

    const earnings = creator.totalEarned || 0;

    const statusColor = creator.paymentStatus === 'Paid' ? 'text-emerald-400' :
        creator.paymentStatus === 'Processing' ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Confetti active={showConfetti} />

            {/* NOTIFICATION BANNER */}
            {!creator.notificationsEnabled && (
                <button
                    onClick={onEnableNotifications}
                    className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition-all group animate-pulse-slow"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Bell size={18} className="text-purple-400" />
                    </div>
                    <div className="text-left flex-1">
                        <p className="text-sm font-bold text-white">Enable Notifications 🔔</p>
                        <p className="text-[10px] text-neutral-400">Get instant alerts when campaigns are assigned, payments update, and more</p>
                    </div>
                    <ArrowRight size={14} className="text-neutral-600 group-hover:text-purple-400 transition-colors" />
                </button>
            )}

            {/* WELCOME BANNER */}
            <div className="bg-gradient-to-br from-purple-600/20 via-indigo-500/10 to-pink-500/10 border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{greetingEmoji}</span>
                        <h1 className="text-2xl font-black text-white">
                            {greetingText}, {creator.name.split(' ')[0]}!
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm mb-4">
                        {creator.status === 'Active' ? "You're crushing it" : `Status: ${creator.status}`}
                        {creator.campaign && <> • <span className="text-purple-400 font-bold">{creator.campaign}</span></>}
                    </p>

                    {/* Streak & Earnings Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
                            <Zap size={14} className="text-yellow-400" />
                            <span className="text-sm font-black text-white">{streak}</span>
                            <span className="text-[10px] text-neutral-500 font-bold uppercase">Day Streak</span>
                        </div>
                        {earnings > 0 && (
                            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
                                <TrendingUp size={14} className="text-emerald-400" />
                                <span className="text-sm font-black text-emerald-400">
                                    <AnimatedNumber value={earnings} prefix="$" />
                                </span>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase">Earned</span>
                            </div>
                        )}
                        {completedTasks > 0 && (
                            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
                                <Trophy size={14} className="text-purple-400" />
                                <span className="text-sm font-black text-white">{completedTasks}</span>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase">Tasks Done</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* REVISION REQUESTED BANNER */}
            {needsEditing.length > 0 && (
                <div className="space-y-3">
                    {needsEditing.map(item => {
                        const latestTeamNote = [...(item.teamNotes || [])].reverse().find(n => !n.isCreatorReply);
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate('upload')}
                                className="w-full text-left bg-gradient-to-r from-orange-500/15 to-amber-500/10 border-2 border-orange-500/40 rounded-2xl p-5 hover:border-orange-500/60 transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <AlertTriangle size={18} className="text-orange-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                                                Revision Requested{item.revisionCount ? ` (Revision #${item.revisionCount})` : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                                        {latestTeamNote && (
                                            <div className="bg-black/30 rounded-lg px-3 py-2 border border-orange-500/10">
                                                <p className="text-[10px] text-orange-300/80 font-bold uppercase tracking-widest mb-0.5">Team Notes:</p>
                                                <p className="text-xs text-neutral-300 leading-relaxed">{latestTeamNote.text}</p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-orange-400/60 mt-2 group-hover:text-orange-400 transition-colors flex items-center gap-1">
                                            Tap to open Content Hub and re-upload <ArrowRight size={10} />
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* CONTENT APPROVED BANNER */}
            {recentlyApproved.length > 0 && (
                <div className="space-y-3">
                    {recentlyApproved.map(item => (
                        <div
                            key={item.id}
                            className="w-full text-left bg-gradient-to-r from-emerald-500/15 to-green-500/10 border-2 border-emerald-500/40 rounded-2xl p-5"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle size={18} className="text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                            Content Approved! 🎉
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                                    <p className="text-[10px] text-emerald-400/60">
                                        {item.paymentRequested ? '💰 Payment has been queued!' : 'Great work — your content is ready!'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* NEW CAMPAIGNS ALERT */}
            {newCampaigns.length > 0 && (
                <button
                    onClick={() => onNavigate('campaigns')}
                    className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl hover:border-yellow-500/50 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center animate-bounce">
                        <Sparkles size={18} className="text-yellow-400" />
                    </div>
                    <div className="text-left flex-1">
                        <p className="text-sm font-bold text-white">
                            {newCampaigns.length} New Campaign{newCampaigns.length > 1 ? 's' : ''}! 🎉
                        </p>
                        <p className="text-[10px] text-neutral-400">Tap to view and accept</p>
                    </div>
                    <ArrowRight size={14} className="text-neutral-600 group-hover:text-yellow-400 transition-colors" />
                </button>
            )}

            {/* QUICK STATS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Payment', value: creator.paymentStatus, color: statusColor, view: 'payments', icon: CreditCard, glow: 'hover:shadow-purple-500/10' },
                    { label: 'Messages', value: `${feedbackCount || 0}`, color: feedbackCount > 0 ? 'text-blue-400' : 'text-neutral-500', view: 'chat', icon: MessageCircle, glow: 'hover:shadow-blue-500/10' },
                    { label: 'Uploads', value: `${myContent.length}`, color: 'text-purple-400', view: 'upload', icon: Upload, glow: 'hover:shadow-purple-500/10' },
                    { label: 'Tasks', value: `${pendingTasks.length} open`, color: pendingTasks.length > 0 ? 'text-yellow-400' : 'text-emerald-400', view: 'campaigns', icon: Briefcase, glow: 'hover:shadow-yellow-500/10' },
                ].map(stat => (
                    <button
                        key={stat.label}
                        onClick={() => onNavigate(stat.view)}
                        className={`bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-4 text-left hover:border-purple-500/30 transition-all duration-300 group hover:scale-[1.02] hover:shadow-xl ${stat.glow}`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                <stat.icon size={14} className="text-neutral-500 group-hover:text-purple-400 transition-colors" />
                            </div>
                            <ArrowRight size={10} className="text-neutral-700 group-hover:text-purple-400 transition-colors group-hover:translate-x-1 duration-200" />
                        </div>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest mt-0.5">{stat.label}</p>
                    </button>
                ))}
            </div>

            {/* ACTIVE CAMPAIGNS TIMELINE */}
            {myCampaigns.length > 0 && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                        <Briefcase size={14} /> My Campaigns
                    </h3>
                    <div className="space-y-3">
                        {myCampaigns.map(campaign => {
                            const doneTasks = campaign.tasks?.filter(t => t.isDone).length || 0;
                            const totalTasks = campaign.tasks?.length || 0;
                            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                            const isComplete = progress === 100;
                            const hasDeadline = campaign.deadline;
                            const daysLeft = hasDeadline ? Math.max(0, Math.ceil((new Date(campaign.deadline!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

                            return (
                                <button
                                    key={campaign.id}
                                    onClick={() => onNavigate('campaigns')}
                                    className={`w-full text-left p-4 rounded-xl border transition-all group hover:scale-[1.01] ${isComplete
                                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                                        : 'bg-black/50 border-neutral-800 hover:border-purple-500/30'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {isComplete && <span className="text-lg">🏆</span>}
                                            <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{campaign.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {daysLeft !== null && !isComplete && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${daysLeft <= 2 ? 'bg-red-500/10 text-red-400' :
                                                    daysLeft <= 5 ? 'bg-yellow-500/10 text-yellow-400' :
                                                        'bg-neutral-500/10 text-neutral-400'
                                                    }`}>
                                                    <Calendar size={8} className="inline mr-1" />{daysLeft}d left
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold text-neutral-500 uppercase">{campaign.status}</span>
                                        </div>
                                    </div>
                                    {totalTasks > 0 && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-bold whitespace-nowrap">{doneTasks}/{totalTasks}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* RECENT VIDEO FEEDBACK */}
            {myContent.some(c => c.teamNotes && c.teamNotes.length > 0) && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                        <Star size={14} /> Recent Feedback
                    </h3>
                    <div className="space-y-2">
                        {myContent
                            .filter(c => c.teamNotes && c.teamNotes.length > 0)
                            .slice(0, 3)
                            .map(content => {
                                const latestNote = content.teamNotes![content.teamNotes!.length - 1];
                                return (
                                    <button
                                        key={content.id}
                                        onClick={() => onNavigate('upload')}
                                        className="w-full text-left p-3 bg-black/50 rounded-xl border border-neutral-800 hover:border-purple-500/30 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-white">{content.title}</span>
                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${content.status === ContentStatus.Approved ? 'bg-emerald-500/10 text-emerald-400' :
                                                content.status === ContentStatus.Editing ? 'bg-orange-500/10 text-orange-400' :
                                                    'bg-neutral-500/10 text-neutral-400'
                                                }`}>{content.status}</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 truncate">💬 {latestNote.user}: {latestNote.text}</p>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* SHIPMENTS */}
            {creator.shipments && creator.shipments.length > 0 && (
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                        <Package size={14} /> Incoming Shipments 📦
                    </h3>
                    <div className="space-y-2">
                        {creator.shipments.slice(0, 3).map(shipment => (
                            <div key={shipment.id} className="flex items-center justify-between p-3 bg-black/50 rounded-xl border border-neutral-800">
                                <div>
                                    <p className="text-xs font-bold text-white">{shipment.title}</p>
                                    <p className="text-[10px] text-neutral-500">{shipment.carrier} • {shipment.trackingNumber}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${shipment.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400' :
                                    shipment.status === 'In Transit' ? 'bg-blue-500/10 text-blue-400' :
                                        'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                    {shipment.status === 'Delivered' ? '✅ ' : shipment.status === 'In Transit' ? '🚚 ' : '📦 '}{shipment.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
        </div>
    );
};

export default CreatorDashboard;
