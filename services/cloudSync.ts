
import { Creator, Campaign, ContentItem, AppSettings, TeamMessage, TeamTask, CreatorAccount, BetaTest, BetaRelease } from "../types";
import { uploadJSONToGoogleCloud, fetchJSONFromGoogleCloud } from "./googleCloudStorage";

const MASTER_DB_FILENAME = 'ooedn_master_db.json';
const LOCAL_FALLBACK_KEY = 'ooedn_local_fallback_db';
const SYNC_STATUS_KEY = 'ooedn_sync_status';

export interface MasterDB {
    lastUpdated: string;
    creators: Creator[];
    campaigns: Campaign[];
    contentItems: ContentItem[];
    teamMessages?: TeamMessage[];
    teamTasks?: TeamTask[];
    creatorAccounts?: CreatorAccount[];
    betaTests?: BetaTest[];
    betaReleases?: BetaRelease[];
    brandInfo?: string;
    lastBackupDate?: string;
    version?: number;
}


// ===================================================================
// SYNC STATUS — Observable by the UI
// ===================================================================
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'auth-expired' | 'offline-cached';
let currentSyncStatus: SyncStatus = 'idle';
let syncStatusListeners: ((status: SyncStatus, message?: string) => void)[] = [];
let lastSyncError: string = '';

export const getSyncStatus = (): { status: SyncStatus; error: string } => ({ status: currentSyncStatus, error: lastSyncError });

export const onSyncStatusChange = (listener: (status: SyncStatus, message?: string) => void) => {
    syncStatusListeners.push(listener);
    return () => { syncStatusListeners = syncStatusListeners.filter(l => l !== listener); };
};

const setSyncStatus = (status: SyncStatus, message?: string) => {
    currentSyncStatus = status;
    if (message) lastSyncError = message;
    syncStatusListeners.forEach(l => l(status, message));
};

// ===================================================================
// PROTECTION LAYER 1: Track known-good data counts
// ===================================================================
let lastKnownCounts = { creators: 0, content: 0, campaigns: 0 };

const updateKnownCounts = (creators: number, content: number, campaigns: number) => {
    if (creators > 0 || content > 0 || campaigns > 0) {
        lastKnownCounts = { creators, content, campaigns };
    }
};

const isSuspiciouslyEmpty = (creators: Creator[], content: ContentItem[], campaigns: Campaign[]): boolean => {
    const hadData = lastKnownCounts.creators > 0 || lastKnownCounts.content > 0 || lastKnownCounts.campaigns > 0;
    const nowEmpty = creators.length === 0 && content.length === 0 && campaigns.length === 0;
    return hadData && nowEmpty;
};

// ===================================================================
// SAVE QUEUE — Prevents concurrent GCS writes (mutex)
// ===================================================================
let saveInFlight = false;
let pendingSave: (() => Promise<void>) | null = null;

const enqueueSave = async (saveFn: () => Promise<void>) => {
    if (saveInFlight) {
        // A save is in progress — queue this one (only keep latest)
        pendingSave = saveFn;
        console.log('[CloudSync] Save queued (previous still in-flight)');
        return;
    }

    saveInFlight = true;
    try {
        await saveFn();
    } finally {
        saveInFlight = false;
        // If a save was queued while we were saving, run it now
        if (pendingSave) {
            const next = pendingSave;
            pendingSave = null;
            console.log('[CloudSync] Running queued save...');
            await enqueueSave(next);
        }
    }
};

