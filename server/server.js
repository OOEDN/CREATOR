
import { config } from './config.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webpush from 'web-push';
import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as firestoreDAL from '../shared/services/firestore.js';

// --- Route Modules ---
import createAiRoutes from './routes/aiRoutes.js';
import createPushRoutes from './routes/pushRoutes.js';
import createEmailRoutes from './routes/emailRoutes.js';
import createCreatorAuthRoutes from './routes/creatorAuthRoutes.js';
import createCreatorContentRoutes from './routes/creatorContentRoutes.js';
import createRealtimeRoutes from './routes/realtimeRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const app = express();
const port = config.PORT;

// --- JSON body parser for API endpoints ---
app.use(express.json({ limit: '50mb' }));

// ═══════════════════════════════════════════════════
// ── VAPID Configuration ──
// ═══════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = config.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = config.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = config.VAPID_EMAIL;

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[Push] VAPID keys configured');
} catch (e) {
  console.warn('[Push] Failed to configure VAPID keys:', e.message);
}

// ═══════════════════════════════════════════════════
// ── GCS Helpers ──
// ═══════════════════════════════════════════════════

let pushSubscriptions = [];
const GCS_BUCKET = config.GCS_BUCKET;
const MAIN_BUCKET = config.MAIN_BUCKET;
const SUBS_GCS_PATH = `push_subscriptions.json`;

async function getGCSAuthToken() {
  try {
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

// ═══════════════════════════════════════════════════
// ── Health Check ──
// ═══════════════════════════════════════════════════

app.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    firestore: 'unknown',
    geminiApi: 'unknown',
    gmailProxy: gmailAuthClient ? 'configured' : 'not configured',
  };

  // Check Firestore
  try {
    await firestoreDAL.loadAllData();
    checks.firestore = 'ok';
  } catch (e) {
    checks.firestore = `error: ${e.message?.substring(0, 80)}`;
  }

  // Check Gemini API key is set
  checks.geminiApi = config.API_KEY ? 'key set' : 'missing API_KEY';

  const allOk = checks.firestore === 'ok' && checks.geminiApi === 'key set';

  res.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '4.33',
    pushSubscribers: pushSubscriptions.length,
    checks,
  });
});

// ═══════════════════════════════════════════════════
// ── Gmail Auth Client (Domain-Wide Delegation) ──
// ═══════════════════════════════════════════════════

let gmailAuthClient = null;
try {
  let credentials = null;
  const keyPath = path.join(PROJECT_ROOT, 'service-account-key.json');

  if (config.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(config.GOOGLE_CREDENTIALS_JSON);
  } else if (fs.existsSync(keyPath)) {
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  }

  if (credentials) {
    gmailAuthClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://mail.google.com/'],
      subject: config.TEAM_EMAIL
    });
    console.log('[Gmail Proxy] Loaded service account credentials for Domain-Wide Delegation.');
  } else {
    console.warn('[Gmail Proxy] No service-account-key.json found. Shared inbox proxy disabled.');
  }
} catch (e) {
  console.error('[Gmail Proxy] Failed to initialize GoogleAuth:', e);
}

// ═══════════════════════════════════════════════════
// ── DB Helpers: Dual-Mode (GCS ↔ Firestore) ──
// ═══════════════════════════════════════════════════

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRY = config.JWT_EXPIRY;
const BCRYPT_ROUNDS = config.BCRYPT_ROUNDS;

const DB_SOURCE = config.DB_SOURCE;
console.log(`[DB] Source mode: ${DB_SOURCE}`);

async function readMasterDB_GCS() {
  try {
    const token = await getGCSAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const url = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent('ooedn_master_db.json')}?alt=media&t=${Date.now()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) { console.error(`[DB] GCS read failed: ${res.status}`); return null; }
    return await res.json();
  } catch (e) {
    console.error('[DB] GCS readMasterDB error:', e.message);
    return null;
  }
}

