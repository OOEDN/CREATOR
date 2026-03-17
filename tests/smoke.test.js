// tests/smoke.test.js — Smoke tests to verify critical functionality
// Run with: node tests/smoke.test.js
// These tests start the server, verify endpoints, and shut down.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = 9999; // Avoid conflicts with dev server on 8080
let serverProcess = null;
let passed = 0;
let failed = 0;

function log(icon, msg) { console.log(`${icon}  ${msg}`); }

async function fetchJSON(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`http://localhost:${PORT}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    log('✅', name);
  } catch (e) {
    failed++;
    log('❌', `${name} — ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Start Server ──

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), DB_SOURCE: 'firestore' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('listening on port')) resolve();
    });
    serverProcess.stderr.on('data', (data) => {
      output += data.toString();
      if (output.includes('listening on port')) resolve();
    });

    setTimeout(() => reject(new Error('Server failed to start within 15s')), 15000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ── Tests ──

async function runTests() {
  log('🔧', 'Starting server...');

  try {
    await startServer();
    log('🟢', `Server running on port ${PORT}\n`);
  } catch (e) {
    log('💥', `Server failed to start: ${e.message}`);
    process.exit(1);
  }

  // 1. Health check
  await test('Health endpoint responds', async () => {
    const { status, body } = await fetchJSON('/health');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.status === 'ok' || body.status === 'degraded', `Expected ok/degraded, got ${body.status}`);
    assert(body.checks, 'Expected checks object in health response');
  });

  // 2. Login endpoint exists (should return 400 without credentials, not 404)
  await test('Login endpoint exists', async () => {
    const { status } = await fetchJSON('/api/creator/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(status === 400, `Expected 400 (missing creds), got ${status}`);
  });

  // 3. Invite endpoint exists (should return 400 without data, not 404)
  await test('Invite endpoint exists', async () => {
    const { status } = await fetchJSON('/api/creator/invite', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(status === 400, `Expected 400 (missing data), got ${status}`);
  });

  // 4. AI generate endpoint exists (should return 400 without prompt, not 404)
  await test('AI generate endpoint exists', async () => {
    const { status } = await fetchJSON('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(status === 400, `Expected 400 (missing prompt), got ${status}`);
  });

  // 5. Accounts check endpoint works
  await test('Accounts check endpoint responds', async () => {
    const { status, body } = await fetchJSON('/api/creator/accounts-check');
    assert(status === 200 || status === 500, `Expected 200 or 500, got ${status}`);
  });

  // Done
  console.log(`\n${'═'.repeat(40)}`);
  log('📊', `Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);

  stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  log('💥', `Test runner error: ${e.message}`);
  stopServer();
  process.exit(1);
});
