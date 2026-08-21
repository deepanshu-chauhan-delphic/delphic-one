# How to test with demo seed data

| Field | Value |
|---|---|
| **Purpose** | Fill dashboards and list pages so you can walk role flows without creating every record by hand |
| **Seed file** | `server/prisma/seed.js` |
| **As of** | 2026-08-21 |
| **Password** | `Password123!` for every `*@delphic.local` user |

## Table of contents

1. [Run seed](#1-run-seed)
2. [What gets created](#2-what-gets-created)
3. [Quick login](#3-quick-login)
4. [Role walkthroughs](#4-role-walkthroughs)
5. [API smoke checks](#5-api-smoke-checks)
6. [Re-seed / wipe](#6-re-seed--wipe)
7. [Common failures](#7-common-failures)

---

## 1. Run seed

### Docker (recommended)

After editing `server/prisma/seed.js` on the host, copy it into the running image (compose does not bind-mount source), then run:

```powershell
docker compose up -d --build
docker compose cp server/prisma/seed.js server:/app/server/prisma/seed.js
docker compose exec server node prisma/seed.js
```

Or rebuild so the image includes the new seed, then:

```powershell
docker compose up -d --build
docker compose exec server node prisma/seed.js
```

If the server container is not running yet:

```powershell
docker compose run --rm --entrypoint sh server -c "node prisma/seed.js"
```
(Use a rebuilt image, or the run container still has the old baked-in seed.)

- UI: http://localhost:8081  
- API: http://localhost:4000  

### Without Docker

```powershell
npm run migrate
npm run seed
npm run dev:server
npm run dev:client
```

UI: http://localhost:5173 · API: http://localhost:4000  

A successful seed prints JSON counts (users, accounts, requirements, submissions, etc.) and the login hint.

---

## 2. What gets created

| Entity | Highlights |
|---|---|
| **Users** | admin, sales1, bda1, recruiter1, recruiter2 |
| **Accounts** | Stuck lead (14+ days), meeting scheduled, **Acme Active Client**, Nova Softwares (active), Talent Vendor Partners |
| **Requirements** | Stuck Java (open, aging), React Frontend (in progress), DevOps project (open), Closed QA (closed this month) |
| **Seats** | Mix of open / interviewing / closed |
| **Assignments** | Recruiter One / Two on live reqs |
| **Profiles** | 4 active candidates + 1 inactive |
| **Submissions** | Stages across sourced → closed (funnel + stuck submission) |
| **Interviews** | Internal pass + pending client L1; one closed final |
| **History / comments** | Recent activity feed is non-empty |

Named anchors useful in the UI:

- **Acme Active Client** — use when creating a new requirement (active client).
- **Stuck Lead Corp** — aging lead for BDA / admin stuck lists and aging report.
- **Stuck Senior Java Developer** — open req older than 7 days.
- **React Frontend Engineer** — in-progress with seats and submissions.
- **Ananya Sharma** / **Rohan Mehta** / **Neha Iyer** — active profiles for put-forward flows.

---

## 3. Quick login

Open `/login`. Use the role buttons (Admin / BDA / Sales / Recruiter), or sign in with:

| Role | Email |
|---|---|
| Admin | `admin@delphic.local` |
| BDA | `bda1@delphic.local` |
| Sales | `sales1@delphic.local` |
| Recruiter | `recruiter1@delphic.local` |

Hide buttons with `VITE_DISABLE_QUICK_LOGIN=true` when real auth lands.

---

## 4. Role walkthroughs

### A. Admin — full dashboard

1. Quick login **Admin**.
2. Open **Dashboard**.
3. Expect non-zero: Active leads, In meeting, Active clients, Active vendors, Open requirements, In progress, Closed this month, Active submissions.
4. Pipeline funnel bars should show several stages (sourced, screening, submitted, interviewing, offered, closed).
5. **Recent activity** should list stage changes (not empty).
6. Spot-check **Accounts**, **Requirements**, **Profiles**, **Submissions** lists — rows present.

### B. BDA — leads and stuck account

1. Quick login **BDA**.
2. Dashboard / accounts: you own **Stuck Lead Corp**, **Meeting Scheduled Ltd**, **Acme Active Client**, **Nova Softwares**.
3. Open Stuck Lead Corp — comment about follow-ups should exist if comments UI is wired.
4. Optional API: `GET /dashboard/summary` as BDA should include stuck leads; requirements may be empty for pure BDA scope.

### C. Sales — requirements create + stuck req

1. Quick login **Sales**.
2. **Requirements** list: Stuck Senior Java, React Frontend, DevOps Project, Closed QA.
3. Open **React Frontend Engineer** — seats, assignees, status history.
4. **+ Create** a requirement against **Acme Active Client** (proves active-client filter).
5. Reports / aging (if UI exists): stuck Java + stuck lead should appear via API.

### D. Recruiter — submissions and put-forward

1. Quick login **Recruiter** (`recruiter1`).
2. **Submissions** list: sourced Java, screening/interview React, closed QA, stuck submitted-to-client.
3. Open the **interview_scheduled** submission (Ananya) — interview rounds (internal pass + pending L1).
4. **Profiles**: Ananya, Rohan, Vikram (and inactive if shown).
5. **+ Put forward** (if RD-107/108 UI is live): pick an active profile + open seat.

### E. Recruiter Two

1. Sign in as `recruiter2@delphic.local` / `Password123!` (no one-click button for rec2).
2. You should see **DevOps Project Squad** assignment and the **offer** submission for Neha.

---

## 5. API smoke checks

With Docker client proxy, or hit API on port 4000:

```powershell
# Login
$body = '{"email":"admin@delphic.local","password":"Password123!"}'
$login = Invoke-RestMethod -Method POST -Uri http://localhost:4000/auth/login -ContentType application/json -Body $body
$token = $login.data.token

# Dashboard summary (expect non-zero counts + funnel + stuck + recent_activity)
Invoke-RestMethod -Uri http://localhost:4000/dashboard/summary -Headers @{ Authorization = "Bearer $token" }

# Aging report
Invoke-RestMethod -Uri http://localhost:4000/reports/aging -Headers @{ Authorization = "Bearer $token" }
```

Through the Nginx client (port 8081), use the same paths under `/api/...` if your proxy strips that prefix — match whatever `apiClient` uses in the browser Network tab.

---

## 6. Re-seed / wipe

Re-running the seed **deletes all** users, accounts, requirements, profiles, submissions, history, and comments, then recreates the demo set.

```powershell
docker compose exec server node prisma/seed.js
```

Do not run against a shared staging DB with real data.

---

## 7. Common failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Empty dashboard after seed | Seed ran against a different DB than the API | Confirm `DATABASE_URL` / compose service; re-seed with `docker compose exec server` |
| Cannot create requirement | No active client | Seed includes **Acme Active Client**; re-seed if wiped manually |
| Login fails | Old password / wiped users | Re-seed; password is always `Password123!` |
| Stuck lists empty | Timestamps too fresh | Seed sets `updated_at` / `created_at` &gt; 7 days ago; re-seed without editing those rows afterward |
| Funnel all zeros | Submissions missing | Seed prints `submissions` count — should be ≥ 6 |

---

## Related docs

- [TESTING-RD-103-104.md](TESTING-RD-103-104.md) — requirements UI  
- [TESTING-RD-107-108.md](TESTING-RD-107-108.md) — submissions UI  
- [TESTING-RD-111-125-112.md](TESTING-RD-111-125-112.md) — pipeline / interviews  
- [TESTING-RD-114-128.md](TESTING-RD-114-128.md) — reports + change password  
- [AGENTS.md](../AGENTS.md) — local setup and docs index  
