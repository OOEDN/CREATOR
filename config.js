// config.js — Single source of truth for all environment variables
// All env vars are loaded here, validated, and exported.
// Import this instead of reading process.env directly.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function env(key, fallback) {
  const val = process.env[key];
  if (val !== undefined) return val;
  if (fallback !== undefined) return fallback;
  return undefined;
}

function requiredInProd(key, fallback) {
  const val = env(key, fallback);
  if (!val && process.env.K_SERVICE) {
    // K_SERVICE is set on Cloud Run — means we're in production
    console.error(`[Config] ⚠️  MISSING required env var: ${key}`);
  }
  return val || fallback;
}

// ═══════════════════════════════════════════════════
// ── Server ──
// ═══════════════════════════════════════════════════

export const config = {
  PORT: env('PORT', 8080),
  CREATOR_MODE: env('CREATOR_MODE') === 'true',
  DB_SOURCE: env('DB_SOURCE', 'dual-write'),

  // Auth
  JWT_SECRET: env('JWT_SECRET', 'ooedn-creator-portal-stable-secret-v18'),
  JWT_EXPIRY: '24h',
  BCRYPT_ROUNDS: 10,
  CLIENT_ID: env('CLIENT_ID', ''),

  // Google Cloud
  GCP_PROJECT: env('GOOGLE_CLOUD_PROJECT') || env('GCP_PROJECT', 'admin-tracker-490321'),
  GCS_BUCKET: env('GCS_BUCKET', 'ooedn-tracker-data'),
  MAIN_BUCKET: 'ai-studio-bucket-850668507460-us-west1',
  GOOGLE_CREDENTIALS_JSON: env('GOOGLE_CREDENTIALS_JSON'),

  // AI
  API_KEY: requiredInProd('API_KEY'),
  VERTEX_LOCATION: 'us-central1',

  // Push Notifications
  VAPID_PUBLIC_KEY: env('VAPID_PUBLIC_KEY', 'BCibI4a7TWgbM97VXFd9u73W-ZwS1FHRLciBfCOPjyMx-CVC8zqQk3DWsoMv-F8eMtR8Fz-2EZ_cJDfdZZgXBCo'),
  VAPID_PRIVATE_KEY: env('VAPID_PRIVATE_KEY', 'z0mdG9UnP7HYufX6x9YIJ6-3cZ4GhnwWm384ad1h2kI'),
  VAPID_EMAIL: env('VAPID_EMAIL', 'mailto:daniel@ooedn.com'),

  // Email
  SMTP_USER: env('SMTP_USER', 'create@ooedn.com'),
  SMTP_PASS: env('SMTP_PASS', ''),
  TEAM_EMAIL: env('TEAM_EMAIL', 'create@ooedn.com'),
};

// ═══════════════════════════════════════════════════
// ── Startup Validation ──
// ═══════════════════════════════════════════════════

const missing = [];
if (!config.API_KEY) missing.push('API_KEY');
if (!config.JWT_SECRET) missing.push('JWT_SECRET');

if (missing.length > 0) {
  console.warn(`[Config] ⚠️  Missing env vars: ${missing.join(', ')} — some features may not work`);
} else {
  console.log('[Config] ✅ All critical env vars loaded');
}

export default config;
