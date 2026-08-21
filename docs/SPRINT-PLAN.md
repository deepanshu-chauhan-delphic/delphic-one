# Sprint Plan — Aug 21 → Aug 28

Plain-language ticket breakdown for two full-stack developers. Goal: everything — including testing — is finished by end of day **Aug 27**. **Aug 28 is deploy day only**, no new feature work.

Where things stand on Aug 21: database, login, Docker, every API endpoint from the spec, ownership rules, role-scoped dashboard, stuck lists, avg-day report metrics, stage-machine tests, and the admin/comments/documents module split are **done and green** (47 server tests) — see [PROGRESS.md](PROGRESS.md). The remaining gap is almost entirely **frontend**: list pages exist, but create/edit forms, detail pages, stage/interview UI, admin users, and unlock UX are still missing.

Both developers are full-stack. Each owns complete features end-to-end so neither is stuck waiting on the other.

---

## Ticket status key

| Mark | Meaning |
|---|---|
| *(no mark)* | Open — still to build |
| **DONE (Aug 21)** | Finished on backend this session; do not re-open unless a regression appears |

---

## Day 1 — Fri Aug 22 — Clients & Jobs get real pages

| Ticket | Owner | What to build |
|---|---|---|
| RD-101 | Dev A | Full detail page for one Client/Vendor — all their info, current status, stage history, a button to move them to the next stage (popup for reason / meeting fields when required) |
| RD-102 | Dev A | "Add new Client/Vendor" and "Edit" forms (company, POC, vendor/client-specific fields) |
| RD-103 | Dev B | Full detail page for one Job Requirement — info panels, **seats table with per-seat stage controls** (Open → Interviewing → Offer → BGV → Closed/Dropped, including `joined_at` when closing), who's assigned |
| RD-104 | Dev B | "Add new Job Requirement" form, requirement status button (Open → In Progress → On Hold → Closed/Dropped), and **Add seat** |

## Day 2 — Sat Aug 23 — Candidates & putting them forward

| Ticket | Owner | What to build |
|---|---|---|
| RD-105 | Dev A | Candidate detail page and "Add/Edit Candidate" form, including uploading a resume (documents API) |
| RD-106 | Dev A | Popup for assigning a recruiter to a job, plus assignment history (assign / unassign) |
| RD-107 | Dev B | Submission detail page — candidate, job/seat, stage stepper, commercials/margin, BGV fields, history |
| RD-108 | Dev B | "Put a candidate forward for a job" flow — pick candidate + seat, enter rates, live margin |

## Day 3 — Sun Aug 24 — Moving people through the pipeline

| Ticket | Owner | What to build |
|---|---|---|
| RD-109 | Dev A | One reusable "Notes" (comments) box and "Files" (documents) uploader |
| RD-110 | Dev A | Drop Notes + Files onto all four detail pages (Client, Job, Candidate, Submission) |
| RD-111 | Dev B | Submission stage buttons through the full pipeline (`sourced` → `internal_screening` → `submitted_to_client` → interview → offer → BGV → closed), with reason popups for backout/rejection |
| RD-125 | Dev B | **Interview rounds UI** on the submission detail page: add/edit rounds for **recruiter internal interviews** (`round_type: internal`) and client rounds — schedule, interviewer, **feedback + rating**, result. Backend already accepts feedback on create and PATCH. |
| RD-132 | Dev B | ~~Interview feedback API + richer interview/closure report metrics~~ **DONE (Aug 21)** — feedback/rating on create+update; recruiter/sales reports include interviews done, by type/result, feedback coverage, avg rating, turnaround days, closures |
| RD-112 | Dev B | Visual board (like Trello) showing all candidates for one job, grouped by stage |

## Day 4 — Mon Aug 25 — Dashboard & Reports that are actually useful

| Ticket | Owner | What to build |
|---|---|---|
| RD-113 | Dev A | Real home-screen dashboard: summary numbers, stuck list (API already returns data), recent activity — different widgets per role (BDA / Sales / Recruiter / Admin). Backend already role-scopes the summary. |
| RD-114 | Dev B | Reports: real tables/charts per report type (not raw JSON), date-range picker, Excel/PDF download that saves a usable file (endpoint already exists) |

## Day 5 — Tue Aug 26 — Catching what's missing, admin UX, tests

