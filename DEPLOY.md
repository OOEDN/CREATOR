# OOEDN Deployment Reference

# ⚠️ READ THIS BEFORE EVERY DEPLOYMENT ⚠️

## Services

### 1. ADMIN/TEAM APP (ooedn-tracker)

- **Cloud Run Service:** `ooedn-tracker`
- **URL:** <https://ooedn-tracker-270857128950.us-west1.run.app>
- **Dockerfile:** `Dockerfile` (the DEFAULT admin Dockerfile)
- **Build:** `npm run build` → `dist/`
- **Env Vars:** `CLIENT_ID=850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com`
- **NO CREATOR_MODE** — this is the Team/Admin app
- **⚠️ PEOPLE ARE ACTIVELY USING THIS — be careful**

### 2. CREATOR PORTAL (ooedn-creators)

- **Cloud Run Service:** `ooedn-creators`
- **URL:** <https://ooedn-creators-270857128950.us-west1.run.app>
- **Dockerfile:** `Dockerfile.creator`
- **Build:** `npx vite build --config vite.creator.config.ts` → `dist-creator/`
- **Env Vars:** `CREATOR_MODE=true`, `CLIENT_ID=850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com`

### 3. PRODUCTION (DO NOT TOUCH)

- **URL:** <https://ooedn-tracker-356469728393.us-west1.run.app>
- **⛔ NEVER deploy to this — it is the live production app**

## Deployment Commands

### Deploy ADMIN app

```bash
gcloud run deploy ooedn-tracker --source . --region us-west1 \
  --update-env-vars CLIENT_ID=850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com
```

**Make sure `Dockerfile` is the ADMIN version (uses `npm run build`, NOT `vite.creator.config.ts`)**

### Deploy CREATOR portal

```bash
# Temporarily swap Dockerfile
cp Dockerfile Dockerfile.admin.bak
cp Dockerfile.creator Dockerfile

gcloud run deploy ooedn-creators --source . --region us-west1 \
  --update-env-vars CREATOR_MODE=true,CLIENT_ID=850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com

# RESTORE admin Dockerfile immediately after
cp Dockerfile.admin.bak Dockerfile
rm Dockerfile.admin.bak
```

## GCS Database

- **Bucket:** `ai-studio-bucket-850668507460-us-west1`
- **DB File:** `ooedn_master_db.json`
- **Shared** between admin and creator portal
