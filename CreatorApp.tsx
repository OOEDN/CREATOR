import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard, MessageCircle, Upload, CreditCard, User, Package, Briefcase,
    Loader2, ArrowRight, AlertTriangle, Flame, LogOut, Menu, X, Sun, Moon, UserPlus,
    Mail, Lock, Eye, EyeOff, Bell, BellDot, FlaskConical, Users
} from 'lucide-react';
import {
    Creator, CreatorStatus, PaymentStatus, Platform, ContentItem, AppSettings,
    ShipmentStatus, Campaign, ContentStatus, TeamMessage, TeamTask, Shipment,
    CreatorAccount, ContentNote, BetaTest, BetaRelease, PeerMessage
} from './types';
import CreatorDashboard from './components/creator/CreatorDashboard';
import CreatorChat from './components/creator/CreatorChat';
import CreatorUpload from './components/creator/CreatorUpload';
import CreatorPayments from './components/creator/CreatorPayments';
import CreatorProfile from './components/creator/CreatorProfile';
import CreatorShipments from './components/creator/CreatorShipments';
import CreatorCampaigns from './components/creator/CreatorCampaigns';
import CreatorOnboarding from './components/creator/CreatorOnboarding';
import CreatorBetaLab from './components/creator/CreatorBetaLab';
import CreatorAIChat from './components/creator/CreatorAIChat';
import CreatorPeerChat from './components/creator/CreatorPeerChat';

type CreatorView = 'dashboard' | 'chat' | 'upload' | 'payments' | 'profile' | 'shipments' | 'campaigns' | 'betaLab' | 'community';

// GCS settings (shared with team side)
const GCS_SETTINGS: AppSettings = {
    useCloudStorage: true,
    googleProjectId: '850668507460',
    googleCloudBucket: 'ai-studio-bucket-850668507460-us-west1',
    logoUrl: 'https://i.postimg.cc/Z5xWzGv5/Logowhite.png',
};

// Notification types
interface CreatorNotification {
    id: string;
    type: 'campaign' | 'payment' | 'message' | 'feedback';
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
}

