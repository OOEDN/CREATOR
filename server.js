
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webpush from 'web-push';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// --- JSON body parser for API endpoints ---
app.use(express.json());

// --- VAPID Configuration ---
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCibI4a7TWgbM97VXFd9u73W-ZwS1FHRLciBfCOPjyMx-CVC8zqQk3DWsoMv-F8eMtR8Fz-2EZ_cJDfdZZgXBCo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'z0mdG9UnP7HYufX6x9YIJ6-3cZ4GhnwWm384ad1h2kI';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:daniel@ooedn.com';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[Push] VAPID keys configured');
} catch (e) {
  console.warn('[Push] Failed to configure VAPID keys:', e.message);
}

// --- GCS-backed subscription store ---
let pushSubscriptions = [];
const GCS_BUCKET = process.env.GCS_BUCKET || 'ooedn-tracker-data';
const MAIN_BUCKET = 'ai-studio-bucket-850668507460-us-west1';
const SUBS_GCS_PATH = `push_subscriptions.json`;

// Get Cloud Run auth token for GCS access
async function getGCSAuthToken() {
  try {
    // On Cloud Run, get token from metadata server
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.access_token;
    }
  } catch (e) {
    // Not on Cloud Run — try without auth (local dev)
  }
  return null;
}

async function loadSubscriptionsFromGCS() {
  try {
    const token = await getGCSAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    // Try main bucket first (more likely to have permissions)
    const url = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent(SUBS_GCS_PATH)}?alt=media`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      pushSubscriptions = await res.json();
      console.log(`[Push] Loaded ${pushSubscriptions.length} subscriptions from GCS`);
    } else {
      console.log(`[Push] No existing subscriptions in GCS (status: ${res.status})`);
    }
  } catch (e) {
    console.warn('[Push] Could not load subscriptions from GCS:', e.message);
  }
}

async function persistSubscriptions() {
  try {
    const token = await getGCSAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${MAIN_BUCKET}/o?uploadType=media&name=${encodeURIComponent(SUBS_GCS_PATH)}`;
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(pushSubscriptions, null, 2)
    });
    console.log(`[Push] Persisted ${pushSubscriptions.length} subscriptions to GCS`);
  } catch (e) {
    console.warn('[Push] Could not persist subscriptions to GCS:', e.message);
  }
}

// Load on startup
loadSubscriptionsFromGCS();

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '4.33', pushSubscribers: pushSubscriptions.length });
});

// --- Push API Endpoints ---

// Return the public VAPID key to the client
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register a new push subscription
app.post('/api/push/subscribe', (req, res) => {
  try {
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Deduplicate by endpoint
    const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      pushSubscriptions.push(subscription);
      persistSubscriptions();
      console.log(`[Push] New subscription registered. Total: ${pushSubscriptions.length}`);
    }

    res.status(201).json({ success: true, total: pushSubscriptions.length });
  } catch (e) {
    console.error('[Push] Subscribe error:', e);
    res.status(500).json({ error: 'Failed to register subscription' });
  }
});

