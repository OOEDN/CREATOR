
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webpush from 'web-push';
import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

// --- Creator Push Subscriptions ---
let creatorPushSubscriptions = []; // { creatorId, subscription }

// Register a creator's push subscription
app.post('/api/push/subscribe-creator', (req, res) => {
  try {
    const { subscription, creatorId } = req.body;
    if (!subscription || !creatorId) return res.status(400).json({ error: 'subscription and creatorId required' });
    // Remove old subscription for this creator
    creatorPushSubscriptions = creatorPushSubscriptions.filter(s => s.creatorId !== creatorId);
    creatorPushSubscriptions.push({ creatorId, subscription });
    console.log(`[Push] Creator ${creatorId} subscribed. Total creator subs: ${creatorPushSubscriptions.length}`);
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('[Push] Creator subscribe error:', e);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Send push to specific creators
app.post('/api/push/send-creators', async (req, res) => {
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

// Send email to creators
app.post('/api/creator/send-email', async (req, res) => {
  try {
    const { emails, subject, body } = req.body;
    if (!emails?.length || !subject || !body) return res.status(400).json({ error: 'emails, subject, and body required' });
    // Use nodemailer with a simple transporter (configure with real SMTP in production)
    let nodemailer;
    try { nodemailer = await import('nodemailer'); } catch { return res.status(500).json({ error: 'nodemailer not available' }); }
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER || 'noreply@ooedn.com', pass: process.env.SMTP_PASS || '' }
    });
    let sent = 0, failed = 0;
    for (const email of emails) {
      try {
        await transporter.sendMail({
          from: `"OOEDN" <${process.env.SMTP_USER || 'noreply@ooedn.com'}>`,
          to: email, subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#000;padding:24px;border-radius:16px">
              <h1 style="color:#a855f7;font-size:18px;margin:0 0 16px">OOEDN</h1>
              <h2 style="color:#fff;font-size:16px;margin:0 0 12px">${subject}</h2>
              <p style="color:#a3a3a3;font-size:14px;line-height:1.6">${body.replace(/\n/g, '<br>')}</p>
              <hr style="border:1px solid #333;margin:20px 0">
              <p style="color:#525252;font-size:10px">OOEDN Creator Portal</p>
            </div>
          </div>`
        });
        sent++;
      } catch (err) { failed++; console.warn(`[Email] Failed to send to ${email}:`, err.message); }
    }
    console.log(`[Email] Sent: ${sent}, Failed: ${failed}`);
    res.json({ sent, failed });
  } catch (e) {
    console.error('[Email] Send error:', e);
    res.status(500).json({ error: 'Failed to send emails' });
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

// ===================================================================
// CREATOR PORTAL AUTH — Phase 1 Server-Side Authentication
// ===================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'ooedn-creator-portal-secret-' + Date.now();
const JWT_EXPIRY = '24h';
const BCRYPT_ROUNDS = 10;

// --- GCS DB Helpers (server-side) ---

async function readMasterDB() {
  try {
    const token = await getGCSAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const url = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent('ooedn_master_db.json')}?alt=media&t=${Date.now()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[CreatorAuth] Failed to read DB: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('[CreatorAuth] readMasterDB error:', e.message);
    return null;
  }
}

async function writeMasterDB(db) {
  try {
    const token = await getGCSAuthToken();
    if (!token) { console.error('[CreatorAuth] No GCS token for writing'); return false; }

    // SAFEGUARD: Read existing DB to check if we'd be wiping creator accounts
    try {
      const checkUrl = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent('ooedn_master_db.json')}?alt=media&t=${Date.now()}`;
      const checkRes = await fetch(checkUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        const existingAccounts = existing?.creatorAccounts?.length || 0;
        const newAccounts = db?.creatorAccounts?.length || 0;
        const dropped = existingAccounts - newAccounts;
        if (existingAccounts > 2 && newAccounts === 0) {
          // Catastrophic wipe: many accounts → 0. Block and preserve.
          console.error(`[CreatorAuth] ⛔ BLOCKED WRITE: Would wipe ${existingAccounts} creator accounts! Preserving existing accounts.`);
          db.creatorAccounts = existing.creatorAccounts;
        } else if (dropped >= 3) {
          // Large drop (3+) — suspicious, merge to be safe
          console.warn(`[CreatorAuth] ⚠️ Large account drop (${existingAccounts} → ${newAccounts}), merging to be safe`);
          const merged = new Map();
          for (const a of existing.creatorAccounts) merged.set(a.id, a);
          for (const a of (db.creatorAccounts || [])) merged.set(a.id, a);
          db.creatorAccounts = Array.from(merged.values());
        }
      }
    } catch (checkErr) {
      console.warn('[CreatorAuth] Could not verify accounts before write — proceeding with caution');
    }

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${MAIN_BUCKET}/o?uploadType=media&name=${encodeURIComponent('ooedn_master_db.json')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(db)
    });
    if (!res.ok) {
      console.error(`[CreatorAuth] Failed to write DB: ${res.status}`);
      return false;
    }
    console.log('[CreatorAuth] DB written successfully');
    return true;
  } catch (e) {
    console.error('[CreatorAuth] writeMasterDB error:', e.message);
    return false;
  }
}

// --- JWT Auth Middleware ---

function creatorAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.creatorAccountId = decoded.accountId;
    req.creatorEmail = decoded.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Helper: Scope data for a single creator ---

function scopeDataForCreator(db, creatorRecord) {
  if (!creatorRecord) return { creator: null, campaigns: [], contentItems: [], teamMessages: db.teamMessages || [], betaTests: db.betaTests || [], betaReleases: [] };

  const myCampaigns = (db.campaigns || []).filter(c =>
    c.assignedCreatorIds?.includes(creatorRecord.id)
  );

  const myContent = (db.contentItems || []).filter(c =>
    c.creatorId === creatorRecord.id
  );

  const myBetaReleases = (db.betaReleases || []).filter(r =>
    r.creatorId === creatorRecord.id
  );

  return {
    creator: creatorRecord,
    campaigns: myCampaigns,
    contentItems: myContent,
    teamMessages: db.teamMessages || [],
    teamTasks: db.teamTasks || [],
    betaTests: db.betaTests || [],
    betaReleases: myBetaReleases,
  };
}

// --- POST /api/creator/login ---

app.post('/api/creator/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const inputEmail = email.toLowerCase().trim();
    const inputPassword = password.trim();
    const account = accounts.find(a => a.email.toLowerCase() === inputEmail);

    if (!account) {
      console.log(`[CreatorAuth] Login failed — no account for: ${inputEmail}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Support both bcrypt hashed and legacy plain-text passwords
    let passwordValid = false;
    if (account.password.startsWith('$2a$') || account.password.startsWith('$2b$')) {
      // Bcrypt hash — verify properly
      passwordValid = await bcrypt.compare(inputPassword, account.password);
    } else {
      // Legacy plain-text — direct comparison
      passwordValid = account.password === inputPassword;
      // Auto-upgrade: hash the plain-text password on successful login
      if (passwordValid) {
        console.log(`[CreatorAuth] Auto-upgrading plain-text password for: ${inputEmail}`);
        account.password = await bcrypt.hash(inputPassword, BCRYPT_ROUNDS);
        db.creatorAccounts = accounts.map(a => a.id === account.id ? account : a);
        db.lastUpdated = new Date().toISOString();
        db.version = Date.now();
        writeMasterDB(db).catch(e => console.warn('[CreatorAuth] Auto-upgrade write failed:', e));
      }
    }

    if (!passwordValid) {
      console.log(`[CreatorAuth] Login failed — wrong password for: ${inputEmail}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Find the creator record
    const creatorRecord = (db.creators || []).find(c =>
      c.id === account.linkedCreatorId ||
      c.email?.toLowerCase() === account.email.toLowerCase() ||
      c.portalEmail?.toLowerCase() === account.email.toLowerCase()
    );

    // Sign JWT
    const token = jwt.sign(
      { accountId: account.id, email: account.email, creatorId: creatorRecord?.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`[CreatorAuth] ✅ Login success: ${inputEmail}`);

    // Return scoped data — NEVER send other creators' info
    const scopedData = scopeDataForCreator(db, creatorRecord);

    res.json({
      token,
      account: { id: account.id, email: account.email, displayName: account.displayName, onboardingComplete: account.onboardingComplete, betaLabIntroSeen: account.betaLabIntroSeen, linkedCreatorId: account.linkedCreatorId },
      ...scopedData
    });
  } catch (e) {
    console.error('[CreatorAuth] Login error:', e);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// --- POST /api/creator/signup ---

app.post('/api/creator/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const inputEmail = email.toLowerCase().trim();

    if (accounts.find(a => a.email.toLowerCase() === inputEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

    // Create account
    const newAccount = {
      id: crypto.randomUUID(),
      email: inputEmail,
      password: hashedPassword,
      displayName: name.trim(),
      createdAt: new Date().toISOString(),
    };

    // Create creator record
    const newCreator = {
      id: crypto.randomUUID(),
      name: name.trim(),
      handle: '@' + inputEmail.split('@')[0],
      platform: 'Instagram',
      profileImage: '',
      notes: 'Self-registered via Creator Portal',
      status: 'Active',
      paymentStatus: 'Unpaid',
      paymentOptions: [],
      rate: 0,
      email: inputEmail,
      dateAdded: new Date().toISOString(),
      rating: null,
      flagged: false,
      shipmentStatus: 'None',
      role: 'creator',
      portalEmail: inputEmail,
      notificationsEnabled: false,
      totalEarned: 0,
      lastActiveDate: new Date().toISOString(),
    };

    newAccount.linkedCreatorId = newCreator.id;

    db.creatorAccounts = [...accounts, newAccount];
    db.creators = [...(db.creators || []), newCreator];
    db.lastUpdated = new Date().toISOString();
    db.version = Date.now();

    const saved = await writeMasterDB(db);
    if (!saved) return res.status(500).json({ error: 'Failed to save account' });

    // Sign JWT
    const token = jwt.sign(
      { accountId: newAccount.id, email: newAccount.email, creatorId: newCreator.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`[CreatorAuth] ✅ Signup success: ${inputEmail}`);

    const scopedData = scopeDataForCreator(db, newCreator);

    res.status(201).json({
      token,
      account: { id: newAccount.id, email: newAccount.email, displayName: newAccount.displayName, onboardingComplete: false, linkedCreatorId: newCreator.id },
      ...scopedData
    });
  } catch (e) {
    console.error('[CreatorAuth] Signup error:', e);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// --- GET /api/creator/me --- (JWT protected)

app.get('/api/creator/me', creatorAuthMiddleware, async (req, res) => {
  try {
    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const account = accounts.find(a => a.id === req.creatorAccountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const creatorRecord = (db.creators || []).find(c =>
      c.id === account.linkedCreatorId ||
      c.email?.toLowerCase() === account.email.toLowerCase() ||
      c.portalEmail?.toLowerCase() === account.email.toLowerCase()
    );

    const scopedData = scopeDataForCreator(db, creatorRecord);

    res.json({
      account: { id: account.id, email: account.email, displayName: account.displayName, onboardingComplete: account.onboardingComplete, betaLabIntroSeen: account.betaLabIntroSeen, linkedCreatorId: account.linkedCreatorId },
      ...scopedData
    });
  } catch (e) {
    console.error('[CreatorAuth] /me error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- POST /api/creator/invite --- (used by admin to invite creators)

app.post('/api/creator/invite', async (req, res) => {
  try {
    const { email, name, creatorId, plainPassword } = req.body;
    if (!email || !name || !plainPassword) return res.status(400).json({ error: 'Email, name, and password required' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const inputEmail = email.toLowerCase().trim();

    if (accounts.find(a => a.email.toLowerCase() === inputEmail)) {
      return res.status(409).json({ error: 'Account already exists for this email' });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    const newAccount = {
      id: crypto.randomUUID(),
      email: inputEmail,
      password: hashedPassword,
      displayName: name,
      createdAt: new Date().toISOString(),
      linkedCreatorId: creatorId || undefined,
      invitedByTeam: true,
      inviteEmailSent: false,
    };

    db.creatorAccounts = [...accounts, newAccount];

    // Also set portalEmail on the creator record if creatorId provided
    if (creatorId) {
      db.creators = (db.creators || []).map(c =>
        c.id === creatorId ? { ...c, portalEmail: inputEmail } : c
      );
    }

    db.lastUpdated = new Date().toISOString();
    db.version = Date.now();

    const saved = await writeMasterDB(db);
    if (!saved) return res.status(500).json({ error: 'Failed to save account' });

    console.log(`[CreatorAuth] ✅ Invite created for: ${inputEmail} (hashed)`);

    res.status(201).json({ success: true, accountId: newAccount.id });
  } catch (e) {
    console.error('[CreatorAuth] Invite error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- POST /api/creator/migrate-passwords --- (one-time admin utility)

app.post('/api/creator/migrate-passwords', async (req, res) => {
  try {
    const { adminKey } = req.body;
    if (adminKey !== 'ooedn-migrate-2026') return res.status(403).json({ error: 'Unauthorized' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    let migrated = 0;

    for (const account of accounts) {
      if (!account.password.startsWith('$2a$') && !account.password.startsWith('$2b$')) {
        account.password = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
        migrated++;
      }
    }

    if (migrated > 0) {
      db.creatorAccounts = accounts;
      db.lastUpdated = new Date().toISOString();
      db.version = Date.now();
      await writeMasterDB(db);
    }

    console.log(`[CreatorAuth] Migrated ${migrated}/${accounts.length} passwords to bcrypt`);
    res.json({ success: true, migrated, total: accounts.length });
  } catch (e) {
    console.error('[CreatorAuth] Migration error:', e);
    res.status(500).json({ error: 'Migration failed' });
  }
});

// --- POST /api/creator/reset-password --- (admin utility)
app.post('/api/creator/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: 'email and newPassword required' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase().trim());
    if (!account) return res.status(404).json({ error: `No account found for ${email}` });

    account.password = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
    db.creatorAccounts = accounts.map(a => a.id === account.id ? account : a);
    db.lastUpdated = new Date().toISOString();
    db.version = Date.now();

    const saved = await writeMasterDB(db);
    if (!saved) return res.status(500).json({ error: 'Failed to save' });

    console.log(`[CreatorAuth] ✅ Password reset for: ${email}`);
    res.json({ success: true, email, accountId: account.id });
  } catch (e) {
    console.error('[CreatorAuth] Reset password error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- POST /api/creator/delete-account --- (admin utility)
app.post('/api/creator/delete-account', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const before = (db.creatorAccounts || []).length;
    db.creatorAccounts = (db.creatorAccounts || []).filter(a => a.email.toLowerCase() !== email.toLowerCase().trim());
    const after = db.creatorAccounts.length;

    if (before === after) return res.status(404).json({ error: `No account found for ${email}` });

    db.lastUpdated = new Date().toISOString();
    db.version = Date.now();
    const saved = await writeMasterDB(db);
    if (!saved) return res.status(500).json({ error: 'Failed to save' });

    console.log(`[CreatorAuth] 🗑️ Deleted account: ${email}`);
    res.json({ success: true, deleted: email, remaining: after });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- POST /api/creator/debug-login --- (debug: test password without logging in)
app.post('/api/creator/debug-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'DB unavailable' });

    const account = (db.creatorAccounts || []).find(a => a.email.toLowerCase() === email.toLowerCase().trim());
    if (!account) return res.json({ found: false, message: 'No account found' });

    const storedHash = account.password;
    const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$');
    const inputTrimmed = password.trim();

    let result = false;
    if (isBcrypt) {
      result = await bcrypt.compare(inputTrimmed, storedHash);
    } else {
      result = storedHash === inputTrimmed;
    }

    res.json({
      found: true,
      email: account.email,
      isBcrypt,
      hashPrefix: storedHash.substring(0, 10) + '...',
      inputLength: inputTrimmed.length,
      passwordMatch: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- GET /api/creator/accounts-check --- (admin debug - no passwords)
app.get('/api/creator/accounts-check', async (req, res) => {
  try {
    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });
    const accounts = (db.creatorAccounts || []).map(a => ({
      id: a.id, email: a.email, displayName: a.displayName, createdAt: a.createdAt,
      linkedCreatorId: a.linkedCreatorId, invitedByTeam: a.invitedByTeam,
      hasHashedPassword: a.password?.startsWith('$2') || false
    }));
    res.json({ count: accounts.length, accounts });
  } catch (e) {
    res.status(500).json({ error: 'Failed to check accounts' });
  }
});

// --- POST /api/creator/save --- (JWT protected, creator writes their own changes)

app.post('/api/creator/save', creatorAuthMiddleware, async (req, res) => {
  try {
    const { updates } = req.body; // { creator?, content?, messages?, campaigns?, betaReleases?, account? }
    if (!updates) return res.status(400).json({ error: 'No updates provided' });

    const db = await readMasterDB();
    if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

    const accounts = db.creatorAccounts || [];
    const account = accounts.find(a => a.id === req.creatorAccountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Only allow updating the creator's OWN data
    if (updates.creator && account.linkedCreatorId) {
      db.creators = (db.creators || []).map(c =>
        c.id === account.linkedCreatorId ? { ...c, ...updates.creator } : c
      );
    }

    // Content: only add/update items owned by this creator
    if (updates.contentItems) {
      const existingIds = new Set((db.contentItems || []).map(c => c.id));
      for (const item of updates.contentItems) {
        if (item.creatorId !== account.linkedCreatorId) continue; // Safety: only own content
        if (existingIds.has(item.id)) {
          db.contentItems = db.contentItems.map(c => c.id === item.id ? { ...c, ...item } : c);
        } else {
          db.contentItems = [...(db.contentItems || []), item];
        }
      }
    }

    // Messages: append new messages from this creator
    if (updates.teamMessages) {
      const existingMsgIds = new Set((db.teamMessages || []).map(m => m.id));
      const newMessages = updates.teamMessages.filter(m => !existingMsgIds.has(m.id));
      db.teamMessages = [...(db.teamMessages || []), ...newMessages];
    }

    // Beta releases: update only this creator's entries
    if (updates.betaReleases) {
      for (const release of updates.betaReleases) {
        if (release.creatorId !== account.linkedCreatorId) continue;
        const existing = (db.betaReleases || []).find(r => r.id === release.id);
        if (existing) {
          db.betaReleases = db.betaReleases.map(r => r.id === release.id ? { ...r, ...release } : r);
        } else {
          db.betaReleases = [...(db.betaReleases || []), release];
        }
      }
    }

    // Campaigns: only allow updating acceptedByCreatorIds (accepting a campaign)
    if (updates.campaigns) {
      for (const campaign of updates.campaigns) {
        db.campaigns = (db.campaigns || []).map(c =>
          c.id === campaign.id ? { ...c, acceptedByCreatorIds: campaign.acceptedByCreatorIds } : c
        );
      }
    }

    // Account updates (onboarding, betaLabIntro)
    if (updates.account) {
      db.creatorAccounts = (db.creatorAccounts || []).map(a =>
        a.id === req.creatorAccountId ? { ...a, ...updates.account, password: a.password } : a
      );
    }

    db.lastUpdated = new Date().toISOString();
    db.version = Date.now();

    const saved = await writeMasterDB(db);
    if (!saved) return res.status(500).json({ error: 'Failed to save' });

    res.json({ success: true });
  } catch (e) {
    console.error('[CreatorAuth] Save error:', e);
    res.status(500).json({ error: 'Server error during save' });
  }
});

console.log('[CreatorAuth] Creator Portal auth endpoints registered');

// --- CREATOR_MODE: serve creator-only build or full admin build ---
const CREATOR_MODE = process.env.CREATOR_MODE === 'true';
const DIST_DIR = CREATOR_MODE ? 'dist-creator' : 'dist';
const INDEX_HTML = CREATOR_MODE ? 'creator-index.html' : 'index.html';

// --- Static File Serving ---
app.set('etag', false);

app.use(express.static(path.join(__dirname, DIST_DIR), {
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
  const swPath = path.join(__dirname, DIST_DIR, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(swPath);
  } else {
    const devPath = path.join(__dirname, 'public', 'sw.js');
    if (fs.existsSync(devPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(devPath);
    } else {
      res.status(404).send('Service worker not found');
    }
  }
});

// In creator mode, redirect root to /creator
if (CREATOR_MODE) {
  app.get('/', (req, res) => {
    res.redirect('/creator');
  });
}

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, DIST_DIR, INDEX_HTML);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  if (!fs.existsSync(indexPath)) {
    console.error(`${DIST_DIR} folder not found!`);
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
        
        const currentV = localStorage.getItem('ooedn_version');
        if (currentV !== '4.32') {
            console.log('Detected version upgrade to 4.32. Clearing legacy config to restore correct bucket.');
            localStorage.removeItem('ooedn_settings');
            localStorage.setItem('ooedn_version', '4.32');
        }
        
        console.log("${CREATOR_MODE ? 'OOEDN Creator Portal' : 'OOEDN Tracker'} v4.32 Loaded");

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
  console.log(`${CREATOR_MODE ? 'OOEDN Creator Portal' : 'OOEDN Tracker'} v4.32 listening on port ${port}`);
  if (!CREATOR_MODE) {
    console.log(`[Push] ${pushSubscriptions.length} active push subscriptions`);
  }
});


