import React, { useState } from 'react';
import { Creator, Campaign, ContentItem } from '../../types';
import {
    Briefcase, CheckSquare, Square, Calendar, Clock, Sparkles,
    Trophy, Upload, ArrowRight, Timer, Palette, LinkIcon, ExternalLink,
    FileText, Image, ListTodo, MessageSquare, ChevronDown, ChevronRight, Eye
} from 'lucide-react';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    contentItems: ContentItem[];
    onMarkTaskDone: (campaignId: string, taskId: string) => void;
    onAcceptCampaign: (campaignId: string) => void;
    onNavigate: (view: string) => void;
}

type CampaignTab = 'brief' | 'moodboard' | 'tasks' | 'uploads';

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

const CreatorCampaigns: React.FC<Props> = ({ creator, campaigns, contentItems, onMarkTaskDone, onAcceptCampaign, onNavigate }) => {
    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creator.id));
    const [completedCampaignId, setCompletedCampaignId] = useState<string | null>(null);
    const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Record<string, CampaignTab>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const getTab = (campaignId: string) => activeTab[campaignId] || 'brief';
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
            { id: 'brief' as CampaignTab, label: 'Brief', icon: FileText, emoji: '📋' },
            ...(hasMoodboard ? [{ id: 'moodboard' as CampaignTab, label: 'Moodboard', icon: Palette, emoji: '🎨' }] : []),
            { id: 'tasks' as CampaignTab, label: 'Tasks', icon: ListTodo, emoji: '✅', count: campaign?.tasks?.length || 0 },
            { id: 'uploads' as CampaignTab, label: 'Uploads', icon: Upload, emoji: '📎', count: myUploads.length },
        ];
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-2">
                    <Briefcase size={24} className="text-purple-400" /> My Campaigns
                </h2>
                <p className="text-neutral-500 text-xs mt-1">View briefs, moodboards, complete deliverables, and track deadlines</p>
            </div>

            {myCampaigns.length === 0 ? (
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-12 text-center">
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
                                className={`bg-neutral-900/80 border rounded-2xl relative overflow-hidden transition-all ${isNew ? 'border-yellow-500/30 bg-yellow-500/5' :
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
                                            <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors">{campaign.title}</h3>
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
                                                    className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
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
                                        {/* ACCEPT BUTTON */}
                                        {isNew && (
                                            <button
                                                onClick={() => onAcceptCampaign(campaign.id)}
                                                className="w-full mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:from-yellow-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-95"
                                            >
                                                <Sparkles size={14} /> Accept Campaign 🎯
                                            </button>
                                        )}

                                        {/* TAB BAR */}
                                        <div className="flex bg-black/50 rounded-xl p-1 mb-4 gap-1">
                                            {tabDef(campaign.id).map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setTab(campaign.id, tab.id)}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest ${currentTab === tab.id
                                                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
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
                                        {currentTab === 'brief' && (
                                            <div className="space-y-4">
                                                {campaign.description && (
                                                    <div className="bg-black/50 rounded-xl p-4 border border-neutral-800">
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2">📋 Campaign Brief</p>
                                                        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{campaign.description}</p>
                                                    </div>
                                                )}
                                                {campaign.deadline && (
                                                    <div className="bg-black/50 rounded-xl p-3 border border-neutral-800 flex items-center gap-3">
                                                        <Calendar size={16} className="text-purple-400" />
                                                        <div>
                                                            <p className="text-[10px] text-neutral-500 font-bold uppercase">Deadline</p>
                                                            <p className="text-sm text-white font-bold">{new Date(campaign.deadline).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                        </div>
                                                        {timeLeft && (
                                                            <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-lg ${timeLeft.urgent ? 'bg-red-500/10 text-red-400' : 'bg-neutral-500/10 text-neutral-400'}`}>
                                                                {timeLeft.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Comments / Team Notes in Brief tab */}
                                                {campaign.comments && campaign.comments.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase mb-2">💬 Team Notes</p>
                                                        <div className="space-y-2">
                                                            {campaign.comments.map(comment => (
                                                                <div key={comment.id} className="bg-black/50 rounded-xl p-3 border border-neutral-800">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-[10px] font-bold text-purple-400">{comment.user}</span>
                                                                        <span className="text-[9px] text-neutral-600">{formatDate(comment.date)}</span>
                                                                    </div>
                                                                    <p className="text-xs text-neutral-300">{comment.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {currentTab === 'moodboard' && (
                                            <div className="space-y-4">
                                                {/* Style Notes */}
                                                {campaign.styleNotes && (
                                                    <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-xl p-4">
                                                        <p className="text-[10px] text-purple-400 font-bold uppercase mb-2 flex items-center gap-1.5">
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
                                                                    className="flex items-center gap-2 bg-black/50 border border-neutral-800 rounded-xl p-3 hover:border-purple-500/30 group transition-all"
                                                                >
                                                                    <LinkIcon size={12} className="text-purple-400 flex-shrink-0" />
                                                                    <span className="text-xs text-purple-400 group-hover:text-purple-300 truncate flex-1">{link}</span>
                                                                    <ExternalLink size={10} className="text-neutral-600 group-hover:text-purple-400" />
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
                                                                    className="relative aspect-square bg-neutral-800 rounded-xl overflow-hidden group border border-neutral-700 hover:border-purple-500/30 transition-all"
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
                                                                className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
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
                                                                        : 'bg-black/50 border border-neutral-800 hover:border-purple-500/30 cursor-pointer hover:scale-[1.01] active:scale-95'
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
                                                        className="w-full flex items-center justify-between p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-2 text-purple-400">
                                                            <Upload size={14} />
                                                            <span className="text-xs font-bold">Upload content for this campaign</span>
                                                        </div>
                                                        <ArrowRight size={12} className="text-neutral-600 group-hover:text-purple-400 transition-colors" />
                                                    </button>
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
