# OOEDN Platform — Master Reference & Rollback Guide

> **Created:** March 16, 2026  
> **Last Updated:** March 16, 2026  
> **Purpose:** Full system reference in case something goes wrong during refactoring

---

## 🔑 Credentials & Secrets

### Google Secret Manager (both projects)
| Secret Name | Value | Projects |
|-------------|-------|----------|
| `API_KEY` | `AIzaSyBn7BhBlM0o11xW-kZlFKx8vxF2aiqhHF0` | admin-tracker-490321, ooedn-creator-portal |
| `JWT_SECRET` | `iyDxbTH4Qr2P2tKiZXXSmOJKIpIWgmQcKR/BxDoXnBY=` | admin-tracker-490321, ooedn-creator-portal |
| `SMTP_PASS` | `ketrac-sydqyk-dopGa4` | admin-tracker-490321, ooedn-creator-portal |

### Non-Secret Env Vars
| Var | Admin Value | Creator Value |
|-----|-------------|---------------|
| `CLIENT_ID` | `964463045186-ck53fm3viba6jsq7ctg0jd8vj9oom4ag.apps.googleusercontent.com` | `850668507460-3qtvn7krlf5vv0artsraukruq7lqheug.apps.googleusercontent.com` |
| `SMTP_FROM` | `creator@ooedn.com` | `creator@ooedn.com` |
| `SMTP_USER` | `create@ooedn.com` | `create@ooedn.com` |
| `GCS_BUCKET` | `ai-studio-bucket-850668507460-us-west1` | `ai-studio-bucket-850668507460-us-west1` |
| `DB_SOURCE` | `firestore` | `firestore` |
| `CREATOR_MODE` | *(not set)* | `true` |

---

## 🏗️ Infrastructure Map

### Team App (Admin Tracker)
- **GCP Project:** `admin-tracker-490321` (project number: `964463045186`)
- **Cloud Run Service:** `ooedn-tracker`
- **Region:** `us-west1`
- **Domain:** `team.ooedn.com`
- **Direct URL:** `https://ooedn-tracker-964463045186.us-west1.run.app`
- **Service Account:** `964463045186-compute@developer.gserviceaccount.com`
- **Current Revision:** `ooedn-tracker-00007-t8c`
- **Deploy Script:** `deploy-admin.sh`

### Creator Portal
- **GCP Project:** `ooedn-creator-portal` (project number: `1038679114321`)
- **Cloud Run Service:** `creator-portal`
- **Region:** `us-west1`
- **Domain:** `creator.ooedn.com`
- **Direct URL:** `https://creator-portal-1038679114321.us-west1.run.app`
- **Service Account:** `1038679114321-compute@developer.gserviceaccount.com`
- **Current Revision:** `creator-portal-00004-5rw`
- **Deploy Script:** `deploy-creator.sh`

### Firestore
- **Project:** `kinetix-ooedn`
- **Database:** `ooedn` (named, NOT default)
- **Coco Memory Collection:** `coco_memory/{userId}/memories`

---

## 🔐 IAM Roles Granted

| Service Account | Role | Project |
|----------------|------|---------|
| `964463045186-compute@...` | `roles/aiplatform.user` | admin-tracker-490321 |
| `964463045186-compute@...` | `roles/secretmanager.secretAccessor` | admin-tracker-490321 |
| `1038679114321-compute@...` | `roles/aiplatform.user` | ooedn-creator-portal |
| `1038679114321-compute@...` | `roles/secretmanager.secretAccessor` | ooedn-creator-portal |

---

## 🔄 Rollback Commands

### Roll back to previous revision (admin)
```bash
gcloud run services update-traffic ooedn-tracker \
  --to-revisions=ooedn-tracker-00005-p96=100 \
  --region=us-west1 --project=admin-tracker-490321
```

### Roll back to previous revision (creator)
```bash
gcloud run services update-traffic creator-portal \
  --to-revisions=creator-portal-00002-md7=100 \
  --region=us-west1 --project=ooedn-creator-portal
```

### Re-add secrets as plain env vars (emergency)
```bash
# Admin
gcloud run services update ooedn-tracker --region=us-west1 \
  --project=admin-tracker-490321 \
  --update-env-vars="API_KEY=AIzaSyBn7BhBlM0o11xW-kZlFKx8vxF2aiqhHF0,JWT_SECRET=iyDxbTH4Qr2P2tKiZXXSmOJKIpIWgmQcKR/BxDoXnBY=,SMTP_PASS=ketrac-sydqyk-dopGa4" \
  --remove-secrets="API_KEY,JWT_SECRET,SMTP_PASS"

# Creator
gcloud run services update creator-portal --region=us-west1 \
  --project=ooedn-creator-portal \
  --update-env-vars="API_KEY=AIzaSyBn7BhBlM0o11xW-kZlFKx8vxF2aiqhHF0,JWT_SECRET=iyDxbTH4Qr2P2tKiZXXSmOJKIpIWgmQcKR/BxDoXnBY=,SMTP_PASS=ketrac-sydqyk-dopGa4" \
  --remove-secrets="API_KEY,JWT_SECRET,SMTP_PASS"
```

---

## ✅ Completed Upgrades
1. Gemini 3.1 Pro models
2. Server-side AI proxy (`/api/ai/generate`, `/api/ai/chat`)
3. Coco Firestore memory (`/api/ai/memory/*`)
4. Vertex AI migration (IAM auth, no API key)
5. Secret Manager (plaintext removed from deploy scripts)

## 🔜 Next Steps
- **Phase 5:** Architecture cleanup — split `App.tsx` (101KB) and `server.js` (56KB) into modules
- **Phase 6:** Real-time Firestore listeners
- **Phase 7:** Multimodal Coco
- **Phase 8:** CI/CD with GitHub Actions

---

## 📁 Key Files Modified in This Session
| File | What Changed |
|------|-------------|
| `server.js` | Added Vertex AI proxy routes, Coco memory routes, removed API key from window.env |
| `services/aiProxy.ts` | **NEW** — Client-side proxy wrapper |
| `services/aura/auraCore.ts` | Rewired to use server proxy |
| `services/geminiService.ts` | Rewired all 10 functions to use proxy |
| `services/firestore.js` | Added generic `setDocument`, `getCollection`, `deleteDocument` |
| `deploy-admin.sh` | Secrets moved to `--update-secrets` |
| `deploy-creator.sh` | Secrets moved to `--update-secrets` |
