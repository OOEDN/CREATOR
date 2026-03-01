import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard, MessageCircle, Upload, CreditCard, User, Package, Briefcase,
    Loader2, ArrowRight, AlertTriangle, Flame, LogOut, Menu, X, Sun, Moon, UserPlus,
    Mail, Lock, Eye, EyeOff, Bell, BellDot, FlaskConical
} from 'lucide-react';
import {
    Creator, CreatorStatus, PaymentStatus, Platform, ContentItem, AppSettings,
    ShipmentStatus, Campaign, ContentStatus, TeamMessage, TeamTask, Shipment,
    CreatorAccount, ContentNote, BetaTest, BetaRelease
} from './types';
import { syncStateToCloud, loadRemoteState, MasterDB, onSyncStatusChange, SyncStatus } from './services/cloudSync';
import { uploadJSONToGoogleCloud, fetchJSONFromGoogleCloud } from './services/googleCloudStorage';
import CreatorDashboard from './components/creator/CreatorDashboard';
import CreatorChat from './components/creator/CreatorChat';
import CreatorUpload from './components/creator/CreatorUpload';
import CreatorPayments from './components/creator/CreatorPayments';
import CreatorProfile from './components/creator/CreatorProfile';
import CreatorShipments from './components/creator/CreatorShipments';
import CreatorCampaigns from './components/creator/CreatorCampaigns';
import CreatorOnboarding from './components/creator/CreatorOnboarding';
import CreatorBetaLab from './components/creator/CreatorBetaLab';

