// routes/pushRoutes.js — Push notification subscribe/send for team + creators
import { Router } from 'express';

export default function createPushRoutes(webpush, { getSubscriptions, setSubscriptions, persistSubscriptions, VAPID_PUBLIC_KEY }) {
  const router = Router();

  // Return the public VAPID key to the client
  router.get('/vapid-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // Register a new push subscription
  router.post('/subscribe', (req, res) => {
    try {
      const subscription = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }

      const subs = getSubscriptions();
      const exists = subs.some(s => s.endpoint === subscription.endpoint);
      if (!exists) {
        subs.push(subscription);
        setSubscriptions(subs);
        persistSubscriptions();
        console.log(`[Push] New subscription registered. Total: ${subs.length}`);
      }

      res.status(201).json({ success: true, total: subs.length });
    } catch (e) {
      console.error('[Push] Subscribe error:', e);
      res.status(500).json({ error: 'Failed to register subscription' });
    }
  });

  // Send push notification to all subscribers
  router.post('/send', async (req, res) => {
    try {
      const { title, body, url, tag } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required' });
      }

      const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'ooedn-general' });
      let subs = getSubscriptions();
      let sent = 0;
      let failed = 0;
      const staleEndpoints = [];

      await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(sub, payload).then(() => {
            sent++;
          }).catch(err => {
            failed++;
            if (err.statusCode === 410 || err.statusCode === 404) {
              staleEndpoints.push(sub.endpoint);
            }
            console.warn(`[Push] Failed to send to subscriber:`, err.statusCode || err.message);
          })
        )
      );

      if (staleEndpoints.length > 0) {
        subs = subs.filter(s => !staleEndpoints.includes(s.endpoint));
        setSubscriptions(subs);
        persistSubscriptions();
        console.log(`[Push] Removed ${staleEndpoints.length} stale subscriptions`);
      }

      console.log(`[Push] Sent: ${sent}, Failed: ${failed}, Remaining: ${subs.length}`);
      res.json({ sent, failed, remaining: subs.length });
    } catch (e) {
      console.error('[Push] Send error:', e);
      res.status(500).json({ error: 'Failed to send notifications' });
    }
  });

  // --- Creator Push Subscriptions ---
  let creatorPushSubscriptions = [];

  router.post('/subscribe-creator', (req, res) => {
    try {
      const { subscription, creatorId } = req.body;
      if (!subscription || !creatorId) return res.status(400).json({ error: 'subscription and creatorId required' });
      creatorPushSubscriptions = creatorPushSubscriptions.filter(s => s.creatorId !== creatorId);
      creatorPushSubscriptions.push({ creatorId, subscription });
      console.log(`[Push] Creator ${creatorId} subscribed. Total creator subs: ${creatorPushSubscriptions.length}`);
      res.status(201).json({ success: true });
    } catch (e) {
      console.error('[Push] Creator subscribe error:', e);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  router.post('/send-creators', async (req, res) => {
    try {
      const { creatorIds, title, body, url } = req.body;
      if (!title || !body) return res.status(400).json({ error: 'title and body required' });
      const payload = JSON.stringify({ title, body, url: url || '/creator', tag: 'ooedn-creator' });
      let sent = 0, failed = 0;
      const targets = creatorIds
        ? creatorPushSubscriptions.filter(s => creatorIds.includes(s.creatorId))
        : creatorPushSubscriptions;
      await Promise.allSettled(
        targets.map(s =>
          webpush.sendNotification(s.subscription, payload).then(() => sent++).catch(err => {
            failed++;
            console.warn(`[Push] Creator send failed:`, err.statusCode || err.message);
          })
        )
      );
      console.log(`[Push] Creator push: sent=${sent}, failed=${failed}`);
      res.json({ sent, failed });
    } catch (e) {
      console.error('[Push] Creator send error:', e);
      res.status(500).json({ error: 'Failed to send' });
    }
  });

  return router;
}
