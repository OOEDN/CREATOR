/**
 * AURA Core — Unified AI Gateway (Server-Proxied)
 * 
 * Every AI interaction in the app flows through here.
 * Loads soul + knowledge + memory → builds context → calls server proxy → stores memory.
 * 
 * SECURITY: All Gemini API calls go through server.js /api/ai/* routes.
 * The API key NEVER reaches the browser.
 */

import { Creator, Campaign, ContentItem, TeamTask, TeamMessage, BetaTest, BetaRelease } from "../../types";
import { aiGenerate, aiChat, saveMemory, recallMemories, aiEmbed, semanticSave, semanticSearch } from "../aiProxy";

// ── Soul & Knowledge (loaded once, cached) ──
import COCO_SOUL_RAW from "./COCO_SOUL.md?raw";
import COCO_KNOWLEDGE_RAW from "./COCO_KNOWLEDGE.md?raw";

// ── Types ──

export interface AuraContext {
    creators?: Creator[];
    campaigns?: Campaign[];
    content?: ContentItem[];
    teamTasks?: TeamTask[];
    teamMessages?: TeamMessage[];
    betaTests?: BetaTest[];
    betaReleases?: BetaRelease[];
    brandInfo?: string;
    currentUser?: string;
    currentView?: string;
    additionalContext?: string;
}

export interface AuraResponse {
    text: string;
    suggestedActions?: string[];
    emailDraft?: {
        to: string;
        subject: string;
        body: string;
    };
}

export type AuraMode = 'chat' | 'task' | 'email' | 'brief' | 'polish' | 'caption' | 'digest' | 'creator-chat';

// ── Local session memory (in-memory for current tab) ──
let sessionConversation: { role: string; parts: { text: string }[] }[] = [];

function addToSession(role: string, text: string) {
    sessionConversation.push({ role, parts: [{ text }] });
    // Keep last 20 turns to stay within context limits
    if (sessionConversation.length > 40) {
        sessionConversation = sessionConversation.slice(-40);
    }
}

// ── Helpers ──

function truncateArray<T>(arr: T[], max: number, mapper: (item: T) => any): string {
    return JSON.stringify(arr.slice(0, max).map(mapper));
}

function buildAppStateContext(ctx: AuraContext): string {
    const parts: string[] = [];

    if (ctx.creators && ctx.creators.length > 0) {
        parts.push(`## Active Creators (${ctx.creators.length} total, showing top 30)`);
        parts.push(truncateArray(ctx.creators, 30, c => ({
            name: c.name,
            handle: c.handle,
            status: c.status,
            platform: c.platform,
            email: c.email || 'none',
            tracking: c.trackingNumber || 'none',
            rating: c.rating || 'unrated',
            shipments: (c.shipments || []).length,
        })));
    }

    if (ctx.campaigns && ctx.campaigns.length > 0) {
        parts.push(`## Campaigns (${ctx.campaigns.length})`);
        parts.push(truncateArray(ctx.campaigns, 10, c => ({
            title: c.title,
            status: c.status,
            description: c.description?.slice(0, 100),
        })));
    }

    if (ctx.content && ctx.content.length > 0) {
        parts.push(`## Content Library (${ctx.content.length} items)`);
        parts.push(truncateArray(ctx.content, 15, c => ({
            title: c.title,
            status: c.status,
            creator: c.creatorName,
            platform: c.platform,
        })));
    }

    if (ctx.teamTasks && ctx.teamTasks.length > 0) {
        parts.push(`## Team Tasks (${ctx.teamTasks.length})`);
        parts.push(truncateArray(ctx.teamTasks, 20, t => ({
            title: t.title,
            status: t.status,
            assignedTo: t.assignedTo,
            dueDate: t.dueDate,
            notes: t.notes,
        })));
    }

    if (ctx.teamMessages && ctx.teamMessages.length > 0) {
        parts.push(`## Recent Team Messages (${ctx.teamMessages.length}, showing last 20)`);
        parts.push(truncateArray(ctx.teamMessages.slice(-20), 20, m => ({
            sender: m.sender,
            text: m.text?.slice(0, 100),
            timestamp: m.timestamp,
        })));
    }

    if (ctx.betaTests && ctx.betaTests.length > 0) {
        parts.push(`## Beta Tests (${ctx.betaTests.length})`);
        parts.push(truncateArray(ctx.betaTests, 10, b => ({
            title: (b as any).title || (b as any).name || 'Unnamed',
            status: (b as any).status,
            createdAt: (b as any).createdAt,
        })));
    }

    if (ctx.betaReleases && ctx.betaReleases.length > 0) {
        parts.push(`## Beta Releases (${ctx.betaReleases.length})`);
        parts.push(truncateArray(ctx.betaReleases, 10, r => ({
            creatorId: (r as any).creatorId,
            status: (r as any).status,
            feedback: (r as any).feedback?.slice(0, 80),
        })));
    }

    if (ctx.currentUser) parts.push(`## Current User: ${ctx.currentUser}`);
    if (ctx.currentView) parts.push(`## Current View: ${ctx.currentView}`);

    return parts.join('\n\n');
}