| Ticket | Owner | What to build |
|---|---|---|
| RD-115 | Dev A | Spec walkthrough page-by-page — every screen/button in the design/API docs exists; fix gaps found |
| RD-126 | Dev A | **Admin Users page** — list / create / deactivate users (BDA, Sales, Recruiter, Admin). Only admin can create; share creds with the team. **DONE (Aug 21)** — `/users` page + nav (admin only); API was already admin-gated |
| RD-127 | Dev A | **Unlock UI** — on locked account / requirement / seat / submission detail pages, admin-only "Unlock" with mandatory reason (`POST /admin/:entity_type/:entity_id/unlock`) |
| RD-128 | Dev B | **Change password** — reachable from the header/profile menu (`POST /auth/change-password`) |
| RD-131 | Dev A | ~~Temporary one-click role login on `/login` for seeded Admin/BDA/Sales/Recruiter~~ **DONE (Aug 21)** — remove / disable (`VITE_DISABLE_QUICK_LOGIN=true`) when real auth lands |
| RD-123 | Dev A | ~~Stuck leads / stuck requirements on dashboard~~ **DONE (Aug 21)** |
| RD-124 | Dev A | ~~Avg days on recruiter + vendor reports~~ **DONE (Aug 21)** |
| RD-117 | Dev B | ~~Stage-machine automated tests~~ **DONE (Aug 21)** |
| RD-118 | Dev B | ~~Auth + locking automated tests~~ **DONE (Aug 21)** |
| RD-129 | Dev B | ~~Ownership on mutate + dashboard role scoping (BE)~~ **DONE (Aug 21)** |
| RD-130 | Dev B | ~~Split admin / comments / documents into routes/controller/service/validation~~ **DONE (Aug 21)** |

## Day 6 — Wed Aug 27 — Full run-through and getting ready to switch on

| Ticket | Owner | What to build |
|---|---|---|
| RD-119 | Both, together | Click through the entire app as each role (BDA, Sales, Recruiter, Admin) end-to-end — including an **internal recruiter interview round**, seat close, unlock, and create a real user. Log and fix bugs same day. |
| RD-116 | Dev A | Turn on a basic linter so typos and obvious mistakes get flagged automatically |
| RD-120 | Dev A | CI builds Docker images / compose smoke (at least login) — not only `npm install` / `node --check` |
| RD-121 | Dev B | Decide live deployment story (Docker vs old PM2/Nginx `deploy.yml`) and get it ready so Aug 28 is "press go" |

## Day 7 — Thu Aug 28 — DEPLOY DAY

| Ticket | Owner | What to build |
|---|---|---|
| RD-122 | Both, together | Final check, deploy, smoke-test live, create real team accounts (prefer RD-126 Users UI; seed/API fallback if needed). Stay available for urgent issues. |

---

## Backend vs frontend (quick map)

| Area | Backend | Frontend ticket(s) |
|---|---|---|
| Accounts CRUD + stages | Done | RD-101, RD-102 |
| Requirements + seats + assign | Done | RD-103, RD-104, RD-106 |
| Profiles + resume upload | Done | RD-105, RD-109/110 |
| Submissions + margin + stages | Done | RD-107, RD-108, RD-111 |
| Interview rounds (incl. **internal** + feedback) | Done (API; feedback on create/PATCH) | **RD-125** UI |
| Recruiter interview/closure report metrics | Done (RD-132) | RD-114 charts |
| Comments + documents | Done (split Aug 21) | RD-109, RD-110 |
| Dashboard stuck + role scope | Done (RD-123/129) | RD-113 |
| Report avg days + export API | Done (RD-124) | RD-114 |
| Admin unlock API | Done | **RD-127** |
| Users admin API | Done | **RD-126 DONE** |
| Change password API | Done | **RD-128** |
| One-click test login (temporary) | N/A (FE only) | **RD-131 DONE** — replace before prod |
| Stage/auth/locking tests | Done (RD-117/118) | — |

---

## Rules for the week

- **No new features on Aug 28.** If it's not done and tested by end of Aug 27, it waits for the next release.
- If a ticket runs long, the other developer helps rather than starting new work — better to finish Day N's tickets a bit late than to start Day N+1 short-handed going into deploy day.
- Update [PROGRESS.md](PROGRESS.md) and [TODO.md](TODO.md) as tickets land.
- Do not commit or push unless the human asks.
