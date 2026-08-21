# TODO

Working task list. Check off / move to [PROGRESS.md](PROGRESS.md) as items land. See [AGENTS.md](../AGENTS.md) for project context.

**Sprint tickets live in [SPRINT-PLAN.md](SPRINT-PLAN.md)** (Aug 21 → Aug 28 deploy).

**⚠️ RESUME POINT — read [PROGRESS.md](PROGRESS.md) top entry first.** Product UI + **RD-114/128** + **RD-116 lint** + **RD-120 Docker CI smoke** done. **Open (3):** RD-119 E2E · RD-121 deploy story · RD-122 deploy day. Manual reports/password: [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md). Spec: [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md).

## Backend

- [x] Install, migrate, seed, Docker end-to-end verified.
- [x] All spec API routes present; stage machines, locking, auth tested.
- [x] RD-123 stuck dashboard lists + RD-129 role-scoped summary.
- [x] RD-124 recruiter/vendor avg-day metrics.
- [x] Ownership on account/requirement mutate paths.
- [x] RD-130 admin / comments / documents split to routes/controller/service/validation.
- [x] Test suite: **14 suites / 83 tests** green (`cd server && npm test`). Linter: `npm run lint` (RD-116).
- [x] Interview feedback API (create + PATCH) and extended interview/closure report metrics (RD-132).
- [x] Structured backend logging (`logger` + request/error/lifecycle) — see [BACKEND-LOGGING.md](../guides/BACKEND-LOGGING.md).
- [x] Comments `entity_type` includes `profile` (for Candidate Notes on RD-110).

## Frontend (open — see sprint tickets)

- [x] List pages + login + layout/logout wired to API.
- [x] RD-101–102 — account detail, stage history/move, and Client/Vendor create/edit forms.
- [x] **RD-103 / RD-104** Requirement detail + create/edit + status + seats — [TESTING-RD-103-104.md](../testing/TESTING-RD-103-104.md).
- [x] RD-105 — candidate detail + Add/Edit form + resume upload (documents API).
- [x] RD-106 — assign recruiter popup + assignment history from Requirements list.
- [x] **RD-107 / RD-108** Submission detail + put-forward — [TESTING-RD-107-108.md](../testing/TESTING-RD-107-108.md).
- [x] RD-109 — reusable `NotesPanel` + `FilesPanel` components.
- [x] RD-110 — Notes + Files on Account, Job, Candidate, and Submission detail pages.
- [x] **RD-111 / RD-125 / RD-112** Stage buttons + interview rounds UI + job kanban — [TESTING-RD-111-125-112.md](../testing/TESTING-RD-111-125-112.md).
- [x] RD-113 — role home dashboard widgets (BDA / Sales / Recruiter / Admin) on `GET /dashboard/summary`.
- [x] RD-114 — real report charts + export — [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md).
- [x] **RD-126** Admin Users page (create BDA/Sales/Recruiter/Admin; deactivate).
- [x] **RD-131** Temporary one-click role login on login page (disable/remove before real auth).
- [x] **RD-127** Unlock UI (admin) on locked account / requirement / seat / submission.
- [x] **RD-128** Change password (Dev B) — header avatar menu — [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md).
- [x] RD-115 spec UI audit + Jira-like list polish — [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md).

## Infra / CI

- [x] GitHub repo + Docker compose stack.
- [x] RD-116 linter — `npm run lint` (ESLint 9, client + server).
- [x] RD-120 Docker CI smoke — compose up, health, seed, login (API + client proxy).
- [ ] RD-121 deploy story (Docker vs PM2) · RD-122 deploy day.

## Docs

- [x] SPRINT-PLAN updated with missing tickets (RD-125–130) and DONE marks (Aug 21).
- [x] Backend logging guide: [BACKEND-LOGGING.md](../guides/BACKEND-LOGGING.md) (linked from AGENTS + README).
- [x] Jira-like UI/UX standing note: [UI-UX-JIRA.md](../ui/UI-UX-JIRA.md) + reference screenshot.
- [x] RD-103/104 test guide: [TESTING-RD-103-104.md](../testing/TESTING-RD-103-104.md).
- [x] RD-107/108 test guide: [TESTING-RD-107-108.md](../testing/TESTING-RD-107-108.md).
- [x] RD-111/125/112 test guide: [TESTING-RD-111-125-112.md](../testing/TESTING-RD-111-125-112.md).
- [x] Demo seed test guide: [TESTING-DEMO-SEED.md](../testing/TESTING-DEMO-SEED.md).
- [x] RD-115 walkthrough log: [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md).
- [x] RD-114/128 test guide: [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md).
- [ ] Keep this file and PROGRESS.md current each session.
