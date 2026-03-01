/**
 * AURA Memory System — Multi-Layered Organic Memory
 * 
 * Three tiers:
 *  1. Session Memory   → React state (dies with tab)
 *  2. Short-Term Memory → localStorage (7-day TTL)
 *  3. Long-Term Memory  → GCS-backed JSON (permanent)
 */

// ── Types ──

export interface MemoryEntry {
    id: string;
    key: string;
    value: string;
    tier: 'session' | 'short' | 'long';
    timestamp: string;
    category?: 'conversation' | 'decision' | 'insight' | 'preference' | 'creator' | 'campaign';
}

export interface ConversationTurn {
    role: 'user' | 'model';
    text: string;
    timestamp: string;
}

// ── Constants ──
const STM_KEY = 'coco_short_term_memory';
const STM_CONVO_KEY = 'coco_conversations';
const STM_TTL_DAYS = 7;
const MAX_CONVO_HISTORY = 50; // max turns to keep in short-term
const MAX_CONTEXT_CHARS = 4000; // max chars for memory prompt injection

// ── Session Memory (in-memory, tab lifetime) ──

let sessionMemory: MemoryEntry[] = [];
let sessionConversation: ConversationTurn[] = [];

export function rememberSession(key: string, value: string, category?: MemoryEntry['category']): void {
    sessionMemory.push({
        id: crypto.randomUUID(),
        key,
        value,
        tier: 'session',
        timestamp: new Date().toISOString(),
        category,
    });
}

export function getSessionConversation(): ConversationTurn[] {
    return sessionConversation;
}

export function addToSessionConversation(role: 'user' | 'model', text: string): void {
    sessionConversation.push({ role, text, timestamp: new Date().toISOString() });
    // Also persist to short-term so it survives page refresh
    persistConversationToSTM();
}

export function clearSessionConversation(): void {
    sessionConversation = [];
}

// ── Short-Term Memory (localStorage, 7-day TTL) ──

