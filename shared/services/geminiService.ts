
import { Platform, PaymentMethod, Creator, Campaign, ContentItem, ShipmentStatus, CampaignStatus, ReachPlatform } from "../types";
import { aiGenerate } from "./aiProxy";

// ── Structured generation helper ──
// All calls go through the server-side proxy — no API key in the browser

const getBrandContext = (brandInfo?: string) => {
    return brandInfo
        ? `OOEDN BRAND BIBLE (STRICT ADHERENCE):\n${brandInfo}\n`
        : "Brand: OOEDN. Tone: Bold, minimalist, premium streetwear.";
};

// ... Existing parsing functions ...
export const parseCreatorInfo = async (rawText: string) => {
    const systemInstruction = `Extract creator info. Detect ALL payment methods mentioned (e.g. Venmo, PayPal, Zelle). Extract physical addresses if present. Detect sourcing platform if mentioned (Brillo, Social Cat, Join Bands). Default platform to Instagram if not found.`;
    try {
        const text = await aiGenerate({
            prompt: `Extract info from: "${rawText}"`,
            systemInstruction,
            model: 'gemini-3-flash',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING' },
                    handle: { type: 'STRING' },
                    platform: { type: 'STRING', enum: Object.values(Platform) },
                    reachPlatform: { type: 'STRING' },
                    email: { type: 'STRING' },
                    address: { type: 'STRING' },
                    paymentOptions: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                method: { type: 'STRING', enum: Object.values(PaymentMethod) },
                                details: { type: 'STRING' }
                            },
                            required: ["method", "details"]
                        }
                    },
                    rate: { type: 'NUMBER' },
                    notes: { type: 'STRING' },
                },
                required: ["name", "handle", "platform"],
            },
        });
        return JSON.parse(text || '{}');
    } catch (error) {
        console.error("Gemini Extraction Error:", error);
        throw error;
    }
};

export const parseBulkCreators = async (rawText: string) => {
    const systemInstruction = `You are a data entry specialist for OOEDN. Parse a list of creators from unstructured text. 
    Return an array of objects. Infer platform from handle if possible. 
    Default platform to Instagram. Return JSON array.`;

    try {
        const text = await aiGenerate({
            prompt: `Parse this list of creators:\n\n${rawText}`,
            systemInstruction,
            model: 'gemini-3-flash',
            responseSchema: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING' },
                        handle: { type: 'STRING' },
                        platform: { type: 'STRING', enum: Object.values(Platform) },
                        email: { type: 'STRING' },
                        rate: { type: 'NUMBER' }
                    },
                    required: ["name"]
                }
            }
        });
        return JSON.parse(text || '[]');
    } catch (error) {
        console.error("Bulk Parse Error:", error);
        throw error;
    }
};

export const generateCampaignBrief = async (prompt: string, creators: Creator[], existingCampaigns: Campaign[], brandInfo?: string) => {
    const creatorsContext = creators
        .filter(c => c.status !== 'Blackburn')
        .map(c => ({ id: c.id, name: c.name, handle: c.handle, notes: c.notes, rating: c.rating }))
        .slice(0, 30);

    const historyContext = existingCampaigns.map(c => ({ title: c.title, desc: c.description.slice(0, 100) })).slice(0, 5);

    const systemInstruction = `You are the OOEDN Agentic Creative Director (COS).
    ${getBrandContext(brandInfo)}

    You are NOT a simple text generator. You are an orchestrator following the "Deep Research 2025" methodology.
    
    ## INSTRUCTIONS:
    1. **North Star Objective**: Define a *quantifiable* goal (e.g. "Reach 500k unique viewers with 15% retention at 3s"). Do not use vague terms like "Brand Awareness".
    2. **Psychographic Audience**: Define audience by *behavior* (e.g. "Users who engage with #CozyGaming and buy from TikTok Shop"), NOT just demographics.
    3. **Hook Strategy (0-3s)**: You must choose one of the following frameworks:
       - *Negative Assumption*: "Stop doing [X] if you want..."
       - *Curiosity Gap*: "I tried [Product] so you don't have to."
       - *Visual Pattern Interrupt*: "Sudden zoom/color shift."
       - *Hyper-Specificity*: Target a visceral feeling (e.g. "unbuttoning jeans after dinner").
    4. **Compliance Layer**: You MUST include a "Compliance & Ethics" section.
       - Mandate #ad / #sponsored overlays in the first 3 seconds.
       - Require AI labelling if generative tools are used.
    5. **Scripting**: Generate a script following the flow: Hook (0-3s) -> Body (Value Prop) -> CTA (Soft vs Hard).

    ## OUTPUT FORMAT:
    Return a valid JSON object. The 'description' field must be a Markdown string formatted with specific headers (## 🎯 North Star, ## 🧠 Psychographics, ## 🪝 Hook Strategy, ## 📝 Scripting, ## ⚖️ Compliance).
    Select the best creators from the provided pool who match the Psychographic Vibe.
    `;

    try {
        const text = await aiGenerate({
            prompt: `User Idea: ${prompt}\n\nCreator Pool: ${JSON.stringify(creatorsContext)}`,
            systemInstruction,
            model: 'gemini-3.1-pro-preview',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    title: { type: 'STRING' },
                    description: { type: 'STRING', description: "Full brief in Markdown format including North Star, Hook Strategy, Script, and Compliance." },
                    recommendedCreatorIds: {
                        type: 'ARRAY',
                        items: { type: 'STRING' }
                    }
                },
                required: ["title", "description", "recommendedCreatorIds"]
            }
        });
        return JSON.parse(text || '{}');
    } catch (error) {
        console.error("Campaign Brief Generation Error", error);
        throw error;
    }
};

