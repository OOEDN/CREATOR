/**
 * OOEDN Firestore Data Access Layer
 * 
 * IMPORTANT: Uses named database "ooedn" on project "kinetix-ooedn"
 *            NEVER uses "(default)" — that belongs to KINETIX.
 * 
 * See: infrastructure_map.md for full project layout.
 */

import { Firestore, FieldValue } from '@google-cloud/firestore';

// --- CONFIG ---
const PROJECT_ID = 'kinetix-ooedn';
const DATABASE_ID = 'ooedn';

let _db = null;

/**
 * Get or initialize the Firestore client.
 * Always targets the named "ooedn" database.
 */
export function getFirestore() {
    if (!_db) {
        _db = new Firestore({
            projectId: PROJECT_ID,
            databaseId: DATABASE_ID,
        });
        console.log(`[Firestore] Connected to project=${PROJECT_ID} database=${DATABASE_ID}`);
    }
    return _db;
}

// ===================================================================
// CREATOR ACCOUNTS
// ===================================================================

export async function getAccountById(id) {
    const doc = await getFirestore().collection('creatorAccounts').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getAccountByEmail(email) {
    const snapshot = await getFirestore()
        .collection('creatorAccounts')
        .where('email', '==', email.trim().toLowerCase())
        .limit(1)
        .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

export async function addAccount(account) {
    await getFirestore().collection('creatorAccounts').doc(account.id).set(account);
    return account;
}

export async function updateAccount(id, fields) {
    await getFirestore().collection('creatorAccounts').doc(id).update(fields);
}

export async function deleteAccount(id) {
    await getFirestore().collection('creatorAccounts').doc(id).delete();
}

export async function getAllAccounts() {
    const snapshot = await getFirestore().collection('creatorAccounts').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ===================================================================
// CREATORS
// ===================================================================

export async function getCreator(id) {
    const doc = await getFirestore().collection('creators').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getAllCreators() {
    const snapshot = await getFirestore().collection('creators').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addCreator(creator) {
    await getFirestore().collection('creators').doc(creator.id).set(creator);
    return creator;
}

export async function updateCreator(id, fields) {
    await getFirestore().collection('creators').doc(id).update(fields);
}

export async function deleteCreator(id) {
    await getFirestore().collection('creators').doc(id).delete();
}

// ===================================================================
// CAMPAIGNS
// ===================================================================

export async function getCampaign(id) {
    const doc = await getFirestore().collection('campaigns').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getAllCampaigns() {
    const snapshot = await getFirestore().collection('campaigns').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCampaignsForCreator(creatorId) {
    const snapshot = await getFirestore()
        .collection('campaigns')
        .where('assignedCreatorIds', 'array-contains', creatorId)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateCampaign(id, fields) {
    await getFirestore().collection('campaigns').doc(id).update(fields);
}

export async function addCampaign(campaign) {
    await getFirestore().collection('campaigns').doc(campaign.id).set(campaign);
    return campaign;
}

// ===================================================================
// CONTENT ITEMS
// ===================================================================

export async function getContentItem(id) {
    const doc = await getFirestore().collection('contentItems').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getAllContentItems() {
    const snapshot = await getFirestore().collection('contentItems').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getContentForCreator(creatorId) {
    const snapshot = await getFirestore()
        .collection('contentItems')
        .where('creatorId', '==', creatorId)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addContentItem(item) {
    await getFirestore().collection('contentItems').doc(item.id).set(item);
    return item;
}

export async function updateContentItem(id, fields) {
    await getFirestore().collection('contentItems').doc(id).update(fields);
}

export async function deleteContentItem(id) {
    await getFirestore().collection('contentItems').doc(id).delete();
}

// ===================================================================
// TEAM MESSAGES
// ===================================================================

export async function getAllMessages() {
    const snapshot = await getFirestore().collection('teamMessages').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMessagesForCreator(creatorId) {
    const snapshot = await getFirestore()
        .collection('teamMessages')
        .where('creatorId', '==', creatorId)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addMessage(message) {
    await getFirestore().collection('teamMessages').doc(message.id).set(message);
    return message;
}

// ===================================================================
// TEAM TASKS
// ===================================================================

export async function getAllTasks() {
    const snapshot = await getFirestore().collection('teamTasks').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addTask(task) {
    await getFirestore().collection('teamTasks').doc(task.id).set(task);
    return task;
}

export async function updateTask(id, fields) {
    await getFirestore().collection('teamTasks').doc(id).update(fields);
}

// ===================================================================
// BETA TESTS & RELEASES
// ===================================================================

export async function getAllBetaTests() {
    const snapshot = await getFirestore().collection('betaTests').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllBetaReleases() {
    const snapshot = await getFirestore().collection('betaReleases').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getBetaReleasesForCreator(creatorId) {
    const snapshot = await getFirestore()
        .collection('betaReleases')
        .where('creatorId', '==', creatorId)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addBetaRelease(release) {
    await getFirestore().collection('betaReleases').doc(release.id).set(release);
    return release;
}

export async function updateBetaRelease(id, fields) {
    await getFirestore().collection('betaReleases').doc(id).update(fields);
}

// ===================================================================
// APP METADATA
// ===================================================================

export async function getAppMeta() {
    const doc = await getFirestore().collection('appMeta').doc('state').get();
    return doc.exists ? doc.data() : { version: 0, lastUpdated: new Date().toISOString() };
}

export async function updateAppMeta(fields) {
    await getFirestore().collection('appMeta').doc('state').set(fields, { merge: true });
}

// ===================================================================
// BULK OPERATIONS (for admin sync)
// ===================================================================

/**
 * Load all data for admin app (replaces readMasterDB)
 */
export async function loadAllData() {
    const [creators, campaigns, contentItems, teamMessages, teamTasks, creatorAccounts, betaTests, betaReleases, appMeta] = await Promise.all([
        getAllCreators(),
        getAllCampaigns(),
        getAllContentItems(),
        getAllMessages(),
        getAllTasks(),
        getAllAccounts(),
        getAllBetaTests(),
        getAllBetaReleases(),
        getAppMeta(),
    ]);

    return {
        creators,
        campaigns,
        contentItems,
        teamMessages,
        teamTasks,
        creatorAccounts,
        betaTests,
        betaReleases,
        version: appMeta.version || Date.now(),
        lastUpdated: appMeta.lastUpdated || new Date().toISOString(),
        brandInfo: appMeta.brandInfo || '',
    };
}

/**
 * Save all data from admin app (replaces writeMasterDB).
 * Uses batch writes for efficiency.
 */
export async function saveAllData(data) {
    const db = getFirestore();
    const BATCH_SIZE = 400;

    const collections = [
        { name: 'creators', items: data.creators || [] },
        { name: 'campaigns', items: data.campaigns || [] },
        { name: 'contentItems', items: data.contentItems || [] },
        { name: 'teamMessages', items: data.teamMessages || [] },
        { name: 'teamTasks', items: data.teamTasks || [] },
        { name: 'creatorAccounts', items: data.creatorAccounts || [] },
        { name: 'betaTests', items: data.betaTests || [] },
        { name: 'betaReleases', items: data.betaReleases || [] },
    ];

    for (const col of collections) {
        for (let i = 0; i < col.items.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = col.items.slice(i, i + BATCH_SIZE);
            for (const item of chunk) {
                if (!item.id) continue;
                batch.set(db.collection(col.name).doc(item.id), item, { merge: true });
            }
            await batch.commit();
        }
    }

    // Update metadata
    await updateAppMeta({
        version: data.version || Date.now(),
        lastUpdated: new Date().toISOString(),
        brandInfo: data.brandInfo || '',
    });
}

/**
 * Scope data for a specific creator (replaces scopeDataForCreator)
 */
export async function loadScopedDataForCreator(creatorId) {
    const [creator, campaigns, contentItems, teamMessages, betaTests, betaReleases] = await Promise.all([
        getCreator(creatorId),
        getCampaignsForCreator(creatorId),
        getContentForCreator(creatorId),
        getMessagesForCreator(creatorId),
        getAllBetaTests(),        // Creators see all available beta tests
        getBetaReleasesForCreator(creatorId),
    ]);

    return {
        creator,
        campaigns,
        contentItems,
        teamMessages,
        betaTests,
        betaReleases,
    };
}
