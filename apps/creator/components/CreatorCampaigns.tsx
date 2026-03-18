import React, { useState } from 'react';
import { Creator, Campaign, ContentItem, AvatarAngle } from '../../../shared/types';
import {
    Briefcase, CheckSquare, Square, Calendar, Clock, Sparkles,
    Trophy, Upload, ArrowRight, Timer, Palette, LinkIcon, ExternalLink,
    FileText, Image, ListTodo, MessageSquare, ChevronDown, ChevronRight, Eye, Send,
    UserCircle2, Unlock, Check, Star, Zap, ChevronLeft, Lock, Shield, Target, Download, Bell, Pause
} from 'lucide-react';
import CampaignProgressBar from './CampaignProgressBar';
import CaptionGenerator from './CaptionGenerator';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    contentItems: ContentItem[];
    onMarkTaskDone: (campaignId: string, taskId: string) => void;
    onAcceptCampaign: (campaignId: string) => void;
    onDeclineCampaign: (campaignId: string) => void;
    onNavigate: (view: string) => void;
    onAddComment?: (campaignId: string, text: string) => void;
    onSelectAngle?: (campaignId: string, avatarId: string, angleId: string) => void;
    onJoinWaitlist?: (campaignId: string) => void;
}

type CampaignTab = 'moodboard' | 'tasks' | 'uploads' | 'notes';

// Confetti for campaign completion
const CampaignConfetti: React.FC<{ active: boolean }> = ({ active }) => {
    if (!active) return null;
    const colors = ['#a855f7', '#facc15', '#34d399', '#f472b6', '#60a5fa', '#fb923c'];
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
            {Array.from({ length: 30 }).map((_, i) => {
                const style: React.CSSProperties = {
                    left: `${Math.random() * 100}%`,
                    top: '-5px',
                    width: `${4 + Math.random() * 6}px`,
                    height: `${4 + Math.random() * 6}px`,
                    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    animationDelay: `${Math.random() * 1}s`,
                    animationDuration: `${1.5 + Math.random() * 1.5}s`,
                };
                return <div key={i} className="absolute animate-confetti-mini" style={style} />;
            })}
            <style>{`
        @keyframes confetti-mini {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(540deg); opacity: 0; }
        }
        .animate-confetti-mini { animation: confetti-mini 2s ease-in forwards; }
      `}</style>
        </div>
    );
};

