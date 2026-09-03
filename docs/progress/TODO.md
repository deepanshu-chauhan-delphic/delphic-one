# TODO

Working task list. Check off / move to [PROGRESS.md](PROGRESS.md) as items land. See [AGENTS.md](../AGENTS.md) for project context.

**Sprint tickets live in [SPRINT-PLAN.md](SPRINT-PLAN.md)** (Aug 21 → Aug 28 deploy).

**⚠️ RESUME POINT — read [PROGRESS.md](PROGRESS.md) top entries first.** Product UI + role pipelines + V2 lead/rounds/bench + **2026-08-29** closure-progress rings + requirement × stage matrix (`GET /pipeline/board`) + form field wiring are implemented locally on `main` but **still uncommitted**. **Also landing via cherry-pick `7ba5c90`:** internal-round interviewer multiselect + alert banners. **Open:** commit/push the uncommitted pile; V2 + matrix manual browser click-through; RD-119 E2E; RD-122 deploy day (`DEPLOY_ENABLED` + VPS secrets). See PROGRESS.md 2026-08-29 and 2026-08-27. Manual reports/password: [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md). Spec: [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md). Redesign: [UI-REDESIGN.md](../ui/UI-REDESIGN.md). V2 design: [V2-LEAD-PIPELINE-REQUIREMENTS.md](../architecture/V2-LEAD-PIPELINE-REQUIREMENTS.md).

## Notifications + Interview Calendar (planned)

Full design + build spec: [features/RD-NOTIFICATIONS-AND-CALENDAR.md](../features/RD-NOTIFICATIONS-AND-CALENDAR.md). Sequenced:

