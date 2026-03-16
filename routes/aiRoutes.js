// routes/aiRoutes.js — Vertex AI proxy + Coco memory
import { Router } from 'express';
import { VertexAI } from '@google-cloud/vertexai';

const router = Router();

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'admin-tracker-490321';
const VERTEX_LOCATION = 'us-central1';

function getVertexModel(modelName) {
  const vertexAI = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_LOCATION });
  return vertexAI.getGenerativeModel({ model: modelName || 'gemini-3-flash' });
}

// Generic generation endpoint (single-shot, optionally structured)
router.post('/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, model, responseSchema, tools, mediaParts } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const generativeModel = getVertexModel(model);

    // Build content parts: text + optional media (images/video)
    const parts = [{ text: prompt }];
    if (mediaParts && Array.isArray(mediaParts)) {
      for (const mp of mediaParts) {
        if (mp.mimeType && mp.data) {
          parts.push({ inlineData: { mimeType: mp.mimeType, data: mp.data } });
        }
      }
      console.log(`[Vertex AI] Multimodal request: ${parts.length} parts (${mediaParts.length} media)`);
    }

    const request = {
      contents: [{ role: 'user', parts }],
    };

    if (systemInstruction) {
      request.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (responseSchema) {
      request.generationConfig = {
        responseMimeType: 'application/json',
        responseSchema,
      };
    }

    if (tools) {
      request.tools = tools;
    }

    const result = await generativeModel.generateContent(request);
    const response = result.response;
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (e) {
    console.error('[Vertex AI] Generate error:', e.message);
    // Fallback: try with API key if Vertex fails (during transition)
    try {
      const apiKey = process.env.API_KEY;
      if (apiKey) {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const { prompt, systemInstruction, model, responseSchema } = req.body;
        const config = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (responseSchema) { config.responseMimeType = 'application/json'; config.responseSchema = responseSchema; }
        const fallbackResult = await ai.models.generateContent({ model: model || 'gemini-3-flash', contents: prompt, config });
        console.log('[Vertex AI] Fallback to API key succeeded');
        return res.json({ text: fallbackResult.text || '' });
      }
    } catch (fallbackErr) {
      console.error('[Vertex AI] Fallback also failed:', fallbackErr.message);
    }
    res.status(500).json({ error: e.message || 'AI generation failed' });
  }
});

// Chat endpoint (multi-turn with history)
router.post('/chat', async (req, res) => {
  try {
    const { message, systemInstruction, model, history, mediaParts } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const generativeModel = getVertexModel(model || 'gemini-3.1-pro-preview');

    const vertexHistory = (history || []).map(turn => ({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: turn.parts || [{ text: turn.text || '' }],
    }));

    const chat = generativeModel.startChat({
      history: vertexHistory,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    });

    // Build message parts: text + optional media
    const messageParts = [{ text: message }];
    if (mediaParts && Array.isArray(mediaParts)) {
      for (const mp of mediaParts) {
        if (mp.mimeType && mp.data) {
          messageParts.push({ inlineData: { mimeType: mp.mimeType, data: mp.data } });
        }
      }
      console.log(`[Vertex AI] Multimodal chat: ${messageParts.length} parts (${mediaParts.length} media)`);
    }

    const result = await chat.sendMessage(messageParts);
    const response = result.response;
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (e) {
    console.error('[Vertex AI] Chat error:', e.message);
    try {
      const apiKey = process.env.API_KEY;
      if (apiKey) {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const { message, systemInstruction, model, history } = req.body;
        const chatSession = ai.chats.create({ model: model || 'gemini-3.1-pro-preview', config: { systemInstruction: systemInstruction || '' }, history: history || [] });
        const fallbackResult = await chatSession.sendMessage({ message });
        console.log('[Vertex AI] Chat fallback to API key succeeded');
        return res.json({ text: fallbackResult.text || '' });
      }
    } catch (fallbackErr) {
      console.error('[Vertex AI] Chat fallback also failed:', fallbackErr.message);
    }
    res.status(500).json({ error: e.message || 'AI chat failed' });
  }
});

// Coco Memory — Firestore-backed
export default function createAiRoutes(firestoreDAL) {
  router.post('/memory/save', async (req, res) => {
    try {
      const { userId, key, value, category, ttlDays } = req.body;
      if (!userId || !key) return res.status(400).json({ error: 'userId and key required' });

      const memoryDoc = {
        key,
        value,
        category: category || 'general',
        createdAt: new Date().toISOString(),
        expiresAt: ttlDays ? new Date(Date.now() + ttlDays * 86400000).toISOString() : null,
      };
      await firestoreDAL.setDocument(`coco_memory/${userId}/memories`, key, memoryDoc);
      res.json({ ok: true });
    } catch (e) {
      console.error('[Coco Memory] Save error:', e.message);
      res.status(500).json({ error: 'Failed to save memory' });
    }
  });

  router.get('/memory/recall', async (req, res) => {
    try {
      const { userId, category } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId required' });

      const memories = await firestoreDAL.getCollection(`coco_memory/${userId}/memories`);
      const now = new Date().toISOString();
      const active = (memories || []).filter(m => !m.expiresAt || m.expiresAt > now);
      const filtered = category ? active.filter(m => m.category === category) : active;
      res.json({ memories: filtered });
    } catch (e) {
      console.error('[Coco Memory] Recall error:', e.message);
      res.json({ memories: [] });
    }
  });

  router.post('/memory/clear', async (req, res) => {
    try {
      const { userId, key } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId required' });

      if (key) {
        await firestoreDAL.deleteDocument(`coco_memory/${userId}/memories`, key);
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('[Coco Memory] Clear error:', e.message);
      res.status(500).json({ error: 'Failed to clear memory' });
    }
  });

  return router;
}
