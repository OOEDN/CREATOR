import React, { useState, useEffect } from 'react';
import { Creator, Campaign, ContentItem, ContentStatus, TeamMessage, PaymentStatus } from '../../types';
import {
    DollarSign, CheckCircle, Upload, MessageCircle, Flame, ArrowRight, Bell, ChevronRight, Zap, Target, Trophy
} from 'lucide-react';
import { getLevel, getNextLevel, getLevelProgress, ACHIEVEMENTS } from '../../services/creatorXP';

interface Props {
    creator: Creator;
    campaigns: Campaign[];
    contentItems: ContentItem[];
    teamMessages: TeamMessage[];
    onNavigate: (view: string) => void;
    onEnableNotifications?: () => void;
}

/* ─── Animated Number ─────────────────────────────────── */
const AnimNum: React.FC<{ value: number; prefix?: string }> = ({ value, prefix = '' }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (value === 0) { setDisplay(0); return; }
        const step = Math.max(1, value / 60);
        let cur = 0;
        const id = setInterval(() => {
            cur += step;
            if (cur >= value) { setDisplay(value); clearInterval(id); }
            else setDisplay(Math.floor(cur));
        }, 16);
        return () => clearInterval(id);
    }, [value]);
    return <>{prefix}{display}</>;
};

/* ─── Stat Card (deep glassmorphism with 3D tilt) ──────── */
const StatCard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    tint: string; // e.g. '167,139,250' (rgba channels)
    suffix?: string;
    onClick?: () => void;
    delay?: number;
}> = ({ label, value, icon, tint, suffix, onClick, delay = 0 }) => (
    <div
        onClick={onClick}
        style={{
            flex: '1 1 0',
            minWidth: '120px',
            background: `linear-gradient(135deg, rgba(${tint},0.12) 0%, rgba(${tint},0.04) 100%)`,
            backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
            border: `1px solid rgba(${tint},0.15)`,
            borderTop: `1px solid rgba(${tint},0.25)`,
            borderLeft: `1px solid rgba(${tint},0.2)`,
            borderRadius: '20px',
            padding: '20px 18px',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
            animation: `dashFadeUp 0.6s ease ${delay}s both`,
            boxShadow: `0 4px 24px rgba(${tint},0.08), inset 0 1px 0 rgba(255,255,255,0.06)`,
            position: 'relative' as const,
            overflow: 'hidden',
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.02) rotateX(5deg) rotateY(2deg)';
            e.currentTarget.style.borderColor = `rgba(${tint},0.35)`;
            e.currentTarget.style.boxShadow = `0 16px 40px rgba(${tint},0.2), inset 0 1px 0 rgba(255,255,255,0.1)`;
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1) rotateX(0) rotateY(0)';
            e.currentTarget.style.borderColor = `rgba(${tint},0.15)`;
            e.currentTarget.style.boxShadow = `0 4px 24px rgba(${tint},0.08), inset 0 1px 0 rgba(255,255,255,0.06)`;
        }}
    >
        {/* Inner highlight overlay */}
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
            borderRadius: '20px 20px 0 0', pointerEvents: 'none',
        }} />
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', position: 'relative' as const }}>
            {label}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', position: 'relative' as const }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {typeof value === 'number' ? <AnimNum value={value} /> : value}
            </span>
            {suffix && <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{suffix}</span>}
        </div>
        <div style={{ marginTop: '10px', color: `rgba(${tint},0.7)`, position: 'relative' as const }}>{icon}</div>
    </div>
);