- [ ] **Schema** — `Notification` + `NotificationPreference` models + enums; `InterviewRound` gains `status` (`scheduled`/`completed`/`cancelled`), `cancelled_at`/`cancellation_reason`, `reminder_sent_at`/`reminder_1h_sent_at`, reserved `online_meeting_provider`/`external_event_id`. `npm run migrate`; add tables to `helpers.js` truncate list.
- [ ] **Dispatch layer** — `server/src/lib/notifications/` (`eventCatalog.js` `ROLE_EVENT_MATRIX` + `renderNotification`, `recipients.js`, `dispatch.js` `notify()` — role + preference filtered, never throws).
- [ ] **Notifications API** — `server/src/modules/notifications/` (`GET /`, `/unread-count`, `POST /read`, `/read-all`, `GET`/`PUT /preferences`); mount in `app.js`.
- [ ] **Wire call sites** — accounts `changeStage` (→active), requirements `create`/`assign`/`unassign`/`changeStatus`, submissions `addInterviewRound`/`updateInterviewRound`/`changeStage` (submitted/rejected/backout/offer).
- [ ] **Interviews API** — `server/src/modules/interviews/` (`GET /` calendar feed, role-scoped like `entityAccess`; `POST /:id/feedback` for assigned interviewers + managers; `POST /:id/cancel`); mount in `app.js`.
- [ ] **Reminder cron** — add `node-cron`; `server/src/jobs/interviewReminders.js` (T-24h + T-1h, deduped); `startJobs()` from `index.js` guarded by `ENABLE_JOBS` (`false` in test env).
- [ ] **Frontend shared bits** — extract `client/src/lib/interviewRounds.js` (round-type colors/labels); `components/ui/Toggle.jsx`; extend `Badge.jsx` `COLOR_MAP` with `scheduled`/`completed`/`cancelled`; `id="interview-rounds"` on the panel section.
- [ ] **Frontend — notifications** — `NotificationsProvider` (60s poll) in `main.jsx`; `NotificationBell` in `AppLayout` header; `/notifications` page; `/notifications/preferences` page.
- [ ] **Frontend — calendar** — `/calendar` page + nav item (all roles); `monthGrid.js` helpers; `CalendarMonthView` + `CalendarAgendaView`; `EventDetailDrawer` + `FeedbackDrawer`; cancelled shown struck-through / "Cancelled" strip; optional dashboard "My upcoming interviews" widget.
- [ ] **Tests** — `notifications.test.js`, `interviews-calendar.test.js`, `interview-reminders.test.js`.
- [ ] **Docs finalize** — as-built notes in the feature spec; dated `PROGRESS.md` entry; note the bell in `ui/UI-UX-JIRA.md`; `ENABLE_JOBS` in `guides/DEPLOY-RUNBOOK.md`; flip the three v2 rows in `architecture/API-Spec-and-Build-Plan.md`.

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
- [x] Superadmin tier (`User.is_superadmin`, `admin@delphic.in`): full user editing (`PATCH /users/:id` + `password`/`is_superadmin`, `GET /users/:id`), editable account `origin_owner_id`, locked-record edits, `POST /accounts/:id/stage/override`. Update-only, no deletes. Migration `20260901131738_add_is_superadmin`. See PROGRESS.md 2026-09-01.
- [ ] Superadmin: manual browser click-through (edit a user's role/email/password; override a dropped account back to `lead`; change "Brought by"). Confirm an ordinary admin sees none of it.
- [x] **2026-09-01** — `clients-without-requirements` report: "Sales POC" = account owner (renamed), "Brought by" kept, Department filter dropped, Brought-by + Sales-POC person filters added, superadmin can edit both people inline on the Reports page. `interview_scheduled → interview_result` is manual only (no round-result auto-advance). No schema change. See PROGRESS.md.
- [ ] Manual click-through: superadmin edits Brought by / Sales POC inline on the Reports page; the two person filters narrow the list; ordinary admin sees plain read-only cells.
- [x] **2026-09-02** — Reports dropdown shows only `clients-without-requirements` + `recruiter-vendor-gaps` (others `hidden: true`, still defined). `clients-without-requirements` gains a Stage filter defaulting to Active. `recruiter-vendor-gaps` reworked to one row per vendor account (our POC + recruiters + zero-submitted), filterable by vendor + our POC. Internal screening round chips (`ScreeningRoundChips`) on Candidate pipeline + Requirement map cards. Accounts list filterable by Owner + Brought by. See PROGRESS.md 2026-09-02.
- [ ] **Run `cd server && npm test`** once the Docker test DB (`localhost:5434`) is back up — `reports-coverage-gaps.test.js` was rewritten but not executed this session (Docker Desktop was down).
- [ ] Manual click-through: RVG vendor/POC filters + CWR stage filter; screening chips show `IS1/IS2` results on both boards; Accounts Owner/Brought-by filters narrow the list and round-trip through the URL.
- [x] **2026-09-03** — Pipeline board query accepts `recruiter_ids` / `submitted_by_ids` / `admin_id` (matrix "Assigned recruiters" multiselect, "Submitted by" multiselect, "All admins"). `POST /submissions/:id/stage` allows `sales` for `internal_screening → submitted_to_client` on their own requirement only (`forbidden_stage_change` otherwise). `requirements` list returns `tagged_profiles_count`. Accounts list honours `origin_owner_id`. `clients-without-requirements` includes `type: null` accounts. See PROGRESS.md 2026-09-03.
- [ ] **Run `cd server && npm test`** for the 2026-09-03 changes once `localhost:5434` is up — `pipeline-board`, `submissions-stage`, `accounts-*`, `reports-coverage-gaps` cover the touched paths; none executed this session.
- [ ] Manual click-through (2026-09-03): matrix "Assigned recruiters" + "Submitted by" + "All admins" filters narrow the board and round-trip through the URL; sales user sees only "Move to submitted to client" on an owned submission at `internal_screening` (and 403 on anything else); Requirements list shows Tagged Profiles counts; Accounts "Brought by" filter + column; CWR report shows lead/meeting/dropped accounts per the Stage filter after an API restart.
- [ ] Dashboard date-range filter bar is **inert for every metric** (never sent to `/dashboard/summary`, which has no date params). Decide: wire it through, or remove it. Stuck cards are now explicitly "as of today".
- [ ] Decide CWR semantics: keep `requirements: { none: {} }` ("never had a requirement") or switch to "no open/in-progress requirement" so dropped-then-closed clients surface.
- [x] **2026-09-03** — Superadmin stage override for submissions (`POST /submissions/:id/stage/override`, `authorizeSuperadmin`, reason required, audited); a disallowed drag on the submission/account boards opens the override drawer for a superadmin instead of the "Cannot move" toast (`SubmissionDetailPage`, `RequirementKanbanPage`, `CandidatePipelineBoard`, `AccountPipelineBoardPage`, `LeadPipelineBoard`, `AccountsListPage`). See PROGRESS.md 2026-09-03 §8.
- [ ] Manual click-through (superadmin): drag a candidate backward (submitted_to_client → internal_screening) and an account backward (active → rescheduled) on every board listed above; confirm the override drawer opens preset to the drop target, the move lands, and `stage_history` shows `[override] …`. Confirm an ordinary admin still gets the validation toast.
- [ ] `submission/:id/stage/override` has no test yet — add to `submissions-stage.test.js` (superadmin can, admin/recruiter/sales get 403) when `localhost:5434` is up.

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
- [x] Internal round interviewer multiselect (`interview_round_interviewers`) + app-wide alert banners / form validation helpers.
- [ ] Manual click-through (V2 + closure rings + requirement map + interviewer multiselect) in the browser — tests cover the new server surface; UI not yet hand-verified.
- [x] Stuck requirements list normally + `stuck` tri-state filter (`GET /requirements` `is_stuck` + `?stuck=stuck|not_stuck`; requirements list page + requirement map board). Graceful token-expiry: shared refresh promise, redirect to `/login` on unrecoverable 401 (`apiClient.js`).
- [x] **2026-09-02** — Fix: account edit form threw `null.trim()` in `buildAccountBody` for any account with null optional columns, shown only as a generic "Failed to update account" toast (no request sent). `formFromAccount`/`buildAccountBody` moved to `accountUtils.js`, null-coerced, regression-tested.
- [x] **2026-09-02** — Dashboard "Stuck" KPI: value now comes from `stuck_{leads,requirements}_count` (real `prisma.count`, uncapped) instead of the top-5 preview array length. Requirement "stuck" unified to `updated_at <= now-7d` ("no update") across dashboard / requirements list `?stuck=` / pipeline board / reports aging + explorer, matching leads & submissions. KPI hover copy updated. 29 suites / 188 tests green.
- [x] **2026-09-01** — Admin-editable account `type` (one-way `/classify` unchanged; edit-form path is admin-only re-classification, `forbidden_type_change` guard).
- [x] **2026-09-01** — Dashboard KPI fixes: `leads_active` counts all `stage: 'lead'` accounts (not just `type: 'client'`), `leads_in_meeting` includes `rescheduled`; admin dashboard now a 4-col / 10-tile grid with client vs vendor, requirements open vs in-progress, and stuck leads / stuck requirements split into their own cards.
- [x] **2026-09-01** — `components/ui/SearchableSelect.jsx` + 25 data-driven / 6-plus-option `<select>`s converted app-wide (account/requirement/profile/submission forms, list + pipeline + reports filters). Small fixed enums left native. `vite build` green; not hand-clicked in browser yet.
- [x] **2026-09-01** — Vendor account name shown on candidate cards (requirement matrix + candidate pipeline) when `source = vendor` (`/pipeline/board` + `/submissions` now select `profile.vendor_account`).
- [x] **2026-09-01** — Pipeline `submission_stage` filter now hides requirements with no candidate in the selected stage (both boards); board search matches candidate name; `stuck_only` removed in favour of the `stuck` tri-state; wired the created-date range control onto the matrix. **26 suites / 163 tests** green.
- [x] **2026-09-01** — New report tabs `clients-without-requirements` (admin/sales/bda) and `recruiter-vendor-gaps` (admin/recruiter) — accounts/POCs with no downstream activity. `server/tests/reports-coverage-gaps.test.js`.

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
- [x] Interviewer multiselect tests (`interview-round-interviewers.test.js`).
- [x] **2026-09-03** — Prod data-loss safeguards: `start-delphic.sh --prod` takes a verified pre-deploy `pg_dump -Fc` into `./backups/` and aborts on failure (no `--restore` flag; restores are manual). `prisma/_guard.js` blocks the CSV seeds against non-local / `NODE_ENV=production` DBs (`ALLOW_DESTRUCTIVE_SEED=1` override). `start-platform.sh --restore`/`--fresh` guarded likewise. `scripts/db-backup.sh` for scheduled backups. Runbook rewritten. See PROGRESS.md 2026-09-03.
- [ ] **VPS: schedule `scripts/db-backup.sh`** (cron `*/15` or systemd timer) and set `BACKUP_OFFSITE_CMD` to copy dumps off the box. Runbook §0.
- [ ] **Enable Postgres PITR** (WAL archiving) or move to managed Postgres — recovery to the second, not the last dump. This is the real fix for "hours of data lost".
- [ ] Confirm on the VPS: `./start-delphic.sh --prod` writes `./backups/predeploy-*.dump` and the systemd `ExecStart=... --prod --service` path still boots (backup_db brings `db` up first).
- [ ] Wipe the stale `pre-restore-safety-*.dump` / `backup-*.dump` from the repo root (git-ignored but clutter); keep real backups under `./backups/` only.

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
- [x] 2026-09-01 — PROGRESS/TODO updated for admin-editable account type, dashboard KPI fixes + client/vendor + stuck split (4-col grid), and the `SearchableSelect` dropdown migration.
- [x] 2026-09-01 — PROGRESS/TODO updated for vendor-name-on-cards, the candidate-stage filter fix + pipeline filter cleanup, and the two coverage-gap report tabs.
- [ ] Keep this file and PROGRESS.md current each session.