function loadSTM(): MemoryEntry[] {
    try {
        const raw = localStorage.getItem(STM_KEY);
        if (!raw) return [];
        const entries: MemoryEntry[] = JSON.parse(raw);
        const cutoff = new Date(Date.now() - STM_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        // Prune expired entries
        return entries.filter(e => e.timestamp > cutoff);
    } catch {
        return [];
    }
}

function saveSTM(entries: MemoryEntry[]): void {
    try {
        localStorage.setItem(STM_KEY, JSON.stringify(entries));
    } catch (e) {
        console.warn('[Coco Memory] STM save failed:', e);
    }
}

export function rememberShortTerm(key: string, value: string, category?: MemoryEntry['category']): void {
    const entries = loadSTM();
    entries.push({
        id: crypto.randomUUID(),
        key,
        value,
        tier: 'short',
        timestamp: new Date().toISOString(),
        category,
    });
    // Keep last 200 entries max
    const trimmed = entries.slice(-200);
    saveSTM(trimmed);
}

function persistConversationToSTM(): void {
    try {
        // Keep last N turns
        const trimmed = sessionConversation.slice(-MAX_CONVO_HISTORY);
        localStorage.setItem(STM_CONVO_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.warn('[Coco Memory] Conversation persist failed:', e);
    }
}

export function loadConversationFromSTM(): ConversationTurn[] {
    try {
        const raw = localStorage.getItem(STM_CONVO_KEY);
        if (!raw) return [];
        const turns: ConversationTurn[] = JSON.parse(raw);
        // Only reload conversations from last 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return turns.filter(t => t.timestamp > cutoff);
    } catch {
        return [];
    }
}

export function restoreSessionFromSTM(): void {
    const restored = loadConversationFromSTM();
    if (restored.length > 0 && sessionConversation.length === 0) {
        sessionConversation = restored;
    }
}

// ── Long-Term Memory (GCS-backed, managed externally) ──

export interface LongTermMemory {
    entries: MemoryEntry[];
    creatorInsights: Record<string, string>; // creatorId → insight
    campaignLearnings: string[];
    userPreferences: Record<string, string>;
    lastUpdated: string;
}

const LTM_LOCAL_KEY = 'coco_long_term_memory';

export function loadLongTermMemory(): LongTermMemory {
    try {
        const raw = localStorage.getItem(LTM_LOCAL_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    return {
        entries: [],
        creatorInsights: {},
        campaignLearnings: [],
        userPreferences: {},
        lastUpdated: new Date().toISOString(),
    };
}

export function saveLongTermMemory(ltm: LongTermMemory): void {
    try {
        ltm.lastUpdated = new Date().toISOString();
        localStorage.setItem(LTM_LOCAL_KEY, JSON.stringify(ltm));
    } catch (e) {
        console.warn('[Coco Memory] LTM save failed:', e);
    }
}

export function rememberLongTerm(key: string, value: string, category?: MemoryEntry['category']): void {
    const ltm = loadLongTermMemory();
    ltm.entries.push({
        id: crypto.randomUUID(),
        key,
        value,
        tier: 'long',
        timestamp: new Date().toISOString(),
        category,
    });
    // Cap at 500 entries
    if (ltm.entries.length > 500) {
        ltm.entries = ltm.entries.slice(-500);
    }
    saveLongTermMemory(ltm);
}

export function addCreatorInsight(creatorId: string, insight: string): void {
    const ltm = loadLongTermMemory();
    const existing = ltm.creatorInsights[creatorId] || '';
    ltm.creatorInsights[creatorId] = existing
        ? `${existing}\n[${new Date().toLocaleDateString()}] ${insight}`
        : `[${new Date().toLocaleDateString()}] ${insight}`;
    saveLongTermMemory(ltm);
}

export function addCampaignLearning(learning: string): void {
    const ltm = loadLongTermMemory();
    ltm.campaignLearnings.push(`[${new Date().toLocaleDateString()}] ${learning}`);
    if (ltm.campaignLearnings.length > 100) {
        ltm.campaignLearnings = ltm.campaignLearnings.slice(-100);
    }
    saveLongTermMemory(ltm);
}

// ── Recall & Context Building ──

export function recall(query?: string): string {
    const pieces: string[] = [];

    // Recent session memories
    if (sessionMemory.length > 0) {
        const recent = sessionMemory.slice(-10);
        pieces.push('## Recent Session Context');
        recent.forEach(m => pieces.push(`- ${m.key}: ${m.value}`));
    }

    // Short-term memories
    const stm = loadSTM();
    if (stm.length > 0) {
        const relevant = query
            ? stm.filter(m => m.key.toLowerCase().includes(query.toLowerCase()) || m.value.toLowerCase().includes(query.toLowerCase())).slice(-10)
            : stm.slice(-10);
        if (relevant.length > 0) {
            pieces.push('## Recent Memory (Last 7 Days)');
            relevant.forEach(m => pieces.push(`- [${m.category || 'note'}] ${m.key}: ${m.value}`));
        }
    }

    // Long-term
    const ltm = loadLongTermMemory();
    if (ltm.campaignLearnings.length > 0) {
        pieces.push('## Campaign Learnings');
        ltm.campaignLearnings.slice(-5).forEach(l => pieces.push(`- ${l}`));
    }

    if (Object.keys(ltm.creatorInsights).length > 0) {
        pieces.push('## Creator Insights');
        Object.entries(ltm.creatorInsights).slice(0, 10).forEach(([id, insight]) => {
            pieces.push(`- Creator ${id}: ${insight.split('\n').pop()}`);
        });
    }

    if (Object.keys(ltm.userPreferences).length > 0) {
        pieces.push('## User Preferences');
        Object.entries(ltm.userPreferences).forEach(([k, v]) => pieces.push(`- ${k}: ${v}`));
    }

    const result = pieces.join('\n');
    // Truncate if too long to avoid token limits
    return result.length > MAX_CONTEXT_CHARS ? result.slice(0, MAX_CONTEXT_CHARS) + '\n...(memory truncated)' : result;
}

export function buildConversationHistory(): { role: string; parts: { text: string }[] }[] {
    return sessionConversation.map(turn => ({
        role: turn.role,
        parts: [{ text: turn.text }],
    }));
}