// Send push notification to all subscribers
app.post('/api/push/send', async (req, res) => {
  try {
    const { title, body, url, tag } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'ooedn-general' });

    let sent = 0;
    let failed = 0;
    const staleEndpoints = [];

    const results = await Promise.allSettled(
      pushSubscriptions.map(sub =>
        webpush.sendNotification(sub, payload).then(() => {
          sent++;
        }).catch(err => {
          failed++;
          // Remove stale subscriptions (410 Gone or 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          }
          console.warn(`[Push] Failed to send to subscriber:`, err.statusCode || err.message);
        })
      )
    );

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      pushSubscriptions = pushSubscriptions.filter(s => !staleEndpoints.includes(s.endpoint));
      persistSubscriptions();
      console.log(`[Push] Removed ${staleEndpoints.length} stale subscriptions`);
    }

    console.log(`[Push] Sent: ${sent}, Failed: ${failed}, Remaining: ${pushSubscriptions.length}`);
    res.json({ sent, failed, remaining: pushSubscriptions.length });
  } catch (e) {
    console.error('[Push] Send error:', e);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// --- Morning Reminder (Google Chat Webhook) ---

const GCHAT_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/AAQA7pMfr0Y/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=xM_-nwUZ71vMuf9A0fJeOVF4pCfjwXlscULolyXpb1U';

// Helper: Fetch master DB from GCS
async function fetchMasterDB() {
  try {
    const bucket = process.env.GCS_BUCKET || 'ooedn-tracker-data';
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/ooedn_master_db.json?alt=media`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[Reminder] Could not fetch master DB:', res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn('[Reminder] Fetch failed:', e.message);
    return null;
  }
}

// Helper: Send message to Google Chat
async function sendToGoogleChat(message) {
  try {
    const res = await fetch(GCHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
    if (!res.ok) {
      console.warn('[Reminder] Webhook failed:', res.status);
      return false;
    }
    console.log('[Reminder] Google Chat message sent');
    return true;
  } catch (e) {
    console.warn('[Reminder] Webhook error:', e.message);
    return false;
  }
}

// Check for today's scheduled content and tasks, send to Google Chat
async function checkAndSendMorningReminder() {
  try {
    const db = await fetchMasterDB();
    if (!db) return { sent: false, reason: 'Could not fetch data' };

    const today = new Date().toISOString().split('T')[0];
    const contentItems = db.contentItems || [];
    const teamTasks = db.teamTasks || [];

    // Find content scheduled for today
    const todayContent = contentItems.filter(c =>
      c.scheduledDate && c.scheduledDate.split('T')[0] === today
    );

    // Find tasks due today
    const todayTasks = teamTasks.filter(t =>
      t.dueDate && t.dueDate.split('T')[0] === today && t.status !== 'Done'
    );

    // Find overdue tasks
    const overdueTasks = teamTasks.filter(t =>
      t.dueDate && t.dueDate.split('T')[0] < today && t.status !== 'Done'
    );

    if (todayContent.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0) {
      console.log('[Reminder] Nothing scheduled for today');
      return { sent: false, reason: 'Nothing scheduled today' };
    }

    // Build the message
    let message = `☀️ *OOEDN Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}*\n\n`;

    if (todayContent.length > 0) {
      message += `📅 *Content to Post Today (${todayContent.length}):*\n`;
      todayContent.forEach(c => {
        const caption = c.caption ? `\n   📝 Caption: _${c.caption.substring(0, 120)}${c.caption.length > 120 ? '...' : ''}_` : '\n   ⚠️ No caption drafted yet!';
        message += `• *${c.title}* by @${c.creatorName || 'Unknown'} on ${c.platform}${caption}\n`;
      });
      message += '\n';
    }

    if (todayTasks.length > 0) {
      message += `📋 *Tasks Due Today (${todayTasks.length}):*\n`;
      todayTasks.forEach(t => {
        message += `• ${t.title} → ${t.assignedTo.split('@')[0]}\n`;
      });
      message += '\n';
    }

    if (overdueTasks.length > 0) {
      message += `🔴 *Overdue Tasks (${overdueTasks.length}):*\n`;
      overdueTasks.forEach(t => {
        message += `• ${t.title} (due ${t.dueDate}) → ${t.assignedTo.split('@')[0]}\n`;
      });
      message += '\n';
    }

    message += `\n🔗 Open Tracker: https://ooedn-tracker-356469728393.us-west1.run.app`;

    const sent = await sendToGoogleChat(message);
    return { sent, todayContent: todayContent.length, todayTasks: todayTasks.length, overdueTasks: overdueTasks.length };
  } catch (e) {
    console.error('[Reminder] Check failed:', e);
    return { sent: false, error: e.message };
  }
}

