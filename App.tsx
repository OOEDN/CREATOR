import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard, Users, Flame, Settings, Plus, Search, Menu, X, CreditCard, CalendarDays, Loader2, Briefcase, RefreshCw, Sparkles, Link, Database, Truck, Package, Library, Inbox, FolderLock, MapPin, Layers, Cloud, LogOut, AlertTriangle, ShieldCheck, Globe, Info, Terminal, UserPlus, CloudCog, Archive, Copy, KeyRound, ExternalLink, ArrowRight, Wrench, Trash2, Sun, Moon, Mail, Crown, Eye, FlaskConical
} from 'lucide-react';
import { Creator, CreatorStatus, PaymentStatus, Platform, ContentItem, AppSettings, ShipmentStatus, Campaign, ContentStatus, PaymentOption, Shipment, TeamMessage, TeamTask, BetaTest, BetaRelease, CreatorAccount, ReachoutStatus } from './types';
import { syncTrackingWithAI } from './services/geminiService';
import { syncStateToCloud, loadRemoteState, MasterDB, onSyncStatusChange, SyncStatus, getSyncStatus, performDailyBackup } from './services/cloudSync';
import { connectRealtime, onRealtimeChange, disconnectRealtime } from './services/realtimeService';
import CreatorCard from './components/CreatorCard';
import StatsOverview from './components/StatsOverview';
import CreatorEditModal from './components/CreatorEditModal';
import CalendarView from './components/CalendarView';
import GlobalChat from './components/GlobalChat';
import ContentLibrary from './components/ContentLibrary';
import MagicPaste from './components/MagicPaste';
import BulkAdd from './components/BulkAdd';
import CampaignBoard from './components/CampaignBoard';
import BetaTestManager from './components/BetaTestManager';
import PaymentHub from './components/PaymentHub';
import TeamManager from './components/TeamManager';
import TeamChatWidget from './components/TeamChatWidget';
import CreatorCommsWidget from './components/CreatorCommsWidget';
import ShipmentTrackerWidget from './components/ShipmentTrackerWidget';
import TeamTaskListWidget from './components/TeamTaskListWidget';
import DailyDigestWidget from './components/DailyDigestWidget';
import ContentPipelineWidget from './components/ContentPipelineWidget';
import QuickNotesWidget from './components/QuickNotesWidget';
import CreatorInbox from './components/CreatorInbox';
import LongTermCreators from './components/LongTermCreators';
import CreatorReachout from './components/CreatorReachout';
import PendingReview from './components/PendingReview';
import AdminTrainingCourse from './components/AdminTrainingCourse';
import { subscribeToPush, sendPushNotification, getPermissionStatus, isSupported as isPushSupported } from './services/pushService';
import { syncContentToDrive, ensureOOEDNMasterFolder } from './services/googleDriveService';
import { getInboxSummary, EmailThread } from './services/gmailService';

