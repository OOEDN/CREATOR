/**
 * AURA Core — Unified AI Gateway
 * 
 * Every AI interaction in the app flows through here.
 * Loads soul + knowledge + memory → builds context → calls Gemini → stores memory.
 */

import { GoogleGenAI } from "@google/genai";
import { Creator, Campaign, ContentItem } from "../../types";
import {
    recall,
    addToSessionConversation,
    buildConversationHistory,
    rememberShortTerm,
    restoreSessionFromSTM,
    getSessionConversation,
} from "./auraMemory";

// ── Soul & Knowledge (loaded once, cached) ──

// These are imported as raw strings via Vite's ?raw import
// We'll inline them as constants since .md files can't be dynamically imported client-side
import COCO_SOUL_RAW from "./COCO_SOUL.md?raw";
import COCO_KNOWLEDGE_RAW from "./COCO_KNOWLEDGE.md?raw";

// ── Types ──

export interface AuraContext {
    creators?: Creator[];
    campaigns?: Campaign[];
    content?: ContentItem[];
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

export type AuraMode = 'chat' | 'task' | 'email' | 'brief' | 'polish' | 'caption' | 'digest';

// ── Helpers ──

function getApiKey(): string {
    return (window as any).env?.API_KEY || (window as any).env?.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || '';
}

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

    if (ctx.currentUser) {
        parts.push(`## Current User: ${ctx.currentUser}`);
    }

    if (ctx.currentView) {
        parts.push(`## Current View: ${ctx.currentView}`);
    }

    return parts.join('\n\n');
}

function buildSystemPrompt(mode: AuraMode, ctx: AuraContext): string {
    const soul = COCO_SOUL_RAW || '';
    const knowledge = COCO_KNOWLEDGE_RAW || '';
    const memoryContext = recall();
    const appState = buildAppStateContext(ctx);
    const brandOverride = ctx.brandInfo ? `\n\n## Brand Bible Override\n${ctx.brandInfo}` : '';

    // Mode-specific instructions
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
        knowledge,
        brandOverride,
        ``,
        `## Memory & Context`,
        memoryContext || '(No prior memories yet)',
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
    }
): Promise<AuraResponse> {
    const mode = options?.mode || 'chat';
    const useMemory = options?.useMemory !== false;
    const apiKey = getApiKey();

    if (!apiKey) {
        return { text: "I can't connect right now — API key is missing. Check your environment config." };
    }

    // Restore conversation from last session if needed
    if (useMemory && getSessionConversation().length === 0) {
        restoreSessionFromSTM();
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = buildSystemPrompt(mode, context);

    // Build history: either provided explicitly or from memory
    const history = options?.history || (useMemory ? buildConversationHistory() : []);

    // Smart model selection: Pro for important modes, Flash for quick utilities
    // Using gemini-3-flash-preview as the primary model (matches working geminiService)
    const primaryModel = "gemini-3-flash-preview";

    // Fallback chain in case primary model is unavailable
    const modelsToTry = [primaryModel, "gemini-2.0-flash"];

    for (const model of modelsToTry) {
        try {
            let responseText: string;

            if (history.length > 0 && mode === 'chat') {
                // Use chat mode for conversational flow
                const chat = ai.chats.create({
                    model,
                    config: { systemInstruction },
                    history,
                });
                const result = await chat.sendMessage({ message: input });
                responseText = result.text || "I couldn't process that.";
            } else {
                // Single-shot for tasks, emails, polish, etc.
                const result = await ai.models.generateContent({
                    model,
                    contents: input,
                    config: { systemInstruction },
                });
                responseText = result.text || "I couldn't process that.";
            }

            // Store in memory
            if (useMemory) {
                addToSessionConversation('user', input);
                addToSessionConversation('model', responseText);
                rememberShortTerm('conversation', `User: ${input.slice(0, 100)} → Coco: ${responseText.slice(0, 100)}`, 'conversation');
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
            console.error(`[Coco Core] Error with model ${model}:`, error?.message || error);

            // If this wasn't the last model, try the next one
            if (model !== modelsToTry[modelsToTry.length - 1]) {
                console.log(`[Coco Core] Falling back from ${model} to next model...`);
                continue;
            }

            // Last model failed — return helpful error
            if (error.message?.includes('quota') || error.message?.includes('429')) {
                return { text: "I'm hitting my rate limit right now — give me a minute and try again. 🔄" };
            }
            if (error.message?.includes('API_KEY') || error.message?.includes('API key')) {
                return { text: "My API key seems misconfigured. Check the system settings." };
            }
            if (error.message?.includes('not found') || error.message?.includes('404')) {
                return { text: "The AI model I need isn't available right now. Try again in a moment." };
            }

            return { text: "Something went wrong on my end. Try again in a sec." };
        }
    }

    return { text: "Something went wrong on my end. Try again in a sec." };
}

// ── Email Parser ──

function parseEmailResponse(response: string, context: AuraContext): AuraResponse['emailDraft'] | null {
    try {
        // Try to parse structured email format
        const toMatch = response.match(/TO:\s*(.+)/i);
        const subjectMatch = response.match(/SUBJECT:\s*(.+)/i);
        const bodyMatch = response.split('---');

        if (toMatch && subjectMatch && bodyMatch.length > 1) {
            let to = toMatch[1].trim();

            // If 'to' is a name, try to look up email from creators
            if (!to.includes('@') && context.creators) {
                const creator = context.creators.find(c =>
                    c.name.toLowerCase().includes(to.toLowerCase()) ||
                    c.handle.toLowerCase().includes(to.toLowerCase())
                );
                if (creator?.email) {
                    to = creator.email;
                }
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
    appState: { creators: Creator[]; campaigns: Campaign[]; content: ContentItem[] },
    brandInfo?: string,
    currentUser?: string
): Promise<string> {
    const response = await askAura(message, {
        creators: appState.creators,
        campaigns: appState.campaigns,
        content: appState.content,
        brandInfo,
        currentUser,
    }, { mode: 'chat' });
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