export const generateViralScript = async (briefContext: string, brandInfo?: string) => {
    const systemInstruction = `You are a Viral Script Engineer for OOEDN. 
    ${getBrandContext(brandInfo)}
    
    Using the provided Brief Context, generate a high-retention script following the 'Deep Research 2025' frameworks.
    
    ## REQUIREMENTS:
    1. **The Hook (0-3s)**: Use the 'Negative Assumption' or 'Visual Pattern Interrupt'. Must be provocative.
    2. **The Body (3s-end)**: Rapid-fire value propositions. No throat-clearing.
    3. **CTA**: Provide a Soft CTA (for engagement) and a Hard CTA (for sales).
    
    Output strictly in Markdown format suitable for appending to a brief.
    Start with "## 🎬 GENERATED SCRIPT (AI)"`;

    try {
        const text = await aiGenerate({
            prompt: `Context from Brief: ${briefContext}`,
            systemInstruction,
            model: 'gemini-3.1-pro-preview',
        });
        return text;
    } catch (e) {
        console.error("Script Gen Error", e);
        return "## Script Generation Failed\nPlease try again.";
    }
};

export const generateCampaignTasks = async (brief: string, brandInfo?: string) => {
    const systemInstruction = `You are a Project Manager for OOEDN. Break down this campaign brief into actionable, short tasks for the marketing team. Return a JSON array of strings.`;

    try {
        const text = await aiGenerate({
            prompt: `Brief: ${brief}`,
            systemInstruction,
            model: 'gemini-3-flash',
            responseSchema: {
                type: 'ARRAY',
                items: { type: 'STRING' }
            }
        });
        return JSON.parse(text || '[]');
    } catch (e) {
        console.error("Task Gen Error", e);
        return ["Review Brief", "Select Creators", "Send Contracts"];
    }
};

export const syncTrackingWithAI = async (trackingNumber: string, carrier?: string) => {
    const prompt = `Search the live status of package ${trackingNumber} ${carrier ? `via ${carrier}` : ''}. Use Google Search. Output current status (Not Shipped, Preparing, In Transit, Delivered, Shipping Issue), last location, and actual carrier.`;

    try {
        const text = await aiGenerate({
            prompt,
            model: 'gemini-3.1-pro-preview',
            tools: [{ googleSearch: {} }],
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    status: { type: 'STRING', enum: Object.values(ShipmentStatus) },
                    detailedStatus: { type: 'STRING' },
                    carrierFound: { type: 'STRING' },
                    lastLocation: { type: 'STRING' }
                },
                required: ["status", "detailedStatus"]
            }
        });
        return JSON.parse(text || '{}');
    } catch (error) {
        console.error("AI Tracking Error", error);
        return null;
    }
};