// Endpoint for Cloud Scheduler or manual trigger
app.get('/api/reminder/morning', async (req, res) => {
  try {
    const result = await checkAndSendMorningReminder();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Auto-schedule: Check every hour, send at 8 AM ET 
let lastReminderDate = null;
setInterval(() => {
  try {
    const now = new Date();
    const etHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    const todayStr = now.toISOString().split('T')[0];

    if (etHour === 8 && lastReminderDate !== todayStr) {
      lastReminderDate = todayStr;
      console.log('[Reminder] 8 AM ET — sending morning briefing');
      checkAndSendMorningReminder();
    }
  } catch (e) {
    console.warn('[Reminder] Scheduler error (non-blocking):', e.message);
  }
}, 60 * 60 * 1000); // Check every hour

// --- Gmail API Proxy (Domain-Wide Delegation) ---
let gmailAuthClient = null;
try {
  let credentials = null;
  const keyPath = path.join(__dirname, 'service-account-key.json');

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else if (fs.existsSync(keyPath)) {
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  }

  if (credentials) {
    // Explicitly use JWT client. GoogleAuth sometimes drops the subject in DWD.
    gmailAuthClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://mail.google.com/'],
      subject: process.env.TEAM_EMAIL || 'create@ooedn.com'
    });
    console.log('[Gmail Proxy] Loaded service account credentials for Domain-Wide Delegation.');
  } else {
    console.warn('[Gmail Proxy] No service-account-key.json found. Shared inbox proxy disabled.');
  }
} catch (e) {
  console.error('[Gmail Proxy] Failed to initialize GoogleAuth:', e);
}

app.use('/api/gmail/*', async (req, res) => {
  if (!gmailAuthClient) {
    return res.status(500).json({ error: 'Gmail proxy not configured on server (missing service account credentials)' });
  }

  try {
    // JWT client handles the access token explicitly
    const tokenInfo = await gmailAuthClient.getAccessToken();
    const token = tokenInfo.token;

    // Construct the real Google API URL by stripping our local prefix
    const targetUrl = `https://gmail.googleapis.com/gmail${req.originalUrl.replace('/api/gmail', '')}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': req.headers['content-type'] || 'application/json'
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const googleRes = await fetch(targetUrl, fetchOptions);
    const data = await googleRes.text();

    res.status(googleRes.status);
    res.set('Content-Type', googleRes.headers.get('content-type'));
    res.send(data);
  } catch (error) {
    console.error('[Gmail Proxy] Error:', error);
    res.status(500).json({ error: error.message || 'Proxy failed' });
  }
});

// --- Static File Serving ---
app.set('etag', false);

app.use(express.static(path.join(__dirname, 'dist'), {
  index: false,
  maxAge: '0',
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Serve service worker from root path (must be at root for scope)
app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, 'dist', 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(swPath);
  } else {
    // Fallback to public folder during dev
    const devPath = path.join(__dirname, 'public', 'sw.js');
    if (fs.existsSync(devPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(devPath);
    } else {
      res.status(404).send('Service worker not found');
    }
  }
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  if (!fs.existsSync(indexPath)) {
    console.error("Dist folder not found!");
    return res.status(500).send('Server Error: App build not found. Container build failed.');
  }

  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Server Error');

    const injection = `
      <script>
        window.env = { 
            API_KEY: "${process.env.API_KEY || ''}",
            CLIENT_ID: "${process.env.CLIENT_ID || ''}"
        };
        window.APP_VERSION = "4.32";
        
        // AUTO-FIX: If the version changed, clear legacy settings to pick up new defaults
        const currentV = localStorage.getItem('ooedn_version');
        if (currentV !== '4.32') {
            console.log('Detected version upgrade to 4.32. Clearing legacy config to restore correct bucket.');
            localStorage.removeItem('ooedn_settings');
            localStorage.setItem('ooedn_version', '4.32');
        }
        
        console.log("OOEDN Tracker v4.32 Loaded");

        // Register Service Worker for Push Notifications
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[Push] Service Worker registered:', reg.scope))
                .catch(err => console.warn('[Push] Service Worker registration failed:', err));
        }
      </script>
    `;

    const result = data.replace('<!--ENV_INJECTION-->', injection);
    res.send(result);
  });
});

app.listen(port, () => {
  console.log(`OOEDN Tracker v4.32 listening on port ${port}`);
  console.log(`[Push] ${pushSubscriptions.length} active push subscriptions`);
});
