# 🚨 CREATOR LOGIN — RECURRING BUG POSTMORTEM

> **READ THIS FIRST** if creator login is broken again.
> This document was created after debugging this issue **10+ times** across multiple sessions.
> Last updated: 2026-03-02

---

## TL;DR — How Accounts Work NOW

| What | Where | Why |
|------|-------|-----|
| **Creator accounts** | **Firestore ONLY** (database `ooedn`, collection `creatorAccounts`) | GCS was being overwritten by admin auto-save |
| **Login reads** | `firestoreDAL.getAccountByEmail()` | Never from GCS `readMasterDB()` |
| **Account writes** | `firestoreDAL.addAccount()` / `updateAccount()` | Server endpoints only |
| **Admin auto-save** | **Does NOT include `creatorAccounts`** | Intentionally omitted in `cloudSync.ts` |
| **GCS JSON** | Has NO `creatorAccounts` field | Stripped out permanently |

---

## The Bug (What Kept Happening)

Creators could not log in. The `/api/creator/login` endpoint returned `"no account found"`.
This happened **repeatedly** — after every "fix", it would break again within hours.

## Root Cause (Final, Confirmed)

```
Admin app (App.tsx) → auto-save every 3 seconds
    → syncStateToCloud() in cloudSync.ts
    → uploadJSONToGoogleCloud() — DIRECT GCS write, bypasses server.js entirely
    → Overwrites ooedn_master_db.json INCLUDING creatorAccounts
    → If admin loaded with stale/empty accounts → wipes all accounts from GCS
    → Server reads GCS → finds 0 accounts → login fails
```

### Why Previous Fixes Failed

| Attempt | Fix | Why It Failed |
|---------|-----|---------------|
| 1-3 | Added merge logic in `cloudSync.ts` | Browser cached old JS; merge code never ran |
| 4 | Server-side safeguard in `writeMasterDB_GCS` | Admin writes to GCS directly, bypasses server |
| 5 | Read-then-write-back pattern in `cloudSync.ts` | Still cached old JS in browser tab |
| 6 | Stricter merge (any count decrease = merge) | Same caching problem — server safeguard only protects server writes |

**Key insight**: Client-side JavaScript fixes are useless if the browser keeps running cached old code. The admin app is an SPA — it can run for hours without reloading.

## The Nuclear Fix (Current, Permanent)

### Architecture Change

```
BEFORE: Accounts stored in GCS JSON → readable/writable by admin browser JS
AFTER:  Accounts stored ONLY in Firestore → only server endpoints can read/write
```

### Files Changed

#### `server.js` — ALL auth endpoints rewritten

Every endpoint that touches accounts now calls Firestore directly:

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /api/creator/login` | `readMasterDB()` → `db.creatorAccounts` | `firestoreDAL.getAccountByEmail()` |
| `POST /api/creator/signup` | `db.creatorAccounts = [...]` + `writeMasterDB()` | `firestoreDAL.addAccount()` |
| `POST /api/creator/invite` | `db.creatorAccounts = [...]` + `writeMasterDB()` | `firestoreDAL.addAccount()` |
| `GET /api/creator/me` | `db.creatorAccounts.find()` | `firestoreDAL.getAccountById()` |
| `POST /api/creator/save` | `db.creatorAccounts.map()` | `firestoreDAL.updateAccount()` |
| `POST /api/creator/change-password` | `db.creatorAccounts` RMW cycle | `firestoreDAL.updateAccount()` |
| `POST /api/creator/reset-password` | `db.creatorAccounts` RMW cycle | `firestoreDAL.updateAccount()` |
| `POST /api/creator/delete-account` | `db.creatorAccounts.filter()` | `firestoreDAL.deleteAccount()` |
| `POST /api/creator/debug-login` | `db.creatorAccounts.find()` | `firestoreDAL.getAccountByEmail()` |
| `GET /api/creator/accounts-check` | `db.creatorAccounts` | `firestoreDAL.getAllAccounts()` |
| `POST /api/creator/upload-file` | `db.creatorAccounts.find()` | `firestoreDAL.getAccountById()` |

#### `services/cloudSync.ts` — Accounts removed from GCS payload

- `creatorAccounts` parameter marked DEPRECATED (still accepted, ignored)
- `dbPayload` no longer includes `creatorAccounts`
- No merge logic needed — nothing to merge

#### `services/firestore.js` — Existing DAL (unchanged)

- `getAccountByEmail(email)` — query by email
- `getAccountById(id)` — get by document ID
- `addAccount(account)` — create new
- `updateAccount(id, fields)` — partial update
- `deleteAccount(id)` — remove
- `getAllAccounts()` — list all

---

## Firestore Details

| Property | Value |
|----------|-------|
| **Project** | `kinetix-ooedn` (270857128950) |
| **Database** | `ooedn` (named, NOT default) |
| **Collection** | `creatorAccounts` |
| **Region** | `us-west1` |
| **Service accounts with access** | `270857128950-compute@developer.gserviceaccount.com` (role: `datastore.owner`), `356469728393-compute@developer.gserviceaccount.com` (role: `datastore.owner`) |

---

## How to Verify Accounts Are OK

```bash
# 1. Check accounts via API (reads from Firestore)
curl -s 'https://ooedn-creators-270857128950.us-west1.run.app/api/creator/accounts-check'
# Should return: {"count":N,"accounts":[...],"source":"firestore"}