function CreatorApp() {
    // --- Auth State ---

    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Form fields
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');


    // Signed-in state
    const [currentAccount, setCurrentAccount] = useState<CreatorAccount | null>(null);
    const [creatorRecord, setCreatorRecord] = useState<Creator | null>(null);
    const [view, setView] = useState<CreatorView>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Shared data
    const [creators, setCreators] = useState<Creator[]>([]);
    const [contentItems, setContentItems] = useState<ContentItem[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
    const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
    const [creatorAccounts, setCreatorAccounts] = useState<CreatorAccount[]>([]);
    const [betaTests, setBetaTests] = useState<BetaTest[]>([]);
    const [betaReleases, setBetaReleases] = useState<BetaRelease[]>([]);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
    const [peerMessages, setPeerMessages] = useState<PeerMessage[]>([]);

    // JWT Token
    const [jwtToken, setJwtToken] = useState<string | null>(() => {
        try { return localStorage.getItem('ooedn_creator_jwt'); } catch { return null; }
    });

    // Notifications
    const [notifications, setNotifications] = useState<CreatorNotification[]>([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);

    const initialLoadRef = useRef(false);

    // Theme
    const [isDarkMode, setIsDarkMode] = useState(() => {
        try { return localStorage.getItem('ooedn_creator_theme') !== 'light'; } catch { return true; }
    });

    useEffect(() => {
        document.documentElement.classList.toggle('light-mode', !isDarkMode);
        document.body.classList.toggle('light-mode', !isDarkMode);
        localStorage.setItem('ooedn_creator_theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Auto-dismiss welcome intro after 5 seconds (must be before any conditional returns)
    useEffect(() => {
        if (showWelcomeIntro) {
            const timer = setTimeout(() => setShowWelcomeIntro(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showWelcomeIntro]);

    const [settings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('ooedn_settings');
        if (saved) {
            try { return { ...GCS_SETTINGS, ...JSON.parse(saved) }; } catch { return GCS_SETTINGS; }
        }
        return GCS_SETTINGS;
    });

    // --- Helper: apply server response data to state ---
    const applyServerData = (data: any, account: any) => {
        setCurrentAccount(account as CreatorAccount);
        setCreatorRecord(data.creator || null);
        setCreators(data.creator ? [data.creator] : []);
        setCampaigns(data.campaigns || []);
        setContentItems(data.contentItems || []);
        setTeamMessages(data.teamMessages || []);
        setTeamTasks(data.teamTasks || []);
        setBetaTests(data.betaTests || []);
        setBetaReleases(data.betaReleases || []);
    };

    // --- Save via server API (JWT protected) ---
    const saveMasterDB = async (
        updatedCreators?: Creator[],
        updatedCampaigns?: Campaign[],
        updatedContent?: ContentItem[],
        updatedMessages?: TeamMessage[],
        updatedTasks?: TeamTask[],
        updatedAccounts?: CreatorAccount[],
        updatedBetaTests?: BetaTest[],
        updatedBetaReleases?: BetaRelease[]
    ) => {
        const token = jwtToken || localStorage.getItem('ooedn_creator_jwt');
        if (!token) return;
        try {
            const updates: any = {};
            if (updatedCreators && creatorRecord) {
                const myUpdated = updatedCreators.find(c => c.id === creatorRecord.id);
                if (myUpdated) updates.creator = myUpdated;
            }
            if (updatedContent) updates.contentItems = updatedContent;
            if (updatedMessages) updates.teamMessages = updatedMessages;
            if (updatedBetaReleases) updates.betaReleases = updatedBetaReleases;
            if (updatedCampaigns) updates.campaigns = updatedCampaigns;
            if (updatedAccounts && currentAccount) {
                const myAccount = updatedAccounts.find(a => a.id === currentAccount.id);
                if (myAccount) updates.account = { onboardingComplete: myAccount.onboardingComplete, betaLabIntroSeen: myAccount.betaLabIntroSeen };
            }

            await fetch('/api/creator/save', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
        } catch (e) { console.error('[CreatorApp] Save failed:', e); }
    };



    // --- AUTH: Sign In (server-side) ---
    const handleSignIn = async () => {
        if (!formEmail || !formPassword) { setLoginError('Please enter your email and password.'); return; }
        setIsLoading(true); setLoginError(null);
        try {
            const resp = await fetch('/api/creator/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formEmail, password: formPassword })
            });
            const data = await resp.json();
            if (!resp.ok) {
                if (resp.status === 503) {
                    setLoginError('Unable to connect to server. Please try again.');
                } else {
                    setLoginError(data.error || 'Invalid email or password.');
                }
                setIsLoading(false); return;
            }

            // Store JWT
            setJwtToken(data.token);
            localStorage.setItem('ooedn_creator_jwt', data.token);
            localStorage.setItem('ooedn_creator_session', JSON.stringify({ accountId: data.account.id, email: data.account.email }));

            applyServerData(data, data.account);
            setIsConnected(true); initialLoadRef.current = true;
            if (!data.account.onboardingComplete) setShowOnboarding(true);

            // Show intro only on first-ever login for this creator
            const introKey = `ooedn_creator_intro_seen_${data.account.email}`;
            if (!localStorage.getItem(introKey)) {
                setShowWelcomeIntro(true);
                localStorage.setItem(introKey, 'true');
            }
        } catch (e: any) { setLoginError(`Sign in failed: ${e.message}`); }
        finally { setIsLoading(false); }
    };

    // --- Session restore (JWT-based) ---
    useEffect(() => {
        const token = localStorage.getItem('ooedn_creator_jwt');
        if (token && !isConnected) {
            setIsLoading(true);
            fetch('/api/creator/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(async resp => {
                if (resp.ok) {
                    const data = await resp.json();
                    setJwtToken(token);
                    applyServerData(data, data.account);
                    setIsConnected(true); initialLoadRef.current = true;
                    if (!data.account.onboardingComplete) setShowOnboarding(true);
                } else {
                    // Token expired or invalid — clear session
                    localStorage.removeItem('ooedn_creator_jwt');
                    localStorage.removeItem('ooedn_creator_session');
                }
                setIsLoading(false);
            }).catch(() => {
                localStorage.removeItem('ooedn_creator_jwt');
                localStorage.removeItem('ooedn_creator_session');
                setIsLoading(false);
            });
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('ooedn_creator_session');
        localStorage.removeItem('ooedn_creator_jwt');
        setJwtToken(null);
        setIsConnected(false); setCurrentAccount(null); setCreatorRecord(null);
        setFormEmail(''); setFormPassword('');
    };

    // --- NOTIFICATION SUPPORT ---
    const handleEnableNotifications = async () => {
        if (!creatorRecord) return;
        try {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const updated = { ...creatorRecord, notificationsEnabled: true };
                    setCreatorRecord(updated);
                    const updatedCreators = creators.map(c => c.id === updated.id ? updated : c);
                    setCreators(updatedCreators);
                    saveMasterDB(updatedCreators);
                    addNotification('message', 'Notifications Enabled! 🔔', 'You\'ll now get alerts for campaigns, payments, and messages.');

                    // Register push subscription with server
                    try {
                        const reg = await navigator.serviceWorker.ready;
                        const vapidRes = await fetch('/api/push/vapid-key');
                        const { key } = await vapidRes.json();
                        const sub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: key
                        });
                        await fetch('/api/push/subscribe-creator', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subscription: sub, creatorId: creatorRecord.id })
                        });
                        console.log('[Push] Creator push subscription registered');
                    } catch (pushErr) { console.warn('[Push] Could not register push subscription:', pushErr); }
                }
            }
        } catch (e) { console.error('Notification permission failed:', e); }
    };

    const addNotification = (type: CreatorNotification['type'], title: string, body: string) => {
        const notif: CreatorNotification = {
            id: crypto.randomUUID(), type, title, body, timestamp: new Date().toISOString(), read: false,
        };
        setNotifications(prev => [notif, ...prev]);

        // Browser notification
        if (creatorRecord?.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: settings.logoUrl });
        }
    };

    const unreadNotifs = notifications.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setShowNotifPanel(false);
    };

    // --- HANDLERS ---
    const handleUpdateMyProfile = (updates: Partial<Creator>) => {
        if (!creatorRecord) return;
        const updated = { ...creatorRecord, ...updates };
        setCreatorRecord(updated);
        const updatedCreators = creators.map(c => c.id === updated.id ? updated : c);
        setCreators(updatedCreators);
        saveMasterDB(updatedCreators);
    };

    const handleRequestPayment = (selectedContentIds: string[], totalAmount: number) => {
        if (!creatorRecord) return;
        // Mark content as payment-requested
        const updatedContent = contentItems.map(c =>
            selectedContentIds.includes(c.id) ? { ...c, paymentRequested: true, paymentAmount: creatorRecord.rate || 0 } : c
        );
        setContentItems(updatedContent);
        handleUpdateMyProfile({
            paymentStatus: PaymentStatus.Processing,
            paymentRequestDate: new Date().toISOString(),
        });
        addNotification('payment', 'Payment Requested! 💰', `$${totalAmount} for ${selectedContentIds.length} video(s). Team will process shortly.`);
        saveMasterDB(undefined, undefined, updatedContent);
    };

    const handleSendMessage = (text: string) => {
        if (!creatorRecord || !text.trim()) return;
        const msg: TeamMessage = {
            id: crypto.randomUUID(), sender: creatorRecord.name, text: text.trim(), timestamp: new Date().toISOString(),
            creatorId: creatorRecord.id, creatorName: creatorRecord.name, isCreatorMessage: true,
        };
        const updatedMessages = [...teamMessages, msg];
        setTeamMessages(updatedMessages);
        saveMasterDB(undefined, undefined, undefined, updatedMessages);
    };

    const handleContentUpload = (item: ContentItem) => {
        const updatedContent = [...contentItems, item];
        setContentItems(updatedContent);
        saveMasterDB(undefined, undefined, updatedContent);
        addNotification('message', 'Content Uploaded! 🚀', `"${item.title}" has been submitted for review.`);
    };

    const handleContentUpdate = (id: string, updates: Partial<ContentItem>) => {
        const updatedContent = contentItems.map(c => c.id === id ? { ...c, ...updates } : c);
        setContentItems(updatedContent);
        saveMasterDB(undefined, undefined, updatedContent);
        if (updates.status === ContentStatus.Raw && updates.revisionCount) {
            addNotification('message', 'Revision Uploaded! 📎', `Revised version submitted for review.`);
        }
    };

    const handleReplyToNote = (contentId: string, text: string) => {
        if (!creatorRecord) return;
        const reply: ContentNote = {
            id: crypto.randomUUID(), user: creatorRecord.name, text,
            date: new Date().toISOString(), isCreatorReply: true,
        };
        const updatedContent = contentItems.map(c =>
            c.id === contentId ? { ...c, teamNotes: [...(c.teamNotes || []), reply] } : c
        );
        setContentItems(updatedContent);
        saveMasterDB(undefined, undefined, updatedContent);
    };

    const handleMarkTaskDone = (campaignId: string, taskId: string) => {
        const updatedCampaigns = campaigns.map(c => {
            if (c.id !== campaignId) return c;
            return { ...c, tasks: c.tasks?.map(t => t.id === taskId ? { ...t, isDone: true } : t) };
        });
        setCampaigns(updatedCampaigns);
        saveMasterDB(undefined, updatedCampaigns);
    };

    const handleAcceptCampaign = (campaignId: string) => {
        if (!creatorRecord) return;
        const updatedCampaigns = campaigns.map(c => {
            if (c.id !== campaignId) return c;
            return { ...c, acceptedByCreatorIds: [...(c.acceptedByCreatorIds || []), creatorRecord.id] };
        });
        setCampaigns(updatedCampaigns);
        saveMasterDB(undefined, updatedCampaigns);
        addNotification('campaign', 'Campaign Accepted! 🎯', `You're now part of the campaign. Check the deliverables!`);
    };

    const handleDeclineCampaign = (campaignId: string) => {
        if (!creatorRecord) return;
        const campaign = campaigns.find(c => c.id === campaignId);
        // Remove the creator from assignedCreatorIds
        const updatedCampaigns = campaigns.map(c => {
            if (c.id !== campaignId) return c;
            return {
                ...c,
                assignedCreatorIds: (c.assignedCreatorIds || []).filter(id => id !== creatorRecord.id),
                acceptedByCreatorIds: [...(c.acceptedByCreatorIds || []), creatorRecord.id] // Mark as "handled" so it doesn't re-appear
            };
        });
        setCampaigns(updatedCampaigns);
        saveMasterDB(undefined, updatedCampaigns);
        // Send a message to the team so they know
        const msg: TeamMessage = {
            id: crypto.randomUUID(),
            creatorId: creatorRecord.id,
            sender: creatorRecord.name,
            text: `❌ Declined campaign "${campaign?.title || 'Unknown'}"`,
            timestamp: new Date().toISOString(),
            isCreatorMessage: true,
        };
        const updatedMessages = [...teamMessages, msg];
        setTeamMessages(updatedMessages);
        saveMasterDB(undefined, undefined, undefined, updatedMessages);
        addNotification('campaign', 'Campaign Declined', `You've declined this campaign.`);
    };

    // --- BETA LAB HANDLERS ---
    const handleSignBetaRelease = (betaTestId: string) => {
        if (!creatorRecord) return;
        const test = betaTests.find(t => t.id === betaTestId);
        const newRelease: BetaRelease = {
            id: crypto.randomUUID(),
            betaTestId,
            creatorId: creatorRecord.id,
            signedAt: new Date().toISOString(),
            agreed: true,
            releaseText: 'OOEDN Beta Testing Agreement — Signed digitally',
        };
        const updatedReleases = [...betaReleases, newRelease];
        setBetaReleases(updatedReleases);
        saveMasterDB(undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedReleases);
        addNotification('campaign', 'Release Signed ✍️', `You signed the release for "${test?.title}". Next: await your sample!`);
    };

    const handleMarkSampleReceived = (betaTestId: string) => {
        if (!creatorRecord) return;
        const updatedReleases = betaReleases.map(r =>
            r.betaTestId === betaTestId && r.creatorId === creatorRecord!.id ? { ...r, sampleReceived: true } : r
        );
        setBetaReleases(updatedReleases);
        saveMasterDB(undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedReleases);
        addNotification('campaign', 'Sample Received 📦', 'Great! You can now start reviewing and uploading content.');
    };

    const handleSubmitBetaReview = (betaTestId: string, rating: number, text: string) => {
        if (!creatorRecord) return;
        const updatedReleases = betaReleases.map(r =>
            r.betaTestId === betaTestId && r.creatorId === creatorRecord!.id
                ? { ...r, reviewSubmitted: true, reviewRating: rating, reviewText: text }
                : r
        );
        setBetaReleases(updatedReleases);
        saveMasterDB(undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedReleases);
        addNotification('campaign', 'Review Submitted ⭐', `Your ${rating}-star review has been sent to the team.`);
    };

    // --- ONBOARDING COMPLETE ---
    const handleOnboardingComplete = () => {
        if (!currentAccount) return;
        const updatedAccount = { ...currentAccount, onboardingComplete: true };
        setCurrentAccount(updatedAccount);
        // Save account update directly — don't rely on creatorAccounts array
        const token = jwtToken || localStorage.getItem('ooedn_creator_jwt');
        if (token) {
            fetch('/api/creator/save', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: { account: { onboardingComplete: true } } })
            }).catch(e => console.error('[CreatorApp] Onboarding save failed:', e));
        }
        setShowOnboarding(false);
    };

    // --- BETA LAB INTRO DISMISS ---
    const handleBetaLabIntroDismiss = () => {
        if (!currentAccount) return;
        const updatedAccount = { ...currentAccount, betaLabIntroSeen: true };
        const updatedAccounts = creatorAccounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
        setCurrentAccount(updatedAccount);
        setCreatorAccounts(updatedAccounts);
        saveMasterDB(undefined, undefined, undefined, undefined, undefined, updatedAccounts);
        // localStorage fallback so it stays dismissed even if server save fails
        if (creatorRecord) localStorage.setItem(`ooedn_beta_intro_${creatorRecord.id}`, 'true');
    };

    // --- BETA REQUEST ---
    const handleRequestBeta = () => {
        if (!creatorRecord) return;
        const updated = { ...creatorRecord, requestedBeta: true, requestedBetaAt: new Date().toISOString() } as any;
        setCreatorRecord(updated);
        const updatedCreators = creators.map(c => c.id === updated.id ? updated : c);
        setCreators(updatedCreators);
        saveMasterDB(updatedCreators);
        addNotification('campaign', 'Beta Request Sent! 🧪', "You're on the waitlist. The team will assign you when a test is available.");
    };

    // --- LOGIN / SIGN-UP SCREEN ---
    if (!isConnected) {
        return (
            <div style={{ minHeight: '100vh', background: '#07070a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
                {/* Animated gradient orbs */}
                <div style={{ position: 'absolute', top: '15%', left: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', animation: 'creatorOrb1 8s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(236,72,153,0.12), transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', animation: 'creatorOrb2 10s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', top: '50%', left: '60%', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(103,232,249,0.08), transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', animation: 'creatorOrb3 12s ease-in-out infinite' }} />

                {/* Login card — frosted glass */}
                <div style={{
                    position: 'relative', zIndex: 10, width: '100%', maxWidth: '400px',
                    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(40px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px',
                    padding: '40px 32px', boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                    animation: 'creatorSlideUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                    opacity: 0, transform: 'translateY(20px)',
                }}>
                    {/* Top light accent line */}
                    <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent)' }} />

                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                        {settings.logoUrl
                            ? <img src={settings.logoUrl} alt="OOEDN Logo" style={{ height: '40px', objectFit: 'contain', margin: '0 auto 16px', opacity: 0.9 }} />
                            : <Flame size={40} style={{ color: '#a78bfa', margin: '0 auto 16px' }} />}
                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', margin: '0 0 4px' }}>Creator Portal</h1>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>OOEDN Partner Access</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <Mail size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email address" type="email"
                                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px 14px 40px', fontSize: '14px', color: 'white', outline: 'none', transition: 'border-color 0.3s', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.4)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                            <input value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Password"
                                type={showPassword ? 'text' : 'password'}
                                onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 42px 14px 40px', fontSize: '14px', color: 'white', outline: 'none', transition: 'border-color 0.3s', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.4)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                            <button onClick={() => setShowPassword(!showPassword)} type="button"
                                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 0 }}>
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <button onClick={handleSignIn} disabled={isLoading}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: 'white',
                                fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: '0 8px 32px rgba(139,92,246,0.25)', transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
                                marginTop: '4px', opacity: isLoading ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(139,92,246,0.35)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(139,92,246,0.25)'; }}>
                            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><ArrowRight size={14} /> Sign In</>}
                        </button>
                    </div>

                    {loginError && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', textAlign: 'center' }}>
                            <p style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 0 }}><AlertTriangle size={12} /> {loginError}</p>
                        </div>
                    )}
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>OOEDN Holdings LLC • Creator Portal</p>
                    </div>
                </div>

                <style>{`
                    @keyframes creatorOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.15); } }
                    @keyframes creatorOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.1); } }
                    @keyframes creatorOrb3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,20px) scale(1.2); } }
                    @keyframes creatorSlideUp { to { opacity: 1; transform: translateY(0); } }
                `}</style>
            </div>
        );
    }

    if (isLoading && !creatorRecord) {
        return (
            <div style={{ minHeight: '100vh', background: '#07070a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', animation: 'creatorSlideUp 0.6s ease forwards', opacity: 0, transform: 'translateY(10px)' }}>
                    <Loader2 size={32} style={{ color: '#a78bfa', animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Loading your portal...</p>
                </div>
                <style>{`@keyframes creatorSlideUp { to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
        );
    }


    if (showWelcomeIntro) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => setShowWelcomeIntro(false)}>
                {/* Cinematic flash */}
                <div className="absolute inset-0 bg-white" style={{ animation: 'introFlash 0.6s ease-out forwards' }} />

                {/* Gradient BG */}
                <div className="absolute inset-0" style={{ animation: 'introFadeIn 0.5s ease-out 0.3s both' }}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/50 via-black to-black" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/15 rounded-full blur-[150px]" style={{ animation: 'introPulseGlow 2s ease-in-out infinite' }} />
                </div>

                {/* SLAM Content */}
                <div className="relative z-10 flex flex-col items-center px-6">
                    {/* Logo — smashes in */}
                    <div style={{ animation: 'introSlamIn 0.4s cubic-bezier(0, 0, 0.2, 1) 0.2s both' }}>
                        {settings.logoUrl
                            ? <img src={settings.logoUrl} alt="OOEDN" className="h-20 object-contain mb-6" />
                            : <Flame size={80} className="text-purple-500 mb-6" />}
                    </div>

                    {/* BIG TEXT — slams in with scale */}
                    <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter text-center leading-none"
                        style={{ animation: 'introSlamIn 0.3s cubic-bezier(0, 0, 0.2, 1) 0.4s both' }}>
                        CREATOR<br />PORTAL
                    </h1>

                    {/* Divider line — snaps open */}
                    <div className="h-1 w-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full my-6"
                        style={{ animation: 'introExpandLine 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both' }} />

                    {/* Creator name — slides up */}
                    <p className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 text-center"
                        style={{ animation: 'introSlideUp 0.6s ease-out 0.9s both' }}>
                        {creatorRecord?.name || currentAccount?.displayName || 'Welcome'}
                    </p>

                    {/* Tagline */}
                    <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.5em] mt-4"
                        style={{ animation: 'introSlideUp 0.5s ease-out 1.1s both' }}>
                        OOEDN × YOU
                    </p>

                    {/* Enter button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowWelcomeIntro(false); }}
                        className="mt-10 px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-110 active:scale-95 transition-all"
                        style={{ animation: 'introSlideUp 0.5s ease-out 1.4s both' }}>
                        Enter →
                    </button>

                    <p className="text-neutral-700 text-[9px] mt-6 uppercase tracking-widest"
                        style={{ animation: 'introSlideUp 0.5s ease-out 1.6s both' }}>
                        Tap anywhere to continue
                    </p>
                </div>

                <style>{`
                    @keyframes introFlash { 0% { opacity: 1; } 100% { opacity: 0; } }
                    @keyframes introFadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes introSlamIn { 0% { opacity: 0; transform: scale(3); } 100% { opacity: 1; transform: scale(1); } }
                    @keyframes introSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
                    @keyframes introExpandLine { from { width: 0; } to { width: 12rem; } }
                    @keyframes introPulseGlow { 0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); } }
                `}</style>
            </div>
        );
    }

    if (!creatorRecord) {
        return (
            <div style={{ minHeight: '100vh', background: '#07070a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
                <div style={{ position: 'absolute', top: '20%', left: '30%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', animation: 'creatorOrb1 8s ease-in-out infinite' }} />
                <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(40px) saturate(1.8)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px', padding: '40px 32px', textAlign: 'center', animation: 'creatorSlideUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0, transform: 'translateY(20px)', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Welcome, {currentAccount?.displayName}!</h2>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px', lineHeight: 1.5 }}>Your account has been created. The OOEDN team will link your profile shortly. Check back soon!</p>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', marginBottom: '16px' }}>Signed in as {currentAccount?.email}</p>
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto', padding: 0 }}>
                        <LogOut size={12} /> Sign out
                    </button>
                </div>
                <style>{`@keyframes creatorOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.15); } } @keyframes creatorSlideUp { to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
        );
    }

    // --- NAV ITEMS ---
    const navItems: { id: CreatorView; icon: React.ElementType; label: string; emoji: string }[] = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Home', emoji: '🏠' },
        { id: 'chat', icon: MessageCircle, label: 'Chat', emoji: '💬' },
        { id: 'upload', icon: Upload, label: 'Content', emoji: '📹' },
        { id: 'payments', icon: CreditCard, label: 'Payments', emoji: '💰' },
        { id: 'profile', icon: User, label: 'Profile', emoji: '👤' },
        { id: 'shipments', icon: Package, label: 'Shipments', emoji: '📦' },
        { id: 'campaigns', icon: Briefcase, label: 'Campaigns', emoji: '🎯' },
        { id: 'community', icon: Users, label: 'Community', emoji: '🤝' },
        { id: 'betaLab', icon: FlaskConical, label: 'Beta Lab', emoji: '🧪' },
    ];

    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creatorRecord.id));
    const newCampaignCount = myCampaigns.filter(c => !c.acceptedByCreatorIds?.includes(creatorRecord.id)).length;

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: 'white', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif', position: 'relative' }} className={!isDarkMode ? 'light-mode' : ''}>
            {/* Subtle ambient glow — Apple style */}
            <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(167,139,250,0.06), transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(236,72,153,0.04), transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
            {/* ONBOARDING WALKTHROUGH OVERLAY */}
            {showOnboarding && currentAccount && creatorRecord && (
                <CreatorOnboarding
                    account={currentAccount}
                    creator={creatorRecord}
                    onComplete={handleOnboardingComplete}
                    onUpdateProfile={(updates) => {
                        const updated = { ...creatorRecord, ...updates };
                        setCreatorRecord(updated);
                        const updatedCreators = creators.map(c => c.id === updated.id ? updated : c);
                        setCreators(updatedCreators);
                        saveMasterDB(updatedCreators);
                    }}
                    onEnableNotifications={handleEnableNotifications}
                    onChangePassword={async (newPw: string) => {
                        try {
                            const token = jwtToken || localStorage.getItem('ooedn_creator_jwt');
                            const resp = await fetch('/api/creator/change-password', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ newPassword: newPw })
                            });
                            return resp.ok;
                        } catch { return false; }
                    }}
                />
            )}
            {/* SIDEBAR — refined Apple style */}
            <aside style={{
                width: isSidebarOpen ? '200px' : '68px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(40px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                transition: 'width 0.3s cubic-bezier(0.22,1,0.36,1)', zIndex: 50,
            }}>
                <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {isSidebarOpen
                        ? settings.logoUrl ? <img src={settings.logoUrl} alt="OOEDN" style={{ height: '24px', objectFit: 'contain' }} /> : <h1 style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.03em', color: '#a78bfa', margin: 0 }}>ooedn</h1>
                        : <Flame style={{ color: '#a78bfa' }} size={18} />}
                </div>
                <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {navItems.map(item => {
                        const isActive = view === item.id;
                        return (
                            <button key={item.id} onClick={() => setView(item.id)}
                                title={!isSidebarOpen ? item.label : ''}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: isSidebarOpen ? '10px 12px' : '10px',
                                    borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                                    justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                                    background: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                                {isActive && <div style={{ position: 'absolute', left: isSidebarOpen ? '0' : '-8px', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', borderRadius: '2px', background: 'linear-gradient(180deg, #a78bfa, #ec4899)' }} />}
                                <item.icon size={isSidebarOpen ? 16 : 18} style={{ color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'color 0.2s' }} />
                                {isSidebarOpen && (
                                    <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 600, color: isActive ? 'white' : 'rgba(255,255,255,0.4)', textAlign: 'left', whiteSpace: 'nowrap' }}>{item.label}</span>
                                )}
                                {item.id === 'campaigns' && newCampaignCount > 0 && (
                                    isSidebarOpen
                                        ? <span style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', background: '#a78bfa', color: 'white', fontSize: '9px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{newCampaignCount}</span>
                                        : <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', background: '#a78bfa', borderRadius: '50%' }} />
                                )}
                            </button>
                        );
                    })}
                </nav>
                <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', color: 'rgba(255,255,255,0.25)', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                    </button>
                    {isSidebarOpen && (
                        <>
                            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', color: 'rgba(255,255,255,0.25)', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>
                                {isDarkMode ? <Sun size={12} /> : <Moon size={12} />} {isDarkMode ? 'Light' : 'Dark'}
                            </button>
                            <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', color: 'rgba(239,68,68,0.4)', background: 'transparent', border: '1px solid rgba(239,68,68,0.08)', borderRadius: '10px', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>
                                <LogOut size={12} /> Sign Out
                            </button>
                        </>
                    )}
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', zIndex: 10 }}>

                {/* TOP BAR — refined frosted glass */}
                <header style={{
                    height: '60px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(40px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 24px', zIndex: 40, position: 'relative',
                }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <span>{navItems.find(n => n.id === view)?.emoji}</span>
                        {navItems.find(n => n.id === view)?.label || 'Home'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Bell */}
                        <button
                            onClick={() => setShowNotifPanel(!showNotifPanel)}
                            style={{ position: 'relative', padding: '8px', background: 'none', border: 'none', color: unreadNotifs > 0 ? '#a78bfa' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'color 0.2s' }}
                            title="Notifications">
                            {unreadNotifs > 0 ? <BellDot size={17} /> : <Bell size={17} />}
                            {unreadNotifs > 0 && (
                                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', background: '#8b5cf6', borderRadius: '50%', fontSize: '8px', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifs}</span>
                            )}
                        </button>
                        {/* Avatar pill */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            padding: '4px 14px 4px 4px', borderRadius: '100px',
                        }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '11px' }}>
                                {creatorRecord.name?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{creatorRecord.name?.split(' ')[0] || 'Creator'}</span>
                        </div>
                    </div>
                </header>

                {/* NOTIFICATION PANEL — frosted glass */}
                {showNotifPanel && (
                    <div style={{ position: 'absolute', top: '68px', right: '16px', width: '320px', background: 'rgba(20,20,25,0.9)', backdropFilter: 'blur(40px) saturate(1.5)', WebkitBackdropFilter: 'blur(40px) saturate(1.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notifications</span>
                            {unreadNotifs > 0 && (
                                <button onClick={markAllRead} style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔔</div>
                                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>No notifications yet</p>
                                </div>
                            ) : (
                                notifications.slice(0, 10).map(n => (
                                    <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.read ? 'transparent' : 'rgba(139,92,246,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>{n.title}</span>
                                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>{n.body}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Close notification panel when clicking elsewhere */}
                {showNotifPanel && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNotifPanel(false)} />
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative', zIndex: 1 }}>
                    {view === 'dashboard' && (
                        <CreatorDashboard
                            creator={creatorRecord}
                            campaigns={campaigns}
                            contentItems={contentItems}
                            teamMessages={teamMessages}
                            onNavigate={(v: string) => setView(v as CreatorView)}
                            onEnableNotifications={handleEnableNotifications}
                        />
                    )}
                    {view === 'chat' && (
                        <CreatorChat
                            creator={creatorRecord}
                            messages={teamMessages}
                            onSendMessage={handleSendMessage}
                        />
                    )}
                    {view === 'upload' && (
                        <CreatorUpload
                            creator={creatorRecord}
                            campaigns={campaigns}
                            contentItems={contentItems}
                            onUpload={handleContentUpload}
                            onReplyToNote={handleReplyToNote}
                            onUpdateContent={handleContentUpdate}
                        />
                    )}
                    {view === 'payments' && (
                        <CreatorPayments
                            creator={creatorRecord}
                            contentItems={contentItems}
                            onRequestPayment={handleRequestPayment}
                        />
                    )}
                    {view === 'profile' && (
                        <CreatorProfile
                            creator={creatorRecord}
                            onUpdate={handleUpdateMyProfile}
                        />
                    )}
                    {view === 'shipments' && (
                        <CreatorShipments
                            creator={creatorRecord}
                        />
                    )}
                    {view === 'campaigns' && (
                        <CreatorCampaigns
                            creator={creatorRecord}
                            campaigns={campaigns}
                            contentItems={contentItems}
                            onMarkTaskDone={handleMarkTaskDone}
                            onAcceptCampaign={handleAcceptCampaign}
                            onDeclineCampaign={handleDeclineCampaign}
                            onNavigate={(v: string) => setView(v as CreatorView)}
                            onAddComment={(campaignId, text) => {
                                if (!creatorRecord) return;
                                const comment = {
                                    id: crypto.randomUUID(),
                                    user: creatorRecord.name,
                                    text,
                                    date: new Date().toISOString(),
                                    isCreatorComment: true,
                                    creatorId: creatorRecord.id,
                                };
                                const updatedCampaigns = campaigns.map(c => {
                                    if (c.id !== campaignId) return c;
                                    return { ...c, comments: [...(c.comments || []), comment] };
                                });
                                setCampaigns(updatedCampaigns);
                                saveMasterDB(undefined, updatedCampaigns);
                                // Also send a message so the team gets notified
                                const campaign = campaigns.find(c => c.id === campaignId);
                                const msg: TeamMessage = {
                                    id: crypto.randomUUID(),
                                    creatorId: creatorRecord.id,
                                    sender: creatorRecord.name,
                                    text: `📋 Note on campaign "${campaign?.title || 'Unknown'}": ${text}`,
                                    timestamp: new Date().toISOString(),
                                    isCreatorMessage: true,
                                };
                                setTeamMessages(prev => [...prev, msg]);
                                saveMasterDB(undefined, undefined, undefined, [...teamMessages, msg]);
                            }}
                            onSelectAngle={(campaignId, avatarId, angleId) => {
                                const updatedCampaigns = campaigns.map(c => {
                                    if (c.id !== campaignId) return c;
                                    const updatedAvatars = (c.avatars || []).map(avatar => {
                                        if (avatar.id !== avatarId) return avatar;
                                        const updatedAngles = (avatar.angles || []).map(angle => {
                                            if (angle.id !== angleId) return angle;
                                            const ids = angle.selectedByCreatorIds || [];
                                            if (!ids.includes(creatorRecord.id)) {
                                                return { ...angle, selectedByCreatorIds: [...ids, creatorRecord.id] };
                                            }
                                            return angle;
                                        });
                                        // Also add creator to avatar's matchedCreatorIds for slot tracking
                                        const matchedIds = avatar.matchedCreatorIds || [];
                                        const updatedMatched = matchedIds.includes(creatorRecord.id) ? matchedIds : [...matchedIds, creatorRecord.id];
                                        return { ...avatar, angles: updatedAngles, matchedCreatorIds: updatedMatched };
                                    });
                                    return { ...c, avatars: updatedAvatars };
                                });
                                setCampaigns(updatedCampaigns);
                                saveMasterDB(undefined, updatedCampaigns);
                            }}
                        />
                    )}
                    {view === 'community' && (
                        <CreatorPeerChat
                            creator={creatorRecord}
                            campaigns={campaigns}
                            creators={creators}
                            peerMessages={peerMessages}
                            onSendPeerMessage={(toCreatorId, text) => {
                                const msg: PeerMessage = {
                                    id: crypto.randomUUID(),
                                    fromCreatorId: creatorRecord.id,
                                    toCreatorId,
                                    text,
                                    timestamp: new Date().toISOString(),
                                };
                                setPeerMessages(prev => [...prev, msg]);
                                saveMasterDB();
                            }}
                        />
                    )}
                    {view === 'betaLab' && currentAccount && (
                        <CreatorBetaLab
                            creator={creatorRecord}
                            account={currentAccount}
                            betaTests={betaTests}
                            betaReleases={betaReleases}
                            onSignRelease={handleSignBetaRelease}
                            onMarkSampleReceived={handleMarkSampleReceived}
                            onSubmitReview={handleSubmitBetaReview}
                            onRequestBeta={handleRequestBeta}
                            onNavigate={(v: string) => setView(v as CreatorView)}
                            onDismissIntro={handleBetaLabIntroDismiss}
                        />
                    )}
                </div>

                {/* Coco AI Chat — floating overlay */}
                <CreatorAIChat
                    creator={creatorRecord}
                    campaigns={campaigns}
                    contentItems={contentItems}
                />
            </main>
        </div>
    );
}

export default CreatorApp;