const CreatorCampaigns: React.FC<Props> = ({ creator, campaigns, contentItems, onMarkTaskDone, onAcceptCampaign, onDeclineCampaign, onNavigate, onAddComment, onSelectAngle, onJoinWaitlist }) => {
    const myCampaigns = campaigns.filter(c => (c.assignedCreatorIds?.includes(creator.id) || c.status === 'Final Campaign') && c.status !== 'Paused');
    const [completedCampaignId, setCompletedCampaignId] = useState<string | null>(null);
    const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Record<string, CampaignTab>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [noteText, setNoteText] = useState<Record<string, string>>({});
    const [selectedAngles, setSelectedAngles] = useState<Record<string, string>>({}); // campaignId_avatarId -> angleId
    const [selectedHooks, setSelectedHooks] = useState<Record<string, string[]>>({}); // campaignId_avatarId -> selected hook strings
    const [briefRevealed, setBriefRevealed] = useState<Record<string, boolean>>({}); // angleKey -> whether brief has been revealed
    const [activeAvatar, setActiveAvatar] = useState<Record<string, string>>({}); // campaignId -> avatarId (expanded avatar)
    const [reviewedCampaigns, setReviewedCampaigns] = useState<Set<string>>(new Set()); // campaigns the creator has reviewed

    const getTab = (campaignId: string) => activeTab[campaignId] || 'tasks';
    const setTab = (campaignId: string, tab: CampaignTab) => setActiveTab(prev => ({ ...prev, [campaignId]: tab }));

    const handleTaskDone = (campaignId: string, taskId: string) => {
        onMarkTaskDone(campaignId, taskId);
        const campaign = myCampaigns.find(c => c.id === campaignId);
        if (campaign) {
            const tasks = campaign.tasks || [];
            const remainingAfter = tasks.filter(t => !t.isDone && t.id !== taskId).length;
            if (remainingAfter === 0 && tasks.length > 0) {
                setCompletedCampaignId(campaignId);
                setRecentlyCompleted(prev => new Set([...prev, campaignId]));
                setTimeout(() => setCompletedCampaignId(null), 3000);
            }
        }
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return ''; }
    };

    const getTimeLeft = (deadline?: string) => {
        if (!deadline) return null;
        const diff = new Date(deadline).getTime() - Date.now();
        if (diff <= 0) return { text: 'Overdue', urgent: true };
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days <= 1) return { text: 'Due today!', urgent: true };
        if (days <= 3) return { text: `${days} days left`, urgent: true };
        return { text: `${days} days left`, urgent: false };
    };

    const tabDef = (campaignId: string) => {
        const campaign = myCampaigns.find(c => c.id === campaignId);
        const myUploads = contentItems.filter(c =>
            (c.creatorId === creator.id || c.creatorName === creator.name) &&
            c.campaignId === campaignId
        );
        const moodboardAssets = contentItems.filter(c => c.campaignId === campaignId && c.creatorName === 'MoodBoard');
        const hasMoodboard = (campaign?.styleNotes || (campaign?.referenceLinks && campaign.referenceLinks.length > 0) || moodboardAssets.length > 0);

        return [
            ...(hasMoodboard ? [{ id: 'moodboard' as CampaignTab, label: 'Moodboard', icon: Palette, emoji: '🎨' }] : []),
            { id: 'tasks' as CampaignTab, label: 'Tasks', icon: ListTodo, emoji: '✅', count: campaign?.tasks?.length || 0 },
            { id: 'uploads' as CampaignTab, label: 'Uploads', icon: Upload, emoji: '📎', count: myUploads.length },
            { id: 'notes' as CampaignTab, label: 'Notes', icon: MessageSquare, emoji: '💬', count: campaign?.comments?.length || 0 },
        ];
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <Briefcase size={24} className="text-teal-400" /> My Campaigns
                </h2>
                <p className="text-neutral-500 text-xs mt-1">View briefs, moodboards, complete deliverables, and track deadlines</p>
            </div>

            {myCampaigns.length === 0 ? (
                <div className="bg-neutral-900/40 backdrop-blur-[80px] border border-teal-500/[0.08] rounded-2xl p-12 text-center">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="text-neutral-400 text-sm font-bold">No campaigns assigned yet</p>
                    <p className="text-neutral-600 text-[10px] mt-1">When the team assigns you a campaign, it'll show up here with all the details 🎯</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {myCampaigns.map(campaign => {
                        const doneTasks = campaign.tasks?.filter(t => t.isDone).length || 0;
                        const totalTasks = campaign.tasks?.length || 0;
                        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                        const isComplete = totalTasks > 0 && doneTasks === totalTasks;
                        const isAccepted = campaign.acceptedByCreatorIds?.includes(creator.id);
                        const isNew = !isAccepted && !isComplete;
                        const timeLeft = getTimeLeft(campaign.deadline);
                        const showConfetti = completedCampaignId === campaign.id;
                        const isExpanded = expandedCampaign === campaign.id;
                        const currentTab = getTab(campaign.id);
                        const myUploads = contentItems.filter(c =>
                            (c.creatorId === creator.id || c.creatorName === creator.name) &&
                            c.campaignId === campaign.id
                        );
                        const moodboardAssets = contentItems.filter(c => c.campaignId === campaign.id && c.creatorName === 'MoodBoard');

                        return (
                            <div
                                key={campaign.id}
                                className={`bg-neutral-900/30 backdrop-blur-[80px] border rounded-2xl relative overflow-hidden transition-all ${isNew ? 'border-yellow-500/30 bg-yellow-500/5' :
                                    isComplete ? 'border-emerald-500/20' :
                                        'border-neutral-800'
                                    }`}
                            >
                                <CampaignConfetti active={showConfetti} />

                                {/* Campaign Header — clickable to expand */}
                                <button
                                    onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                                    className="w-full p-5 text-left flex items-start justify-between group"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? <ChevronDown size={14} className="text-neutral-500" /> : <ChevronRight size={14} className="text-neutral-500" />}
                                            {isComplete && <span className="text-xl">🏆</span>}
                                            {recentlyCompleted.has(campaign.id) && <span className="text-xl">🎉</span>}
                                            <h3 className="text-lg font-black text-white group-hover:text-teal-400 transition-colors">{campaign.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 ml-6 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${campaign.status === 'Final Campaign' ? 'bg-emerald-500/10 text-emerald-400' :
                                                campaign.status === 'Brainstorming' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    'bg-neutral-500/10 text-neutral-400'
                                                }`}>{campaign.status}</span>
                                            {timeLeft && !isComplete && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${timeLeft.urgent ? 'bg-red-500/10 text-red-400' : 'bg-neutral-500/10 text-neutral-400'
                                                    }`}>
                                                    <Timer size={8} /> {timeLeft.text}
                                                </span>
                                            )}
                                            {campaign.deadline && (
                                                <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                                                    <Calendar size={8} /> Due {formatDate(campaign.deadline)}
                                                </span>
                                            )}
                                            {totalTasks > 0 && (
                                                <span className="text-[10px] text-neutral-500 font-bold">{doneTasks}/{totalTasks} tasks</span>
                                            )}
                                        </div>
                                        {/* Progress bar in collapsed view */}
                                        {totalTasks > 0 && !isExpanded && (
                                            <div className="ml-6 mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden max-w-xs">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-600 to-cyan-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isNew && (
                                            <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-lg text-[10px] font-bold animate-pulse">
                                                <Sparkles size={10} /> NEW
                                            </span>
                                        )}
                                        {isComplete && (
                                            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl">
                                                <Trophy size={14} />
                                                <span className="text-[10px] font-bold">Complete!</span>
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* EXPANDED DETAIL VIEW */}
                                {isExpanded && (
                                    <div className="px-5 pb-5">
                                        {/* Brief review reminder */}
                                        {isNew && (
                                            <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                                                <Eye size={14} className="text-yellow-400 flex-shrink-0" />
                                                <p className="text-[10px] text-yellow-300 font-bold">📖 Review the full brief below before accepting. Scroll through the campaign details, choose your character & angle, then accept at the bottom.</p>
                                            </div>
                                        )}

                                        {/* Campaign Progress Tracker */}
                                        <div className="mb-4">
                                            <CampaignProgressBar campaign={campaign} creator={creator} contentItems={contentItems} />
                                        </div>

                                        {/* Caption & Hashtag Generator (for accepted campaigns) */}
                                        {isAccepted && (
                                            <div className="mb-4">
                                                <CaptionGenerator campaign={campaign} />
                                            </div>
                                        )}

                                        {/* === GAMIFIED BRIEF HUB — progressive unlock === */}
                                        {(campaign.avatars?.length || 0) > 0 && (() => {
                                            const campAvatar = activeAvatar[campaign.id];
                                            const chosenAvatar = campAvatar ? campaign.avatars!.find(a => a.id === campAvatar) : null;
                                            const angleKey = chosenAvatar ? `${campaign.id}_${chosenAvatar.id}` : '';
                                            const mySelectedAngleId = chosenAvatar ? (selectedAngles[angleKey] ||
                                                chosenAvatar.angles?.find(a => a.selectedByCreatorIds?.includes(creator.id))?.id) : undefined;
                                            const selectedAngle = mySelectedAngleId && chosenAvatar?.angles?.find(a => a.id === mySelectedAngleId);

                                            // Collect ALL hooks from all angles of chosen avatar
                                            const allHooks: { hook: string; angle: any; angleIdx: number; hookIdx: number }[] = [];
                                            if (chosenAvatar?.angles) {
                                                chosenAvatar.angles.forEach((angle: any, ai: number) => {
                                                    if (angle.hooks && angle.hooks.length > 0) {
                                                        angle.hooks.forEach((h: string, hi: number) => {
                                                            allHooks.push({ hook: h, angle, angleIdx: ai, hookIdx: hi });
                                                        });
                                                    }
                                                });
                                            }
                                            const mySelectedHooks = selectedHooks[angleKey] || [];
                                            const isBriefRevealed = briefRevealed[angleKey] || false;
                                            // Progress: 1 = choose character, 2 = choose hooks (character chosen), 3 = brief unlocked (hooks chosen + revealed)
                                            const currentStep = (mySelectedHooks.length > 0 && isBriefRevealed) ? 3 : chosenAvatar ? 2 : 1;

                                            // Campaign closed logic
                                            const maxPerAvatar = campaign.maxCreatorsPerAvatar;
                                            const campaignFull = maxPerAvatar ? campaign.avatars!.every(a => (a.matchedCreatorIds?.length || 0) >= maxPerAvatar) : false;
                                            const creatorAlreadyChose = campaign.avatars!.some(a => a.matchedCreatorIds?.includes(creator.id));
                                            const isPaused = campaign.status === 'Paused';
                                            const isOnWaitlist = campaign.waitlistCreatorIds?.includes(creator.id) || false;

                                            return (
                                                <>
                                                    <style>{`
                                                        @keyframes quest-glow {
                                                            0%, 100% { box-shadow: 0 0 20px rgba(100,170,170,0.15), 0 0 60px rgba(100,170,170,0.05); }
                                                            50% { box-shadow: 0 0 40px rgba(100,170,170,0.3), 0 0 80px rgba(100,170,170,0.1); }
                                                        }
                                                        @keyframes float-icon {
                                                            0%, 100% { transform: translateY(0px); }
                                                            50% { transform: translateY(-4px); }
                                                        }
                                                        @keyframes step-zoom-in {
                                                            from { opacity: 0; transform: scale(0.85) translateY(30px); filter: blur(8px); }
                                                            to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
                                                        }
                                                        @keyframes chosen-hero {
                                                            from { opacity: 0; transform: scale(1.1); }
                                                            to { opacity: 1; transform: scale(1); }
                                                        }
                                                        @keyframes card-entrance {
                                                            from { opacity: 0; transform: translateY(20px) scale(0.95); }
                                                            to { opacity: 1; transform: translateY(0) scale(1); }
                                                        }
                                                        @keyframes progress-fill {
                                                            from { width: 0%; }
                                                            to { width: 100%; }
                                                        }
                                                        @keyframes brief-section-reveal {
                                                            from { opacity: 0; transform: translateX(-15px); }
                                                            to { opacity: 1; transform: translateX(0); }
                                                        }
                                                        @keyframes epic-unlock {
                                                            0% { opacity: 0; transform: scale(0.7) perspective(600px) rotateX(15deg); filter: blur(10px); }
                                                            60% { transform: scale(1.02) perspective(600px) rotateX(-2deg); filter: blur(0); }
                                                            100% { opacity: 1; transform: scale(1) perspective(600px) rotateX(0); }
                                                        }
                                                        @keyframes shimmer {
                                                            0% { background-position: -200% 0; }
                                                            100% { background-position: 200% 0; }
                                                        }
                                                        @keyframes pulse-ring {
                                                            0% { box-shadow: 0 0 0 0 rgba(100,170,170,0.4); }
                                                            70% { box-shadow: 0 0 0 12px rgba(100,170,170,0); }
                                                            100% { box-shadow: 0 0 0 0 rgba(100,170,170,0); }
                                                        }
                                                        .quest-glow { animation: quest-glow 3s ease-in-out infinite; }
                                                        .float-icon { animation: float-icon 3s ease-in-out infinite; }
                                                        .step-zoom-in { animation: step-zoom-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                                                        .chosen-hero { animation: chosen-hero 0.5s ease-out forwards; }
                                                        .card-entrance { animation: card-entrance 0.5s ease-out forwards; }
                                                        .epic-unlock { animation: epic-unlock 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                                                        .brief-section-reveal { animation: brief-section-reveal 0.5s ease-out forwards; }
                                                        .shimmer-bg { background: linear-gradient(90deg, transparent 0%, rgba(100,170,170,0.08) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite; }
                                                        .pulse-ring { animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                                                        .avatar-pick:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 8px 30px rgba(100,170,170,0.2); }
                                                        .avatar-pick { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                                                    `}</style>

                                                    <div className="mb-5 bg-gradient-to-br from-teal-600/5 via-neutral-900/95 to-cyan-500/5 border border-teal-500/20 rounded-2xl overflow-hidden quest-glow">
                                                        {/* === EPIC HEADER === */}
                                                        <div className="relative bg-gradient-to-r from-teal-900/40 via-teal-700/20 to-cyan-900/40 px-5 py-5 border-b border-teal-500/15 overflow-hidden">
                                                            <div className="absolute inset-0 shimmer-bg" />
                                                            <div className="relative z-10 flex items-center gap-3 mb-3">
                                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30 float-icon pulse-ring">
                                                                    <Star size={22} className="text-white" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h3 className="text-lg font-black text-white tracking-tight">🗡️ Your Quest Begins</h3>
                                                                    <p className="text-[10px] text-teal-300/60">
                                                                        {currentStep === 1 && 'Choose your path wisely, creator...'}
                                                                        {currentStep === 2 && '🎣 Now choose your hooks — your opening lines...'}
                                                                        {currentStep === 3 && '✨ Your destiny has been revealed!'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[9px] font-bold text-teal-300/50 uppercase tracking-widest">Step</p>
                                                                    <p className="text-2xl font-black text-white">{currentStep}<span className="text-[10px] text-neutral-500">/3</span></p>
                                                                </div>
                                                            </div>

                                                            {/* Progress Bar */}
                                                            <div className="relative z-10 flex items-center gap-1.5">
                                                                {[1, 2, 3].map(step => (
                                                                    <div key={step} className="flex-1 relative">
                                                                        <div className="h-1.5 rounded-full bg-neutral-800/80 overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                                                                    currentStep > step ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 w-full'
                                                                                    : currentStep === step ? 'bg-gradient-to-r from-teal-600 to-cyan-500 w-1/2'
                                                                                    : 'w-0'
                                                                                }`}
                                                                                style={{ width: currentStep > step ? '100%' : currentStep === step ? '50%' : '0%' }}
                                                                            />
                                                                        </div>
                                                                        <p className={`text-[7px] font-black uppercase tracking-widest mt-1 text-center transition-colors ${
                                                                            currentStep > step ? 'text-emerald-400' : currentStep === step ? 'text-teal-300' : 'text-neutral-700'
                                                                        }`}>
                                                                            {step === 1 ? 'Character' : step === 2 ? 'Hook' : 'Brief'}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Campaign Paused Banner */}
                                                        {isPaused && (
                                                            <div className="px-5 py-8 text-center border-b border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-neutral-900/80">
                                                                <Pause size={32} className="text-orange-400 mx-auto mb-3" />
                                                                <h4 className="text-base font-black text-white mb-1">⏸ Campaign Paused</h4>
                                                                <p className="text-[11px] text-neutral-400 leading-relaxed">This campaign is temporarily on hold.<br/>The team will resume it when ready — hang tight!</p>
                                                            </div>
                                                        )}

                                                        {/* Campaign Closed Overlay */}
                                                        {campaignFull && !creatorAlreadyChose && !isPaused && (
                                                            <div className="px-5 py-8 text-center border-b border-neutral-800/50 bg-gradient-to-br from-red-500/5 to-neutral-900/80">
                                                                <Lock size={32} className="text-neutral-600 mx-auto mb-3" />
                                                                <h4 className="text-base font-black text-white mb-1">🔒 Campaign Filled</h4>
                                                                <p className="text-[11px] text-neutral-400 leading-relaxed mb-4">All spots for this campaign have been filled at the moment.</p>
                                                                {isOnWaitlist ? (
                                                                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                                                                        <Check size={14} />
                                                                        <span className="text-[11px] font-bold">You're on the waitlist — we'll notify you when a spot opens!</span>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => onJoinWaitlist?.(campaign.id)}
                                                                        className="bg-amber-500/10 text-amber-400 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all flex items-center gap-2 mx-auto"
                                                                    >
                                                                        <Bell size={14} /> Notify Me When Available
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {campaignFull && creatorAlreadyChose && (
                                                            <div className="px-5 py-2 border-b border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center gap-2">
                                                                <Check size={12} className="text-emerald-400" />
                                                                <span className="text-[9px] font-bold text-emerald-400">✨ Your spot is secured — campaign is now full</span>
                                                            </div>
                                                        )}

                                                        {/* === CONTENT AREA === */}
                                                        <div className="p-5">

                                                            {/* ══════════════════════════════════════════════
                                                                STEP 1: CHOOSE YOUR CHARACTER
                                                               ══════════════════════════════════════════════ */}
                                                            {currentStep === 1 && !chosenAvatar && !(campaignFull && !creatorAlreadyChose) && !isPaused && (
                                                                <div className="step-zoom-in">
                                                                    {/* Campaign Goal Teaser */}
                                                                    {(campaign.briefGoal || campaign.description) && (
                                                                        <div className="mb-5 bg-black/30 rounded-xl p-4 border border-yellow-500/15">
                                                                            <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                                <Zap size={9} /> The Mission
                                                                            </p>
                                                                            <p className="text-[11px] text-neutral-300 leading-relaxed">
                                                                                {campaign.briefGoal || campaign.description?.slice(0, 200)}
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    <div className="text-center mb-5">
                                                                        <h4 className="text-xl font-black text-white mb-1">⚔️ Choose Your Character</h4>
                                                                        <p className="text-[11px] text-neutral-400">Which avatar resonates with YOUR actual life? Select your path.</p>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4">
                                                                        {campaign.avatars!.map((avatar, idx) => {
                                                                            const isFull = !!(maxPerAvatar && (avatar.matchedCreatorIds?.length || 0) >= maxPerAvatar);
                                                                            return (
                                                                                <button
                                                                                    key={avatar.id}
                                                                                    onClick={() => { if (!isFull) setActiveAvatar(prev => ({ ...prev, [campaign.id]: avatar.id })); }}
                                                                                    className={`avatar-pick text-left bg-gradient-to-br from-neutral-900/90 to-neutral-800/50 rounded-2xl overflow-hidden group ${
                                                                                        isFull ? 'opacity-50 cursor-not-allowed border border-neutral-800' : 'border border-neutral-700/40 hover:border-teal-500/50 cursor-pointer'
                                                                                    }`}
                                                                                    style={{ animationDelay: `${idx * 0.12}s` }}
                                                                                    disabled={isFull}
                                                                                >
                                                                                    <div className={`h-1 bg-gradient-to-r ${avatar.color || 'from-teal-600 to-cyan-500'} group-hover:h-1.5 transition-all`} />
                                                                                    <div className="p-5 flex items-start gap-4">
                                                                                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${avatar.color || 'from-teal-600 to-cyan-500'} flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                                                            {avatar.imageUrl ? (
                                                                                                <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover rounded-xl" />
                                                                                            ) : (
                                                                                                <UserCircle2 size={28} className="text-white" />
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <h4 className="text-base font-black text-white group-hover:text-teal-300 transition-colors">{avatar.name}</h4>
                                                                                            <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">{avatar.description}</p>
                                                                                            {avatar.traits.length > 0 && (
                                                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                                                    {avatar.traits.map((trait, i) => (
                                                                                                        <span key={i} className="text-[7px] font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">{trait}</span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex-shrink-0 self-center">
                                                                                            {isFull ? (
                                                                                                <span className="text-[8px] font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">🔒 Full</span>
                                                                                            ) : (
                                                                                                <span className="text-[9px] font-black text-teal-400 bg-teal-500/10 px-4 py-2 rounded-xl border border-teal-500/20 group-hover:bg-teal-500 group-hover:text-white transition-all">
                                                                                                    This is me →
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* ══════════════════════════════════════════════
                                                                STEP 2: PICK YOUR HOOK(S) (after character chosen)
                                                               ══════════════════════════════════════════════ */}
                                                            {currentStep === 2 && chosenAvatar && (
                                                                <div className="step-zoom-in space-y-5">
                                                                    {/* Chosen Character Hero Badge */}
                                                                    <div className="chosen-hero bg-gradient-to-r from-emerald-500/5 to-purple-500/5 rounded-2xl p-4 border border-emerald-500/20">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${chosenAvatar.color || 'from-teal-600 to-cyan-500'} flex items-center justify-center shadow-lg`}>
                                                                                {chosenAvatar.imageUrl ? (
                                                                                    <img src={chosenAvatar.imageUrl} alt={chosenAvatar.name} className="w-full h-full object-cover rounded-xl" />
                                                                                ) : (
                                                                                    <UserCircle2 size={24} className="text-white" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">✓ Your Character</p>
                                                                                <p className="text-sm font-black text-white">{chosenAvatar.name}</p>
                                                                                <p className="text-[9px] text-neutral-400">{chosenAvatar.traits.slice(0, 3).join(' · ')}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setActiveAvatar(prev => ({ ...prev, [campaign.id]: '' }));
                                                                                    setSelectedHooks(prev => ({ ...prev, [angleKey]: [] }));
                                                                                    setBriefRevealed(prev => ({ ...prev, [angleKey]: false }));
                                                                                }}
                                                                                className="text-[8px] text-neutral-500 hover:text-teal-400 transition-colors font-bold px-2 py-1 rounded-lg hover:bg-teal-500/10"
                                                                            >
                                                                                Change
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Hook Selection */}
                                                                    <div className="text-center">
                                                                        <h4 className="text-xl font-black text-white mb-1">🎣 Pick Your Hook{allHooks.length > 1 ? '(s)' : ''}</h4>
                                                                        <p className="text-[11px] text-neutral-400">Select the opening line(s) that resonate with you. Your full brief will be revealed next.</p>
                                                                    </div>

                                                                    {allHooks.length > 0 ? (
                                                                        <div className="space-y-3">
                                                                            {allHooks.map((item, idx) => {
                                                                                const isSelected = mySelectedHooks.includes(item.hook);
                                                                                return (
                                                                                    <button
                                                                                        key={`${item.angleIdx}-${item.hookIdx}`}
                                                                                        onClick={() => {
                                                                                            setSelectedHooks(prev => {
                                                                                                const current = prev[angleKey] || [];
                                                                                                if (isSelected) {
                                                                                                    return { ...prev, [angleKey]: current.filter(h => h !== item.hook) };
                                                                                                } else {
                                                                                                    return { ...prev, [angleKey]: [...current, item.hook] };
                                                                                                }
                                                                                            });
                                                                                            // Also auto-select the angle for this hook
                                                                                            if (!isSelected) {
                                                                                                setSelectedAngles(prev => ({ ...prev, [angleKey]: item.angle.id }));
                                                                                                if (onSelectAngle) onSelectAngle(campaign.id, chosenAvatar.id, item.angle.id);
                                                                                            }
                                                                                        }}
                                                                                        className={`card-entrance avatar-pick w-full text-left rounded-2xl border p-5 ${
                                                                                            isSelected
                                                                                                ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                                                                                                : 'bg-black/30 border-neutral-800 hover:border-yellow-500/40 hover:bg-yellow-500/5'
                                                                                        } group`}
                                                                                        style={{ animationDelay: `${idx * 0.12}s` }}
                                                                                    >
                                                                                        <div className="flex items-start gap-4">
                                                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                                                                                                isSelected ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-teal-500/10 border border-teal-500/20 group-hover:bg-yellow-500/15'
                                                                                            }`}>
                                                                                                {isSelected ? <Check size={18} className="text-yellow-400" /> : <Zap size={18} className="text-teal-400 group-hover:text-yellow-400 transition-colors" />}
                                                                                            </div>
                                                                                            <div className="flex-1">
                                                                                                <p className={`text-[12px] font-bold leading-relaxed transition-colors ${
                                                                                                    isSelected ? 'text-yellow-200' : 'text-neutral-200 group-hover:text-white'
                                                                                                }`}>
                                                                                                    "{item.hook}"
                                                                                                </p>
                                                                                                {item.angle.hook && (
                                                                                                    <p className="text-[9px] text-neutral-500 mt-1.5 flex items-center gap-1">
                                                                                                        <Target size={8} /> Angle: {item.angle.hook}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex-shrink-0 self-center">
                                                                                                {isSelected ? (
                                                                                                    <span className="text-[8px] font-black text-yellow-400 bg-yellow-500/15 px-3 py-1.5 rounded-lg border border-yellow-500/30">✓ Selected</span>
                                                                                                ) : (
                                                                                                    <span className="text-[9px] font-black text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 group-hover:bg-yellow-500 group-hover:text-black transition-all">
                                                                                                        Select →
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}

                                                                            {/* Reveal Brief Button */}
                                                                            {mySelectedHooks.length > 0 && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setBriefRevealed(prev => ({ ...prev, [angleKey]: true }));
                                                                                    }}
                                                                                    className="w-full mt-2 py-4 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border border-yellow-500/30 rounded-2xl text-center group hover:from-yellow-500/30 hover:to-yellow-500/30 transition-all pulse-ring"
                                                                                >
                                                                                    <p className="text-sm font-black text-yellow-300 group-hover:text-yellow-200">🔓 Reveal Your Brief →</p>
                                                                                    <p className="text-[9px] text-yellow-400/60 mt-0.5">{mySelectedHooks.length} hook{mySelectedHooks.length !== 1 ? 's' : ''} selected</p>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-black/30 rounded-xl p-5 border border-dashed border-neutral-800 text-center">
                                                                            <Clock size={20} className="text-neutral-600 mx-auto mb-2" />
                                                                            <p className="text-[10px] text-neutral-500 font-bold">Hooks coming soon</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* ══════════════════════════════════════════════
                                                                STEP 3: YOUR PERSONALIZED BRIEF (epic reveal)
                                                               ══════════════════════════════════════════════ */}
                                                            {currentStep === 3 && chosenAvatar && mySelectedHooks.length > 0 && (() => {
                                                                // Find all angles that contain the selected hooks
                                                                const relevantAngles = (chosenAvatar.angles || []).filter((angle: any) =>
                                                                    angle.hooks?.some((h: string) => mySelectedHooks.includes(h))
                                                                );
                                                                const primaryAngle = relevantAngles[0] || selectedAngle;
                                                                return (
                                                                <div className="epic-unlock space-y-5">
                                                                    {/* Mini Context Bar — Character + Hook(s) */}
                                                                    <div className="flex gap-3 flex-wrap">
                                                                        <div className="flex-1 min-w-[140px] bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/15 flex items-center gap-2">
                                                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${chosenAvatar.color || 'from-teal-600 to-cyan-500'} flex items-center justify-center flex-shrink-0`}>
                                                                                <UserCircle2 size={16} className="text-white" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-widest">Character</p>
                                                                                <p className="text-[10px] font-black text-white">{chosenAvatar.name}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 min-w-[140px] bg-yellow-500/5 rounded-xl p-3 border border-yellow-500/15 flex items-center gap-2">
                                                                            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                                                                <Zap size={16} className="text-yellow-400" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[7px] font-bold text-yellow-400 uppercase tracking-widest">{mySelectedHooks.length} Hook{mySelectedHooks.length !== 1 ? 's' : ''}</p>
                                                                                <p className="text-[10px] font-black text-white truncate max-w-[150px]">{mySelectedHooks[0]?.slice(0, 40)}...</p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedHooks(prev => ({ ...prev, [angleKey]: [] }));
                                                                                setBriefRevealed(prev => ({ ...prev, [angleKey]: false }));
                                                                                setSelectedAngles(prev => ({ ...prev, [angleKey]: '' }));
                                                                                setActiveAvatar(prev => ({ ...prev, [campaign.id]: '' }));
                                                                            }}
                                                                            className="text-[8px] text-neutral-500 hover:text-teal-400 transition-colors font-bold px-2 self-center"
                                                                        >Start Over</button>
                                                                    </div>

                                                                    {/* Epic Title */}
                                                                    <div className="text-center py-3">
                                                                        <p className="text-[10px] font-bold text-teal-300/50 uppercase tracking-[0.2em] mb-1">Your destiny has been revealed</p>
                                                                        <h4 className="text-xl font-black text-white">✨ Your Personalized Brief</h4>
                                                                    </div>

                                                                    {/* Your Chosen Hooks */}
                                                                    <div className="bg-yellow-500/5 rounded-xl p-4 border border-yellow-500/15 brief-section-reveal" style={{ animationDelay: '0.15s' }}>
                                                                        <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                                                                            <Zap size={9} /> 🎣 Your Chosen Hook{mySelectedHooks.length !== 1 ? 's' : ''}
                                                                        </p>
                                                                        <div className="space-y-2">
                                                                            {mySelectedHooks.map((hookLine, i) => (
                                                                                <div key={i} className="flex items-start gap-2 pl-3 border-l-2 border-yellow-500/30 bg-yellow-500/5 rounded-r-lg p-2">
                                                                                    <span className="text-yellow-400 text-[9px] font-black mt-0.5">{i + 1}.</span>
                                                                                    <p className="text-[11px] text-yellow-200 leading-relaxed font-bold">"{hookLine}"</p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Psychology + Visual Cue from relevant angles */}
                                                                    {relevantAngles.map((angle: any, angleIdx: number) => (
                                                                        <div key={angleIdx}>
                                                                            {(angle.psychology || angle.visualCue) && (
                                                                                <div className="grid grid-cols-2 gap-3 brief-section-reveal" style={{ animationDelay: `${0.25 + angleIdx * 0.1}s` }}>
                                                                                    {angle.psychology && (
                                                                                        <div className="bg-teal-500/5 rounded-xl p-4 border border-teal-500/15">
                                                                                            <p className="text-[8px] font-black text-teal-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                                                <Target size={8} /> The Psychology
                                                                                            </p>
                                                                                            <p className="text-[10px] text-neutral-300 leading-relaxed">{angle.psychology}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {angle.visualCue && (
                                                                                        <div className="bg-pink-500/5 rounded-xl p-4 border border-pink-500/15">
                                                                                            <p className="text-[8px] font-black text-pink-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                                                <Eye size={8} /> Visual Cue
                                                                                            </p>
                                                                                            <p className="text-[10px] text-neutral-300 leading-relaxed">{angle.visualCue}</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Story Script from this angle */}
                                                                            {angle.briefContent && (
                                                                                <div className="bg-gradient-to-br from-teal-600/5 to-cyan-500/5 rounded-xl p-5 border border-teal-500/15 brief-section-reveal mt-3" style={{ animationDelay: `${0.4 + angleIdx * 0.1}s` }}>
                                                                                    <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                                                        <FileText size={9} /> 📜 Your Story Script {relevantAngles.length > 1 ? `(${angle.hook || `Angle ${angleIdx + 1}`})` : ''}
                                                                                    </p>
                                                                                    <div className="text-[11px] text-neutral-200 leading-relaxed whitespace-pre-wrap">
                                                                                        {angle.briefContent}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}

                                                                    {/* Mandatories */}
                                                                    {campaign.briefMandatories && (
                                                                        <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/15 brief-section-reveal" style={{ animationDelay: '0.65s' }}>
                                                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                                                <Shield size={9} /> 🛡️ Mandatories — Every Video
                                                                            </p>
                                                                            <div className="text-[10px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                                                                {campaign.briefMandatories}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Download Brief */}
                                                                    <button
                                                                        onClick={() => {
                                                                            const briefHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${campaign.title} — Creator Brief</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; line-height: 1.6; padding: 0; }
  .brief-container { max-width: 720px; margin: 0 auto; padding: 40px 32px 80px; }

  /* Header */
  .brief-header { text-align: center; padding: 48px 32px 40px; border-bottom: 1px solid rgba(100,170,170,0.15); margin-bottom: 40px; position: relative; overflow: hidden; }
  .brief-header::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(100,170,170,0.08) 0%, transparent 70%); pointer-events: none; }
  .brief-logo { font-size: 11px; font-weight: 900; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(100,170,170,0.5); margin-bottom: 24px; }
  .brief-title { font-size: 28px; font-weight: 900; color: #fff; letter-spacing: -0.02em; margin-bottom: 8px; }
  .brief-subtitle { font-size: 13px; color: #737373; font-weight: 600; }
  .brief-campaign-name { display: inline-block; background: linear-gradient(135deg, rgba(100,170,170,0.12), rgba(80,200,200,0.08)); border: 1px solid rgba(100,170,170,0.2); border-radius: 12px; padding: 8px 20px; margin-top: 16px; font-size: 14px; font-weight: 800; color: #5eead4; letter-spacing: 0.02em; }

  /* Sections */
  .section { margin-bottom: 28px; border-radius: 16px; overflow: hidden; border: 1px solid; }
  .section-header { padding: 14px 20px; font-size: 10px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
  .section-body { padding: 20px; font-size: 14px; line-height: 1.8; }

  /* Section Variants */
  .section-goal { border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.03); }
  .section-goal .section-header { background: rgba(16,185,129,0.06); color: #34d399; }
  .section-character { border-color: rgba(168,85,247,0.2); background: rgba(168,85,247,0.03); }
  .section-character .section-header { background: rgba(168,85,247,0.06); color: #c084fc; }
  .section-hooks { border-color: rgba(234,179,8,0.2); background: rgba(234,179,8,0.03); }
  .section-hooks .section-header { background: rgba(234,179,8,0.06); color: #fbbf24; }
  .section-psychology { border-color: rgba(100,170,170,0.2); background: rgba(100,170,170,0.03); }
  .section-psychology .section-header { background: rgba(100,170,170,0.06); color: #5eead4; }
  .section-visual { border-color: rgba(236,72,153,0.2); background: rgba(236,72,153,0.03); }
  .section-visual .section-header { background: rgba(236,72,153,0.06); color: #f472b6; }
  .section-script { border-color: rgba(100,170,170,0.25); background: linear-gradient(135deg, rgba(100,170,170,0.04), rgba(80,200,200,0.02)); }
  .section-script .section-header { background: rgba(100,170,170,0.08); color: #5eead4; }
  .section-mandatories { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.03); }
  .section-mandatories .section-header { background: rgba(239,68,68,0.06); color: #f87171; }

  /* Hook Items */
  .hook-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-left: 3px solid rgba(234,179,8,0.4); background: rgba(234,179,8,0.04); border-radius: 0 10px 10px 0; margin-bottom: 10px; }
  .hook-number { flex-shrink: 0; width: 24px; height: 24px; border-radius: 8px; background: rgba(234,179,8,0.15); color: #fbbf24; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .hook-text { font-size: 14px; font-weight: 600; color: #fde68a; font-style: italic; line-height: 1.6; }

  /* Script Content */
  .script-content { white-space: pre-wrap; font-size: 14px; line-height: 1.9; color: #d4d4d4; }
  .script-content strong, .script-content b { color: #5eead4; font-weight: 700; }

  /* Mandatories Content */
  .mandatories-content { white-space: pre-wrap; }
  .mandatories-content li, .mandatories-list li { padding: 4px 0; }

  /* Print Button */
  .print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(10,10,10,0.95); backdrop-filter: blur(12px); border-top: 1px solid rgba(100,170,170,0.15); padding: 12px 32px; display: flex; align-items: center; justify-content: center; gap: 12px; z-index: 100; }
  .print-btn { background: linear-gradient(135deg, #0d9488, #06b6d4); color: #fff; border: none; padding: 10px 28px; border-radius: 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .print-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(13,148,136,0.4); }
  .print-hint { font-size: 11px; color: #525252; font-weight: 600; }

  /* Divider */
  .section-divider { display: flex; align-items: center; gap: 12px; margin: 32px 0; }
  .section-divider .divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(100,170,170,0.15), transparent); }
  .section-divider .divider-label { font-size: 9px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(100,170,170,0.3); }

  /* Footer */
  .brief-footer { text-align: center; padding-top: 40px; border-top: 1px solid rgba(100,170,170,0.1); margin-top: 48px; }
  .brief-footer p { font-size: 11px; color: #404040; font-weight: 600; }

  @media print {
    body { background: #0a0a0a !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .print-bar { display: none !important; }
    .brief-container { padding: 20px; }
  }
</style>
</head>
<body>
<div class="brief-container">
  <div class="brief-header">
    <div class="brief-logo">⚡ OOEDN Creator Brief</div>
    <h1 class="brief-title">Your Personalized Brief</h1>
    <p class="brief-subtitle">Everything you need to create incredible content</p>
    <div class="brief-campaign-name">🎯 ${campaign.title}</div>
  </div>

  ${campaign.briefGoal ? `
  <div class="section section-goal">
    <div class="section-header">🚀 Campaign Goal</div>
    <div class="section-body">${campaign.briefGoal.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${chosenAvatar ? `
  <div class="section section-character">
    <div class="section-header">🎭 Your Character — ${chosenAvatar.name}</div>
    <div class="section-body">${chosenAvatar.description.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  <div class="section section-hooks">
    <div class="section-header">🎣 Your Chosen Hook${mySelectedHooks.length !== 1 ? 's' : ''}</div>
    <div class="section-body">
      ${mySelectedHooks.map((h: string, i: number) => `
      <div class="hook-item">
        <div class="hook-number">${i + 1}</div>
        <div class="hook-text">"${h.replace(/"/g, '&quot;').replace(/</g, '&lt;')}"</div>
      </div>`).join('')}
    </div>
  </div>

  ${relevantAngles.map((angle: any, idx: number) => `
  ${angle.psychology ? `
  <div class="section section-psychology">
    <div class="section-header">🧠 The Psychology${relevantAngles.length > 1 ? ` (Angle ${idx + 1})` : ''}</div>
    <div class="section-body">${angle.psychology.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${angle.visualCue ? `
  <div class="section section-visual">
    <div class="section-header">👁️ Visual Cue${relevantAngles.length > 1 ? ` (Angle ${idx + 1})` : ''}</div>
    <div class="section-body">${angle.visualCue.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${angle.briefContent ? `
  <div class="section-divider">
    <div class="divider-line"></div>
    <div class="divider-label">📜 Your Story Script${relevantAngles.length > 1 ? ` — ${angle.hook || 'Angle ' + (idx + 1)}` : ''}</div>
    <div class="divider-line"></div>
  </div>
  <div class="section section-script">
    <div class="section-header">📜 Story Script${relevantAngles.length > 1 ? ` — ${angle.hook || 'Angle ' + (idx + 1)}` : ''}</div>
    <div class="section-body"><div class="script-content">${angle.briefContent.replace(/\n/g, '<br>')}</div></div>
  </div>` : ''}`).join('')}

  ${campaign.briefMandatories ? `
  <div class="section section-mandatories">
    <div class="section-header">🛡️ Mandatories — Every Video</div>
    <div class="section-body"><div class="mandatories-content">${campaign.briefMandatories.replace(/\n/g, '<br>')}</div></div>
  </div>` : ''}

  <div class="brief-footer">
    <p>⚡ OOEDN Creator Brief • ${campaign.title} • Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    <p style="margin-top: 6px; color: #262626;">Save as PDF: Press Ctrl+P (or ⌘+P on Mac) → Save as PDF</p>
  </div>
</div>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
  <span class="print-hint">Press ⌘P to save as PDF</span>
</div>
</body>
</html>`;
                                                                            const blob = new Blob([briefHtml], { type: 'text/html' });
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = `${campaign.title.replace(/[^a-zA-Z0-9]/g, '_')}_Brief.html`;
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            document.body.removeChild(a);
                                                                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                                                                        }}
                                                                        className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-teal-600/10 to-cyan-500/10 border border-teal-500/20 rounded-xl text-teal-300 hover:from-teal-600/20 hover:to-cyan-500/20 hover:text-white transition-all group brief-section-reveal"
                                                                        style={{ animationDelay: '0.8s' }}
                                                                    >
                                                                        <Download size={14} className="group-hover:scale-110 transition-transform" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">Download Your Brief ✨</span>
                                                                    </button>
                                                                </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        {/* FALLBACK: Show raw brief when no avatars exist */}
                                        {(!campaign.avatars || campaign.avatars.length === 0) && (campaign.description || campaign.briefGoal) && (
                                            <div className="mb-5 bg-gradient-to-br from-teal-600/5 via-neutral-900/90 to-cyan-500/5 border border-teal-500/20 rounded-2xl overflow-hidden">
                                                <div className="bg-gradient-to-r from-teal-600/10 to-cyan-500/10 px-5 py-4 border-b border-teal-500/10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                                                            <Star size={20} className="text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-base font-black text-white">🚀 Campaign Brief</h3>
                                                            <p className="text-[10px] text-neutral-400">Review the full campaign details below</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-5 space-y-4">
                                                    {campaign.briefGoal && (
                                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                                            <p className="text-[10px] text-emerald-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                                                                <Sparkles size={10} /> Campaign Goal
                                                            </p>
                                                            <p className="text-sm text-white leading-relaxed">{campaign.briefGoal}</p>
                                                        </div>
                                                    )}
                                                    {campaign.description && (
                                                        <div className="bg-black/30 border border-neutral-800 rounded-xl p-4">
                                                            <p className="text-[10px] text-teal-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                                                                <FileText size={10} /> Full Brief
                                                            </p>
                                                            <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto pr-2">{campaign.description}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* TAB BAR */}
                                        <div className="flex bg-black/50 rounded-xl p-1 mb-4 gap-1">
                                            {tabDef(campaign.id).map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setTab(campaign.id, tab.id)}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest ${currentTab === tab.id
                                                        ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-lg shadow-teal-500/20'
                                                        : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                                                        }`}
                                                >
                                                    <span>{tab.emoji}</span> {tab.label}
                                                    {'count' in tab && (tab as any).count > 0 && (
                                                        <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[8px]">{(tab as any).count}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* TAB CONTENT */}


                                        {currentTab === 'moodboard' && (
                                            <div className="space-y-4">
                                                {/* Style Notes */}
                                                {campaign.styleNotes && (
                                                    <div className="bg-gradient-to-br from-teal-600/5 to-cyan-500/5 border border-teal-500/20 rounded-xl p-4">
                                                        <p className="text-[10px] text-teal-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                                                            <Palette size={10} /> Style Notes & Visual Direction
                                                        </p>
                                                        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{campaign.styleNotes}</p>
                                                    </div>
                                                )}

                                                {/* Reference Links */}
                                                {campaign.referenceLinks && campaign.referenceLinks.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                                                            <LinkIcon size={10} /> Reference / Inspiration
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            {campaign.referenceLinks.map((link, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 bg-black/50 border border-neutral-800 rounded-xl p-3 hover:border-teal-500/30 group transition-all"
                                                                >
                                                                    <LinkIcon size={12} className="text-teal-400 flex-shrink-0" />
                                                                    <span className="text-xs text-teal-400 group-hover:text-teal-300 truncate flex-1">{link}</span>
                                                                    <ExternalLink size={10} className="text-neutral-600 group-hover:text-teal-400" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Moodboard Image Grid */}
                                                {moodboardAssets.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                                                            <Image size={10} /> Moodboard Images ({moodboardAssets.length})
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {moodboardAssets.map(asset => (
                                                                <button
                                                                    key={asset.id}
                                                                    onClick={() => setLightboxImage(asset.fileUrl)}
                                                                    className="relative aspect-square bg-neutral-800 rounded-xl overflow-hidden group border border-neutral-700 hover:border-teal-500/30 transition-all"
                                                                >
                                                                    {asset.fileUrl ? (
                                                                        <img src={asset.fileUrl} alt={asset.title} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <Image size={20} className="text-neutral-600" />
                                                                        </div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                    {asset.title && (
                                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                                            <p className="text-[8px] text-white font-bold truncate">{asset.title}</p>
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {!campaign.styleNotes && (!campaign.referenceLinks || campaign.referenceLinks.length === 0) && moodboardAssets.length === 0 && (
                                                    <div className="text-center py-8">
                                                        <div className="text-4xl mb-3">🎨</div>
                                                        <p className="text-neutral-400 text-sm font-bold">No visual direction yet</p>
                                                        <p className="text-neutral-600 text-[10px]">The team will add moodboard assets and style notes here</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {currentTab === 'tasks' && (
                                            <div className="space-y-4">
                                                {/* Progress */}
                                                {totalTasks > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-[10px] text-neutral-500 font-bold uppercase">Progress</span>
                                                            <span className="text-[10px] text-neutral-400 font-bold">{doneTasks}/{totalTasks} tasks • {progress}%</span>
                                                        </div>
                                                        <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-teal-600 to-cyan-500'}`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Task List */}
                                                {campaign.tasks && campaign.tasks.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {campaign.tasks.map(task => (
                                                            <button
                                                                key={task.id}
                                                                onClick={() => !task.isDone && handleTaskDone(campaign.id, task.id)}
                                                                disabled={task.isDone}
                                                                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${task.isDone
                                                                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                                                                    : 'bg-black/50 border border-neutral-800 hover:border-teal-500/30 cursor-pointer hover:scale-[1.01] active:scale-95'
                                                                    }`}
                                                            >
                                                                {task.isDone ? (
                                                                    <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                                                                ) : (
                                                                    <Square size={16} className="text-neutral-600 flex-shrink-0" />
                                                                )}
                                                                <span className={`text-sm ${task.isDone ? 'text-neutral-500 line-through' : 'text-white'}`}>
                                                                    {task.text}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6">
                                                        <p className="text-neutral-500 text-sm">No tasks yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {currentTab === 'uploads' && (
                                            <div className="space-y-4">
                                                {myUploads.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {myUploads.map(upload => (
                                                            <div key={upload.id} className="flex items-center gap-3 bg-black/50 rounded-xl p-3 border border-neutral-800">
                                                                {upload.fileUrl && upload.type !== 'Video' ? (
                                                                    <img src={upload.fileUrl} alt={upload.title} className="w-10 h-10 rounded-lg object-cover" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                                                                        <Upload size={14} className="text-neutral-600" />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-white truncate">{upload.title}</p>
                                                                    <p className="text-[10px] text-neutral-500">{upload.status} • {formatDate(upload.uploadDate)}</p>
                                                                </div>
                                                                {upload.paymentRequested && (
                                                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">💰 Paid</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6">
                                                        <div className="text-3xl mb-2">📎</div>
                                                        <p className="text-neutral-400 text-sm font-bold">No uploads yet</p>
                                                    </div>
                                                )}
                                                {!isComplete && isAccepted && (
                                                    <button
                                                        onClick={() => onNavigate('upload')}
                                                        className="w-full flex items-center justify-between p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl hover:border-teal-500/40 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-2 text-teal-400">
                                                            <Upload size={14} />
                                                            <span className="text-xs font-bold">Upload content for this campaign</span>
                                                        </div>
                                                        <ArrowRight size={12} className="text-neutral-600 group-hover:text-teal-400 transition-colors" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* NOTES TAB */}
                                        {currentTab === 'notes' && (
                                            <div className="space-y-4">
                                                <p className="text-[10px] text-neutral-500 font-bold uppercase">💬 Campaign Notes — Chat with team</p>
                                                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                                                    {(campaign.comments || []).length === 0 && (
                                                        <div className="text-center py-6">
                                                            <MessageSquare size={20} className="text-neutral-600 mx-auto mb-2" />
                                                            <p className="text-neutral-500 text-sm">No notes yet. Start the conversation!</p>
                                                        </div>
                                                    )}
                                                    {(campaign.comments || []).map(comment => (
                                                        <div key={comment.id} className={`rounded-xl p-3 border ${comment.isCreatorComment
                                                            ? 'bg-teal-500/5 border-teal-500/20 ml-4'
                                                            : 'bg-black/50 border-neutral-800 mr-4'
                                                            }`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`text-[10px] font-bold ${comment.isCreatorComment ? 'text-teal-400' : 'text-emerald-400'
                                                                    }`}>
                                                                    {comment.isCreatorComment ? `${creator.name} (You)` : comment.user || 'Team'}
                                                                </span>
                                                                <span className="text-[9px] text-neutral-600">{formatDate(comment.date)}</span>
                                                            </div>
                                                            <p className="text-xs text-neutral-300 leading-relaxed">{comment.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Note input */}
                                                {onAddComment && (
                                                    <div className="flex gap-2 pt-2 border-t border-neutral-800">
                                                        <input
                                                            value={noteText[campaign.id] || ''}
                                                            onChange={(e) => setNoteText(prev => ({ ...prev, [campaign.id]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && (noteText[campaign.id] || '').trim()) {
                                                                    onAddComment(campaign.id, noteText[campaign.id]!);
                                                                    setNoteText(prev => ({ ...prev, [campaign.id]: '' }));
                                                                }
                                                            }}
                                                            placeholder="Add a note or question..."
                                                            className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 outline-none"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if ((noteText[campaign.id] || '').trim()) {
                                                                    onAddComment(campaign.id, noteText[campaign.id]!);
                                                                    setNoteText(prev => ({ ...prev, [campaign.id]: '' }));
                                                                }
                                                            }}
                                                            className="bg-teal-500 text-white p-2 rounded-lg hover:bg-purple-400 transition-colors"
                                                            title="Send note"
                                                        ><Send size={14} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* ACCEPT / DECLINE — the very last thing, after reviewing everything */}
                                        {isNew && (
                                            <div className="mt-6 pt-5 border-t border-neutral-800">
                                                {!reviewedCampaigns.has(campaign.id) ? (
                                                    <button
                                                        onClick={() => setReviewedCampaigns(prev => new Set([...prev, campaign.id]))}
                                                        className="w-full py-3 bg-gradient-to-r from-teal-600/10 to-cyan-500/10 border border-teal-500/20 rounded-xl text-teal-300 hover:from-teal-600/20 hover:to-cyan-500/20 hover:text-white transition-all flex items-center justify-center gap-2 group"
                                                    >
                                                        <Eye size={14} className="group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">✅ I've Reviewed the Brief — Show Accept Button</span>
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-3 animate-in slide-in-from-bottom-2">
                                                        <button
                                                            onClick={() => onAcceptCampaign(campaign.id)}
                                                            className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-95"
                                                        >
                                                            <Sparkles size={14} /> Accept Campaign 🎯
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Are you sure you want to decline this campaign? \n\nYou can always ask the team to re-assign it later.')) {
                                                                    onDeclineCampaign(campaign.id);
                                                                }
                                                            }}
                                                            className="px-6 bg-neutral-800 text-neutral-400 py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 border border-neutral-700 active:scale-95"
                                                        >
                                                            Decline
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* LIGHTBOX */}
            {lightboxImage && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
                    <img src={lightboxImage} alt="Moodboard" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    <p className="absolute bottom-6 text-neutral-500 text-xs font-bold">Click anywhere to close</p>
                </div>
            )}
        </div>
    );
};

export default CreatorCampaigns;