export const chatWithAppData = async (userQuery: string, appState: { creators: Creator[], campaigns: Campaign[], content: ContentItem[] }, chatHistory: { role: string, parts: { text: string }[] }[] = [], brandInfo?: string) => {
    const contextData = JSON.stringify({
        creators: appState.creators.map(c => ({ name: c.name, handle: c.handle, status: c.status, tracking: c.trackingNumber, rating: c.rating })),
        campaigns: appState.campaigns
    });
    const systemInstruction = `You are the OOEDN Assistant. ${getBrandContext(brandInfo)} Provide insights, tracking summaries, and roster analysis. Access this data: ${contextData}`;
    try {
        // For chat with history, use the chat endpoint
        const { aiChat } = await import('./aiProxy');
        const text = await aiChat({
            message: userQuery,
            systemInstruction,
            model: 'gemini-3-flash',
            history: chatHistory,
        });
        return text;
    } catch (error) {
        console.error("Gemini Chat Error", error);
        return "I'm having trouble connecting to your database right now.";
    }
};

export const draftCreatorOutreach = async (creator: Creator, type: 'recruit' | 'followup' | 'payment', campaign?: string, brandInfo?: string) => {
    const systemInstruction = `You are the OOEDN Outreach Manager. ${getBrandContext(brandInfo)} 
    Draft a professional but street-style outreach message for a creator. 
    Creator: ${creator.name} (@${creator.handle}). 
    Type: ${type}. 
    Campaign: ${campaign || 'General Collaboration'}.`;

    try {
        const text = await aiGenerate({
            prompt: `Draft a ${type} message for ${creator.name}.`,
            systemInstruction,
            model: 'gemini-3-flash',
        });
        return text;
    } catch (error) {
        console.error("Outreach Draft Error", error);
        return "Failed to generate draft.";
    }
};

export const generateCaptionAI = async (title: string, creatorName: string, previousCaptions: string[], brandInfo?: string) => {
    const systemInstruction = `You are the OOEDN Social Media Manager. ${getBrandContext(brandInfo)} 
    Draft a viral, high-engagement caption for a piece of content. 
    Creator: ${creatorName}. 
    Content Title: ${title}.
    Style Context (Recent Captions): ${previousCaptions.join(' | ')}`;

    try {
        const text = await aiGenerate({
            prompt: `Generate a caption for content titled "${title}" by ${creatorName}.`,
            systemInstruction,
            model: 'gemini-3-flash',
        });
        return text;
    } catch (error) {
        console.error("Caption Generation Error", error);
        return "Failed to generate caption.";
    }
};

// ── AI Email Editor — Polish & Spell Check ──

export const polishEmailDraft = async (body: string, brandInfo?: string) => {
    const systemInstruction = `You are a professional email editor for OOEDN. ${getBrandContext(brandInfo)}
    
    Improve the given email draft:
    - Fix all spelling and grammar errors
    - Improve professional tone while keeping it approachable
    - Tighten sentence structure — remove filler words
    - Keep the same intent, meaning, and key details
    - Do NOT add new content the user didn't mention
    - Return ONLY the improved email text (no explanations, no headers, no quotes)`;

    try {
        const text = await aiGenerate({
            prompt: `Polish this email draft:\n\n${body}`,
            systemInstruction,
            model: 'gemini-3-flash',
        });
        return text || body;
    } catch (error) {
        console.error("Polish Email Error", error);
        return null;
    }
};

export const checkSpellingGrammar = async (body: string) => {
    const systemInstruction = `You are a spelling and grammar checker. Analyze the text and return a JSON array of corrections.
    Each correction should have: "original" (the wrong text), "corrected" (the fix), and "reason" (brief explanation).
    If the text is perfect, return an empty array [].
    Only flag actual errors — do not suggest style changes.`;

    try {
        const text = await aiGenerate({
            prompt: `Check spelling and grammar:\n\n${body}`,
            systemInstruction,
            model: 'gemini-3-flash',
            responseSchema: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        original: { type: 'STRING' },
                        corrected: { type: 'STRING' },
                        reason: { type: 'STRING' },
                    },
                    required: ["original", "corrected", "reason"]
                }
            }
        });
        return JSON.parse(text || '[]');
    } catch (error) {
        console.error("Spell Check Error", error);
        return [];
    }
};