async function writeMasterDB_GCS(db) {
  try {
    const token = await getGCSAuthToken();
    if (!token) { console.error('[DB] No GCS token for writing'); return false; }

    // SAFEGUARD: NEVER allow account count to decrease — always merge
    try {
      const checkUrl = `https://storage.googleapis.com/storage/v1/b/${MAIN_BUCKET}/o/${encodeURIComponent('ooedn_master_db.json')}?alt=media&t=${Date.now()}`;
      const checkRes = await fetch(checkUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        const existingAccounts = existing?.creatorAccounts || [];
        const newAccounts = db?.creatorAccounts || [];
        if (existingAccounts.length > 0 && newAccounts.length < existingAccounts.length) {
          console.warn(`[DB] 🔒 Account protection: merging ${existingAccounts.length} existing + ${newAccounts.length} incoming accounts`);
          const merged = new Map();
          for (const a of existingAccounts) merged.set(a.id, a);
          for (const a of newAccounts) merged.set(a.id, a);
          db.creatorAccounts = Array.from(merged.values());
          console.log(`[DB] 🔒 Result: ${db.creatorAccounts.length} accounts preserved`);
        }
      }
    } catch (checkErr) {
      console.warn('[DB] Could not verify accounts before write');
    }

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${MAIN_BUCKET}/o?uploadType=media&name=${encodeURIComponent('ooedn_master_db.json')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
    if (!res.ok) { console.error(`[DB] GCS write failed: ${res.status}`); return false; }
    return true;
  } catch (e) {
    console.error('[DB] GCS writeMasterDB error:', e.message);
    return false;
  }
}

async function readMasterDB_Firestore() {
  try { return await firestoreDAL.loadAllData(); }
  catch (e) { console.error('[DB] Firestore readMasterDB error:', e.message); return null; }
}

async function writeMasterDB_Firestore(db) {
  try { await firestoreDAL.saveAllData(db); return true; }
  catch (e) { console.error('[DB] Firestore writeMasterDB error:', e.message); return false; }
}

async function readMasterDB() {
  if (DB_SOURCE === 'firestore') return readMasterDB_Firestore();
  const gcsData = await readMasterDB_GCS();
  if (gcsData) return gcsData;
  console.log('[DB] GCS read failed, falling back to Firestore...');
  return readMasterDB_Firestore();
}

async function writeMasterDB(db) {
  if (DB_SOURCE === 'gcs') return writeMasterDB_GCS(db);
  if (DB_SOURCE === 'firestore') return writeMasterDB_Firestore(db);
  const [gcsResult, fsResult] = await Promise.all([writeMasterDB_GCS(db), writeMasterDB_Firestore(db)]);
  if (!gcsResult) console.warn('[DB] Dual-write: GCS write failed');
  if (!fsResult) console.warn('[DB] Dual-write: Firestore write failed');
  return gcsResult || fsResult;
}

// ═══════════════════════════════════════════════════
// ── JWT Auth Middleware ──
// ═══════════════════════════════════════════════════

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

function scopeDataForCreator(db, creatorRecord) {
  if (!creatorRecord) return { creator: null, campaigns: [], contentItems: [], teamMessages: db.teamMessages || [], betaTests: db.betaTests || [], betaReleases: [] };
  const myCampaigns = (db.campaigns || []).filter(c => (c.assignedCreatorIds?.includes(creatorRecord.id) || c.status === 'Final Campaign') && c.status !== 'Paused');
  const myContent = (db.contentItems || []).filter(c => c.creatorId === creatorRecord.id);
  const myBetaReleases = (db.betaReleases || []).filter(r => r.creatorId === creatorRecord.id);
  return {
    creator: creatorRecord, campaigns: myCampaigns, contentItems: myContent,
    teamMessages: db.teamMessages || [], teamTasks: db.teamTasks || [],
    betaTests: db.betaTests || [], betaReleases: myBetaReleases,
  };
}

// ═══════════════════════════════════════════════════
// ── Mount Route Modules ──
// ═══════════════════════════════════════════════════

const sharedDeps = { firestoreDAL, bcrypt, jwt, JWT_SECRET, JWT_EXPIRY, BCRYPT_ROUNDS, readMasterDB, writeMasterDB, readMasterDB_GCS, writeMasterDB_GCS, scopeDataForCreator, creatorAuthMiddleware, getGCSAuthToken, MAIN_BUCKET, gmailAuthClient };

app.use('/api/push', createPushRoutes(webpush, {
  getSubscriptions: () => pushSubscriptions,
  setSubscriptions: (subs) => { pushSubscriptions = subs; },
  persistSubscriptions,
  VAPID_PUBLIC_KEY,
}));

app.use('/api/ai', createAiRoutes(firestoreDAL));

app.use('/api', createEmailRoutes({ gmailAuthClient, getGCSAuthToken, MAIN_BUCKET }));

app.use('/api/creator', createCreatorAuthRoutes(sharedDeps));

app.use('/api', createCreatorContentRoutes(sharedDeps));

app.use('/api/realtime', createRealtimeRoutes(firestoreDAL));

console.log('[Server] All route modules mounted (including SSE realtime)');
console.log('[CreatorAuth] Creator Portal auth endpoints registered');

// ═══════════════════════════════════════════════════
// ── Direct Firestore Message Poll (for team app) ──
// ═══════════════════════════════════════════════════
// The team app reads from GCS, but the creator service may not have GCS write access
// (different GCP project). Messages always reach Firestore correctly.
// This endpoint lets the team app poll Firestore directly for new messages.
app.get('/api/messages/poll', async (req, res) => {
  try {
    const messages = await firestoreDAL.getAllMessages();
    res.json({ teamMessages: messages });
  } catch (e) {
    console.error('[MessagePoll] Error:', e.message);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ═══════════════════════════════════════════════════
// ── Static File Serving ──
// ═══════════════════════════════════════════════════

const CREATOR_MODE = config.CREATOR_MODE;
const DIST_DIR = CREATOR_MODE ? 'dist-creator' : 'dist';
const INDEX_HTML = CREATOR_MODE ? 'apps/creator/index.html' : 'apps/team/index.html';

app.set('etag', false);

app.use(express.static(path.join(PROJECT_ROOT, DIST_DIR), {
  index: false,
  maxAge: '0',
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.get('/sw.js', (req, res) => {
  const swPath = path.join(PROJECT_ROOT, DIST_DIR, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(swPath);
  } else {
    const devPath = path.join(PROJECT_ROOT, 'public', 'sw.js');
    if (fs.existsSync(devPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(devPath);
    } else {
      res.status(404).send('Service worker not found');
    }
  }
});

if (CREATOR_MODE) {
  app.get('/', (req, res) => {
    res.redirect('/creator');
  });
}

app.get('*', (req, res) => {
  const indexPath = path.join(PROJECT_ROOT, DIST_DIR, INDEX_HTML);

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
            CLIENT_ID: "${config.CLIENT_ID}"
        };
        window.APP_VERSION = "4.33";
        
        const currentV = localStorage.getItem('ooedn_version');
        if (currentV !== '4.33') {
            console.log('Detected version upgrade to 4.33. Clearing legacy config.');
            localStorage.removeItem('ooedn_settings');
            localStorage.setItem('ooedn_version', '4.33');
        }
        
        console.log("${CREATOR_MODE ? 'OOEDN Creator Portal' : 'OOEDN Tracker'} v4.33 Loaded");

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
  console.log(`${CREATOR_MODE ? 'OOEDN Creator Portal' : 'OOEDN Tracker'} v4.33 listening on port ${port}`);
  if (!CREATOR_MODE) {
    console.log(`[Push] ${pushSubscriptions.length} active push subscriptions`);
  }
});