type CreatorView = 'dashboard' | 'chat' | 'upload' | 'payments' | 'profile' | 'shipments' | 'campaigns' | 'betaLab';

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
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Form fields
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formName, setFormName] = useState('');

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

    const [settings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('ooedn_settings');
        if (saved) {
            try { return { ...GCS_SETTINGS, ...JSON.parse(saved) }; } catch { return GCS_SETTINGS; }
        }
        return GCS_SETTINGS;
    });

    // --- Load master DB ---
    const loadMasterDB = async (): Promise<MasterDB | null> => {
        try {
            const teamToken = localStorage.getItem('ooedn_settings');
            let token = '';
            if (teamToken) {
                try { const parsed = JSON.parse(teamToken); token = parsed.googleCloudToken || ''; } catch { }
            }
            if (!token) token = localStorage.getItem('ooedn_creator_gcs_token') || '';
            if (!token) return null;
            const settingsWithToken = { ...settings, googleCloudToken: token };
            return await loadRemoteState(settingsWithToken);
        } catch (e) {
            console.error('[CreatorApp] Failed to load DB:', e);
            return null;
        }
    };

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
        try {
            let token = '';
            const teamSettings = localStorage.getItem('ooedn_settings');
            if (teamSettings) { try { token = JSON.parse(teamSettings).googleCloudToken || ''; } catch { } }
            if (!token) token = localStorage.getItem('ooedn_creator_gcs_token') || '';
            if (!token) return;

            const dbPayload: MasterDB = {
                lastUpdated: new Date().toISOString(),
                creators: updatedCreators || creators,
                campaigns: updatedCampaigns || campaigns,
                contentItems: (updatedContent || contentItems).map(c => ({ ...c, fileBlob: undefined, fileUrl: c.storageType === 'cloud' ? c.fileUrl : '' })),
                teamMessages: updatedMessages || teamMessages,
                teamTasks: updatedTasks || teamTasks,
                creatorAccounts: updatedAccounts || creatorAccounts,
                betaTests: updatedBetaTests || betaTests,
                betaReleases: updatedBetaReleases || betaReleases,
                brandInfo: settings.brandInfo,
                version: Date.now(),
            };

            await uploadJSONToGoogleCloud(
                dbPayload, settings.googleCloudBucket!, token, 'ooedn_master_db.json', settings.googleProjectId
            );
        } catch (e) { console.error('[CreatorApp] Save failed:', e); }
    };

    // --- AUTH: Sign Up ---
    const handleSignUp = async () => {
        if (!formEmail || !formPassword || !formName) { setLoginError('Please fill in all fields.'); return; }
        if (formPassword.length < 4) { setLoginError('Password must be at least 4 characters.'); return; }
        setIsLoading(true); setLoginError(null);
        try {
            const db = await loadMasterDB();
            const existingAccounts = db?.creatorAccounts || [];
            if (existingAccounts.find(a => a.email.toLowerCase() === formEmail.toLowerCase())) {
                setLoginError('An account with this email already exists. Try signing in.');
                setIsLoading(false); return;
            }
            const newAccount: CreatorAccount = {
                id: crypto.randomUUID(), email: formEmail.toLowerCase().trim(), password: formPassword,
                displayName: formName.trim(), createdAt: new Date().toISOString(),
            };
            const newCreator: Creator = {
                id: crypto.randomUUID(), name: formName.trim(), handle: '@' + formEmail.split('@')[0],
                platform: Platform.Instagram, profileImage: '', notes: 'Self-registered via Creator Portal',
                status: CreatorStatus.Active, paymentStatus: PaymentStatus.Unpaid, paymentOptions: [],
                rate: 0, email: formEmail.toLowerCase().trim(), dateAdded: new Date().toISOString(),
                rating: null, flagged: false, shipmentStatus: ShipmentStatus.None,
                role: 'creator', portalEmail: formEmail.toLowerCase().trim(),
                notificationsEnabled: false, totalEarned: 0, lastActiveDate: new Date().toISOString(),
            };
            newAccount.linkedCreatorId = newCreator.id;
            const updatedAccounts = [...existingAccounts, newAccount];
            const updatedCreators = [...(db?.creators || []), newCreator];
            await saveMasterDB(updatedCreators, db?.campaigns || [], db?.contentItems || [], db?.teamMessages || [], db?.teamTasks || [], updatedAccounts);
            setCurrentAccount(newAccount); setCreatorRecord(newCreator); setCreators(updatedCreators);
            setCampaigns(db?.campaigns || []); setContentItems(db?.contentItems || []);
            setTeamMessages(db?.teamMessages || []); setTeamTasks(db?.teamTasks || []);
            setCreatorAccounts(updatedAccounts);
            setBetaTests(db?.betaTests || []); setBetaReleases(db?.betaReleases || []);
            localStorage.setItem('ooedn_creator_session', JSON.stringify({ accountId: newAccount.id, email: newAccount.email }));
            setIsConnected(true); initialLoadRef.current = true;
            // New accounts always show onboarding
            setShowOnboarding(true);
        } catch (e: any) { setLoginError(`Sign up failed: ${e.message}`); }
        finally { setIsLoading(false); }
    };

    // --- AUTH: Sign In ---
    const handleSignIn = async () => {
        if (!formEmail || !formPassword) { setLoginError('Please enter your email and password.'); return; }
        setIsLoading(true); setLoginError(null);
        try {
            const db = await loadMasterDB();
            if (!db) {
                console.error('[CreatorApp] loadMasterDB returned null — no GCS token available');
                setLoginError('Unable to connect to server. Please try again.');
                setIsLoading(false); return;
            }
            const accounts = db?.creatorAccounts || [];
            console.log(`[CreatorApp] Sign-in: Found ${accounts.length} accounts. Looking for: "${formEmail.toLowerCase().trim()}"`);
            if (accounts.length > 0) {
                console.log('[CreatorApp] Available emails:', accounts.map(a => a.email));
            }
            const inputEmail = formEmail.toLowerCase().trim();
            const inputPassword = formPassword.trim();
            const account = accounts.find(a => a.email.toLowerCase() === inputEmail && a.password === inputPassword);
            if (!account) {
                // Debug: check if email exists but password is wrong
                const emailMatch = accounts.find(a => a.email.toLowerCase() === inputEmail);
                if (emailMatch) {
                    console.log('[CreatorApp] Email found but password mismatch. Expected:', emailMatch.password, 'Got:', inputPassword);
                } else {
                    console.log('[CreatorApp] No account found with email:', inputEmail);
                }
                setLoginError('Invalid email or password.'); setIsLoading(false); return;
            }
            const myCreator = db?.creators?.find(c => c.id === account.linkedCreatorId) ||
                db?.creators?.find(c => c.email?.toLowerCase() === account.email.toLowerCase() || c.portalEmail?.toLowerCase() === account.email.toLowerCase());
            setCurrentAccount(account); setCreatorRecord(myCreator || null); setCreators(db?.creators || []);
            setCampaigns(db?.campaigns || []); setContentItems(db?.contentItems || []);
            setTeamMessages(db?.teamMessages || []); setTeamTasks(db?.teamTasks || []);
            setCreatorAccounts(accounts);
            setBetaTests(db?.betaTests || []); setBetaReleases(db?.betaReleases || []);
            localStorage.setItem('ooedn_creator_session', JSON.stringify({ accountId: account.id, email: account.email }));
            setIsConnected(true); initialLoadRef.current = true;
            // Show onboarding if not completed
            if (!account.onboardingComplete) setShowOnboarding(true);
        } catch (e: any) { setLoginError(`Sign in failed: ${e.message}`); }
        finally { setIsLoading(false); }
    };

    // --- Session restore ---
    useEffect(() => {
        const saved = localStorage.getItem('ooedn_creator_session');
        if (saved && !isConnected) {
            try {
                const session = JSON.parse(saved);
                setIsLoading(true);
                loadMasterDB().then(db => {
                    if (db) {
                        const account = db.creatorAccounts?.find(a => a.id === session.accountId);
                        if (account) {
                            const myCreator = db.creators?.find(c => c.id === account.linkedCreatorId) ||
                                db.creators?.find(c => c.email?.toLowerCase() === account.email.toLowerCase());
                            setCurrentAccount(account); setCreatorRecord(myCreator || null); setCreators(db.creators || []);
                            setCampaigns(db.campaigns || []); setContentItems(db.contentItems || []);
                            setTeamMessages(db.teamMessages || []); setTeamTasks(db.teamTasks || []);
                            setCreatorAccounts(db.creatorAccounts || []);
                            setBetaTests(db.betaTests || []); setBetaReleases(db.betaReleases || []);
                            setIsConnected(true); initialLoadRef.current = true;
                            if (!account.onboardingComplete) setShowOnboarding(true);
                        } else { localStorage.removeItem('ooedn_creator_session'); }
                    }
                    setIsLoading(false);
                }).catch(() => { localStorage.removeItem('ooedn_creator_session'); setIsLoading(false); });
            } catch { localStorage.removeItem('ooedn_creator_session'); }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('ooedn_creator_session');
        setIsConnected(false); setCurrentAccount(null); setCreatorRecord(null);
        setFormEmail(''); setFormPassword(''); setFormName('');
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
        const updatedAccounts = creatorAccounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
        setCurrentAccount(updatedAccount);
        setCreatorAccounts(updatedAccounts);
        saveMasterDB(undefined, undefined, undefined, undefined, undefined, updatedAccounts);
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
    };

    // --- LOGIN / SIGN-UP SCREEN ---
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black"></div>
                {/* Floating orbs */}
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-pink-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />

                <div className="z-10 w-full max-w-md bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
                    <div className="flex justify-center mb-5">
                        {settings.logoUrl
                            ? <img src={settings.logoUrl} alt="OOEDN Logo" className="h-12 object-contain opacity-90" />
                            : <Flame size={48} className="text-purple-500" />}
                    </div>
                    <h1 className="text-2xl font-black text-white text-center mb-1 uppercase tracking-tighter">Creator Portal</h1>
                    <p className="text-neutral-500 text-center mb-6 text-xs font-bold uppercase tracking-widest">OOEDN Partner Access</p>

                    {/* Tab Toggle */}
                    <div className="flex bg-black rounded-xl p-1 mb-6">
                        <button onClick={() => { setAuthMode('login'); setLoginError(null); }}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-purple-500 text-black' : 'text-neutral-500 hover:text-white'}`}>
                            Sign In
                        </button>
                        <button onClick={() => { setAuthMode('signup'); setLoginError(null); }}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-purple-500 text-black' : 'text-neutral-500 hover:text-white'}`}>
                            Create Account
                        </button>
                    </div>

                    <div className="space-y-3">
                        {authMode === 'signup' && (
                            <div className="relative">
                                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Your name"
                                    className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50" />
                            </div>
                        )}
                        <div className="relative">
                            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email address" type="email"
                                className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50" />
                        </div>
                        <div className="relative">
                            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                            <input value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Password"
                                type={showPassword ? 'text' : 'password'}
                                onKeyDown={e => e.key === 'Enter' && (authMode === 'login' ? handleSignIn() : handleSignUp())}
                                className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-10 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white" type="button">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <button onClick={authMode === 'login' ? handleSignIn : handleSignUp} disabled={isLoading}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-purple-400 hover:to-pink-400 transition-all shadow-xl shadow-purple-500/20 active:scale-95 disabled:opacity-50 mt-2">
                            {isLoading ? <Loader2 className="animate-spin" size={16} /> :
                                authMode === 'login' ? <><ArrowRight size={14} /> Sign In</> : <><UserPlus size={14} /> Create Account</>}
                        </button>
                    </div>

                    {loginError && (
                        <div className="mt-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                            <p className="text-red-400 text-xs flex items-center justify-center gap-2"><AlertTriangle size={12} /> {loginError}</p>
                        </div>
                    )}
                    <div className="mt-6 pt-5 border-t border-neutral-800 text-center">
                        <p className="text-[9px] text-neutral-600 uppercase font-black">OOEDN Holdings LLC • Creator Portal</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading && !creatorRecord) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-purple-500" />
            </div>
        );
    }

    if (!creatorRecord) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl backdrop-blur-xl text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="text-xl font-black text-white mb-2">Welcome, {currentAccount?.displayName}!</h2>
                    <p className="text-neutral-400 text-sm mb-6">Your account has been created. The OOEDN team will link your profile shortly. Check back soon!</p>
                    <p className="text-[10px] text-neutral-600 mb-4">Signed in as {currentAccount?.email}</p>
                    <button onClick={handleLogout} className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-2 mx-auto">
                        <LogOut size={12} /> Sign out
                    </button>
                </div>
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
        { id: 'betaLab', icon: FlaskConical, label: 'Beta Lab', emoji: '🧪' },
    ];

    const myCampaigns = campaigns.filter(c => c.assignedCreatorIds?.includes(creatorRecord.id));
    const newCampaignCount = myCampaigns.filter(c => !c.acceptedByCreatorIds?.includes(creatorRecord.id)).length;

    return (
        <div className={`flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-purple-500/30 ${!isDarkMode ? 'light-mode' : ''}`}>
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
                />
            )}
            {/* SIDEBAR */}
            <aside className={`${isSidebarOpen ? 'w-56' : 'w-20'} bg-neutral-950 border-r border-neutral-800 flex flex-col transition-all duration-300 z-50 flex-shrink-0`}>
                <div className="h-16 flex items-center justify-center border-b border-neutral-800">
                    {isSidebarOpen
                        ? settings.logoUrl ? <img src={settings.logoUrl} alt="OOEDN" className="h-7 object-contain" /> : <h1 className="font-black text-lg tracking-tighter text-purple-400">OOEDN</h1>
                        : <Flame className="text-purple-500" size={20} />}
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative
                ${view === item.id ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20' : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'}`}
                            title={!isSidebarOpen ? item.label : ''}>
                            <item.icon size={18} className={view === item.id ? 'text-white' : 'text-neutral-500 group-hover:text-white'} />
                            {isSidebarOpen && (
                                <span className="text-xs font-bold uppercase tracking-wider flex-1">{item.label}</span>
                            )}
                            {isSidebarOpen && item.id === 'campaigns' && newCampaignCount > 0 && (
                                <span className="bg-yellow-500 text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                                    {newCampaignCount}
                                </span>
                            )}
                            {!isSidebarOpen && item.id === 'campaigns' && newCampaignCount > 0 && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
                            )}
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-neutral-800 space-y-2">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex items-center justify-center p-2.5 text-neutral-600 hover:text-white transition-colors bg-neutral-900 rounded-xl">
                        {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                    {isSidebarOpen && (
                        <>
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-center gap-2 p-2 text-neutral-500 hover:text-white text-[10px] font-bold uppercase bg-neutral-900 rounded-lg">
                                {isDarkMode ? <Sun size={12} /> : <Moon size={12} />} {isDarkMode ? 'Light' : 'Dark'}
                            </button>
                            <div className="px-2 py-1"><p className="text-[9px] text-neutral-600 truncate">{currentAccount?.email}</p></div>
                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-2 text-red-400/60 hover:text-red-400 text-[10px] font-bold uppercase bg-neutral-900 rounded-lg">
                                <LogOut size={12} /> Sign Out
                            </button>
                        </>
                    )}
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-black">
                {/* TOP BAR */}
                <header className="h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md flex items-center justify-between px-6 z-40">
                    <h2 className="text-lg font-black uppercase tracking-tighter text-white flex items-center gap-2">
                        <span>{navItems.find(n => n.id === view)?.emoji}</span>
                        {navItems.find(n => n.id === view)?.label || 'Home'}
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* Notification Bell */}
                        <button
                            onClick={() => setShowNotifPanel(!showNotifPanel)}
                            className="relative p-2 text-neutral-500 hover:text-white transition-colors"
                            title="Notifications"
                        >
                            {unreadNotifs > 0 ? <BellDot size={18} className="text-purple-400" /> : <Bell size={18} />}
                            {unreadNotifs > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-500 text-[8px] font-black text-white rounded-full flex items-center justify-center animate-pulse">
                                    {unreadNotifs}
                                </span>
                            )}
                        </button>

                        <div className="flex items-center gap-2 bg-neutral-900 pr-4 pl-1 py-1 rounded-full border border-neutral-800">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xs">
                                {creatorRecord.name?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 truncate max-w-[120px]">{creatorRecord.name}</span>
                        </div>
                    </div>
                </header>

                {/* NOTIFICATION PANEL */}
                {showNotifPanel && (
                    <div className="absolute top-16 right-4 w-80 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b border-neutral-800">
                            <span className="text-xs font-black text-white uppercase">Notifications</span>
                            {unreadNotifs > 0 && (
                                <button onClick={markAllRead} className="text-[10px] text-purple-400 font-bold hover:text-purple-300">
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-6 text-center">
                                    <div className="text-2xl mb-2">🔔</div>
                                    <p className="text-[10px] text-neutral-500">No notifications yet</p>
                                </div>
                            ) : (
                                notifications.slice(0, 10).map(n => (
                                    <div key={n.id} className={`p-3 border-b border-neutral-800/50 ${n.read ? '' : 'bg-purple-500/5'}`}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[10px] font-bold text-white">{n.title}</span>
                                            <span className="text-[8px] text-neutral-600">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-[10px] text-neutral-400">{n.body}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Close notification panel when clicking elsewhere */}
                {showNotifPanel && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                )}

                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
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
                            contentItems={contentItems}
                            onUpload={handleContentUpload}
                            onReplyToNote={handleReplyToNote}
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
                            onNavigate={(v: string) => setView(v as CreatorView)}
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
                            onNavigate={(v: string) => setView(v as CreatorView)}
                            onDismissIntro={handleBetaLabIntroDismiss}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

export default CreatorApp;
