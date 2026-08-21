# TODO

Working task list. Check off / move to [docs/PROGRESS.md](PROGRESS.md) as items land. See [docs/AGENTS.md](AGENTS.md) for project context.

**Sprint tickets live in [docs/SPRINT-PLAN.md](SPRINT-PLAN.md)** (Aug 21 → Aug 28 deploy).

**⚠️ RESUME POINT — read [PROGRESS.md](PROGRESS.md) top entry first.** Backend green (**62** tests). Dev B Day 1 **RD-103 / RD-104 DONE** — requirement create/edit/detail + seat stages; how to test: [TESTING-RD-103-104.md](TESTING-RD-103-104.md). **UI/UX must be Jira-like** ([UI-UX-JIRA.md](UI-UX-JIRA.md)). Ticket snapshot: [SPRINT-PLAN.md](SPRINT-PLAN.md#ticket-status-snapshot-aug-21). **Next:** Dev A Day 1 (RD-101/102) or Dev B Day 2 (RD-107/108).

## Backend

- [x] Install, migrate, seed, Docker end-to-end verified.
- [x] All spec API routes present; stage machines, locking, auth tested.
- [x] RD-123 stuck dashboard lists + RD-129 role-scoped summary.
- [x] RD-124 recruiter/vendor avg-day metrics.
- [x] Ownership on account/requirement mutate paths.
- [x] RD-130 admin / comments / documents split to routes/controller/service/validation.
- [x] Test suite: **10 suites / 62 tests** green (`cd server && npm test`). Still no linter (RD-116).
- [x] Interview feedback API (create + PATCH) and extended interview/closure report metrics (RD-132).
- [x] Structured backend logging (`logger` + request/error/lifecycle) — see [BACKEND-LOGGING.md](BACKEND-LOGGING.md).

## Frontend (open — see sprint tickets)

- [x] List pages + login + layout/logout wired to API.
- [x] **RD-103 / RD-104** Requirement detail + create/edit + status + seats stage controls + add seat — [TESTING-RD-103-104.md](TESTING-RD-103-104.md).
- [ ] RD-101–102 — account/requirement detail + forms (**accounts** still open; requirements done above).
- [ ] RD-105–108 — profile/submission detail + create flows + assign popup.
- [ ] RD-109–112, **RD-125** — notes/files, submission stages, **interview rounds (internal + client)**, kanban.
- [ ] RD-113–114 — role dashboard widgets + real report charts (APIs ready).
- [x] **RD-126** Admin Users page (create BDA/Sales/Recruiter/Admin; deactivate).
- [x] **RD-131** Temporary one-click role login on login page (disable/remove before real auth).
- [ ] **RD-127** Unlock UI · **RD-128** Change password.
- [ ] RD-115 spec UI audit (**must include Jira-like density/filter/list check** — [UI-UX-JIRA.md](UI-UX-JIRA.md)).
- [ ] Align existing list pages + shell to Jira-like UX (top chrome, filters, dense rows) using [references/jira-like-dashboard-reference.png](references/jira-like-dashboard-reference.png).

## Infra / CI

- [x] GitHub repo + Docker compose stack.
- [ ] RD-116 linter · RD-120 Docker CI smoke · RD-121 deploy story (Docker vs PM2) · RD-122 deploy day.

## Docs

- [x] SPRINT-PLAN updated with missing tickets (RD-125–130) and DONE marks (Aug 21).
- [x] Backend logging guide: [BACKEND-LOGGING.md](BACKEND-LOGGING.md) (linked from AGENTS + README).
- [x] Jira-like UI/UX standing note: [UI-UX-JIRA.md](UI-UX-JIRA.md) + reference screenshot.
- [x] RD-103/104 test guide: [TESTING-RD-103-104.md](TESTING-RD-103-104.md).
- [ ] Keep this file and PROGRESS.md current each session.