// ===================================================================
// RETRY WITH BACKOFF
// ===================================================================
const retryWithBackoff = async (fn: () => Promise<void>, maxRetries = 3): Promise<void> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await fn();
            return; // Success
        } catch (e: any) {
            const isAuthError = e.message?.includes('401') || e.message?.includes('403');
            if (isAuthError) {
                // Auth errors shouldn't be retried — token is expired
                setSyncStatus('auth-expired', 'Google token expired. Re-login to continue saving.');
                window.dispatchEvent(new CustomEvent('ooedn-auth-error', { detail: { message: 'Token expired' } }));
                throw e;
            }

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.warn(`[CloudSync] Save failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, e.message);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e; // All retries exhausted
            }
        }
    }
};

// ===================================================================
// LOCAL STORAGE FALLBACK — Emergency cache when GCS is unreachable
// ===================================================================
const saveToLocalFallback = (payload: MasterDB) => {
    try {
        const json = JSON.stringify(payload);
        // localStorage has ~5MB limit — check size
        if (json.length > 4 * 1024 * 1024) {
            console.warn('[CloudSync] Payload too large for localStorage fallback');
            return;
        }
        localStorage.setItem(LOCAL_FALLBACK_KEY, json);
        localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            status: 'pending-upload',
            creators: payload.creators.length,
            campaigns: payload.campaigns.length,
            contentItems: payload.contentItems.length,
        }));
        console.log(`[CloudSync] ⚠️ Saved to LOCAL fallback (${payload.creators.length} creators)`);
        setSyncStatus('offline-cached', 'Saved locally — will sync when connection restores');
    } catch (e) {
        console.error('[CloudSync] Local fallback save failed:', e);
    }
};

export const getLocalFallback = (): MasterDB | null => {
    try {
        const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

export const clearLocalFallback = () => {
    localStorage.removeItem(LOCAL_FALLBACK_KEY);
    localStorage.removeItem(SYNC_STATUS_KEY);
};

// ===================================================================
// 1. LOAD: Fetch the master state from the cloud
// ===================================================================
export const loadRemoteState = async (settings: AppSettings): Promise<MasterDB | null> => {
    if (!settings.useCloudStorage || !settings.googleCloudBucket || !settings.googleCloudToken) {
        // Check for local fallback
        const local = getLocalFallback();
        if (local) {
            console.log('[CloudSync] Loading from LOCAL fallback');
            return local;
        }
        return null;
    }

    try {
        const data = await fetchJSONFromGoogleCloud(
            settings.googleCloudBucket,
            settings.googleCloudToken,
            MASTER_DB_FILENAME,
            settings.googleProjectId
        ) as MasterDB;

        if (data) {
            updateKnownCounts(
                data.creators?.length || 0,
                data.contentItems?.length || 0,
                data.campaigns?.length || 0
            );
            console.log(`[CloudSync] ✅ Loaded: ${data.creators?.length || 0} creators, ${data.contentItems?.length || 0} content, ${data.campaigns?.length || 0} campaigns`);

            // If we have a local fallback that's newer, merge it
            const local = getLocalFallback();
            if (local && local.version && data.version && local.version > data.version) {
                console.log('[CloudSync] Local fallback is NEWER than cloud — using local data');
                clearLocalFallback();
                return local;
            }
            // Clear any stale fallback since cloud is working
            clearLocalFallback();
        }

        setSyncStatus('saved');
        return data;
    } catch (e: any) {
        console.error("[CloudSync] Cloud load failed:", e);
        // Try local fallback
        const local = getLocalFallback();
        if (local) {
            console.log('[CloudSync] Cloud failed, using LOCAL fallback');
            setSyncStatus('offline-cached', 'Using cached data — cloud unavailable');
            return local;
        }
        throw e;
    }
};

// ===================================================================
// 2. SYNC: Save current state to the cloud (with queue + retry + fallback)
// ===================================================================
export const syncStateToCloud = async (
    settings: AppSettings,
    creators: Creator[],
    campaigns: Campaign[],
    content: ContentItem[],
    brandInfo?: string,
    teamMessages?: TeamMessage[],
    teamTasks?: TeamTask[],
    lastBackupDate?: string,
    betaTests?: BetaTest[],
    betaReleases?: BetaRelease[],
    creatorAccounts?: CreatorAccount[]
) => {
    if (!settings.useCloudStorage || !settings.googleCloudBucket || !settings.googleCloudToken) {
        return;
    }

    // ── PROTECTION: Block empty saves when data previously existed ──
    if (isSuspiciouslyEmpty(creators, content, campaigns)) {
        console.error(
            `🛑 [CloudSync] BLOCKED: Attempted to save 0 creators, 0 content, 0 campaigns ` +
            `when last known state had ${lastKnownCounts.creators} creators, ` +
            `${lastKnownCounts.content} content, ${lastKnownCounts.campaigns} campaigns. ` +
            `This save was prevented to protect your data.`
        );
        return;
    }

    // Update known counts 
    updateKnownCounts(creators.length, content.length, campaigns.length);

    // ── ALWAYS MERGE CREATOR ACCOUNTS: Server-side invite creates accounts directly in GCS.
    // Admin React state may be stale (e.g. loaded as [] before invites were sent).
    // We MUST merge with the cloud DB to preserve server-created accounts. ──
    let accountsToSave = creatorAccounts || [];
    try {
        const existing = await fetchJSONFromGoogleCloud(
            settings.googleCloudBucket,
            settings.googleCloudToken,
            MASTER_DB_FILENAME,
            settings.googleProjectId
        ) as MasterDB | null;
        const cloudAccounts = existing?.creatorAccounts || [];
        if (cloudAccounts.length > 0) {
            // Merge: cloud accounts are the source of truth, admin state supplements
            const merged = new Map<string, any>();
            // Cloud accounts first (server-side created accounts take priority)
            for (const a of cloudAccounts) merged.set(a.id, a);
            // Then overlay any from admin state (in case admin modified something)
            for (const a of accountsToSave) merged.set(a.id, a);
            accountsToSave = Array.from(merged.values());
            if (accountsToSave.length !== (creatorAccounts || []).length) {
                console.log(`[CloudSync] 🔄 Merged creator accounts: ${(creatorAccounts || []).length} local + ${cloudAccounts.length} cloud = ${accountsToSave.length} total`);
            }
        }
    } catch (e) {
        console.error('[CloudSync] ⛔ Could not read existing accounts — BLOCKING save to prevent data loss');
        setSyncStatus('error', 'Cannot verify creator accounts — save blocked for safety');
        return; // DO NOT save without accounts — this would wipe them
    }

    const cleanContent = content.map(c => ({
        ...c,
        fileBlob: undefined,
        fileUrl: c.storageType === 'cloud' ? c.fileUrl : ''
    }));

    // ── MERGE CONTENT ITEMS: Creator uploads arrive via /api/creator/save directly to GCS.
    // Admin auto-save must NOT overwrite them. Merge cloud content with admin state. ──
    let mergedContent: ContentItem[] = cleanContent as ContentItem[];
    let mergedMessages = teamMessages || [];
    try {
        const existing = await fetchJSONFromGoogleCloud(
            settings.googleCloudBucket,
            settings.googleCloudToken,
            MASTER_DB_FILENAME,
            settings.googleProjectId
        ) as MasterDB | null;

        // Merge content: keep cloud items that admin doesn't have (creator uploads)
        if (existing?.contentItems) {
            const adminContentIds = new Set(cleanContent.map(c => c.id));
            const creatorOnlyContent = existing.contentItems.filter(c =>
                !adminContentIds.has(c.id) && (c.submittedByCreator || c.storageType === 'cloud')
            );
            if (creatorOnlyContent.length > 0) {
                console.log(`[CloudSync] 🔄 Merging ${creatorOnlyContent.length} creator-uploaded items from cloud`);
                mergedContent = [...cleanContent, ...creatorOnlyContent] as ContentItem[];
            }
        }

        // Merge messages: keep cloud messages that admin doesn't have (creator messages)
        if (existing?.teamMessages && mergedMessages) {
            const adminMsgIds = new Set(mergedMessages.map(m => m.id));
            const cloudOnlyMsgs = existing.teamMessages.filter(m => !adminMsgIds.has(m.id));
            if (cloudOnlyMsgs.length > 0) {
                console.log(`[CloudSync] 🔄 Merging ${cloudOnlyMsgs.length} messages from cloud`);
                mergedMessages = [...mergedMessages, ...cloudOnlyMsgs];
            }
        }
    } catch (e) {
        // If we can't read cloud, still save (we already read for accounts above)
        console.warn('[CloudSync] ⚠️ Could not merge content/messages from cloud — saving admin state as-is');
    }

    const dbPayload: MasterDB = {
        lastUpdated: new Date().toISOString(),
        creators,
        campaigns,
        contentItems: mergedContent,
        brandInfo,
        teamMessages: mergedMessages,
        teamTasks,
        betaTests,
        betaReleases,
        creatorAccounts: accountsToSave,
        lastBackupDate,
        version: Date.now()
    };

    // ── QUEUE the save (prevents concurrent writes) ──
    await enqueueSave(async () => {
        setSyncStatus('saving');

        try {
            // ── Retry with backoff ──
            await retryWithBackoff(async () => {
                await uploadJSONToGoogleCloud(
                    dbPayload,
                    settings.googleCloudBucket!,
                    settings.googleCloudToken!,
                    MASTER_DB_FILENAME,
                    settings.googleProjectId
                );
            });

            setSyncStatus('saved');
            clearLocalFallback(); // Cloud save succeeded — clear any local fallback
            console.log(`[CloudSync] ✅ Saved: ${creators.length} creators, ${content.length} content, ${campaigns.length} campaigns`);

        } catch (e: any) {
            console.error('[CloudSync] All save attempts failed:', e.message);
            // FALLBACK: Save to localStorage so data isn't lost
            saveToLocalFallback(dbPayload);

            if (!e.message?.includes('401') && !e.message?.includes('403')) {
                setSyncStatus('error', `Save failed: ${e.message}`);
            }
        }

        // ── Rolling backup (once per hour, non-blocking) ──
        try {
            const lastBackupHour = localStorage.getItem('ooedn_last_backup_hour');
            const currentHour = new Date().toISOString().slice(0, 13);
            if (lastBackupHour !== currentHour && (creators.length > 0 || content.length > 0)) {
                const backupFilename = `backups/ooedn_auto_${currentHour.replace(/[T:]/g, '-')}.json`;
                uploadJSONToGoogleCloud(
                    dbPayload,
                    settings.googleCloudBucket!,
                    settings.googleCloudToken!,
                    backupFilename,
                    settings.googleProjectId
                ).then(() => {
                    localStorage.setItem('ooedn_last_backup_hour', currentHour);
                    console.log(`[CloudSync] Hourly backup: ${backupFilename}`);
                }).catch(() => { }); // Non-blocking
            }
        } catch (e) { }
    });
};

// ===================================================================
// 3. DAILY BACKUP: Explicit timestamped backup
// ===================================================================
export const performDailyBackup = async (
    settings: AppSettings,
    creators: Creator[],
    campaigns: Campaign[],
    content: ContentItem[]
) => {
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hasCloud = settings.useCloudStorage && settings.googleCloudBucket && settings.googleCloudToken;

    if (hasCloud) {
        try {
            const backupFilenameJSON = `backups/ooedn_backup_${today}_${timestamp}.json`;
            await uploadJSONToGoogleCloud(
                { creators, campaigns, content, backedUpAt: new Date().toISOString() },
                settings.googleCloudBucket!,
                settings.googleCloudToken!,
                backupFilenameJSON,
                settings.googleProjectId
            );
            console.log(`[CloudSync] Daily backup saved: ${backupFilenameJSON}`);
        } catch (e) {
            console.error("GCS Backup Failed", e);
        }
    }
};
