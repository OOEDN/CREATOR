# OOEDN Developer Playbook
> How to iterate, deploy, and not break things

## Your Daily Workflow

### Step 1: Make Changes Locally
```bash
# Start both servers for local dev
npm run dev          # Team app → http://localhost:5173
npm run dev:creator  # Creator app → http://localhost:5174
npm run dev:server   # API server → http://localhost:8080
```

**Where to edit:**
| What you're changing | Where the files are |
|---------------------|-------------------|
| Team dashboard, campaigns, chat | `apps/team/components/` |
| Team app routing/state | `apps/team/App.tsx` |
| Creator portal, onboarding | `apps/creator/components/` |
| Creator app routing/state | `apps/creator/CreatorApp.tsx` |
| Types, interfaces | `shared/types.ts` |
| Constants, config | `shared/constants.ts` |
| API services (Firestore, AI, etc) | `shared/services/` |
| Server routes, auth | `server/routes/` |
| Server config | `server/server.js`, `server/config.js` |

### Step 2: Test Locally
- Team app changes → check `http://localhost:5173`
- Creator app changes → check `http://localhost:5174`
- API changes → both apps talk to `http://localhost:8080`

### Step 3: Deploy to STAGING (Always Do This First)
```bash
bash deploy-admin-staging.sh     # Team → staging
bash deploy-creator-staging.sh   # Creator → staging
```
**Test on staging URLs:**
- Team: `https://ooedn-tracker-staging-964463045186.us-west1.run.app`
- Creator: `https://creator-portal-staging-1038679114321.us-west1.run.app`

### Step 4: Deploy to PRODUCTION (Only After Staging Looks Good)
```bash
bash deploy-admin.sh      # Team → production
bash deploy-creator.sh    # Creator → production
```

### Step 5: Commit and Push
```bash
git add -A
git commit -m "feat: describe what you changed"
git push origin refactor/phase-3-config-and-split
git push creator refactor/phase-3-config-and-split
```

---

## What Can Go Wrong (and How to Fix It)

### 🔴 "I deployed and the app is broken"
```bash
# Option 1: Rollback to previous commit
git checkout HEAD~1
bash deploy-admin.sh          # Redeploy team from previous commit
bash deploy-creator.sh        # Redeploy creator from previous commit

# Option 2: Rollback via Cloud Run console
# Go to console.cloud.google.com → Cloud Run → select service → Revisions
# Click "Route traffic" → send 100% to the previous revision
```

### 🔴 "I accidentally deleted data from Firestore"
```bash
# Restore from backup
bash restore-firestore.sh
# It will list available backups and ask you to type RESTORE to confirm
```

### 🔴 "I deployed to the wrong project"
The deploy scripts have **built-in safeguards**:
- `deploy-admin.sh` checks for `CREATOR_MODE` in Dockerfile → blocks if wrong Dockerfile
- `deploy-creator.sh` auto-swaps Dockerfiles and auto-restores on exit
- Both scripts verify the GCP project before deploying

### 🔴 "My build is failing"
```bash
# Check what's broken
npm run build              # Team app — does it build?
npm run build:creator      # Creator app — does it build?

# Common fix: import path is wrong after moving a file
# Look at the error — it will say "Cannot resolve './SomeComponent'"
# Fix the import path in the file that's erroring
```

### 🔴 "I changed shared code and both apps broke"
Files in `shared/` affect BOTH apps. If you change `shared/types.ts`:
```bash
npm run build              # Verify team still builds
npm run build:creator      # Verify creator still builds
```
If one breaks, fix it before deploying.

### 🟡 "I'm not sure if my changes are safe"
```bash
# 1. Make a backup first
bash backup-firestore.sh

# 2. Deploy to staging ONLY
bash deploy-admin-staging.sh
bash deploy-creator-staging.sh

# 3. Test on staging URLs
# 4. If good → deploy to production
# 5. If bad → fix and redeploy staging
# Production was never touched
```

---

## Golden Rules

1. **Never deploy directly to production** → always staging first
2. **Backup before risky changes** → `bash backup-firestore.sh`
3. **Team app changes stay in `apps/team/`** → can't break creator
4. **Creator app changes stay in `apps/creator/`** → can't break team
5. **Shared changes (`shared/`)** → test BOTH builds before deploying
6. **Server changes (`server/`)** → affect both apps, test both
7. **Always commit after deploying** → so you can rollback
8. **Check GitHub Actions** → green ✅ = build passes, red ❌ = something's broken

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Run team app locally (port 5173) |
| `npm run dev:creator` | Run creator app locally (port 5174) |
| `npm run dev:server` | Run API server locally (port 8080) |
| `npm run build` | Build team app → `dist/` |
| `npm run build:creator` | Build creator app → `dist-creator/` |
| `bash deploy-admin-staging.sh` | Deploy team to staging |
| `bash deploy-creator-staging.sh` | Deploy creator to staging |
| `bash deploy-admin.sh` | Deploy team to production |
| `bash deploy-creator.sh` | Deploy creator to production |
| `bash backup-firestore.sh` | Backup entire database |
| `bash restore-firestore.sh` | Restore from backup |

## Production URLs
- **Team**: `https://team.ooedn.com` / `https://ooedn-tracker-964463045186.us-west1.run.app`
- **Creator**: `https://creator.ooedn.com` / `https://creator-portal-1038679114321.us-west1.run.app`

## Staging URLs
- **Team**: `https://ooedn-tracker-staging-964463045186.us-west1.run.app`
- **Creator**: `https://creator-portal-staging-1038679114321.us-west1.run.app`