export default function CreatorDashboard({ creator, campaigns, contentItems, teamMessages, onNavigate, onEnableNotifications }: Props) {
    const myContent = contentItems.filter(c => c.creatorId === creator.id);
    const myMessages = teamMessages.filter(m => m.creatorId === creator.id);
    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creator.id) || c.status === 'Final Campaign');
    const pendingCampaigns = myCampaigns.filter(c => !c.acceptedByCreatorIds?.includes(creator.id));
    const acceptedCampaigns = myCampaigns.filter(c => c.acceptedByCreatorIds?.includes(creator.id));

    const completedCount = myContent.filter(c => c.status === ContentStatus.Approved || c.status === ContentStatus.Posted).length;
    const totalUploads = myContent.length;
    const unreadMessages = myMessages.filter(m => !m.isCreatorMessage).length;
    const totalEarned = creator.totalEarned || 0;

    // XP system — use real engine
    const xp = creator.xp || 0;
    const currentLevel = getLevel(xp);
    const nextLevel = getNextLevel(xp);
    const progressPercent = getLevelProgress(xp);
    const streak = creator.streak || 0;
    const earnedAchievements = (creator.achievements || []).map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = creator.name?.split(' ')[0] || 'Creator';

    // Campaign progress for first accepted campaign
    const activeCampaign = acceptedCampaigns[0];
    const campaignTasks = activeCampaign?.tasks || [];
    const doneTasks = campaignTasks.filter((t: any) => t.done || t.completedByCreatorIds?.includes(creator.id)).length;
    const campaignProgress = campaignTasks.length > 0 ? Math.round((doneTasks / campaignTasks.length) * 100) : 0;

    // Recent activity (last content items + messages)
    const recentActivity = [
        ...myContent.slice(-3).map(c => ({
            id: c.id,
            label: c.title || 'Content',
            status: c.status,
            color: c.status === ContentStatus.Approved ? '134,239,172' : c.status === ContentStatus.Posted ? '103,232,249' : '167,139,250',
            time: c.uploadDate || '',
        })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4);

    // Current Focus — top 3 tasks from active campaign
    const focusTasks = campaignTasks.slice(0, 3);

    return (
        <>
            <style>{`
                @keyframes dashFadeUp {
                    from { opacity: 0; transform: translateY(16px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes dashProgressFill {
                    from { width: 0; }
                }
                @keyframes dashXpShimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes ambientDrift {
                    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
                    25% { transform: translate(30px, -20px) scale(1.08); opacity: 0.6; }
                    50% { transform: translate(-20px, 15px) scale(1.12); opacity: 0.45; }
                    75% { transform: translate(15px, 25px) scale(1.05); opacity: 0.55; }
                }
            `}</style>

            {/* ═══ AMBIENT ORB ═══ */}
            <div style={{
                position: 'fixed', top: '-15%', right: '-10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, rgba(236,72,153,0.05) 40%, transparent 70%)',
                borderRadius: '50%', filter: 'blur(80px)',
                pointerEvents: 'none', zIndex: 0,
                animation: 'ambientDrift 15s ease-in-out infinite',
            }} />

            <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px', position: 'relative', zIndex: 1 }}>

                {/* ═══ TOP BAR — Avatar + XP ═══ */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '32px', animation: 'dashFadeUp 0.5s ease 0.1s both',
                }}>
                    {/* Avatar */}
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 4px 16px rgba(167,139,250,0.25)',
                        overflow: 'hidden',
                    }}>
                        {creator.profileImage
                            ? <img src={creator.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: 'white', fontWeight: 800, fontSize: '16px' }}>{firstName[0]?.toUpperCase()}</span>
                        }
                    </div>

                    {/* XP Bar + Level */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {xp} XP
                        </span>
                        <div style={{
                            width: '100px', height: '6px', borderRadius: '3px',
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%', borderRadius: '3px',
                                width: `${progressPercent}%`,
                                background: `linear-gradient(90deg, var(--xp-start, #a78bfa), var(--xp-end, #67e8f9))`,
                                backgroundSize: '200% 100%',
                                animation: 'dashProgressFill 1s ease 0.5s both, dashXpShimmer 3s ease-in-out infinite',
                            }} />
                        </div>
                        <div style={{
                            background: `linear-gradient(135deg, var(--level-start, #a78bfa), var(--level-end, #67e8f9))`,
                            borderRadius: '10px', padding: '3px 10px',
                            display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                            <span style={{ fontSize: '12px' }}>{currentLevel.emoji}</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'white' }}>{currentLevel.name}</span>
                        </div>

                        {/* Streak badge */}
                        {streak > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '3px',
                                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)',
                                borderRadius: '10px', padding: '3px 8px',
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>{streak}</span>
                                <Flame size={11} style={{ color: '#fb923c' }} />
                            </div>
                        )}

                        {/* Achievement count */}
                        {earnedAchievements.length > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '3px',
                                background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)',
                                borderRadius: '10px', padding: '3px 8px',
                                cursor: 'pointer',
                            }} onClick={() => onNavigate('profile')}>
                                <Trophy size={10} style={{ color: '#a855f7' }} />
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#a855f7' }}>{earnedAchievements.length}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ GREETING ═══ */}
                <div style={{ marginBottom: '28px', animation: 'dashFadeUp 0.6s ease 0.15s both' }}>
                    <h1 style={{
                        fontSize: '36px', fontWeight: 800, color: 'white',
                        letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1.2,
                    }}>
                        {greeting},<br />
                        <span style={{
                            background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            {firstName}
                        </span>
                    </h1>
                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, margin: 0 }}>
                        {creator.status === 'Long Term' ? 'Long-term partner' : creator.status === 'Active' ? 'Active creator' : `Status: ${creator.status || 'Active'}`}
                        {totalEarned > 0 ? ` · $${totalEarned} lifetime` : ''}
                    </p>
                </div>

                {/* ═══ ANALYTICS HEADING + STAT CARDS ═══ */}
                <div style={{ marginBottom: '28px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px',
                        animation: 'dashFadeUp 0.5s ease 0.25s both',
                    }}>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px' }}>Analytics</h3>
                            {/* Glowing purple accent bar */}
                            <div style={{
                                width: '40px', height: '3px', borderRadius: '2px',
                                background: 'linear-gradient(90deg, #a78bfa, #ec4899)',
                                boxShadow: '0 0 12px rgba(167,139,250,0.4)',
                            }} />
                        </div>
                        {streak > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Streak</span>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    background: 'rgba(251,191,36,0.1)', borderRadius: '8px', padding: '2px 8px',
                                }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24' }}>{streak}</span>
                                    <Flame size={11} style={{ color: '#fb923c' }} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <StatCard label="Earnings" value={totalEarned > 0 ? `$${totalEarned}` : '$0'} icon={<DollarSign size={16} />}
                            tint="167,139,250" suffix={totalEarned > 0 ? '↑' : ''} onClick={() => onNavigate('payments')} delay={0.3} />
                        <StatCard label="Tasks" value={completedCount} icon={<CheckCircle size={16} />}
                            tint="251,191,36" suffix="↓" onClick={() => onNavigate('campaigns')} delay={0.35} />
                        <StatCard label="Uploads" value={totalUploads} icon={<Upload size={16} />}
                            tint="134,239,172" suffix="↑" onClick={() => onNavigate('upload')} delay={0.4} />
                        <StatCard label="Messages" value={unreadMessages} icon={<MessageCircle size={16} />}
                            tint="103,232,249" suffix="✉" onClick={() => onNavigate('chat')} delay={0.45} />
                    </div>
                </div>

                {/* ═══ CAMPAIGN ALERT (NEW) ═══ */}
                {pendingCampaigns.length > 0 && (
                    <div
                        onClick={() => onNavigate('campaigns')}
                        style={{
                            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(236,72,153,0.1))',
                            border: '1px solid rgba(167,139,250,0.2)',
                            borderRadius: '18px', padding: '16px 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', marginBottom: '28px',
                            transition: 'all 0.3s',
                            animation: 'dashFadeUp 0.6s ease 0.5s both',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.35)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.2)'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>🎉</span>
                            <div>
                                <p style={{ fontWeight: 700, color: 'white', fontSize: '13px', margin: 0 }}>
                                    {pendingCampaigns.length === 1 ? `New Campaign: ${pendingCampaigns[0].title}` : `${pendingCampaigns.length} new campaigns`}
                                </p>
                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', fontWeight: 500 }}>Tap to view & accept</p>
                            </div>
                        </div>
                        <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                )}

                {/* ═══ CAMPAIGN PROGRESS ═══ */}
                {activeCampaign && (
                    <div style={{ marginBottom: '28px', animation: 'dashFadeUp 0.6s ease 0.55s both' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 12px' }}>Campaign Progress</h3>
                        <div
                            onClick={() => onNavigate('campaigns')}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '18px', padding: '18px 20px',
                                cursor: 'pointer', transition: 'all 0.3s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{activeCampaign.title}</span>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{campaignProgress}%</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: '3px',
                                    width: `${campaignProgress}%`,
                                    background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
                                    transition: 'width 1s ease',
                                    animation: 'dashProgressFill 1.2s ease 0.8s both',
                                }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ CURRENT FOCUS ═══ */}
                {activeCampaign && focusTasks.length > 0 && (
                    <div style={{ marginBottom: '28px', animation: 'dashFadeUp 0.6s ease 0.6s both' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Target size={15} style={{ color: '#a78bfa' }} />
                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Current Focus</h3>
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '18px', padding: '18px 20px',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}>
                            {/* Active campaign title + progress */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{activeCampaign.title}</span>
                                <span style={{
                                    fontSize: '11px', fontWeight: 700, color: '#a78bfa',
                                    background: 'rgba(167,139,250,0.12)', borderRadius: '8px', padding: '2px 8px',
                                }}>{campaignProgress}%</span>
                            </div>
                            {/* Mini progress bar */}
                            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{
                                    height: '100%', borderRadius: '2px',
                                    width: `${campaignProgress}%`,
                                    background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
                                    transition: 'width 1s ease',
                                }} />
                            </div>
                            {/* Top 3 tasks */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {focusTasks.map((task: any, i: number) => {
                                    const isDone = task.done || task.completedByCreatorIds?.includes(creator.id) || task.isDone;
                                    return (
                                        <div key={task.id || i} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '8px 0',
                                            borderBottom: i < focusTasks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        }}>
                                            {/* Checkbox indicator */}
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '6px', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isDone ? 'rgba(134,239,172,0.2)' : 'transparent',
                                                border: isDone ? '1.5px solid rgba(134,239,172,0.5)' : '1.5px solid rgba(255,255,255,0.15)',
                                                transition: 'all 0.2s',
                                            }}>
                                                {isDone && <CheckCircle size={11} style={{ color: '#86efac' }} />}
                                            </div>
                                            <span style={{
                                                fontSize: '13px', fontWeight: 500,
                                                color: isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)',
                                                textDecoration: isDone ? 'line-through' : 'none',
                                                flex: 1,
                                            }}>
                                                {task.title || task.text || task.name || `Task ${i + 1}`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ RECENT ACTIVITY ═══ */}
                {recentActivity.length > 0 && (
                    <div style={{ animation: 'dashFadeUp 0.6s ease 0.65s both' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Recent Activity</h3>
                            <button onClick={() => onNavigate('upload')}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                See All
                            </button>
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '18px', overflow: 'hidden',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}>
                            {recentActivity.map((item, i) => (
                                <div key={item.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    transition: 'background 0.2s',
                                    cursor: 'default',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: `rgba(${item.color},0.8)`,
                                            boxShadow: `0 0 8px rgba(${item.color},0.4)`,
                                        }} />
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>{item.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ DAILY MICRO-CHALLENGE ═══ */}
                {(() => {
                    const dailyChallenges = [
                        { emoji: '📸', task: 'Upload a behind-the-scenes clip', xp: 15 },
                        { emoji: '💡', task: 'Try a new angle for your next video', xp: 20 },
                        { emoji: '🎭', task: 'Recreate a trending sound with your style', xp: 25 },
                        { emoji: '📝', task: 'Write a killer caption for your last upload', xp: 10 },
                        { emoji: '🔥', task: 'Reply to a teammate in the community tab', xp: 10 },
                        { emoji: '🎬', task: 'Film 3 different hooks for the same brief', xp: 30 },
                        { emoji: '🤳', task: 'Upload a quick product unboxing', xp: 20 },
                    ];
                    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
                    const todaysChallenge = dailyChallenges[dayOfYear % dailyChallenges.length];
                    return (
                        <div style={{
                            marginTop: '28px',
                            background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.04) 100%)',
                            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(251,191,36,0.15)',
                            borderRadius: '18px', padding: '18px 20px',
                            animation: 'dashFadeUp 0.6s ease 0.65s both',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ Daily Challenge</span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: '8px' }}>+{todaysChallenge.xp} XP</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>{todaysChallenge.emoji}</span>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{todaysChallenge.task}</p>
                            </div>
                        </div>
                    );
                })()}

                {/* ═══ YOUR IMPACT STATS ═══ */}
                <div style={{
                    marginTop: '28px',
                    background: 'rgba(255,255,255,0.02)',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '18px', padding: '18px 20px',
                    animation: 'dashFadeUp 0.6s ease 0.7s both',
                }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>📊 Your Impact</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '18px', fontWeight: 800, color: '#a78bfa', margin: 0 }}><AnimNum value={totalUploads} /></p>
                            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', margin: '2px 0 0' }}>Uploads</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '18px', fontWeight: 800, color: '#67e8f9', margin: 0 }}><AnimNum value={completedCount} /></p>
                            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', margin: '2px 0 0' }}>Approved</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '18px', fontWeight: 800, color: '#86efac', margin: 0 }}>{totalUploads > 0 ? Math.round((completedCount / totalUploads) * 100) : 0}%</p>
                            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', margin: '2px 0 0' }}>Approval Rate</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '18px', fontWeight: 800, color: '#fbbf24', margin: 0 }}><AnimNum value={acceptedCampaigns.length} /></p>
                            <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', margin: '2px 0 0' }}>Campaigns</p>
                        </div>
                    </div>
                </div>

                {/* ═══ UPCOMING CAMPAIGN PREVIEWS ═══ */}
                {(() => {
                    const upcoming = campaigns.filter(c => c.status === 'Brainstorming' || c.status === 'Idea');
                    if (upcoming.length === 0) return null;
                    return (
                        <div style={{
                            marginTop: '28px', animation: 'dashFadeUp 0.6s ease 0.75s both',
                        }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>👀 Coming Soon</p>
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {upcoming.slice(0, 3).map(c => (
                                    <div key={c.id} style={{
                                        minWidth: '160px', flex: '0 0 auto',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '14px', padding: '14px',
                                        filter: 'blur(1.5px)',
                                        transition: 'filter 0.3s',
                                        cursor: 'default',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.filter = 'blur(0px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.filter = 'blur(1.5px)'; }}
                                    >
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase' }}>{c.status}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* ═══ ENABLE NOTIFICATIONS ═══ */}
                {onEnableNotifications && !creator.notificationsEnabled && (
                    <div
                        onClick={onEnableNotifications}
                        style={{
                            marginTop: '28px',
                            background: 'rgba(255,255,255,0.03)',
                            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                            border: '1px dashed rgba(167,139,250,0.25)',
                            borderRadius: '18px',
                            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
                            cursor: 'pointer', transition: 'all 0.3s',
                            animation: 'dashFadeUp 0.6s ease 0.7s both',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)';
                        }}
                    >
                        <Bell size={18} style={{ color: '#a78bfa' }} />
                        <div>
                            <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0 }}>Enable notifications</p>
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Get alerts for campaigns, payments & messages</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