async function buildMemoryContext(userId?: string): Promise<string> {
    if (!userId) return '(No user context for memory)';
    try {
        const memories = await recallMemories(userId);
        if (!memories.length) return '(No prior memories yet)';
        return memories.map(m => `- [${m.category}] ${m.value}`).join('\n');
    } catch {
        return '(Memory unavailable)';
    }
}

// ── Semantic Memory Helpers (Gemini Embedding 2) ──

async function recallSemanticContext(userId: string, query: string): Promise<string> {
    try {
        // Embed the user's query
        const queryEmbedding = await aiEmbed(query, { taskType: 'RETRIEVAL_QUERY', dimensions: 768 });
        if (!queryEmbedding || queryEmbedding.length === 0) return '';

        // Search past memories
        const results = await semanticSearch(userId, queryEmbedding, 3);
        if (!results || results.length === 0) return '';

        const recalled = results.map(r => `- (relevance ${Math.round(r.score * 100)}%) ${r.text}`).join('\n');
        return `\n## Recalled Past Conversations (Semantic Memory)\n${recalled}`;
    } catch (e) {
        console.warn('[Coco Semantic] Recall failed:', e);
        return '';
    }
}

async function saveSemanticMemory(userId: string, userMsg: string, cocoResponse: string): Promise<void> {
    try {
        const summary = `User asked: ${userMsg.slice(0, 150)}. Coco replied: ${cocoResponse.slice(0, 200)}`;
        const embedding = await aiEmbed(summary, { taskType: 'RETRIEVAL_DOCUMENT', dimensions: 768 });
        if (embedding && embedding.length > 0) {
            await semanticSave(userId, summary, embedding, 'conversation');
        }
    } catch (e) {
        // Non-blocking — don't let memory failures break chat
        console.warn('[Coco Semantic] Save failed:', e);
    }
}

