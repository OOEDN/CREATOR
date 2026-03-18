/**
 * AI Proxy Service — Client-side wrapper for server-side AI calls
 * 
 * Instead of calling Gemini directly from the browser (exposing the API key),
 * all AI operations go through server.js /api/ai/* routes.
 */

// ── Server URL detection ──
function getServerUrl(): string {
    // In production, same origin. In dev, Vite proxies /api to localhost:8080
    return '';
}

// ── Generic AI Generation ──
export async function aiGenerate(options: {
    prompt: string;
    systemInstruction?: string;
    model?: string;
    responseSchema?: any;
    tools?: any[];
    mediaParts?: { mimeType: string; data: string }[];
}): Promise<string> {
    const res = await fetch(`${getServerUrl()}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'AI request failed' }));
        throw new Error(err.error || `AI proxy error: ${res.status}`);
    }
    const data = await res.json();
    return data.text || '';
}

// ── Chat (multi-turn) ──
export async function aiChat(options: {
    message: string;
    systemInstruction?: string;
    model?: string;
    history?: { role: string; parts: { text: string }[] }[];
    mediaParts?: { mimeType: string; data: string }[];
}): Promise<string> {
    const res = await fetch(`${getServerUrl()}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'AI chat failed' }));
        throw new Error(err.error || `AI chat error: ${res.status}`);
    }
    const data = await res.json();
    return data.text || '';
}

// ── Coco Memory (Firestore-backed) ──

export async function saveMemory(userId: string, key: string, value: string, category?: string, ttlDays?: number): Promise<void> {
    await fetch(`${getServerUrl()}/api/ai/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, key, value, category, ttlDays }),
    });
}

export async function recallMemories(userId: string, category?: string): Promise<{ key: string; value: string; category: string }[]> {
    const params = new URLSearchParams({ userId });
    if (category) params.append('category', category);
    const res = await fetch(`${getServerUrl()}/api/ai/memory/recall?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.memories || [];
}

export async function clearMemory(userId: string, key?: string): Promise<void> {
    await fetch(`${getServerUrl()}/api/ai/memory/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, key }),
    });
}

// ── Gemini Embedding 2 ──

export async function aiEmbed(text: string, options?: {
    taskType?: string;
    dimensions?: number;
}): Promise<number[]> {
    const res = await fetch(`${getServerUrl()}/api/ai/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...options }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.embedding || [];
}

export async function aiEmbedBatch(texts: string[], options?: {
    taskType?: string;
    dimensions?: number;
}): Promise<number[][]> {
    const res = await fetch(`${getServerUrl()}/api/ai/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, ...options }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.embeddings || [];
}

// ── Coco Semantic Memory ──

export async function semanticSave(userId: string, text: string, embedding: number[], category?: string): Promise<void> {
    await fetch(`${getServerUrl()}/api/ai/memory/semantic-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text, embedding, category }),
    });
}

export async function semanticSearch(userId: string, queryEmbedding: number[], topK?: number): Promise<{ text: string; score: number; category: string }[]> {
    const res = await fetch(`${getServerUrl()}/api/ai/memory/semantic-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, queryEmbedding, topK: topK || 3 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
}