// Inline dashboard email preview widget
const DashboardEmailPreview: React.FC<{ token: string | null; onViewInbox: () => void }> = ({ token, onViewInbox }) => {
    const [emails, setEmails] = React.useState<EmailThread[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!token) return;
        setLoading(true);
        getInboxSummary(token, 'create@ooedn.com')
            .then(threads => setEmails(threads.slice(0, 4)))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [token]);

    const formatDate = (iso: string) => {
        try {
            const d = new Date(iso);
            const now = new Date();
            if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const y = new Date(now); y.setDate(y.getDate() - 1);
            if (d.toDateString() === y.toDateString()) return 'Yesterday';
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    const extractName = (from: string) => {
        const m = from.match(/^"?([^"<]+)"?\s*</);
        return m ? m[1].trim() : from.split('@')[0];
    };

    if (!token) return <p className="text-[10px] text-neutral-600 py-3">Sign in to see emails</p>;
    if (loading) return <div className="py-4 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" size={18} /></div>;
    if (emails.length === 0) return <p className="text-[10px] text-neutral-500 py-3">No recent emails</p>;

    return (
        <div className="space-y-1.5">
            {emails.map(thread => {
                const lastMsg = thread.messages?.[thread.messages.length - 1];
                const name = lastMsg ? extractName(lastMsg.from) : 'Unknown';
                return (
                    <button key={thread.id} onClick={onViewInbox} className="w-full text-left p-2.5 rounded-lg hover:bg-neutral-800/50 transition-all flex items-start gap-2.5 group">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[9px] font-black text-emerald-400">{name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                                <span className={`text-[11px] truncate ${thread.unread ? 'font-bold text-white' : 'font-medium text-neutral-400'}`}>{name}</span>
                                <span className="text-[9px] text-neutral-600 flex-shrink-0">{formatDate(thread.lastMessageDate)}</span>
                            </div>
                            <p className="text-[10px] text-neutral-500 truncate">{thread.subject}</p>
                        </div>
                        {thread.unread && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2.5 flex-shrink-0"></div>}
                    </button>
                );
            })}
        </div>
    );
};

function App() {
    const [creators, setCreators] = useState<Creator[]>([]);
    const [contentItems, setContentItems] = useState<ContentItem[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
    const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
    const [betaTests, setBetaTests] = useState<BetaTest[]>([]);
    const [betaReleases, setBetaReleases] = useState<BetaRelease[]>([]);
    const [creatorAccounts, setCreatorAccounts] = useState<CreatorAccount[]>([]);
    const [view, setView] = useState<'dashboard' | 'active' | 'inactive' | 'blackburn' | 'payments' | 'calendar' | 'campaigns' | 'pending-review' | 'asset-pool' | 'team-assets' | 'master-library' | 'team' | 'inbox' | 'partners' | 'reachout' | 'betaLab'>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPendingShipmentsOnly, setShowPendingShipmentsOnly] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedTime, setLastSyncedTime] = useState<string>('Never');
    const [syncStatus, setSyncStatusState] = useState<SyncStatus>('idle');
    const [syncError, setSyncError] = useState<string>('');
    const [isLoadingInitial, setIsLoadingInitial] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [showConfigHelp, setShowConfigHelp] = useState(false);
    const [showPushBanner, setShowPushBanner] = useState(false);
    const pushSubscribedRef = useRef(false);
    const initialLoadCompleteRef = useRef(false);

    // Admin training course state — per-user (keyed by email)
    const [showAdminTraining, setShowAdminTraining] = useState(false);

    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        try { return localStorage.getItem('ooedn_theme') !== 'light'; } catch { return true; }
    });

    useEffect(() => {
        try {
            document.documentElement.classList.toggle('light-mode', !isDarkMode);
            document.body.classList.toggle('light-mode', !isDarkMode);
            localStorage.setItem('ooedn_theme', isDarkMode ? 'dark' : 'light');
        } catch (e) { console.warn('[Theme] Toggle failed:', e); }
    }, [isDarkMode]);

    // Emergency Login State - Only shown on error
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualToken, setManualToken] = useState('');

    const [addTab, setAddTab] = useState<'manual' | 'ai' | 'bulk'>('manual');
    const [manualForm, setManualForm] = useState<Partial<Creator>>({
        name: '',
        handle: '',
        platform: Platform.Instagram,
        rate: 0
    });

    const lastUpdateRef = useRef<string | null>(null);

    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('ooedn_settings');
        const defaults = {
            useCloudStorage: true,
            googleProjectId: '850668507460',
            googleCloudBucket: 'ai-studio-bucket-850668507460-us-west1',
            logoUrl: 'https://i.postimg.cc/Z5xWzGv5/Logowhite.png',
            brandInfo: ''
        };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...defaults, ...parsed };
            } catch (e) { return defaults; }
        }
        return defaults;
    });

    useEffect(() => {
        localStorage.setItem('ooedn_settings', JSON.stringify(settings));
    }, [settings]);

    // AUTO-MARK CONTENT AS USED IF SCHEDULED DATE IS PAST
    useEffect(() => {
        const now = new Date();
        const pastDueItems = contentItems.filter(item =>
            item.scheduledDate &&
            new Date(item.scheduledDate) < now &&
            !item.isUsed
        );

        if (pastDueItems.length > 0) {
            setContentItems(prev => prev.map(item => {
                if (item.scheduledDate && new Date(item.scheduledDate) < now && !item.isUsed) {
                    console.log(`Auto-marking ${item.title} as Used (Scheduled: ${item.scheduledDate})`);
                    return { ...item, isUsed: true };
                }
                return item;
            }));
        }
    }, [contentItems]);

    // Handle Token Validation on Mount
    useEffect(() => {
        if (settings.googleCloudToken && !isConnected) {
            fetchUserProfile(settings.googleCloudToken).then(email => {
                if (email) {
                    setUserEmail(email);
                    setIsConnected(true);
                } else {
                    // Token likely expired
                    setSettings(s => ({ ...s, googleCloudToken: '' }));
                }
            });
        }
    }, []);

    // Admin Training Course gating — check if team member has completed training
    useEffect(() => {
        if (!isConnected || !userEmail) return;
        // Owner/admin auto-skipped
        const ownerEmails = ['danielvillano', 'daniel'];
        const emailPrefix = userEmail.split('@')[0].toLowerCase();
        if (ownerEmails.some(e => emailPrefix.includes(e))) {
            setShowAdminTraining(false);
            return;
        }
        try {
            const key = `ooedn_training_done_${userEmail.toLowerCase()}`;
            const done = localStorage.getItem(key);
            if (!done) {
                setShowAdminTraining(true);
            }
        } catch (e) {
            console.warn('[Training] Storage check error:', e);
        }
    }, [isConnected, userEmail]);

    // Auth Error Listener - Global
    useEffect(() => {
        const handleAuthError = (e: any) => {
            const status = e.detail?.status;
            console.warn(`Auth Error: ${status}. Session terminated.`);
            setIsConnected(false);
            setSettings(s => ({ ...s, googleCloudToken: '' }));
            setUserEmail(null);
            if (status === 403) {
                setLoginError("Permission Denied: Your email is not authorized to access the Team Bucket.");
            }
        };
        window.addEventListener('ooedn-auth-error', handleAuthError);
        return () => window.removeEventListener('ooedn-auth-error', handleAuthError);
    }, []);

    const fetchUserProfile = async (token: string) => {
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.email;
        } catch (e) {
            console.error("Failed to fetch user profile", e);
            return null;
        }
    };

    const handleGoogleLogin = () => {
        if (!window.google) {
            setLoginError("Google Identity Services failed to load. Check your internet or ad-blocker.");
            return;
        }

        setLoginError(null);
        setDebugInfo(null);
        setShowManualInput(false);
        setShowConfigHelp(false);

        // Dynamic Client ID: Use Env Var if present (from Cloud Run config), otherwise fallback to the standard one
        const envClientId = window.env?.CLIENT_ID;
        const clientId = (envClientId && envClientId.length > 10)
            ? envClientId
            : '964463045186-ck53fm3viba6jsq7ctg0jd8vj9oom4ag.apps.googleusercontent.com';

        try {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/spreadsheets',
                prompt: '', // Default prompt reduces double login popups if session exists
                error_callback: (err: any) => {
                    const origin = window.location.origin;
                    console.error("Login Error Details:", err);

                    // Construct a helpful but technical error message
                    if (err.type === 'popup_closed') {
                        setLoginError("Popup closed by user.");
                    } else if (err.type === 'redirect_uri_mismatch' || err.message?.includes('origin')) {
                        setLoginError("Configuration Error: Origin Mismatch");
                        setDebugInfo(`URL mismatch detected.`);
                        setShowConfigHelp(true);
                    } else {
                        setLoginError(`Login Failed: ${err.message || err.type}`);
                        setDebugInfo(JSON.stringify(err, null, 2));
                        // Show help for unknown errors too if they seem config related
                        if (err.type === 'error') setShowConfigHelp(true);
                    }
                },
                callback: async (resp: any) => {
                    if (resp.access_token) {
                        const email = await fetchUserProfile(resp.access_token);
                        if (email) {
                            setUserEmail(email);
                            setSettings(s => ({ ...s, googleCloudToken: resp.access_token }));
                            setIsConnected(true);
                        } else {
                            setLoginError("Failed to verify user profile with the provided token.");
                        }
                    } else if (resp.error) {
                        setLoginError(`Login Failed: ${resp.error_description || resp.error}`);
                        setDebugInfo(JSON.stringify(resp, null, 2));
                    }
                }
            });
            client.requestAccessToken();
        } catch (e: any) {
            setLoginError(`Init Error: ${e.message}`);
        }
    };

    const handleManualLogin = async () => {
        setLoginError(null);
        setIsLoadingInitial(true);

        // DEV BYPASS
        if (manualToken === 'DEBUG_TOKEN_OOEDN') {
            setUserEmail('developer@ooedn.com');
            setSettings(s => ({ ...s, googleCloudToken: 'dev-token-mock' }));
            setIsConnected(true);
            setIsLoadingInitial(false);
            return;
        }

        try {
            const email = await fetchUserProfile(manualToken);
            if (email) {
                setUserEmail(email);
                setSettings(s => ({ ...s, googleCloudToken: manualToken }));
                setIsConnected(true);
            } else {
                setLoginError("Invalid Token or User Profile Fetch Failed");
            }
        } catch (e: any) {
            setLoginError(`Login Error: ${e.message}`);
        } finally {
            setIsLoadingInitial(false);
        }
    };

    // Sync Logic
    useEffect(() => {
        if (isConnected && settings.googleCloudToken) {
            setIsSyncing(true);
            loadRemoteState(settings).then(data => {
                if (data) {
                    if (data.creators) {
                        // MIGRATION: Auto-convert legacy single shipment to array AND fix statuses
                        const migratedCreators = data.creators.map((c: Creator) => {
                            let updated = { ...c };

                            // 1. Convert Legacy
                            if ((!c.shipments || c.shipments.length === 0) && c.trackingNumber && c.trackingNumber.length > 5) {
                                console.log(`Migrating legacy shipment for ${c.name}`);
                                updated.shipments = [{
                                    id: crypto.randomUUID(),
                                    title: 'Legacy Shipment',
                                    carrier: c.carrier || 'Unknown',
                                    trackingNumber: c.trackingNumber,
                                    status: c.shipmentStatus || ShipmentStatus.Shipped,
                                    dateShipped: new Date().toISOString(),
                                    notes: 'Auto-migrated from legacy system'
                                }] as Shipment[];
                            }

                            // 2. Fix Inconsistent Statuses (Has Tracking but marked Preparing)
                            if (updated.shipments && updated.shipments.length > 0) {
                                updated.shipments = updated.shipments.map(s => {
                                    if (s.trackingNumber &&
                                        s.trackingNumber !== 'PENDING' &&
                                        s.trackingNumber.length > 3 &&
                                        s.status === ShipmentStatus.Preparing) {
                                        console.log(`Auto-correcting status for shipment ${s.id} to SHIPPED`);
                                        return { ...s, status: ShipmentStatus.Shipped };
                                    }
                                    return s;
                                });
                            }
                            return updated;
                        });
                        setCreators(migratedCreators.reverse());
                    }
                    if (data.campaigns) setCampaigns(data.campaigns);
                    if (data.contentItems) {
                        // Dedup: if same fileUrl exists multiple times, keep only the newest entry
                        const urlMap = new Map<string, typeof data.contentItems[0]>();
                        const noUrlItems: typeof data.contentItems = [];
                        for (const item of data.contentItems) {
                            if (!item.fileUrl) { noUrlItems.push(item); continue; }
                            const existing = urlMap.get(item.fileUrl);
                            if (!existing || new Date(item.uploadDate || 0) > new Date(existing.uploadDate || 0)) {
                                urlMap.set(item.fileUrl, item);
                            }
                        }
                        const deduped = [...urlMap.values(), ...noUrlItems];
                        if (deduped.length < data.contentItems.length) {
                            console.log(`[CloudSync] 🧹 Deduped content: ${data.contentItems.length} → ${deduped.length} items`);
                        }
                        setContentItems(deduped);
                    }
                    if (data.teamMessages) setTeamMessages(data.teamMessages);
                    if (data.teamTasks) setTeamTasks(data.teamTasks);
                    if (data.betaTests) setBetaTests(data.betaTests);
                    if (data.betaReleases) setBetaReleases(data.betaReleases);
                    if (data.creatorAccounts) setCreatorAccounts(data.creatorAccounts);
                    if (data.brandInfo) setSettings(s => ({ ...s, brandInfo: data.brandInfo }));
                    setLastSyncedTime(new Date().toLocaleTimeString());
                }
                initialLoadCompleteRef.current = true;
                setIsSyncing(false);
            }).catch(() => {
                initialLoadCompleteRef.current = true;
                setIsSyncing(false);
            });
        }
    }, [isConnected, settings.googleCloudToken]);

    // Auto-Save (QUADRUPLE-GUARDED: load complete + data sanity + cloudSync blocker + save queue)
    useEffect(() => {
        // Guard 1: Don't save until initial load completes
        if (!isConnected || !initialLoadCompleteRef.current) return;

        const timer = setTimeout(() => {
            // Guard 2: Never save if all data arrays are empty (catastrophic protection)
            if (creators.length === 0 && contentItems.length === 0 && campaigns.length === 0) {
                console.warn('[AutoSave] 🛑 BLOCKED: All arrays empty — refusing to save to prevent data loss');
                return;
            }
            console.log(`[AutoSave] Saving: ${creators.length} creators, ${contentItems.length} content, ${campaigns.length} campaigns`);
            // Guard 3+4: cloudSync.ts has isSuspiciouslyEmpty check + save queue
            syncStateToCloud(settings, creators, campaigns, contentItems, settings.brandInfo, teamMessages, teamTasks, undefined, betaTests, betaReleases, creatorAccounts);
            setLastSyncedTime(new Date().toLocaleTimeString());

            // === AUTO-BACKUP: Run daily backup if 24h+ since last backup ===
            const lastBackup = localStorage.getItem('ooedn_last_backup_date');
            const now = new Date();
            const hoursSinceBackup = lastBackup ? (now.getTime() - new Date(lastBackup).getTime()) / (1000 * 60 * 60) : 999;
            if (hoursSinceBackup >= 24) {
                console.log(`[AutoBackup] ⏰ ${Math.round(hoursSinceBackup)}h since last backup — triggering daily backup...`);
                performDailyBackup(settings, creators, campaigns, contentItems).then(() => {
                    localStorage.setItem('ooedn_last_backup_date', now.toISOString());
                    console.log('[AutoBackup] ✅ Daily backup completed');
                }).catch(e => console.error('[AutoBackup] ❌ Backup failed:', e));
            }
        }, 3000); // 3s debounce (was 5s — faster persistence)
        return () => clearTimeout(timer);
    }, [creators, campaigns, contentItems, settings, isConnected, teamMessages, teamTasks, betaTests, betaReleases, creatorAccounts]);

    // Sync status listener
    useEffect(() => {
        const unsub = onSyncStatusChange((status, message) => {
            setSyncStatusState(status);
            if (message) setSyncError(message);
        });
        return unsub;
    }, []);

    // ── Real-Time Firestore Listeners (SSE) ──
    useEffect(() => {
        if (!isConnected || !initialLoadCompleteRef.current) return;

        const cleanup = connectRealtime();

        const unsubMessages = onRealtimeChange('teamMessages', (event) => {
            if (event.type === 'added') {
                setTeamMessages(prev => {
                    if (prev.some(m => m.id === event.doc.id)) return prev;
                    console.log(`[Realtime] 📩 New message: ${event.doc.sender || 'unknown'}`);
                    return [...prev, event.doc as TeamMessage];
                });
            } else if (event.type === 'modified') {
                setTeamMessages(prev => prev.map(m => m.id === event.doc.id ? { ...m, ...event.doc } as TeamMessage : m));
            } else if (event.type === 'removed') {
                setTeamMessages(prev => prev.filter(m => m.id !== event.doc.id));
            }
        });

        const unsubContent = onRealtimeChange('contentItems', (event) => {
            if (event.type === 'added') {
                setContentItems(prev => {
                    if (prev.some(c => c.id === event.doc.id)) return prev;
                    if (deletedContentIdsRef.current.has(event.doc.id)) return prev;
                    console.log(`[Realtime] 🎬 New content: ${event.doc.title || event.doc.id}`);
                    return [...prev, event.doc as ContentItem];
                });
            } else if (event.type === 'modified') {
                setContentItems(prev => prev.map(c => c.id === event.doc.id ? { ...c, ...event.doc } as ContentItem : c));
            } else if (event.type === 'removed') {
                setContentItems(prev => prev.filter(c => c.id !== event.doc.id));
            }
        });

        const unsubTasks = onRealtimeChange('teamTasks', (event) => {
            if (event.type === 'added') {
                setTeamTasks(prev => {
                    if (prev.some(t => t.id === event.doc.id)) return prev;
                    console.log(`[Realtime] 📋 New task: ${event.doc.title || event.doc.id}`);
                    return [...prev, event.doc as TeamTask];
                });
            } else if (event.type === 'modified') {
                setTeamTasks(prev => prev.map(t => t.id === event.doc.id ? { ...t, ...event.doc } as TeamTask : t));
            } else if (event.type === 'removed') {
                setTeamTasks(prev => prev.filter(t => t.id !== event.doc.id));
            }
        });

        return () => {
            unsubMessages();
            unsubContent();
            unsubTasks();
            cleanup();
        };
    }, [isConnected]);

    // Poll for creator activity (messages, uploads) every 30s
    useEffect(() => {
        if (!isConnected || !settings.googleCloudToken || !initialLoadCompleteRef.current) return;
        const interval = setInterval(async () => {
            try {
                const data = await loadRemoteState(settings);
                if (!data) return;
                // Merge new creator messages — use functional updater for fresh state
                if (data.teamMessages) {
                    setTeamMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const newMsgs = data.teamMessages!.filter(m => !existingIds.has(m.id));
                        if (newMsgs.length > 0) {
                            console.log(`[Poll] 📩 ${newMsgs.length} new messages from creators`);
                            return [...prev, ...newMsgs];
                        }
                        return prev;
                    });
                }
                // Merge content items — use functional updater for fresh state
                // Also update existing items (e.g. status/review changes from server)
                if (data.contentItems) {
                    setContentItems(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const existingUrls = new Set(prev.filter(c => c.fileUrl).map(c => c.fileUrl));
                        // Filter out items that were deliberately deleted this session OR already exist by ID or fileUrl
                        const newContent = data.contentItems!.filter(c =>
                            !existingIds.has(c.id) && !deletedContentIdsRef.current.has(c.id) &&
                            !(c.fileUrl && existingUrls.has(c.fileUrl))
                        );
                        if (newContent.length > 0) {
                            console.log(`[Poll] 🎬 ${newContent.length} new content uploads from creators`);
                            return [...prev, ...newContent];
                        }
                        return prev;
                    });
                }
                // Update creator accounts
                if (data.creatorAccounts) setCreatorAccounts(data.creatorAccounts);
            } catch (e) { /* silent polling failure */ }
        }, 120000); // 2-minute fallback (real-time SSE handles most updates)
        return () => clearInterval(interval);
    }, [isConnected, settings.googleCloudToken]);

    // Auth error listener — prompt user to re-login
    useEffect(() => {
        const handler = (e: Event) => {
            console.error('[App] Auth token expired — prompting re-login');
            setSyncStatusState('auth-expired');
            setSyncError('Your Google session expired. Please re-login to continue saving data.');
        };
        window.addEventListener('ooedn-auth-error', handler);
        return () => window.removeEventListener('ooedn-auth-error', handler);
    }, []);

    // Push Notifications — auto-subscribe if already granted, show banner every session if not
    useEffect(() => {
        if (isConnected && !pushSubscribedRef.current) {
            pushSubscribedRef.current = true;
            const timer = setTimeout(async () => {
                try {
                    if (!isPushSupported()) return;
                    const perm = 'Notification' in window ? Notification.permission : 'default';
                    if (perm === 'granted') {
                        // Already granted — silently re-subscribe (works without user gesture)
                        await subscribeToPush();
                        console.log('[Push] Auto-resubscribed (permission already granted)');
                    } else if (perm !== 'denied') {
                        // Show the banner every session until they enable push
                        setShowPushBanner(true);
                    }
                } catch (e) {
                    console.warn('[Push] Auto-subscribe check failed (non-blocking):', e);
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isConnected]);

    // --- CRUD HANDLERS ---
    const handleAddCreator = (newCreators: Partial<Creator>[]) => {
        const added = newCreators.map(c => ({
            ...c,
            id: crypto.randomUUID(),
            dateAdded: new Date().toISOString(),
            status: c.status || CreatorStatus.Active,
            paymentStatus: c.paymentStatus || PaymentStatus.Unpaid,
            paymentOptions: c.paymentOptions || [],
            // Fix types
            name: c.name || 'Unknown',
            handle: c.handle || '@',
            platform: c.platform || Platform.Instagram,
            rate: c.rate || 0,
            profileImage: c.profileImage || '',
            notes: c.notes || '',
            flagged: false,
            shipmentStatus: ShipmentStatus.None,
        } as Creator));
        setCreators(prev => [...added, ...prev]);
        setShowAddModal(false);
        // Push notify team about new creator
        try { sendPushNotification('👤 New Creator Added', `${added.map(c => c.name).join(', ')} added to roster`, '/', 'ooedn-creator'); } catch (e) { }
    };

    const handleUpdateCreator = (id: string, updates: Partial<Creator>) => {
        setCreators(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleDeleteCreator = (id: string) => {
        setCreators(prev => prev.filter(c => c.id !== id));
    };

    const handleContentUpload = async (item: ContentItem) => {
        setContentItems(prev => {
            // Dedup: prevent adding if an item with the same fileUrl already exists
            if (item.fileUrl && prev.some(c => c.fileUrl === item.fileUrl)) {
                console.warn(`[ContentUpload] Skipping duplicate fileUrl: ${item.fileUrl}`);
                return prev;
            }
            return [...prev, item];
        });

        // Auto-backup to Google Drive (non-blocking)
        if (settings?.googleCloudToken && item.fileUrl && !item.driveBackedUp) {
            (async () => {
                try {
                    const folderId = await ensureOOEDNMasterFolder(settings.googleCloudToken!, settings.googleProjectId);
                    const ok = await syncContentToDrive(
                        item.fileUrl, item.title, folderId, settings.googleCloudToken!, settings.googleProjectId
                    );
                    if (ok) {
                        setContentItems(prev => prev.map(c => c.id === item.id ? { ...c, driveBackedUp: true } : c));
                        console.log(`[Drive] Auto-backed up: ${item.title}`);
                    }
                } catch (e) {
                    console.warn('[Drive] Auto-backup failed:', e);
                }
            })();
        }
    };

    // Track pending approval to handle outside of setContentItems (avoids stale closure)
    const pendingApprovalRef = React.useRef<{ oldItem: ContentItem; newItem: ContentItem } | null>(null);

    const handleContentUpdate = (id: string, updates: Partial<ContentItem>) => {
        setContentItems(prev => {
            const oldItem = prev.find(c => c.id === id);
            const newItems = prev.map(c => c.id === id ? { ...c, ...updates } : c);

            // Flag if this is a new approval (to handle outside this closure)
            if (updates.status === ContentStatus.Approved && oldItem && oldItem.status !== ContentStatus.Approved) {
                const newItem = newItems.find(c => c.id === id)!;
                // Use setTimeout to escape the state updater and access fresh state
                setTimeout(() => {
                    const creatorId = oldItem.creatorId;
                    if (!creatorId) return;

                    // 1. Notify creator via TeamMessage
                    setTeamMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        creatorId,
                        sender: userEmail || 'OOEDN Team',
                        text: `✅ Your content "${oldItem.title}" has been approved! Great work! 🎉`,
                        timestamp: new Date().toISOString(),
                        isCreatorMessage: false,
                    }]);

                    // 2. Auto-request payment for paid creators
                    setCreators(prevCreators => {
                        const creator = prevCreators.find(c => c.id === creatorId);
                        if (creator && creator.rate > 0 && creator.paymentStatus !== PaymentStatus.Paid) {
                            // Mark the content as payment-requested
                            setContentItems(prevContent => prevContent.map(c =>
                                c.id === id ? { ...c, paymentRequested: true, paymentAmount: creator.rate } : c
                            ));

                            // Notify creator about payment
                            setTeamMessages(prev => [...prev, {
                                id: crypto.randomUUID(),
                                creatorId,
                                sender: 'OOEDN Payment System',
                                text: `💰 Payment of $${creator.rate} has been queued for "${oldItem.title}". You'll receive your receipt once processed!`,
                                timestamp: new Date().toISOString(),
                                isCreatorMessage: false,
                            }]);

                            // Push notifications
                            try { sendPushNotification('💰 Payment Queued', `$${creator.rate} queued for ${creator.name} — "${oldItem.title}"`, '/', 'ooedn-payment'); } catch (e) { }

                            // Update payment status
                            return prevCreators.map(c =>
                                c.id === creatorId ? { ...c, paymentStatus: PaymentStatus.Processing } : c
                            );
                        }
                        return prevCreators;
                    });

                    // 3. Push notification about approval
                    try { sendPushNotification('✅ Content Approved', `"${oldItem.title}" by ${oldItem.creatorName} approved`, '/', 'ooedn-content'); } catch (e) { }
                }, 0);
            }

            return newItems;
        });
    };

    // Track deleted content IDs to stop them from being re-added by poll
    const deletedContentIdsRef = useRef<Set<string>>(new Set());

    const handleContentDelete = (id: string) => {
        // Track this deletion so the poll cycle doesn't re-add it
        deletedContentIdsRef.current.add(id);
        setContentItems(prev => {
            const filtered = prev.filter(c => c.id !== id);
            // IMMEDIATE PERSIST: Save right away so deleted item doesn't come back on reload
            setTimeout(() => {
                console.log(`[ContentDelete] 🗑️ Deleting content ${id} — saving immediately`);
                syncStateToCloud(settings, creators, campaigns, filtered, settings.brandInfo, teamMessages, teamTasks, undefined, betaTests, betaReleases, creatorAccounts);
                // Also delete from Firestore via server endpoint
                fetch(`${window.location.origin}/api/content/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contentId: id })
                }).then(r => {
                    if (r.ok) console.log(`[ContentDelete] ✅ Deleted from server: ${id}`);
                    else console.warn(`[ContentDelete] Server delete failed: ${r.status}`);
                }).catch(e => console.warn('[ContentDelete] Server delete error:', e.message));
            }, 100);
            return filtered;
        });
    };

    const handleSaveCampaign = (campaign: Campaign) => {
        // Push notify about campaign updates
        try { sendPushNotification('📋 Campaign Updated', `"${campaign.title}" was updated`, '/', 'ooedn-campaign'); } catch (e) { }
        setCampaigns(prev => {
            const idx = prev.findIndex(c => c.id === campaign.id);
            if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = campaign;
                return newArr;
            }
            return [...prev, campaign];
        });
    };

    const handleDeleteCampaign = (id: string) => {
        setCampaigns(prev => prev.filter(c => c.id !== id));
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black animate-pulse"></div>

                <div className="z-10 w-full max-w-md bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
                    <div className="flex justify-center mb-8">
                        {settings.logoUrl ? <img src={settings.logoUrl} className="h-16 object-contain opacity-90" /> : <Flame size={64} className="text-emerald-500" />}
                    </div>

                    <h1 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-tighter">OOEDN Tracker <span className="text-emerald-500 text-sm align-super">v4.31</span></h1>
                    <p className="text-neutral-500 text-center mb-8 text-xs font-bold uppercase tracking-widest">Team Internal Access Portal</p>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all shadow-xl active:scale-95 group"
                    >
                        {isLoadingInitial ? <Loader2 className="animate-spin" /> : <div className="p-1 bg-black rounded-full"><ArrowRight className="text-white" size={14} /></div>}
                        Sign in with Google
                    </button>

                    {loginError && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center animate-in slide-in-from-top-2">
                            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center justify-center gap-2"><AlertTriangle size={12} /> Login Error</p>
                            <p className="text-red-400 text-xs">{loginError}</p>
                            {showConfigHelp && (
                                <div className="mt-2 text-[9px] text-neutral-400 text-left bg-black/40 p-2 rounded">
                                    <p className="font-bold text-white mb-1">Troubleshooting:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Authorized Origin mismatch. Ensure <code>window.location.origin</code> matches GCP Console.</li>
                                        <li>Check if <code>CLIENT_ID</code> env var is set correctly in Cloud Run.</li>
                                    </ul>
                                </div>
                            )}
                            <button onClick={() => setShowManualInput(!showManualInput)} className="text-[9px] text-neutral-600 underline mt-2 hover:text-white">Use Emergency Token</button>
                        </div>
                    )}

                    {showManualInput && (
                        <div className="mt-4 space-y-2 animate-in fade-in">
                            <input
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                placeholder="Paste OAuth Token (Bearer)..."
                                className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-xs text-white"
                            />
                            <button onClick={handleManualLogin} className="w-full bg-neutral-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-neutral-700">Validate Token</button>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
                        <p className="text-[9px] text-neutral-600 uppercase font-black">Protected System • OOEDN Holdings LLC</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className={`flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-emerald-500/30 ${!isDarkMode ? 'light-mode' : ''}`}>

            {/* Admin Training Course Gate */}
            {showAdminTraining && (
                <AdminTrainingCourse
                    userName={userEmail?.split('@')[0] || 'Team Member'}
                    onComplete={() => {
                        setShowAdminTraining(false);
                        try {
                            const key = `ooedn_training_done_${(userEmail || 'unknown').toLowerCase()}`;
                            localStorage.setItem(key, 'true');
                        } catch (e) { console.warn('[Training] Storage error:', e); }
                    }}
                />
            )}

            {/* SIDEBAR */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-ooedn-dark border-r border-neutral-800 flex flex-col transition-all duration-300 z-50 flex-shrink-0 mobile-sidebar`}>
                <div className="h-20 flex items-center justify-center border-b border-neutral-800">
                    {isSidebarOpen ? (
                        settings.logoUrl ? <img src={settings.logoUrl} className="h-8 object-contain" /> : <h1 className="font-black text-xl tracking-tighter">OOEDN</h1>
                    ) : (
                        <Flame className="text-emerald-500 animate-pulse" />
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-2 custom-scrollbar">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                        { id: 'active', icon: Users, label: 'Active Roster' },
                        { id: 'payments', icon: CreditCard, label: 'Payment Hub' },
                        { id: 'campaigns', icon: Briefcase, label: 'Campaigns' },
                        { id: 'betaLab', icon: FlaskConical, label: 'Beta Lab' },
                        { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
                        { id: 'asset-pool', icon: Inbox, label: 'Asset Pool' },
                        { id: 'pending-review', icon: Eye, label: 'Pending Review' },
                        { id: 'team-assets', icon: FolderLock, label: 'Team Assets' },
                        { id: 'master-library', icon: Database, label: 'Master Library' },
                        { id: 'inbox', icon: Mail, label: 'Creator Inbox' },
                        { id: 'partners', icon: Crown, label: 'Long-Term Partners' },
                        { id: 'reachout', icon: UserPlus, label: 'Creator Reachout' },
                        { id: 'team', icon: ShieldCheck, label: 'Team Access' },
                        { id: 'inactive', icon: Archive, label: 'Archive' },
                        { id: 'blackburn', icon: Flame, label: 'Blackburn', color: 'text-red-500' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as any)}
                            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative
                            ${view === item.id ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'}
                        `}
                            title={!isSidebarOpen ? item.label : ''}
                        >
                            <item.icon size={20} className={view === item.id ? 'text-black' : (item.color || 'text-neutral-500 group-hover:text-white')} />
                            {isSidebarOpen && <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>}

                            {!isSidebarOpen && view === item.id && (
                                <div className="absolute left-full ml-4 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-neutral-800 space-y-2">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex items-center justify-center p-3 text-neutral-600 hover:text-white transition-colors bg-neutral-900 rounded-xl">
                        {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                    {isSidebarOpen && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${syncStatus === 'saved' ? 'bg-emerald-500' :
                                    syncStatus === 'saving' ? 'bg-yellow-500 animate-pulse' :
                                        syncStatus === 'error' ? 'bg-red-500' :
                                            syncStatus === 'auth-expired' ? 'bg-orange-500 animate-pulse' :
                                                syncStatus === 'offline-cached' ? 'bg-blue-500' :
                                                    'bg-neutral-600'
                                    }`}></div>
                                <span className={`text-[9px] font-mono ${syncStatus === 'error' || syncStatus === 'auth-expired' ? 'text-red-400' :
                                    syncStatus === 'saved' ? 'text-neutral-500' :
                                        'text-neutral-600'
                                    }`}>
                                    {syncStatus === 'saved' ? `Synced ${lastSyncedTime}` :
                                        syncStatus === 'saving' ? 'Saving...' :
                                            syncStatus === 'error' ? 'Sync Error!' :
                                                syncStatus === 'auth-expired' ? 'Token Expired!' :
                                                    syncStatus === 'offline-cached' ? 'Cached Locally' :
                                                        `Synced ${lastSyncedTime}`}
                                </span>
                            </div>
                            {(syncStatus === 'error' || syncStatus === 'auth-expired') && (
                                <div className="px-2">
                                    <p className="text-[8px] text-red-400/70 mb-1">{syncError}</p>
                                    {syncStatus === 'auth-expired' && (
                                        <button onClick={() => { setIsConnected(false); setSyncStatusState('idle'); }} className="w-full text-[9px] bg-orange-500/10 text-orange-400 px-2 py-1.5 rounded-lg border border-orange-500/20 font-bold hover:bg-orange-500/20">
                                            Re-Login
                                        </button>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    syncStateToCloud(settings, creators, campaigns, contentItems, settings.brandInfo, teamMessages, teamTasks, undefined, betaTests, betaReleases, creatorAccounts);
                                    setLastSyncedTime(new Date().toLocaleTimeString());
                                }}
                                className="w-full text-[9px] bg-neutral-900 text-neutral-500 px-2 py-1.5 rounded-lg border border-neutral-800 font-bold hover:text-white hover:border-neutral-600 transition-all"
                            >
                                ⚡ Force Save Now
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await performDailyBackup(settings, creators, campaigns, contentItems);
                                        localStorage.setItem('ooedn_last_backup_date', new Date().toISOString());
                                        alert('✅ Backup saved successfully to cloud!');
                                    } catch (e) {
                                        alert('❌ Backup failed: ' + (e as Error).message);
                                    }
                                }}
                                className="w-full text-[9px] bg-blue-500/10 text-blue-400 px-2 py-1.5 rounded-lg border border-blue-500/20 font-bold hover:text-white hover:border-blue-400 transition-all"
                            >
                                💾 Backup Now
                            </button>
                            {localStorage.getItem('ooedn_last_backup_date') && (
                                <p className="text-[8px] text-neutral-600 text-center">
                                    Last backup: {new Date(localStorage.getItem('ooedn_last_backup_date')!).toLocaleDateString()} {new Date(localStorage.getItem('ooedn_last_backup_date')!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-ooedn-black">
                {/* TOP BAR */}
                <header className="h-20 border-b border-neutral-800 bg-ooedn-dark/80 backdrop-blur-md flex items-center justify-between px-8 z-40">
                    <div className="flex items-center gap-4 text-neutral-400">
                        <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                            {view.replace('-', ' ')}
                        </h2>
                        {isSyncing && <Loader2 size={14} className="animate-spin text-emerald-500" />}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded-xl px-3 md:px-4 py-2">
                            <Search size={14} className="text-neutral-500" />
                            <input
                                type="text"
                                placeholder={showPendingShipmentsOnly ? '🚚 Pending Shipments (clear to reset)' : 'Search system...'}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); if (showPendingShipmentsOnly) setShowPendingShipmentsOnly(false); }}
                                className="bg-transparent border-none focus:outline-none text-xs text-white w-28 md:w-48 placeholder-neutral-700 font-medium"
                            />
                        </div>
                        {/* Push notification status indicator (green dot = active) */}
                        {'Notification' in window && Notification.permission === 'granted' && (
                            <div className="p-3 bg-emerald-500/10 rounded-xl" title="Push notifications active">
                                <span className="text-emerald-500 text-sm">🔔</span>
                            </div>
                        )}
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-3 bg-neutral-900 text-neutral-400 rounded-xl hover:text-white hover:bg-neutral-800 transition-all border border-transparent hover:border-neutral-700"
                            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="p-3 bg-neutral-900 text-neutral-400 rounded-xl hover:text-white hover:bg-neutral-800 transition-all border border-transparent hover:border-neutral-700">
                            <Settings size={18} />
                        </button>
                        <div className="h-10 w-[1px] bg-neutral-800"></div>
                        <div className="flex items-center gap-3 bg-neutral-900 pr-4 pl-1 py-1 rounded-full border border-neutral-800">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs">
                                {userEmail ? userEmail[0].toUpperCase() : 'T'}
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 hidden md:inline truncate max-w-[100px]">{userEmail}</span>
                        </div>
                    </div>
                </header>

                {/* ONE-TIME PUSH NOTIFICATION OPT-IN BANNER */}
                {showPushBanner && (
                    <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-8 py-4 flex items-center justify-between z-30">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🔔</span>
                            <div>
                                <p className="text-white text-sm font-bold">Enable Team Notifications</p>
                                <p className="text-neutral-400 text-xs">Get alerts for new shipments, tasks, and chat messages. One click — permanent.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={async () => {
                                    try {
                                        const result = await subscribeToPush();
                                        if (result) {
                                            localStorage.setItem('ooedn_push_enabled', 'true');
                                            setShowPushBanner(false);
                                        }
                                    } catch (e) { console.warn('[Push] Enable error:', e); }
                                }}
                                className="bg-emerald-500 text-black font-black text-xs uppercase tracking-wider px-6 py-2 rounded-lg hover:bg-emerald-400 transition-all"
                            >
                                Enable Now
                            </button>
                            <button
                                onClick={() => {
                                    setShowPushBanner(false);
                                }}
                                className="text-neutral-500 hover:text-white text-xs transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-auto p-8 custom-scrollbar mobile-main">

                    {/* GLOBAL STATS (Only on Dashboard) */}
                    {view === 'dashboard' && (
                        <>
                            {/* DAILY DIGEST */}
                            <DailyDigestWidget
                                creators={creators}
                                teamTasks={teamTasks}
                                teamMessages={teamMessages}
                                contentItems={contentItems}
                                currentUser={userEmail || ''}
                                onNavigate={(v) => {
                                    if (v === 'active:shipments') {
                                        setSearchTerm('');
                                        setShowPendingShipmentsOnly(true);
                                        setView('active');
                                    } else {
                                        setView(v as any);
                                    }
                                }}
                            />

                            <StatsOverview
                                creators={creators}
                                content={contentItems}
                                onPendingClick={() => setView('payments')}
                                onUnusedClick={() => setView('asset-pool')}
                                onInTransitClick={() => { setSearchTerm(''); setShowPendingShipmentsOnly(true); setView('active'); }}
                                onNoPostClick={() => { setSearchTerm('Delivered'); setView('active'); }}
                                onInactiveClick={() => setView('inactive')}
                            />
                            {/* CONTENT PIPELINE */}
                            <ContentPipelineWidget
                                contentItems={contentItems}
                                onNavigate={(v) => setView(v as any)}
                                onUpdateContent={handleContentUpdate}
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mobile-grid-1">
                                {/* Recent Activity or Mini Lists could go here */}
                                <div className="bg-ooedn-gray border border-neutral-800 rounded-3xl p-6">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                                        <Mail size={16} /> Recent Emails
                                    </h3>

                                    {/* Quick Action Row */}
                                    <div className="flex gap-2 mb-4">
                                        <button onClick={() => setShowAddModal(true)} className="flex-1 p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-emerald-500/50 transition-all text-center group">
                                            <UserPlus size={16} className="text-neutral-500 group-hover:text-emerald-500 mx-auto mb-1" />
                                            <p className="text-[8px] font-black uppercase text-white">Add</p>
                                        </button>
                                        <button onClick={() => setView('campaigns')} className="flex-1 p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-purple-500/50 transition-all text-center group">
                                            <Briefcase size={16} className="text-neutral-500 group-hover:text-purple-500 mx-auto mb-1" />
                                            <p className="text-[8px] font-black uppercase text-white">Brief</p>
                                        </button>
                                        <button onClick={() => setView('inbox')} className="flex-1 p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-blue-500/50 transition-all text-center group relative">
                                            <Mail size={16} className="text-neutral-500 group-hover:text-blue-500 mx-auto mb-1" />
                                            <p className="text-[8px] font-black uppercase text-white">Inbox</p>
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        </button>
                                        <button onClick={() => setView('partners')} className="flex-1 p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-amber-500/50 transition-all text-center group">
                                            <Crown size={16} className="text-neutral-500 group-hover:text-amber-500 mx-auto mb-1" />
                                            <p className="text-[8px] font-black uppercase text-white">Partners</p>
                                        </button>
                                    </div>

                                    {/* Live Email Preview */}
                                    <DashboardEmailPreview
                                        token={settings.googleCloudToken}
                                        onViewInbox={() => setView('inbox')}
                                    />
                                </div>

                                {/* SHIPMENT TRACKER WIDGET */}
                                <ShipmentTrackerWidget
                                    creators={creators}
                                    onViewAll={() => {
                                        // Use a special filter tag that the creator list filter understands
                                        setSearchTerm('');
                                        setShowPendingShipmentsOnly(true);
                                        setView('active');
                                    }}
                                    onSelectCreator={(creator, shipmentId) => {
                                        setSelectedCreator(creator);
                                        if (shipmentId) setSelectedShipmentId(shipmentId);
                                    }}
                                    onUpdateShipment={(creatorId, shipmentId, updates) => {
                                        try {
                                            setCreators(prev => prev.map(c => {
                                                if (c.id !== creatorId) return c;
                                                return {
                                                    ...c,
                                                    shipments: (c.shipments || []).map(s =>
                                                        s.id === shipmentId ? { ...s, ...updates } : s
                                                    )
                                                };
                                            }));
                                        } catch (e) { console.warn('[AI Tracking] Update failed (non-blocking):', e); }
                                    }}
                                />

                                {/* TEAM TASK WIDGET */}
                                <TeamTaskListWidget
                                    tasks={teamTasks}
                                    currentUser={userEmail || ''}
                                    onUpdateTask={(id, updates) => setTeamTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))}
                                    onAddTask={(task) => {
                                        setTeamTasks(prev => [...prev, task]);
                                        try { sendPushNotification('📋 New Task', `${userEmail?.split('@')[0] || 'Someone'} assigned: ${task.title}`, '/', 'ooedn-task'); } catch (e) { }
                                    }}
                                    onViewAll={() => setView('team')}
                                />

                                {/* TEAM CHAT WIDGET - EMBEDDED */}
                                <TeamChatWidget
                                    teamMessages={teamMessages}
                                    onSendTeamMessage={(msg) => {
                                        setTeamMessages(prev => [...prev, msg]);
                                        try {
                                            const mentionText = msg.mentions?.length ? ` (mentioned: ${msg.mentions.join(', ')})` : '';
                                            sendPushNotification('💬 Team Chat', `${msg.sender?.split('@')[0] || 'Someone'}: ${msg.text?.substring(0, 80)}${mentionText}`, '/', 'ooedn-chat');
                                        } catch (e) { }
                                    }}
                                    currentUser={userEmail || 'Anonymous'}
                                    teamEmails={['daniel@ooedn.com', 'lauren@ooedn.com', 'jenna@ooedn.com']}
                                />

                                {/* CREATOR COMMS WIDGET */}
                                <CreatorCommsWidget
                                    teamMessages={teamMessages}
                                    creators={creators}
                                    currentUser={userEmail || 'Anonymous'}
                                    onSendMessage={(msg) => {
                                        setTeamMessages(prev => [...prev, msg]);
                                        // Auto-save debounce will pick this up
                                    }}
                                    onMarkRead={(creatorId) => {
                                        setTeamMessages(prev => prev.map(m =>
                                            m.creatorId === creatorId && m.isCreatorMessage && !m.readByTeam
                                                ? { ...m, readByTeam: true }
                                                : m
                                        ));
                                    }}
                                    onPushNotify={async (creatorIds, title, body) => {
                                        try {
                                            await fetch('/api/push/send-creators', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ creatorIds, title, body })
                                            });
                                        } catch (e) { console.error('[Push] Creator notify failed:', e); }
                                    }}
                                    onEmailCreators={async (creatorIds, subject, body) => {
                                        try {
                                            const emails = creatorIds.map(id => creators.find(c => c.id === id)?.email).filter(Boolean);
                                            await fetch('/api/creator/send-email', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ emails, subject, body })
                                            });
                                        } catch (e) { console.error('[Email] Creator email failed:', e); }
                                    }}
                                />

                                {/* QUICK NOTES */}
                                <QuickNotesWidget />
                            </div>
                        </>
                    )}

                    {/* CREATOR LIST VIEWS */}
                    {(view === 'active' || view === 'inactive' || view === 'blackburn') && (
                        <>
                            {/* PENDING SHIPMENTS FILTER BANNER */}
                            {showPendingShipmentsOnly && view === 'active' && (
                                <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between">
                                    <span className="text-sm text-blue-400 font-bold flex items-center gap-2">
                                        🚚 Showing only creators with pending shipments (Preparing / Issue)
                                    </span>
                                    <button
                                        onClick={() => setShowPendingShipmentsOnly(false)}
                                        className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-500/30 transition-all"
                                    >
                                        Clear Filter
                                    </button>
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{view} Roster</h2>
                                {view === 'active' && (
                                    <button onClick={() => setShowAddModal(true)} className="bg-white text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-xl active:scale-95">
                                        <Plus size={16} /> Add Creator
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {creators
                                    .filter(c => {
                                        if (view === 'blackburn') return c.status === CreatorStatus.Blackburn;
                                        if (view === 'inactive') return c.status === CreatorStatus.Inactive;
                                        // Hide creators tagged for reachout (Queued/Contacted) from active roster
                                        if (c.reachoutStatus && c.reachoutStatus !== ReachoutStatus.None && c.reachoutStatus !== ReachoutStatus.Reactivated) return false;
                                        return c.status !== CreatorStatus.Blackburn && c.status !== CreatorStatus.Inactive;
                                    })
                                    .filter(c => {
                                        // Special filter: only show creators with pending/active shipments
                                        if (showPendingShipmentsOnly) {
                                            return (c.shipments || []).some(s =>
                                                s.status === ShipmentStatus.Preparing || s.status === ShipmentStatus.Issue
                                            );
                                        }
                                        if (!searchTerm) return true;
                                        return c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            c.handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            c.shipmentStatus?.toLowerCase().includes(searchTerm.toLowerCase());
                                    })
                                    .map(creator => (
                                        <CreatorCard
                                            key={creator.id}
                                            creator={creator}
                                            onClick={setSelectedCreator}
                                            onUpdate={handleUpdateCreator}
                                            onBlackburn={(id) => handleUpdateCreator(id, { status: CreatorStatus.Blackburn })}
                                            onDelete={handleDeleteCreator}
                                        />
                                    ))
                                }
                            </div>
                        </>
                    )}

                    {view === 'campaigns' && (
                        <>
                            <CampaignBoard
                                campaigns={campaigns}
                                creators={creators}
                                content={contentItems}
                                onSaveCampaign={handleSaveCampaign}
                                onDeleteCampaign={handleDeleteCampaign}
                                onContentUpload={handleContentUpload}
                                onContentUpdate={handleContentUpdate}
                                onContentDelete={handleContentDelete}
                                appSettings={settings}
                                onEmailBrief={(to, subject, body) => {
                                    // Navigate to inbox compose with brief pre-filled
                                    setView('inbox');
                                    // Store in sessionStorage so CreatorInbox can pick it up
                                    sessionStorage.setItem('compose_prefill', JSON.stringify({ to, subject, body }));
                                }}
                                onNotifyCreator={(creatorId, campaignTitle) => {
                                    const msg = {
                                        id: crypto.randomUUID(),
                                        creatorId,
                                        sender: userEmail || 'OOEDN Team',
                                        text: `📋 You've been assigned to a new campaign: "${campaignTitle}". Check your Campaigns tab to view the brief and get started!`,
                                        timestamp: new Date().toISOString(),
                                        isCreatorMessage: false,
                                    };
                                    setTeamMessages(prev => [...prev, msg]);
                                }}
                                onAskCoco={(context) => {
                                    // Dispatch custom event for GlobalChat to pick up
                                    window.dispatchEvent(new CustomEvent('coco-open', { detail: { context } }));
                                }}
                                onSendAvatarEmail={(emails, subject, body) => {
                                    // Navigate to inbox with the avatar email pre-filled
                                    setView('inbox');
                                    sessionStorage.setItem('compose_prefill', JSON.stringify({ to: emails.join(', '), subject, body }));
                                }}
                            />
                        </>
                    )}

                    {/* BETA LAB */}
                    {view === 'betaLab' && (
                        <BetaTestManager
                            betaTests={betaTests}
                            betaReleases={betaReleases}
                            creators={creators}
                            onSaveBetaTest={(test) => {
                                setBetaTests(prev => {
                                    const idx = prev.findIndex(t => t.id === test.id);
                                    return idx >= 0 ? prev.map(t => t.id === test.id ? test : t) : [...prev, test];
                                });
                            }}
                            onDeleteBetaTest={(id) => setBetaTests(prev => prev.filter(t => t.id !== id))}
                            onUpdateRelease={(release) => {
                                setBetaReleases(prev => {
                                    const idx = prev.findIndex(r => r.id === release.id);
                                    return idx >= 0 ? prev.map(r => r.id === release.id ? release : r) : [...prev, release];
                                });
                            }}
                        />
                    )}

                    {/* CALENDAR */}
                    {view === 'calendar' && (
                        <CalendarView
                            contentItems={contentItems}
                            onUpdateContent={handleContentUpdate}
                            onUploadContent={handleContentUpload}
                            onDeleteContent={handleContentDelete}
                            appSettings={settings}
                        />
                    )}

                    {/* ASSET POOL (Unused / Available) */}
                    {view === 'asset-pool' && (
                        <ContentLibrary
                            items={contentItems.filter(c => {
                                // Hide unapproved creator-portal uploads — they belong in Pending Review
                                if (c.creatorId && c.creatorId !== 'team' && (c.submittedByCreator || c.storageType === 'cloud') && (c.status === ContentStatus.Raw || c.status === ContentStatus.Editing)) {
                                    return false;
                                }
                                return true;
                            })}
                            onUpload={handleContentUpload}
                            onUpdate={handleContentUpdate}
                            onDelete={handleContentDelete}
                            appSettings={settings}
                            initialView="Available"
                            hideTabs={true}
                        />
                    )}

                    {/* PENDING REVIEW */}
                    {view === 'pending-review' && (
                        <PendingReview
                            contentItems={contentItems}
                            onUpdateContent={handleContentUpdate}
                            onNavigate={(v) => setView(v as any)}
                            onNotifyRevision={(item, note) => {
                                if (!item.creatorId) return;
                                const msg = {
                                    id: crypto.randomUUID(),
                                    creatorId: item.creatorId,
                                    sender: userEmail || 'OOEDN Team',
                                    text: `✂️ Revision requested on "${item.title}": ${note}`,
                                    timestamp: new Date().toISOString(),
                                    isCreatorMessage: false,
                                };
                                setTeamMessages(prev => [...prev, msg]);
                            }}
                        />
                    )}

                    {/* TEAM ASSETS (Team Only) */}
                    {view === 'team-assets' && (
                        <ContentLibrary
                            items={contentItems}
                            onUpload={handleContentUpload}
                            onUpdate={handleContentUpdate}
                            onDelete={handleContentDelete}
                            appSettings={settings}
                            initialView="Team"
                            hideTabs={true}
                        />
                    )}

                    {/* MASTER LIBRARY (All Content) */}
                    {view === 'master-library' && (
                        <ContentLibrary
                            items={contentItems}
                            onUpload={handleContentUpload}
                            onUpdate={handleContentUpdate}
                            onDelete={handleContentDelete}
                            appSettings={settings}
                            initialView="All"
                            hideTabs={true}
                        />
                    )}

                    {/* PAYMENTS */}
                    {view === 'payments' && (
                        <PaymentHub
                            creators={creators}
                            onUpdateCreator={handleUpdateCreator}
                            appSettings={settings}
                        />
                    )}

                    {/* TEAM ADMIN — Admin Only */}
                    {view === 'team' && userEmail === 'daniel@ooedn.com' && (
                        <TeamManager
                            appSettings={settings}
                            creators={creators}
                            onOpenSettings={() => setShowSettingsModal(true)}
                            teamTasks={teamTasks}
                            onUpdateTasks={setTeamTasks}
                            currentUser={userEmail || ''}
                        />
                    )}
                    {view === 'team' && userEmail !== 'daniel@ooedn.com' && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <ShieldCheck size={48} className="mx-auto mb-4 text-red-500/30" />
                                <h3 className="text-xl font-black text-white mb-2">Admin Only</h3>
                                <p className="text-sm text-neutral-500">This section is restricted to administrators.</p>
                            </div>
                        </div>
                    )}

                    {/* CREATOR INBOX */}
                    {view === 'inbox' && (
                        <CreatorInbox
                            creators={creators}
                            appSettings={settings}
                            userEmail={userEmail}
                        />
                    )}

                    {/* LONG-TERM PARTNERS */}
                    {view === 'partners' && (
                        <LongTermCreators
                            creators={creators}
                            appSettings={settings}
                            onNavigate={(v) => setView(v as any)}
                            onUpdateCreator={(id, updates) => {
                                setCreators(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
                            }}
                        />
                    )}

                    {/* CREATOR REACHOUT */}
                    {view === 'reachout' && (
                        <CreatorReachout
                            creators={creators}
                            appSettings={settings}
                            onUpdateCreator={(id, updates) => {
                                setCreators(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
                            }}
                            onNavigate={(v) => { setSearchTerm(''); setView(v as any); }}
                        />
                    )}
                </div>

                {/* Coco — Global AI Assistant */}
                <GlobalChat
                    appState={{
                        creators,
                        campaigns,
                        content: contentItems,
                        teamTasks,
                        teamMessages,
                        betaTests,
                        betaReleases,
                    }}
                    creators={creators}
                    campaigns={campaigns}
                    content={contentItems}
                    teamMessages={teamMessages}
                    teamTasks={teamTasks}
                    betaTests={betaTests}
                    betaReleases={betaReleases}
                    onSendTeamMessage={(msg) => setTeamMessages(prev => [...prev, msg])}
                    currentUser={userEmail || 'Anonymous'}
                    brandInfo={settings.brandInfo}
                />

            </main >

            {/* MODALS */}

            {/* ADD CREATOR MODAL */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-ooedn-dark border border-neutral-700 rounded-3xl w-full max-w-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Add to Roster</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-neutral-500 hover:text-white"><X size={24} /></button>
                            </div>

                            <div className="flex gap-4 mb-6 border-b border-neutral-800 pb-4">
                                <button onClick={() => setAddTab('manual')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${addTab === 'manual' ? 'text-white border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}>Manual Entry</button>
                                <button onClick={() => setAddTab('ai')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all flex items-center gap-2 ${addTab === 'ai' ? 'text-emerald-400 border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}><Sparkles size={12} /> AI Magic Paste</button>
                                <button onClick={() => setAddTab('bulk')} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${addTab === 'bulk' ? 'text-white border-emerald-500' : 'text-neutral-600 border-transparent hover:text-neutral-400'}`}>Bulk Import</button>
                            </div>

                            {addTab === 'manual' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} placeholder="Creator Name" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                                        <input value={manualForm.handle} onChange={e => setManualForm({ ...manualForm, handle: e.target.value })} placeholder="@Handle" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <select value={manualForm.platform} onChange={e => setManualForm({ ...manualForm, platform: e.target.value as Platform })} className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none">
                                            {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <input type="number" value={manualForm.rate} onChange={e => setManualForm({ ...manualForm, rate: Number(e.target.value) })} placeholder="Rate ($)" className="bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none" />
                                    </div>
                                    <button onClick={() => handleAddCreator([manualForm])} disabled={!manualForm.name} className="w-full bg-white text-black py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all shadow-lg disabled:opacity-50">Create Profile</button>
                                </div>
                            )}

                            {addTab === 'ai' && <MagicPaste onParsed={(data) => handleAddCreator([data])} />}
                            {addTab === 'bulk' && <BulkAdd onAdded={handleAddCreator} />}
                        </div>
                    </div>
                )
            }

            {/* SETTINGS MODAL */}
            {
                showSettingsModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <div className="bg-ooedn-dark border border-neutral-700 rounded-3xl w-full max-w-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <CloudCog size={28} className="text-emerald-500" />
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">System Config</h3>
                                </div>
                                <button onClick={() => setShowSettingsModal(false)} className="text-neutral-500 hover:text-white"><X size={28} /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Google Cloud Project ID</label>
                                    <input value={settings.googleProjectId} onChange={e => setSettings({ ...settings, googleProjectId: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Google Cloud Storage Bucket</label>
                                    <input value={settings.googleCloudBucket} onChange={e => setSettings({ ...settings, googleCloudBucket: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2">Brand Bible (AI Context)</label>
                                    <textarea value={settings.brandInfo} onChange={e => setSettings({ ...settings, brandInfo: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-white text-xs h-32 resize-none leading-relaxed" placeholder="Define brand voice, do's/don'ts for the AI..." />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-neutral-800">
                                    <button onClick={() => { setSettings(s => ({ ...s })); setShowSettingsModal(false); }} className="bg-emerald-500 text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-xl">
                                        Save Configuration
                                    </button>
                                </div>

                                <div className="mt-8 border-t border-neutral-800 pt-6">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">🔔 Push Notifications</h4>
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <span className="text-[10px] text-neutral-400 font-mono">
                                            Status: {'Notification' in window ? Notification.permission : 'unsupported'}
                                        </span>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const success = await subscribeToPush();
                                                    alert(success ? '✅ Push notifications enabled! You\'ll receive alerts for new tasks, creators, and more.' : '❌ Could not enable push. Check if notifications are blocked in your browser settings.');
                                                } catch (e: any) { alert('Error: ' + e.message); }
                                            }}
                                            className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/20 text-xs font-bold hover:bg-blue-500/20 transition-all"
                                        >
                                            Subscribe / Re-subscribe
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await sendPushNotification('🔔 OOEDN Test', 'Push notifications are working! You\'ll get alerts for creator updates, tasks, and more.', '/', 'ooedn-test');
                                                    alert('Test notification sent! You should see it pop up in a moment. If you don\'t see it, check your browser notification settings.');
                                                } catch (e: any) { alert('Error: ' + e.message); }
                                            }}
                                            className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                                        >
                                            ⚡ Send Test Notification
                                        </button>
                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('ooedn_push_dismissed');
                                                localStorage.removeItem('ooedn_push_enabled');
                                                alert('Push preferences cleared. Reload the page to see the notification banner again.');
                                            }}
                                            className="text-[10px] text-neutral-500 hover:text-white transition-colors"
                                        >
                                            Reset Push Preferences
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-8 border-t border-neutral-800 pt-6">
                                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Danger Zone / Tools</h4>
                                    <button
                                        onClick={() => {
                                            if (!confirm("Start automated cleanup of duplicate pending shipments? (If a creator has a shipped package, their pending 'Preparing' tasks will be removed).")) return;

                                            const cleanedCreators = creators.map(c => {
                                                const shipments = c.shipments || [];
                                                const hasShipped = shipments.some(s => s.trackingNumber && s.trackingNumber !== 'PENDING' && s.trackingNumber.length > 3);

                                                if (hasShipped) {
                                                    // If they have shipped items, remove any 'Preparing' items that have no tracking
                                                    const cleanShipments = shipments.filter(s => {
                                                        const isPending = s.status === ShipmentStatus.Preparing || (s.trackingNumber === 'PENDING');
                                                        const isTracked = s.trackingNumber && s.trackingNumber !== 'PENDING' && s.trackingNumber.length > 3;

                                                        // Keep if it has tracking OR if we haven't shipped anything (but we know we have shipped something)
                                                        // So: Remove if (Pending AND Not Tracked)
                                                        if (isPending && !isTracked) return false;
                                                        return true;
                                                    });

                                                    if (cleanShipments.length !== shipments.length) {
                                                        console.log(`Cleaning up ${shipments.length - cleanShipments.length} duplicates for ${c.name}`);
                                                        return { ...c, shipments: cleanShipments };
                                                    }
                                                }
                                                return c;
                                            });

                                            setCreators(cleanedCreators);
                                            alert("Cleanup Complete! Validated all shipment records.");
                                            setShowSettingsModal(false);
                                        }}
                                        className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={14} /> Auto-Cleanup Duplicate Shipments
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* EDIT CREATOR MODAL */}
            {
                selectedCreator && (
                    <CreatorEditModal
                        creator={selectedCreator}
                        initialShipmentId={selectedShipmentId}
                        content={contentItems.filter(c => c.creatorId === selectedCreator.id)}
                        onClose={() => { setSelectedCreator(null); setSelectedShipmentId(null); }}
                        onSave={handleUpdateCreator}
                        onDelete={handleDeleteCreator}
                        onContentUpload={async (item) => { handleContentUpload(item); }}
                        onUpdateContent={handleContentUpdate}
                        onDeleteContent={handleContentDelete}
                        appSettings={settings}
                        onNotifyCreator={(creatorId, message) => {
                            setTeamMessages(prev => [...prev, {
                                id: crypto.randomUUID(),
                                creatorId,
                                sender: userEmail || 'OOEDN Team',
                                text: message,
                                timestamp: new Date().toISOString(),
                                isCreatorMessage: false,
                            }]);
                        }}
                    />
                )
            }

            {/* MOBILE BOTTOM NAV */}
            <div className="mobile-bottom-nav" style={{ display: 'none' }}>
                <style>{`@media(max-width:768px){.mobile-bottom-nav{display:flex!important}}`}</style>
                {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
                    { id: 'active', icon: Users, label: 'Roster' },
                    { id: 'campaigns', icon: Briefcase, label: 'Campaigns' },
                    { id: 'payments', icon: CreditCard, label: 'Pay' },
                    { id: 'reachout', icon: UserPlus, label: 'Reach' },
                    { id: 'calendar', icon: CalendarDays, label: 'Cal' },
                    { id: 'team', icon: ShieldCheck, label: 'Team' },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id as any)}
                        className={view === item.id ? 'text-emerald-500' : 'text-neutral-500'}
                    >
                        <item.icon size={20} />
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </div>

        </div >
    );
}

export default App;