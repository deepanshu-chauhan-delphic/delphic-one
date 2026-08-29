# TODO

Working task list. Check off / move to [PROGRESS.md](PROGRESS.md) as items land. See [AGENTS.md](../AGENTS.md) for project context.

**Sprint tickets live in [SPRINT-PLAN.md](SPRINT-PLAN.md)** (Aug 21 → Aug 28 deploy).

**⚠️ RESUME POINT — read [PROGRESS.md](PROGRESS.md) top entries first.** Product UI + role pipelines + V2 lead/rounds/bench + **2026-08-29** closure-progress rings + requirement × stage matrix (`GET /pipeline/board`) + form field wiring are implemented locally on `main` but **still uncommitted**. **Open:** commit/push the uncommitted pile; V2 + matrix manual browser click-through; RD-119 E2E; RD-122 deploy day (`DEPLOY_ENABLED` + VPS secrets). See PROGRESS.md 2026-08-29 and 2026-08-27. Manual reports/password: [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md). Spec: [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md). Redesign: [UI-REDESIGN.md](../ui/UI-REDESIGN.md). V2 design: [V2-LEAD-PIPELINE-REQUIREMENTS.md](../architecture/V2-LEAD-PIPELINE-REQUIREMENTS.md).

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
- [x] **RD-133** UI redesign — RHS drawers, list peeks, pipeline KPIs, BDA/Sales reports — [UI-REDESIGN.md](../ui/UI-REDESIGN.md).
- [x] UX audit fix pass — all remaining forms/modals converted to RHS drawers, searchable skill/tech-stack picker, hover tooltips, BDA pipeline funnel, report KPI accuracy fixes, richer seed data, skeleton loading states.
- [x] Role-specific pipeline boards (BDA leads / Sales jobs / Recruiter candidates / Admin switcher) with shared drag-and-drop shell and card actions menu.
- [x] BDA account create/edit/stage gaps closed; Accounts/Requirements list create now use the full form, not the stripped mini-form.
- [x] Dashboard filter + list spacing polish (Aug 24–25 CSS passes), Delphic logo.
- [x] **V2** — lead classify flow + meeting location/attendees UI; interview rounds panel reworked for 6 named round types + role gating + missing-mandatory banner; candidate on-bench toggle/filter + submission picker quick filter; requirement type dropdown (managed services/recruitment/project); reports page Client performance tab + new BDA/recruiter/sales columns.
- [x] Closure progress rings + step breakdown on submissions/profiles; requirement × stage **Requirement map** board (`/pipeline?view=matrix`, `GET /pipeline/board`).
- [x] Account / profile / requirement create-edit forms wired to remaining schema fields (agreement URLs, candidate compensation/relocate, req certifications/timezone/contract, meeting notes).
- [ ] Manual click-through (V2 + closure rings + requirement map) in the browser — tests cover the new server surface; UI not yet hand-verified.

## Infra / CI

- [x] GitHub repo + Docker compose stack.
- [x] RD-116 linter — `npm run lint` (ESLint 9, client + server).
- [x] RD-120 Docker CI smoke — compose up, health, seed, login (API + client proxy).
- [x] Server-side entity access guards (`entityAccess.js`) + recruiter scoping on submissions/documents/comments/history.
- [x] Fail-closed production env guard (`assertProductionConfig` — rejects missing/placeholder/short JWT secrets, missing `DATABASE_URL`/`CORS_ORIGIN`).
- [x] `seed-admin.js` — non-destructive prod admin bootstrap.
- [x] RD-121 deploy story — `setup-vm.sh` (VM bootstrap) + `start-delphic.sh --prod` (`docker-compose.prod.yml` overlay, secret validation, systemd unit); `deploy.yml` now SSHs and runs it.
- [ ] RD-122 deploy day — still needs `DEPLOY_ENABLED` + VPS secrets set for a real run.
- [x] **V2** schema + migration (`server/prisma/schema.prisma`, `20260827115000_v2_add_enum_values` + `20260827120000_v2_lead_pipeline_requirements`), applied to local dev + test DBs only.
- [x] **V2** backend — `POST /accounts/:id/classify`, meeting location/attendees, interview-round role scoping, candidate bench filter, `GET /reports/client-performance` + extended existing reports.
- [x] **V2** seed data remapped to new enums + new demo rows.
- [x] **V2** test coverage: new `interview-rounds-scope.test.js`, `profiles-bench.test.js`, extended `accounts-stage.test.js`/`reports-ui.test.js`.
- [x] Closure progress unit tests + `GET /pipeline/board` role-scope tests (`closure-progress.test.js`, `pipeline-board.test.js`). **23 suites / 135 tests** green (2026-08-29).

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
- [x] **V2** design doc: [V2-LEAD-PIPELINE-REQUIREMENTS.md](../architecture/V2-LEAD-PIPELINE-REQUIREMENTS.md); [HLD.md](../architecture/HLD.md) and [API-Spec-and-Build-Plan.md](../architecture/API-Spec-and-Build-Plan.md) updated in place for the new schema/endpoints.
- [x] 2026-08-29 — PROGRESS/TODO + API-Spec pipeline board / `progress` field + AGENTS/ARCHITECTURE notes for matrix + closure rings.
- [ ] Keep this file and PROGRESS.md current each session.
