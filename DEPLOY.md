# OOEDN Deployment Reference

> **⚠️ READ THIS ENTIRE FILE BEFORE EVERY DEPLOYMENT ⚠️**
>
> Last updated: 2026-03-15

---

## 🏗️ Project Architecture (Clean Separation)

| Project | ID | Number | Purpose | Domain |
|---|---|---|---|---|
| **Admin Tracker** | `admin-tracker-490321` | `964463045186` | Team dashboard (Daniel, Lauren, Jenn) | `team.ooedn.com` (pending) |
| **Creator Portal** | `ooedn-creator-portal` | `1038679114321` | Creator-facing app | `creator.ooedn.com` (pending) |
| **Kinetix** | `kinetix-ooedn` | `270857128950` | KINETIX app only — ⛔ DO NOT deploy tracker here | — |
| **Legacy** | `ooedn-app` | `356469728393` | ⛔ NEVER deploy — old production | — |

### ⚠️ Legacy Services on `kinetix-ooedn` (to be retired)

The following services still exist on the old `kinetix-ooedn` project and should NOT receive new deployments:
- `ooedn-tracker` (https://ooedn-tracker-270857128950.us-west1.run.app) — **migrate to `admin-tracker-490321`**
- `ooedn-creators` (https://ooedn-creators-270857128950.us-west1.run.app) — **migrate to `ooedn-creator-portal`**

---

## 🚀 How to Deploy

### Deploy ADMIN app

```bash
./deploy-admin.sh
```

This script:
- ✅ Verifies the Dockerfile is the admin version (not creator)
- ✅ Forces project to `admin-tracker-490321`
- ✅ Deploys `ooedn-tracker` service to `us-west1`
- ✅ Sets `CLIENT_ID` env var

### Deploy CREATOR portal

```bash
./deploy-creator.sh
```

This script:
- ✅ Forces project to `ooedn-creator-portal`
- ✅ Swaps Dockerfile → Dockerfile.creator
- ✅ **Auto-restores admin Dockerfile on exit** (even if deploy fails — bash `trap`)
- ✅ Deploys `creator-portal` service to `us-west1`
- ✅ Sets `CREATOR_MODE=true` + `CLIENT_ID` env vars

---

## 🔐 Environment Variables

### Admin Tracker (`admin-tracker-490321`)

| Variable | Value |
|---|---|
| `CLIENT_ID` | `850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com` |
| `API_KEY` | `AIzaSyBn7BhBlM0o11xW-kZlFKx8vxF2aiqhHF0` |
| `SMTP_FROM` | `creator@ooedn.com` |
| `SMTP_USER` | `create@ooedn.com` |
| `SMTP_PASS` | `ketrac-sydqyk-dopGa4` |
| `JWT_SECRET` | Set a strong secret (do NOT use the hardcoded fallback) |

### Creator Portal (`ooedn-creator-portal`)

| Variable | Value |
|---|---|
| `CREATOR_MODE` | `true` |
| `CLIENT_ID` | `850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com` |
| `JWT_SECRET` | Must match the admin tracker JWT secret |
| `SMTP_FROM` | `creator@ooedn.com` |
| `SMTP_USER` | `create@ooedn.com` |
| `SMTP_PASS` | `ketrac-sydqyk-dopGa4` |

---

## 📦 GCS Database (Shared)

| Field | Value |
|---|---|
| **Bucket** | `ai-studio-bucket-850668507460-us-west1` |
| **DB File** | `ooedn_master_db.json` |
| **Shared** | Yes — both admin and creator read/write the same database |
| **Backups** | `ooedn_backup_YYYY-MM-DD.json` in same bucket |

> [!IMPORTANT]
> Both services share the same GCS bucket and database. The service account on each new project needs read/write access to this bucket. See "First Deploy Checklist" below.

---

## 🧱 Dockerfiles

| File | Purpose | Build | Output |
|---|---|---|---|
| `Dockerfile` | Admin/Team App | `npm run build` | `dist/` |
| `Dockerfile.creator` | Creator Portal | `npx vite build --config vite.creator.config.ts` | `dist-creator/` |

**⚠️ Never manually swap Dockerfiles. Always use the deploy scripts.**

---

## 🌐 Custom Domain Setup (Pending)

### `creator.ooedn.com` → `ooedn-creator-portal`

```bash
# After first deploy, map the domain:
gcloud run domain-mappings create --service creator-portal \
  --domain creator.ooedn.com --region us-west1 \
  --project ooedn-creator-portal
```

Then add CNAME in DNS:
- **Name:** `creator`
- **Value:** `ghs.googlehosted.com`

### `team.ooedn.com` → `admin-tracker-490321`

```bash
gcloud run domain-mappings create --service ooedn-tracker \
  --domain team.ooedn.com --region us-west1 \
  --project admin-tracker-490321
```

Then add CNAME in DNS:
- **Name:** `team`
- **Value:** `ghs.googlehosted.com`

### OAuth Update Required

After domain mapping, update the OAuth consent screen and credentials:
1. Go to APIs & Services → Credentials → Your OAuth Client ID
2. Add to **Authorized JavaScript Origins**:
   - `https://creator.ooedn.com`
   - `https://team.ooedn.com`

---

## ✅ First Deploy Checklist

Before the first deploy to each new project, ensure:

- [ ] APIs enabled (`run`, `cloudbuild`, `artifactregistry`) — ✅ Done for both
- [ ] Billing linked to the project
- [ ] Default service account has access to GCS bucket (`ai-studio-bucket-850668507460-us-west1`)
- [ ] Set env vars via deploy script or `--update-env-vars`
- [ ] Test locally with `npm run dev` first
- [ ] After deploy, verify at the Cloud Run URL
- [ ] Map custom domain (CNAME)
- [ ] Update OAuth origins

---

## 🔄 Rollback

```bash
# List recent revisions
gcloud run revisions list --service SERVICE_NAME --region us-west1 --project PROJECT_ID --limit=10

# Route traffic to specific revision
gcloud run services update-traffic SERVICE_NAME --region us-west1 --project PROJECT_ID \
  --to-revisions=REVISION_NAME=100
```

---

## 🔍 Debugging

```bash
# Check which version is live
gcloud run services describe SERVICE --region us-west1 --project PROJECT \
  --format="value(status.latestReadyRevisionName)"

# Read logs
gcloud run services logs read SERVICE --region us-west1 --project PROJECT --limit=50

# Check env vars
gcloud run services describe SERVICE --region us-west1 --project PROJECT \
  --format="yaml(spec.template.spec.containers[0].env)"

# Check DNS for domain
dig NS ooedn.com +short
dig CNAME creator.ooedn.com +short
```

---

## ⚠️ Common Mistakes

| Mistake | Prevention |
|---|---|
| Deploying to wrong project | Always use `./deploy-admin.sh` or `./deploy-creator.sh` |
| Wrong Dockerfile in place | Scripts check and auto-restore |
| Deploying to `kinetix-ooedn` | Legacy — scripts point to new projects |
| Deploying to `ooedn-app` | ⛔ That project is dead — never touch it |
| Forgetting GCS bucket access | Check first-deploy checklist above |