function buildSystemPrompt(mode: AuraMode, ctx: AuraContext, memoryContext: string): string {
    const soul = COCO_SOUL_RAW || '';
    const knowledge = COCO_KNOWLEDGE_RAW || '';
    const appState = buildAppStateContext(ctx);
    const brandOverride = ctx.brandInfo ? `\n\n## Brand Bible Override\n${ctx.brandInfo}` : '';

    // In creator-chat mode, strip internal team knowledge to prevent leaks
    const safeKnowledge = mode === 'creator-chat'
        ? '' // Creators should NOT see team emails, payment protocols, or internal operations
        : knowledge;

    const modeInstructions: Record<AuraMode, string> = {
        chat: `You are in CHAT mode. Have a natural conversation. Reference data when relevant. Be proactive about suggesting next steps.`,
        task: `You are in TASK mode. Help the user accomplish a specific task. Be efficient and action-oriented.`,
        email: `You are in EMAIL mode. The user is dictating an email via voice or text. 
Extract their intent and generate a structured email.
Return your response EXACTLY in this format:
TO: [email address]
SUBJECT: [subject line]
---
[email body]

If the user mentions a creator by name, look up their email from the creator data. Use OOEDN brand voice — professional but approachable. Sign off as "The OOEDN Team" or "OOEDN Creative Team".`,
        brief: `You are in BRIEF mode. Generate a concise, actionable daily briefing based on the current app state. Mention specific numbers, names, and deadlines. Keep it under 150 words. No fluff.`,
        polish: `You are in POLISH mode. Improve the given text while preserving meaning. Fix grammar, tighten sentences, match OOEDN brand voice. Return ONLY the improved text.`,
        caption: `You are in CAPTION mode. Generate a viral, high-engagement social media caption. Short, punchy, brand-aligned. Include relevant hashtags.`,
        digest: `You are in DIGEST mode. Create a morning briefing for the team. Summarize: overdue tasks, pending shipments, unread messages, upcoming deadlines. Be specific with numbers and names. Format as bullet points. Max 200 words.`,
        'creator-chat': `You are in CREATOR CHAT mode. You are talking to a content creator who partners with OOEDN.
Be warm, supportive, and encouraging — like a creative partner, not a corporate bot.
Help them with:
- Content ideas and brainstorming for their assigned campaigns
- Writing captions and hooks
- Understanding their campaign briefs
- Figuring out what to work on next
- General creative advice
Reference their specific campaign data, tasks, and deadlines when relevant.
Keep responses concise and actionable. Use emojis naturally.
Never reveal internal team data, other creators' info, or sensitive business details.`,
    };

    return [
        `# Coco System Prompt`,
        ``,
        `## Identity & Personality`,
        soul,
        ``,
        `## Mode: ${mode.toUpperCase()}`,
        modeInstructions[mode],
        ``,
        `## Knowledge Base`,
        safeKnowledge,
        brandOverride,
        ``,
        `## Memory & Context`,
        memoryContext,
        ``,
        `## Live App Data`,
        appState || '(No app data available)',
        ``,
        `## Rules`,
        `- Stay in character as Coco at all times`,
        `- Reference specific data points when you have them`,
        `- Never say "As an AI" or "I'm a language model"`,
        `- If asked about something you don't have data for, say so directly`,
        `- Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    ].join('\n');
}

// ── Main Function ──

export async function askAura(
    input: string,
    context: AuraContext,
    options?: {
        mode?: AuraMode;
        history?: { role: string; parts: { text: string }[] }[];
        useMemory?: boolean;
        mediaParts?: { mimeType: string; data: string }[];
    }
): Promise<AuraResponse> {
    const mode = options?.mode || 'chat';
    const useMemory = options?.useMemory !== false;
    const userId = context.currentUser || 'anonymous';

    // Build memory context from Firestore
    const memoryContext = useMemory ? await buildMemoryContext(userId) : '(Memory disabled)';

    // Semantic recall: find relevant past conversations
    const semanticContext = (useMemory && mode === 'chat') ? await recallSemanticContext(userId, input) : '';

    const systemInstruction = buildSystemPrompt(mode, context, memoryContext + semanticContext);

    // Build history for chat mode
    const history = options?.history || (mode === 'chat' ? sessionConversation : []);

    try {
        let responseText: string;

        if (history.length > 0 && mode === 'chat') {
            // Multi-turn chat via server proxy
            responseText = await aiChat({
                message: input,
                systemInstruction,
                model: 'gemini-3.1-pro-preview',
                history,
                mediaParts: options?.mediaParts,
            });
        } else {
            // Single-shot via server proxy
            responseText = await aiGenerate({
                prompt: input,
                systemInstruction,
                model: mode === 'chat' ? 'gemini-3.1-pro-preview' : 'gemini-3-flash',
                mediaParts: options?.mediaParts,
            });
        }

        // Store in session memory
        if (useMemory) {
            addToSession('user', input);
            addToSession('model', responseText);

            // Persist notable interactions to Firestore (async, non-blocking)
            saveMemory(userId, `conv_${Date.now()}`, `User: ${input.slice(0, 100)} → Coco: ${responseText.slice(0, 100)}`, 'conversation', 7).catch(() => {});

            // Embed & save to semantic memory (async, non-blocking)
            saveSemanticMemory(userId, input, responseText).catch(() => {});
        }

        // Parse email mode response
        if (mode === 'email') {
            const emailDraft = parseEmailResponse(responseText, context);
            if (emailDraft) {
                return { text: responseText, emailDraft };
            }
        }

        return { text: responseText };
    } catch (error: any) {
        console.error(`[Coco Core] Error:`, error?.message || error);

        if (error.message?.includes('quota') || error.message?.includes('429')) {
            return { text: "I'm hitting my rate limit right now — give me a minute and try again. 🔄" };
        }
        if (error.message?.includes('API key') || error.message?.includes('not configured')) {
            return { text: "I'm having a little trouble connecting right now — try again in a moment! 🔄" };
        }
        if (error.message?.includes('not found') || error.message?.includes('404')) {
            return { text: "I'm having a little trouble connecting right now — try again in a moment! 🔄" };
        }

        return { text: "Something went wrong on my end — try again in a sec! 🔄" };
    }
}

// ── Email Parser ──

function parseEmailResponse(response: string, context: AuraContext): AuraResponse['emailDraft'] | null {
    try {
        const toMatch = response.match(/TO:\s*(.+)/i);
        const subjectMatch = response.match(/SUBJECT:\s*(.+)/i);
        const bodyMatch = response.split('---');

        if (toMatch && subjectMatch && bodyMatch.length > 1) {
            let to = toMatch[1].trim();

            if (!to.includes('@') && context.creators) {
                const creator = context.creators.find(c =>
                    c.name.toLowerCase().includes(to.toLowerCase()) ||
                    c.handle.toLowerCase().includes(to.toLowerCase())
                );
                if (creator?.email) to = creator.email;
            }

            return {
                to,
                subject: subjectMatch[1].trim(),
                body: bodyMatch.slice(1).join('---').trim(),
            };
        }
    } catch (e) {
        console.warn('[Coco] Email parse failed:', e);
    }
    return null;
}

// ── Convenience Functions ──

export async function auraChat(
    message: string,
    appState: {
        creators: Creator[];
        campaigns: Campaign[];
        content: ContentItem[];
        teamTasks?: TeamTask[];
        teamMessages?: TeamMessage[];
        betaTests?: BetaTest[];
        betaReleases?: BetaRelease[];
    },
    brandInfo?: string,
    currentUser?: string,
    mediaParts?: { mimeType: string; data: string }[]
): Promise<string> {
    const response = await askAura(message, {
        creators: appState.creators,
        campaigns: appState.campaigns,
        content: appState.content,
        teamTasks: appState.teamTasks,
        teamMessages: appState.teamMessages,
        betaTests: appState.betaTests,
        betaReleases: appState.betaReleases,
        brandInfo,
        currentUser,
    }, { mode: 'chat', mediaParts });
    return response.text;
}

export async function auraDraftEmail(
    voiceInput: string,
    creators: Creator[],
    brandInfo?: string
): Promise<AuraResponse['emailDraft'] | null> {
    const response = await askAura(voiceInput, {
        creators,
        brandInfo,
    }, { mode: 'email', useMemory: false });
    return response.emailDraft || null;
}

export async function auraDigest(
    appState: { creators: Creator[]; campaigns: Campaign[]; content: ContentItem[] },
    currentUser?: string
): Promise<string> {
    const response = await askAura(
        'Generate my morning briefing for today.',
        { ...appState, currentUser },
        { mode: 'digest', useMemory: false }
    );
    return response.text;
}

export async function auraPolish(text: string, brandInfo?: string): Promise<string> {
    const response = await askAura(text, { brandInfo }, { mode: 'polish', useMemory: false });
    return response.text;
}

export async function auraCaption(
    title: string,
    creatorName: string,
    platform: string,
    brandInfo?: string
): Promise<string> {
    const response = await askAura(
        `Generate a caption for content titled "${title}" by @${creatorName} for ${platform}.`,
        { brandInfo },
        { mode: 'caption', useMemory: false }
    );
    return response.text;
}

// ── Coco Greeting ──

export function getAuraGreeting(currentUser?: string): string {
    const hour = new Date().getHours();
    const name = currentUser?.split('@')[0] || '';
    const greeting = name ? `, ${name}` : '';

    if (hour < 12) {
        return `Morning${greeting}! I pulled the latest data while you were gone. What are we working on? ☀️`;
    } else if (hour < 17) {
        return `Hey${greeting} — I've been keeping an eye on things. What do you need?`;
    } else {
        return `Still at it${greeting}? I don't sleep either 😄 — what can I help with?`;
    }
}
