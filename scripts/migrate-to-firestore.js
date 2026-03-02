#!/usr/bin/env node
/**
 * OOEDN Phase 2 — Migration Script
 * Reads ooedn_master_db.json from GCS and writes to Firestore named database "ooedn"
 * 
 * IMPORTANT: This script uses the named database "ooedn" on project "kinetix-ooedn".
 *            It does NOT touch the "(default)" database (which belongs to KINETIX).
 * 
 * Usage:
 *   node scripts/migrate-to-firestore.js              # dry run (read-only, shows counts)
 *   node scripts/migrate-to-firestore.js --execute     # actually writes to Firestore
 *   node scripts/migrate-to-firestore.js --verify      # compare Firestore counts vs JSON
 */

import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const PROJECT_ID = 'kinetix-ooedn';
const DATABASE_ID = 'ooedn';                    // Named database — NOT "(default)"
const GCS_BUCKET = 'ai-studio-bucket-850668507460-us-west1';
const GCS_FILE = 'ooedn_master_db.json';
const BATCH_SIZE = 400;                          // Firestore limit is 500, keep headroom

const MODE = process.argv.includes('--execute') ? 'execute'
    : process.argv.includes('--verify') ? 'verify'
        : 'dry-run';

// --- FIRESTORE CLIENT ---
const firestore = new Firestore({
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
});

// --- COLLECTIONS TO MIGRATE ---
const COLLECTIONS = [
    { name: 'creators', key: 'creators' },
    { name: 'campaigns', key: 'campaigns' },
    { name: 'contentItems', key: 'contentItems' },
    { name: 'teamMessages', key: 'teamMessages' },
    { name: 'teamTasks', key: 'teamTasks' },
    { name: 'creatorAccounts', key: 'creatorAccounts' },
    { name: 'betaTests', key: 'betaTests' },
    { name: 'betaReleases', key: 'betaReleases' },
];

// --- FETCH JSON FROM GCS ---
async function fetchMasterDB() {
    console.log(`📥 Fetching ${GCS_FILE} from GCS bucket ${GCS_BUCKET}...`);

    // Try local backup first (for offline/testing)
    const localPath = path.join(__dirname, '..', 'backups', 'master-db-PRE-PHASE2.json');
    if (fs.existsSync(localPath)) {
        console.log(`   Using local backup: ${localPath}`);
        return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    }

    // Fetch from GCS using metadata server token (when running on Cloud Run or with gcloud auth)
    let token = null;
    try {
        const tokenRes = await fetch(
            'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
            { headers: { 'Metadata-Flavor': 'Google' } }
        );
        if (tokenRes.ok) {
            const data = await tokenRes.json();
            token = data.access_token;
        }
    } catch {
        // Not on Cloud Run — try gcloud auth
        const { execSync } = await import('child_process');
        try {
            token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
        } catch {
            console.error('❌ Cannot get auth token. Run: gcloud auth login');
            process.exit(1);
        }
    }

    const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(GCS_FILE)}?alt=media`;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) {
        console.error(`❌ Failed to fetch DB: ${res.status} ${res.statusText}`);
        process.exit(1);
    }
    return res.json();
}

// --- WRITE COLLECTION IN BATCHES ---
async function writeCollection(collectionName, items) {
    if (!items || items.length === 0) {
        console.log(`   ⏭️  ${collectionName}: 0 items (skipped)`);
        return 0;
    }

    let written = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = firestore.batch();
        const chunk = items.slice(i, i + BATCH_SIZE);

        for (const item of chunk) {
            if (!item.id) {
                console.warn(`   ⚠️  ${collectionName}: item missing id, skipping`, JSON.stringify(item).slice(0, 100));
                continue;
            }
            const docRef = firestore.collection(collectionName).doc(item.id);
            batch.set(docRef, item, { merge: true }); // merge = idempotent
        }

        await batch.commit();
        written += chunk.length;
        process.stdout.write(`   ✅ ${collectionName}: ${written}/${items.length}\r`);
    }

    console.log(`   ✅ ${collectionName}: ${written} documents written`);
    return written;
}

// --- VERIFY COUNTS ---
async function verifyCollection(collectionName, expectedCount) {
    const snapshot = await firestore.collection(collectionName).count().get();
    const actual = snapshot.data().count;
    const match = actual === expectedCount;
    console.log(`   ${match ? '✅' : '❌'} ${collectionName}: expected ${expectedCount}, got ${actual}`);
    return match;
}

// --- WRITE APP METADATA ---
async function writeAppMeta(db) {
    const meta = {
        version: db.version || Date.now(),
        lastUpdated: db.lastUpdated || new Date().toISOString(),
        brandInfo: db.brandInfo || '',
        lastBackupDate: db.lastBackupDate || '',
        migratedAt: new Date().toISOString(),
        migratedFrom: 'ooedn_master_db.json',
    };
    await firestore.collection('appMeta').doc('state').set(meta, { merge: true });
    console.log(`   ✅ appMeta/state: metadata written`);
}

// --- MAIN ---
async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  OOEDN Phase 2 — Firestore Migration');
    console.log(`  Project:  ${PROJECT_ID}`);
    console.log(`  Database: ${DATABASE_ID}`);
    console.log(`  Mode:     ${MODE.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // 1. Fetch the JSON
    const db = await fetchMasterDB();

    // 2. Show counts
    console.log('📊 Source data counts:');
    const counts = {};
    for (const col of COLLECTIONS) {
        const items = db[col.key] || [];
        counts[col.name] = items.length;
        console.log(`   ${col.name}: ${items.length}`);
    }
    console.log('');

    if (MODE === 'dry-run') {
        console.log('🔍 DRY RUN — No data written. Use --execute to write to Firestore.');
        console.log('');
        return;
    }

    if (MODE === 'verify') {
        console.log('🔍 VERIFY — Comparing Firestore counts to source JSON...');
        let allMatch = true;
        for (const col of COLLECTIONS) {
            const match = await verifyCollection(col.name, counts[col.name]);
            if (!match) allMatch = false;
        }
        console.log('');
        console.log(allMatch ? '✅ All counts match!' : '❌ Some counts do not match — review above.');
        return;
    }

    // MODE === 'execute'
    console.log('🚀 EXECUTING — Writing to Firestore...');
    console.log('');

    let totalWritten = 0;
    for (const col of COLLECTIONS) {
        const items = db[col.key] || [];
        const written = await writeCollection(col.name, items);
        totalWritten += written;
    }

    // Write metadata
    await writeAppMeta(db);

    console.log('');
    console.log(`✅ Migration complete! ${totalWritten} documents written across ${COLLECTIONS.length} collections.`);
    console.log('');

    // Auto-verify
    console.log('🔍 Verifying...');
    let allMatch = true;
    for (const col of COLLECTIONS) {
        const match = await verifyCollection(col.name, counts[col.name]);
        if (!match) allMatch = false;
    }
    console.log('');
    console.log(allMatch ? '✅ Verification passed!' : '❌ Verification failed — review above.');
}

main().catch(e => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
});
