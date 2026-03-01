# OOEDN Creator Portal — Commercial Deployment Advisory

## Where You Are Now

The current stack works great as an **internal team tool**:

| Layer | Current | Notes |
|---|---|---|
| **Frontend** | Vite React SPA (single build) | Admin + Creator share one bundle |
| **Backend** | Express on Cloud Run | Serves static files, push notifications, Gmail proxy |
| **Database** | Single JSON file on GCS (`ooedn_master_db.json`) | Every sync reads/writes the entire ~4MB file |
| **Auth (Admin)** | Google OAuth in-browser | Token stored in `localStorage` |
| **Auth (Creator)** | Plain-text password stored in the same JSON | Compared client-side — no server verification |
| **Secrets** | Service account key file committed, VAPID keys in YAML | Exposed in source |

## What Breaks When Creators Scale

> [!CAUTION]
> **The creator portal currently has NO real security.** Passwords are stored in plain text inside the same JSON file every admin can read. There is no server-side auth — the entire database (all creator passwords, payment details, internal notes) is fetched to the browser on every login attempt.

### Critical Issues for Commercial Use

**1. 🔴 No real authentication**

- Passwords stored in **plain text** in GCS
- The *entire database* — including ALL creator passwords — is downloaded to the browser to check a single login
- Any user with the GCS token can read every password

**2. 🔴 Single JSON file = data corruption risk**

- Two users saving at the same time → last-write-wins, data loss
- The admin auto-save overwrites creator accounts (the bug you just hit)
- Scales to ~50 users max before file size/latency becomes painful

**3. 🔴 No data isolation**

- When a creator logs in, the app downloads `ooedn_master_db.json` which contains ALL creators' data, ALL campaigns, ALL payment info
- A technical creator could inspect the network response and see everyone's data

**4. 🟡 No password reset flow**

- If a creator forgets their password, there's no "I forgot my password" — you'd have to manually look it up and tell them

**5. 🟡 Single domain, single deploy**

- Admin (`/`) and Creator (`/creator`) are one deployment — a bad deploy breaks both

---

## Recommended Path — Phased

### Phase 1: "Ship It Safe" (Do Before Going Commercial)

*Can be done in 1-2 days with your current stack*

| Fix | What | Effort |
|---|---|---|
| **Hash passwords** | Use bcrypt before storing, compare server-side | 2-3 hrs |
| **Add a `/api/creator/login` server endpoint** | Move auth logic to `server.js` — client sends email+password, server checks GCS, returns a JWT session token | 3-4 hrs |
| **Data isolation** | Creator login endpoint returns ONLY their own data (their record, their campaigns, their content) — not the full DB | 2-3 hrs |
| **Environment secrets** | Move service account key + VAPID keys to Cloud Run secrets (not in code) | 1 hr |
| **Password reset** | Simple email-based "here's a new password" flow via your existing Gmail service | 2 hrs |

> [!IMPORTANT]
> Phase 1 keeps your existing JSON-on-GCS architecture but adds a **server-side security layer**. This is the minimum viable commercial deployment.

### Phase 2: "Real Database" (10-100+ Creators)

*Do when the JSON file starts getting slow or you need proper querying*

| Upgrade | Why |
|---|---|
| **Firestore or PostgreSQL (Cloud SQL)** | Per-document reads/writes — no more loading the entire DB. Eliminates race conditions. |
| **Separate collections** | `creators`, `accounts`, `campaigns`, `content` as separate collections/tables instead of one mega-object |
| **Server-side API** | All CRUD through Express endpoints — frontend never touches the DB directly |
| **Firebase Auth or Auth0** | Production-grade auth with email verification, password reset, OAuth, MFA |

### Phase 3: "Multi-Tenant Scale" (100+ Creators, Multiple Brands)

*Enterprise features*

| Feature | Description |
|---|---|
| **Admin vs Creator as separate deployments** | Independent release cycles, separate security boundaries |
| **Role-based access control** | Creator, Admin, Brand Manager roles with scoped permissions |
| **CDN for content** | Cloud CDN or Cloudflare for static assets |
| **Audit logging** | Track who changed what and when |
| **Rate limiting** | Protect API from abuse |

---

## My Recommendation for Right Now

> [!TIP]
> **Do Phase 1 before launching commercially.** It's 1-2 days of work and takes you from "anyone can read everyone's passwords" to "secure enough for a real product." You can ship Phase 2 later when you have 50+ creators.

### What deploying today (as-is) looks like

- ✅ The app works, the UI is polished
- ❌ Any creator can technically see all other creators' data
- ❌ Plain-text passwords sit in a public-readable JSON blob
- ❌ If two people save at the same time, data can be lost

### What deploying after Phase 1 looks like

- ✅ Server-side auth with hashed passwords
- ✅ Creators only see their own data
- ✅ Still your existing JSON-on-GCS — no infrastructure changes needed
- ✅ Ready for 10-50 creators safely

---

## Decision Needed

How would you like to proceed?

1. **Deploy as-is** — accept the risks for now, do Phase 1 later (okay if it's just your own test creators)
2. **Do Phase 1 first, then deploy** — adds 1-2 days but makes it commercially safe
3. **Just deploy the admin app** for now, keep the creator portal in beta on localhost until Phase 1 is done