# 2. Check Firestore directly
node -e "
import { Firestore } from '@google-cloud/firestore';
const db = new Firestore({ projectId: 'kinetix-ooedn', databaseId: 'ooedn' });
const snap = await db.collection('creatorAccounts').get();
snap.forEach(doc => console.log(doc.data().email));
"

# 3. Test login
curl -s -X POST 'https://ooedn-creators-270857128950.us-west1.run.app/api/creator/debug-login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"dv@danielvillano.com","password":"xkpEHpPQ"}'
# Should return: {"found":true,"source":"firestore","passwordMatch":true}
```

---

## If Login Breaks Again — Diagnostic Checklist

1. **Check `source` field** in `accounts-check` response
   - If `source: "firestore"` → accounts are being read correctly
   - If no `source` field → OLD server code is running (redeploy)

2. **Check Firestore directly** — accounts may have been accidentally deleted

   ```bash
   gcloud firestore documents list \
     --project=kinetix-ooedn \
     --database=ooedn \
     --collection-path=creatorAccounts
   ```

3. **Check IAM permissions** — service account must have `datastore.owner`

   ```bash
   gcloud projects get-iam-policy kinetix-ooedn \
     --flatten="bindings[].members" \
     --filter="bindings.role:datastore" \
     --format="table(bindings.members,bindings.role)"
   ```

4. **Restore from backup** if accounts are gone from Firestore:

   ```bash
   # Daniel's account is in: backups/master-db-20260302-local.json
   # Run the restore script (see scripts/ directory)
   ```

---

## ⛔ RULES — DO NOT BREAK THESE

1. **NEVER** add `creatorAccounts` back to `cloudSync.ts` GCS payload
2. **NEVER** read accounts from `readMasterDB()` / `db.creatorAccounts` in auth endpoints
3. **NEVER** write accounts via `writeMasterDB()` — always use `firestoreDAL`
4. **ALWAYS** use `firestoreDAL.getAccountByEmail()` for login lookups
5. **ALWAYS** use `firestoreDAL.addAccount()` for new account creation
6. **ALWAYS** check that `accounts-check` returns `"source":"firestore"`
7. **ALWAYS** verify IAM `datastore.owner` role after any project changes

---

## Known Accounts (as of 2026-03-02)

| Email | Display Name | ID | Invited |
|-------|-------------|-----|---------|
| `dv@danielvillano.com` | Daniel Villano | `7316508f-...` | Yes |
| `hairbyjennasr@gmail.com` | Jenna | `fc2b8b99-...` | Yes |

---

## Three Deploy Targets

All 3 must be deployed together when auth code changes:

```bash
# 1. Team app on kinetix-ooedn
gcloud run deploy ooedn-tracker --source . --region us-west1 --project=kinetix-ooedn

# 2. Team app on ooedn-app
gcloud run deploy ooedn-tracker --source . --region us-west1 --project=ooedn-app

# 3. Creator portal (swap Dockerfile first!)
cp Dockerfile Dockerfile.admin.bak
cp Dockerfile.creator Dockerfile
gcloud run deploy ooedn-creators --source . --region us-west1 --project=kinetix-ooedn
cp Dockerfile.admin.bak Dockerfile && rm Dockerfile.admin.bak
```
