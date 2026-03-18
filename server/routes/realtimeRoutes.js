// routes/realtimeRoutes.js — Server-Sent Events for real-time Firestore updates
import { Router } from 'express';

export default function createRealtimeRoutes(firestoreDAL) {
  const router = Router();
  const clients = new Set();

  // Track whether listeners are active
  let listenersActive = false;
  let unsubscribers = [];

  // Broadcast an event to all connected SSE clients
  function broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try { client.write(payload); } catch (e) { /* client disconnected */ }
    }
  }

  // Set up Firestore onSnapshot listeners (once, when first client connects)
  function startListeners() {
    if (listenersActive) return;
    listenersActive = true;

    const db = firestoreDAL.getFirestore();
    const collections = ['teamMessages', 'contentItems', 'teamTasks'];

    for (const collName of collections) {
      const unsub = db.collection(collName).onSnapshot(
        (snapshot) => {
          const changes = snapshot.docChanges();
          if (changes.length === 0) return;

          // Skip the initial snapshot (full collection load) — clients already have this data
          if (changes.length === snapshot.size && changes.every(c => c.type === 'added')) {
            console.log(`[Realtime] Initial snapshot for ${collName} (${changes.length} docs) — skipped`);
            return;
          }

          for (const change of changes) {
            const doc = { id: change.doc.id, ...change.doc.data() };
            broadcast(collName, {
              type: change.type, // 'added' | 'modified' | 'removed'
              doc,
            });
          }
          console.log(`[Realtime] ${collName}: ${changes.length} changes pushed to ${clients.size} clients`);
        },
        (error) => {
          console.error(`[Realtime] Snapshot error on ${collName}:`, error.message);
        }
      );
      unsubscribers.push(unsub);
    }

    console.log(`[Realtime] Firestore listeners started for: ${collections.join(', ')}`);
  }

  // Stop listeners when no clients remain
  function stopListeners() {
    if (clients.size > 0) return; // Still have clients
    for (const unsub of unsubscribers) {
      try { unsub(); } catch (e) { /* already unsubscribed */ }
    }
    unsubscribers = [];
    listenersActive = false;
    console.log('[Realtime] All clients disconnected — Firestore listeners stopped');
  }

  // SSE endpoint
  router.get('/stream', (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), clientCount: clients.size + 1 })}\n\n`);

    // Add this response to client set
    clients.add(res);
    console.log(`[Realtime] Client connected (total: ${clients.size})`);

    // Start Firestore listeners if this is the first client
    startListeners();

    // Keep-alive ping every 30s (prevents proxy timeout)
    const keepAlive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
      } catch (e) {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clients.delete(res);
      clearInterval(keepAlive);
      console.log(`[Realtime] Client disconnected (remaining: ${clients.size})`);
      // Stop listeners if no clients remain (with a small delay to allow reconnects)
      setTimeout(stopListeners, 5000);
    });
  });

  // Debug endpoint: show listener status
  router.get('/status', (req, res) => {
    res.json({
      clients: clients.size,
      listenersActive,
      collections: ['teamMessages', 'contentItems', 'teamTasks'],
    });
  });

  return router;
}
