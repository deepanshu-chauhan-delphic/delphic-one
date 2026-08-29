# Progress Log

Reverse-chronological log of what's been done. Newest entry on top. See [TODO.md](TODO.md) for what's next and [AGENTS.md](../AGENTS.md) for project context.

## 2026-08-29 — Closure progress rings + requirement × stage matrix board + form field wiring

Uncommitted work on `main` (local). Complements the role pipeline boards and V2 lead work.

**Closure probability** (`server/src/utils/closureProgress.js`):
- `computeClosureProgress(stage, interviewRounds)` — percent whose denominator grows with interview rounds (min 2); interview phase fills as rounds resolve; `rejected`/`backout` → `null`.
- `describeClosureSteps` / `computeClosureDetail` — step list for UI breakdown.
- Serialized on submissions (`progress`) and on profiles (best active-submission progress).
- UI: `ProgressRing`, `ClosureStepsBreakdown` on submission detail / list / candidate surfaces and matrix cards.

**Requirement map board** (`GET /api/v1/pipeline/board`):
- New `server/src/modules/pipeline/` (routes + service + validation). Role-scoped requirements + their submissions with progress; admin/sales/recruiter only.
- Frontend: `RequirementMatrixBoard` under `/pipeline?view=matrix` (“Requirement map”); capability `viewRequirementMatrix` for admin/sales/recruiter (not BDA).
- Tests: `closure-progress.test.js`, `pipeline-board.test.js`.

**Form / validation wiring** (schema fields that existed but were missing from create/edit UIs):
- Accounts: `client_agreement_url` / `vendor_agreement_url`; stage move accepts `meeting_notes`.
- Profiles: DOB, gender, relocate, preferred locations, relevant exp, certifications, domain, current CTC, notice/serving notice, etc.
- Requirements: certifications required, time zone, contract duration, billing notes, notice-period max.

**Docs:** this entry; TODO resume point; API-Spec §13 pipeline board + `progress` on Submission/Profile; AGENTS + ARCHITECTURE-OVERVIEW capability notes.

**Verification (2026-08-29):** `cd server && npm test` — **23 suites / 135 tests**, all green (includes new `closure-progress` + `pipeline-board`).

## 2026-08-27 — V2: lead capture, candidate pipeline round taxonomy, requirement types, candidate bench flag, client-performance report

Full design + rationale: [V2-LEAD-PIPELINE-REQUIREMENTS.md](../architecture/V2-LEAD-PIPELINE-REQUIREMENTS.md). Done on local branch `feature/v2-lead-pipeline-requirements`, not yet merged/pushed.

**Schema + migration** (`server/prisma/schema.prisma`, two migrations `20260827115000_v2_add_enum_values` + `20260827120000_v2_lead_pipeline_requirements`, applied to local dev + test DBs):
- `Account.type` is now nullable (a lead can exist before BDA decides client/vendor); added `lead_generated_date`, `location`, `linkedin_url`, `meeting_location`, `classified_at`, `classified_by`.
- New `AccountMeetingAttendee` join table — multiple Sales users can be tagged to a meeting.
- `ProfileSource`: `internal`→`direct` (`linkedin` stays separate).
- `Profile.on_bench` — flags a candidate as currently available for a new submission.
- `RoundType`: `internal|client_l1|client_l2|client_hr|client_final` → `internal_r1|internal_r2|client_r1|client_r2|client_r3|hr_cto_ceo` (old `client_hr`+`client_final` both collapse into the combined `hr_cto_ceo` round).
- `SubmissionStage`: `offer`→`offer_sent`.
- `ReqType`: `project|developer` → `managed_services|recruitment|project`.

**Backend:** new `POST /accounts/:id/classify` (one-way, logged to `StageHistory`); offline meetings require `meeting_location`; `canManageInterviewRound()` lets Sales log client-facing rounds (client_r1-3, hr_cto_ceo) on requirements they own, alongside the submission's recruiter; soft `missing_mandatory_rounds` warning (internal_r1, hr_cto_ceo) serialized on submissions — existing hard gates (unresolved rounds block `offer_sent`, uncleared BGV blocks `closed`) are unchanged; `on_bench` filter on `GET /profiles`. New report `GET /reports/client-performance` mirrors `vendor-performance`, anchored on `Account.type='client'`. Extended `recruiter-performance` (`rounds_missing_mandatory_count`), `sales-performance` (`submissions_missing_hr_cto_ceo_round`), `bda-performance` (`leads_unclassified`, `leads_via_linkedin`, `avg_days_lead_to_meeting`), `vendor-performance` (offer_sent rename).

**Frontend:** lead create form allows an unset type + new lead fields; account detail page gets a "Classify lead" action and meeting-attendee chips; stage-move drawer adds `meeting_location` (required when offline) and a Sales attendee picker; `InterviewRoundsPanel` reworked for the 6 new round types with per-role add/edit gating and a missing-mandatory-rounds banner; candidate list/form get an on-bench toggle + filter, and the submission candidate-picker gets an on-bench quick filter; requirement form's type dropdown is now Managed Services/Recruitment/Project; reports page adds the Client performance report and new columns on BDA/recruiter/sales performance.

**Seed data:** fully remapped to the new enums; added 2 unclassified leads, meeting attendees on 2 accounts, 2 bench-flagged candidates, 1 managed-services requirement, extra `internal_r2`/`client_r3` interview rounds.

**Tests:** `cd server && npm test` — **21 suites / 117 tests**, all green (added `interview-rounds-scope.test.js`, `profiles-bench.test.js`, extended `accounts-stage.test.js` and `reports-ui.test.js`). `npm run lint` — 0 errors. `npm run build --workspace client` — succeeds (3145 modules).

**Not done yet:** nothing outstanding on scope — docs are the last item and this entry covers them. Still uncommitted (local branch only); merge/push/deploy pending user go-ahead.

## 2026-08-26 — Entity access guards, VM deploy scripts, fail-closed env guard

Same commit as the pipeline-board entries below (`a824240`), landing the backend/infra half of that work — not previously logged here.

**Server — centralised entity access checks** (`server/src/lib/entityAccess.js`): `assertCanAccessEntity(user, entityType, entityId)` mirrors each entity's existing getOne ownership rule (BDA→own accounts, sales→own requirements or assigned recruiter, recruiter→own submissions, profiles open to all) and is now the single gate used by the `documents`, `comments`, and history sub-routes instead of ad hoc checks per module. `submissions.controller`/`.service` also tightened to the same recruiter-scoping used by `GET /submissions`. New tests: `entity-access.test.js`, `history-access.test.js`, `uploads-auth.test.js`.

**Fail-closed env guard** (`server/src/config/env.js`): `assertProductionConfig()` now throws at boot under `NODE_ENV=production` if `DATABASE_URL`/`CORS_ORIGIN` are unset or `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are missing, under 32 chars, or match a known placeholder/dev value — a prod boot can no longer silently run on dev secrets. Test: `env.guard.test.js`.

**`server/prisma/seed-admin.js`** — production-safe alternative to the destructive demo `seed.js`: creates one admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` env vars, no-ops if an admin already exists, never truncates tables.

**VM deploy tooling** (previously only `ecosystem.config.js` + `nginx.conf.example`, now removed/rewritten): `setup-vm.sh` (idempotent Ubuntu/EC2 bootstrap — Docker, Compose v2, nginx, certbot) and `start-delphic.sh` (`--prod` runs `docker-compose.yml` + new `docker-compose.prod.yml` overlay with loopback binds; validates `.env` has no placeholder/short secrets before starting; `--service`/`--no-boot` for systemd; installs a `delphic.service` unit). Deploy workflow (`.github/workflows/deploy.yml`) now SSHs to the VPS and runs `./start-delphic.sh --prod` instead of targeting the old bare PM2 layout. `docs/AGENTS.md` deploy line updated to match. `.gitattributes` added (LF-only for `*.sh`/compose files, so scripts don't break with CRLF from a Windows checkout).

RD-121 (deploy story) is effectively delivered by this; RD-122 (deploy day) is still open pending `DEPLOY_ENABLED` + VPS secrets being set for real.

## 2026-08-25 — Dashboard filter polish + list spacing tightened

Client-only visual pass (`07e461e`, not previously logged): `AppLayout`, `FilterBar`, `DataTable`, `ListToolbar`, `KpiCard`, `Badge`, `ChartCard`, `IconButton`, `Tooltip` restyled; new `ExportIcons.jsx`; `dashboardWidgets.js` gained more widget config; denser rows across Accounts/Requirements/Submissions/Profiles list pages and the dashboard.

## 2026-08-24 — CSS pass + Delphic logo

Client-only visual pass (`0ca73e4`, not previously logged): `client/public/delphic-logo.png` added and wired into `AppLayout`; `ChartCard`/`KpiCard` and `AccountDetailPage`/`DashboardPage` layout tweaks.

## 2026-08-26 — Pipeline DnD + card actions menu on every board

All pipeline boards now support drag-and-drop between columns, and stage/status moves live in a ⋯ dropdown on each card (no more “Move stage” / → button rows).

- Shared: `CardActionsMenu`, `pipelineDnd.jsx` (DroppableColumn / DraggableCard / sensors).
- Boards: Lead, Job, Candidate, Requirement kanban, Account matrix.
- Transitions that need a reason/meeting form still open the existing drawers (pre-filled target stage when dropped/selected).

## 2026-08-26 — Role-specific pipelines (BDA leads / Sales jobs / Recruiter candidates)

`/pipeline` is no longer a single account picker for everyone. `PipelineShell` picks a role board; admin can switch via `?view=lead|jobs|candidates`.

- **BDA:** Lead pipeline — accounts as cards in account-stage columns; move stage via existing drawer; drill into `/pipeline/:accountId`.
- **Sales:** Job pipeline — requirements as cards in status columns; expand for submission previews; status moves via `POST /requirements/:id/status`.
- **Recruiter:** Candidate pipeline — own submissions as cards in submission-stage columns.
- **Admin:** Switcher across all three.
- **Backend:** `GET /submissions` (and getOne) auto-scopes recruiters to `submitted_by = self`.
- Dashboard pipeline CTA now always goes to `/pipeline`.
- Capabilities: `viewLeadPipeline` / `viewJobPipeline` / `viewCandidatePipeline`.
- Tests: `pipelineBoardUtils.test.mjs`, `permissions.pipeline.test.mjs`, `submissions-recruiter-scope.test.js`.

## 2026-08-26 — BDA account create/edit/stage gaps + matching list forms

BDA (and admin) create-account from the Accounts list used a stripped mini-form (type/name/industry/POC only), so client/vendor commercial fields and contacts were missing. Peek also called `canMutateAccount(user)` with the wrong arity, so Edit never appeared, and there was no Move stage from the list.

**Fixes:**
- Accounts list create now mounts full `AccountFormPage` (company, contacts, client/vendor commercial).
- Peek: correct `canMutateAccount(account, user)`; actions Open details / Edit / Move stage.
- Shared `AccountStageMoveDrawer` used from list peek, account detail, and pipeline board.
- Same stripped-create pattern on Requirements list → full `RequirementFormPage`.
- Regression test: `client/src/pages/accounts/accountUtils.test.mjs`.

## 2026-08-21 — UX audit pass: all-drawer forms, tooltips, skill picker, richer seed, pipeline visibility, report accuracy

Full audit (API↔frontend mapping, dead UI, modal/drawer compliance, seed/pipeline/reports) followed by a fix pass across client and server. Verified end-to-end via `npm run lint` (0 errors), `npm run build`, and a live Docker stack re-seed + login/report checks through the client proxy.

**All forms/confirmations now RHS drawers, never modal or full page:**
- Account, Requirement, and Profile edit now open in an RHS drawer from their detail pages (`?edit=1` query param), matching how create already worked. Old `/:id/edit` routes redirect via a shared `EditRedirect` helper in `App.jsx`.
- Converted the last `components/ui/Modal.jsx` usages to `Drawer`: `ChangePasswordModal.jsx` → `ChangePasswordDrawer.jsx`, and the three modals on `RequirementDetailPage.jsx` (status change, seat stage, add seat).
- Converted two hand-rolled centered dialogs (`fixed inset-0` divs, not even using `Modal.jsx`) to `Drawer`: `AccountDetailPage.jsx`'s stage-move dialog and `UnlockButton.jsx`.
- Renamed `AssignRecruiterModal.jsx` → `AssignRecruiterDrawer.jsx` (it already rendered a Drawer; filename-only fix).
- New admin-only Departments create/edit drawer on `/users`, wiring up the previously-unused `POST/PATCH /departments` endpoints.
- Deleted the dead, unused `GET /submissions/:id/interview-rounds` route/controller/service method.
- Fixed `ReportsPage.jsx`'s export download to go through `apiClient` (blob response) instead of a raw `fetch`, so it gets the shared 401/refresh-token handling.

**New: searchable skill/tech-stack picker** — `components/ui/SkillPicker.jsx` + `lib/skillsCatalog.js` (~150 curated entries with category icons from `lucide-react`, no new dependency). Replaces the old free-text CSV inputs on Candidate (`primary_skills`/`secondary_skills`) and Requirement (`primary_tech_stack`/`secondary_tech_stack`) forms; always allows adding a custom/unlisted skill since the backend stores plain string arrays.

**New: hover tooltips** — `components/ui/Tooltip.jsx`. Applied to dashboard KPI cards (each now explains exactly what it counts and its scope), report KPI columns via renamed fields (see below), stage-change buttons on Requirement/Submission detail pages (flags which transitions require a reason/date), and `UnlockButton`.

**Pipeline visibility:** BDA's dashboard funnel was always empty (it showed the submission funnel, which BDAs don't own) — added `accountFunnelFromRows` in `dashboard.service.js` so BDA now sees a real lead-stage funnel (lead → meeting_scheduled → active/dropped). Added a "View pipeline board" / "View all leads" CTA to the dashboard's pipeline section linking into Requirements/Accounts.

**Reports/KPI accuracy fixes** (`reports.service.js`, `dashboard.service.js`):
- Unified the stuck/aging threshold into one `server/src/config/constants.js` (`STUCK_THRESHOLD_DAYS`) instead of three separate hardcoded `7`s.
- `bdaPerformance`'s `clients_active`/`vendors_active`/`stuck_leads_7d` were all-time snapshots silently mixed into an otherwise period-scoped report row — renamed to `clients_active_current`/`vendors_active_current`/`stuck_leads_current` (and updated `reportViews.js` columns) so the snapshot semantics are explicit instead of implied.
- `salesPerformance.avg_closure_days` was anchored on requirement `created_at` falling in the date range (inconsistent with `periodClosures`, which anchors on the closure event) — now anchored on `closed_at` falling in range, matching. Caught and fixed a bug in this same change during testing: the first version didn't filter `status: 'closed'`, so dropped requirements (which also stamp `closed_at`) were pulled into the average — verified via a real seeded example (61 days → 32 days after the fix).
- Unified "interviews this week" anchor logic (`completed_at` if set, else `scheduled_at`) across all three dashboard summary functions and `reports.summarizeInterviewRounds`, via a shared `interviewsInRangeWhere()` helper — previously the dashboard only looked at `scheduled_at`, so a completed interview could disappear from the dashboard count while still showing in the equivalent report.

**Seed data enrichment** (`server/prisma/seed.js`): 5→8 users (2nd sales/BDA/admin, real activity for recruiter #2), added `dropped`/`rescheduled` account examples and `on_hold`/`dropped` requirement examples, 5→10 profiles, submissions now cover every `SubmissionStage` (added `interview_result`/`bgv`/`backout`/`rejected`), full per-transition `StageHistory` rows instead of one snapshot per record, 0→6 `Document` rows (resumes, agreements, job docs — model existed but was never seeded), wider date spread (up to ~250 days back) for month/quarter trend views, and interview rounds now include `no_show`/`rescheduled` results and a feedback/no-feedback mix.

**Loading states:** `DataTable.jsx`'s loading state now renders skeleton rows (covers every list page at once, since they all already pass `loading` through). Added `components/ui/DetailSkeleton.jsx` and wired it into Account/Requirement/Profile/Submission detail pages, replacing bare "Loading…" text.

**Docs:** seeded-user list in this file updated to include the 3 new demo accounts.

## 2026-08-21 — RD-133 UI redesign (drawers, pipeline KPIs, BDA/Sales reports)

**Ticket:** **RD-133** — marked **DONE (Aug 21)** in [SPRINT-PLAN.md](SPRINT-PLAN.md). Guide: [UI-REDESIGN.md](../ui/UI-REDESIGN.md). Commit: `0add970` on `dev-deep`.

**UX**

- Shared `DataTable` + `ListToolbar` on list pages; row click opens RHS peek drawer with actions (not full-page navigation).
- Create flows (candidate, put-forward, account, requirement, user) and assign/interview forms use narrow scrollable RHS `Drawer` with tone colors (`create` / `edit` / `danger` / `info`).
- Dashboard: real KPI numbers only; submission pipeline promoted and always visible to admin.
- Interview rounds: RHS drawer; **interview date & time required** on create (API Zod + UI).

**Reports**

- Added admin **BDA performance** (`GET /reports/bda-performance`) — lead funnel by account `owner_id`.
- **Sales performance** measures requirements/joinings/margin by `sales_owner_id` (no longer treats sales as lead owners).

**Docs:** [UI-REDESIGN.md](../ui/UI-REDESIGN.md), [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md), [TESTING-RD-111-125-112.md](../testing/TESTING-RD-111-125-112.md), [AGENTS.md](../AGENTS.md), API spec report section.

## 2026-08-21 — Hide Profiles (and Reports) from BDA nav

BDA has no API access to `/profiles` (403 Insufficient role) but the sidebar still linked to Candidates and showed an empty error page. Nav now role-filters Profiles + Reports; profile routes redirect to home via `RoleRoute` + `canViewProfiles`.

## 2026-08-21 — Merged `origin/dev` into local `dev-deep` (no conflicts)

Merged RD-116 ESLint + RD-120 Docker compose CI smoke (`ef67c7d` / `d0feab9`) into `dev-deep` on top of the ChangePasswordModal import fix (`d247b82`). Merge commit `7c4606e`. No conflicts.

## 2026-08-21 — Docs reorganized by function

Moved markdown under `docs/` into folders and updated cross-links + [AGENTS.md](../AGENTS.md) index:

| Folder | Purpose |
|---|---|
| `architecture/` | Diagrams, HLD, field model, API spec |
| `ui/` | Jira UX + RD-115 walkthrough + `references/` |
| `testing/` | Demo seed + ticket test guides |
| `progress/` | PROGRESS, TODO, SPRINT-PLAN |
| `guides/` | Backend logging (and similar operator guides) |

`docs/AGENTS.md` stays at the docs root as the entry point.

## 2026-08-21 — Dev B RD-114 + RD-128 (reports UI + change password)

- **RD-114:** Reports page shows role-filtered reports, default month date range, Recharts bar charts, dense tables (not raw JSON), aging sections, closure group-by, Excel/PDF download. Export API writes multi-sheet Excel for aging and tabular PDF rows.
- **RD-128:** Header avatar menu → Change password modal (`POST /auth/change-password`) + Logout.

**Tests:** `reports-ui.test.js` + existing `auth.test.js` change-password. Guide: [TESTING-RD-114-128.md](../testing/TESTING-RD-114-128.md).

**Still open:** RD-119 E2E · RD-121 deploy story · RD-122 deploy day.

## 2026-08-21 — Dev A RD-116 + RD-120 (lint + Docker CI smoke)

- **RD-116:** Root ESLint 9 flat config (`eslint.config.mjs`) for `server/src` (Node/CJS) and `client/src` (React). Scripts: `npm run lint` / `npm run lint:fix`. Warnings allowed; errors fail CI.
- **RD-120:** `.github/workflows/ci.yml` now runs lint + client build + syntax check, plus a **docker-smoke** job: `docker compose up --build`, wait for `/api/v1/health`, seed, POST login on API `:4000` and via client proxy `:8081`.

**Verify locally:** `npm run lint` (0 errors). Docker smoke needs Docker Desktop running.

## 2026-08-21 — RD-110 / RD-127 / RD-115 completed after merge

Re-wired post-merge gaps on Dev B detail pages:

- **RD-110:** `NotesPanel` + `FilesPanel` on Job (`RequirementDetailPage`) and Submission (`SubmissionDetailPage`) — Account + Candidate already had them.
- **RD-127:** Admin `UnlockButton` on locked requirement header, locked seat rows, and locked submission header (Account already wired).
- **RD-115:** Spec walkthrough updated — Job form, put-forward, kanban, interview, Notes/Files/Unlock marked Present; RD-114/128 later completed on this branch.

## 2026-08-21 — Staging updated with merged Dev A + Dev B

Fast-forwarded `staging` to `4b0b61b` (same tip as `dev-deep`: `origin/dev` merge + status docs). Pushed to `origin/staging`.

## 2026-08-21 — Local `dev-deep` pulled from `dev` (no conflicts)

Fast-forwarded local `dev-deep` to `origin/dev` (`c01e99f`). No merge conflicts.

Brought in Dev A work already on `dev`: accounts (RD-101/102), profiles (RD-105), assign recruiter (RD-106), Notes/Files (RD-109/110), dashboard (RD-113), unlock (RD-127), RD-115 walkthrough, plus conflict-resolution commit from the main/dev merge.

**Branch tip after pull:** `c01e99f` (`origin/dev`); docs note commit followed on `dev-deep` / `staging`.

**Open remaining (after RD-110/127 follow-up):** RD-114, RD-116, RD-119–122, RD-128.

## 2026-08-21 — Merged Dev A + Dev B onto main

Pulled Dev B Days 1–3 (RD-103/104, RD-107/108, RD-111/125/112) and restored Dev A work (accounts, candidates, assign, notes/files, dashboard, unlock, UX). Conflict-resolved App routes and list pages; both Create/Put-forward and Assign/filter UX kept.

## 2026-08-21 — Synced Dev B Days 1–3 to all branches

Committed and pushed RD-103/104, RD-107/108, RD-111/125/112 (requirements + submissions UI, stage buttons, interview rounds, kanban), demo seed + test guides. Branches `main`, `staging`, `dev`, and `dev-deep` fast-forwarded to the same tip.

## 2026-08-21 — Dev B Day 3: RD-111 + RD-125 + RD-112

- **RD-111:** Submission detail stage move buttons + modal (backout/rejection reason required).
- **RD-125:** `InterviewRoundsPanel` — add/edit internal + client rounds (schedule, interviewer, feedback, rating, result).
- **RD-112:** `/requirements/:id/board` kanban by stage; cards link to submissions; quick stage chips. Linked from requirement + submission detail.

**Tests:** `submissions-pipeline-ui.test.js` — **77** green. Guide: [TESTING-RD-111-125-112.md](../testing/TESTING-RD-111-125-112.md).

## 2026-08-21 — Demo seed for frontend / dashboard E2E

Expanded `server/prisma/seed.js` beyond users: accounts (incl. stuck lead + active clients), requirements/seats/assignments, profiles, submissions across funnel stages, interview rounds, stage history, comments. Re-run wipes all demo tables then recreates.

**How to test:** [TESTING-DEMO-SEED.md](../testing/TESTING-DEMO-SEED.md).

## 2026-08-21 — Dev B Day 2: RD-107 + RD-108 (submissions UI)

- **RD-108:** `/submissions/new` — pick active candidate + requirement + open seat, rates, live margin preview, create → detail.
- **RD-107:** `/submissions/:id` — stage stepper, candidate + job/seat panels, editable commercials/margin + offer/BGV, interview rounds list (read-only), stage history. List links + **+ Put forward** for recruiter/admin.

Shared maps: `server/.../submissions/stageMachines.js` + `client/src/lib/submissionStages.js`.

**Tests:** `submissions-crud-ui.test.js`, `submission-stage-machines.test.js` — **72** green.  
**How to test:** [TESTING-RD-107-108.md](../testing/TESTING-RD-107-108.md).

## 2026-08-21 — Dev B Day 1: RD-103 + RD-104 (requirements UI)

Implemented Job Requirement frontend for Dev B Aug 22 tickets:

- **RD-104:** `/requirements/new`, `/requirements/:id/edit` — create/edit form (active client, seats_total on create, tech stack, budget, etc.); list **+ Create**; detail **status** buttons + **Add seat** modal.
- **RD-103:** `/requirements/:id` — info panels, seats table with per-seat stage controls (open→interviewing→offer→bgv→closed with `joined_at`, drop+reason), assigned recruiters + assignment history, requirement status history. Badge colors for seat stages. Modal for confirmations.

Shared stage maps: `server/.../stageMachines.js` + `client/src/lib/requirementStages.js` (keep in sync).

**Tests:** `stage-machines.test.js`, `requirements-crud-ui.test.js` — **62** tests green.  
**How to test manually:** [TESTING-RD-103-104.md](../testing/TESTING-RD-103-104.md).

## 2026-08-21 — Dev A Day 5 unlock + spec/UX (RD-127 / RD-115)

**RD-127:** Reusable `UnlockButton` (`POST /admin/:entity_type/:entity_id/unlock` with reason). Wired for admin on locked Account detail and Candidate/Account surfaces; Job/Submission unlock still to verify after Dev B detail merge.

**RD-115:** Spec walkthrough logged in [RD-115-SPEC-WALKTHROUGH.md](../ui/RD-115-SPEC-WALKTHROUGH.md). Fixed owned UX gaps: Requirements/Submissions Basic filter bars + mono keys + denser tables; AppLayout Delphic brand + tighter chrome.

**Verification:** Docker client production build passed (913 modules). Stack restarted on `:8081`.

## 2026-08-21 — Dev A Day 4 role dashboard (RD-113)

Frontend-only home dashboard wired to existing role-scoped `GET /dashboard/summary`:

- Title uses `{name}'s Dashboard` with role-specific subtitle.
- Stat cards differ by role (BDA: account counts; Sales/Recruiter: jobs/submissions/interviews; Admin: full set including interviews + closures).
- Stuck leads (Admin/BDA) and stuck requirements (Admin/Sales/Recruiter) with deep links.
- Pipeline funnel for Admin/Sales/Recruiter; Recent activity for all roles with entity links.
- Widget config in `client/src/pages/dashboard/dashboardWidgets.js`.

**Verification:** Docker client production build passed (913 modules). Stack restarted on `:8081`.

## 2026-08-21 — Dev A Day 3 Notes + Files (RD-109 / RD-110)

Reusable panels plus drop-in on Account and Candidate detail:

- `NotesPanel` and `FilesPanel` under `client/src/components/` — list/add notes via `/comments`, list/upload/delete via `/documents`.
- Wired on Account detail (sidebar) and Candidate detail (FilesPanel + Notes).
- Backend: `CommentEntityType` + validation now allow `profile` (migration `20260821153000_comment_entity_profile`).
- **Follow-up:** wire Notes/Files onto Dev B Job + Submission detail pages if not already present.

**Verification:** Docker client production build passed (912 modules).

## 2026-08-21 — Fix profile date fields for Prisma DateTime

**Root cause:** HTML date inputs send `YYYY-MM-DD`, but Prisma `DateTime` rejected that as “premature end of input”.
**Fix:** Frontend maps date-only values to ISO (`…T00:00:00.000Z`); profiles service also normalizes `date_of_birth` / `last_working_day` / `earliest_join_date` on create/update.
**Verified:** `POST /profiles` with `date_of_birth=1995-08-27` returned 201 and stored `1995-08-27T00:00:00.000Z`.

## 2026-08-21 — Dev A Day 2 candidates + assign UI (RD-105 / RD-106)

Frontend-only work plus one narrow users-list permission for Sales:

- Candidate list: Jira-like filters, create button, detail links (`PRF-…` keys).
- Candidate create/edit form with personal, professional, education, compensation, sourcing fields; optional resume file on create/edit.
- Candidate detail page with full field panels, resume upload/delete via documents API, and submission history sidebar.
- Assign recruiter modal from the Requirements list (Assign / Assignments action): active assign/unassign for Sales/Admin, full assignment history for all viewers.
- Backend: `GET /users` now allows Sales, but Sales is forced to `role=recruiter` only so they can pick assignees without seeing other roles. Create/patch users stay admin-only.

**Verification:** Docker client production build passed (908 modules).

## 2026-08-21 — Dev A Day 1 accounts UI complete (RD-101 / RD-102)

Implemented the Client/Vendor frontend:

- Jira-like Accounts list with search, type/stage filters, pagination, owner initials, account keys, detail links, and a role-gated Create action.
- Account detail page with company, contact, meeting, client/vendor commercial fields, additional contacts, lock state, and stage history.
- Stage movement modal follows the existing API state machine. Meeting scheduling requires mode/date; dropping requires a reason.
- Shared create/edit form covers company, primary/additional contacts, and client/vendor-specific fields. Only BDA/Admin can create; edits follow ownership and lock rules.
- Added `/accounts/new`, `/accounts/:id`, and `/accounts/:id/edit` routes.

**Verification:** Docker client production build passed (903 modules transformed).

## 2026-08-21 — Docs synced; logging + Jira UX noted; ticket snapshot

Documented and linked for the next session:

- [BACKEND-LOGGING.md](../guides/BACKEND-LOGGING.md) — full logging guide
- [UI-UX-JIRA.md](../ui/UI-UX-JIRA.md) + [references/jira-like-dashboard-reference.png](../ui/references/jira-like-dashboard-reference.png)
- [SPRINT-PLAN.md](SPRINT-PLAN.md) — Done (9) / Open (22) ticket snapshot
- AGENTS, README, TODO, PROGRESS, API-Spec security bullet, compose `LOG_LEVEL`

## 2026-08-21 — Standing UX note: Jira-like UI

Stakeholder direction: product UI/UX must feel like **Atlassian Jira** (issue search / filters / dense list), not a generic admin CRUD theme.

Documented in [UI-UX-JIRA.md](../ui/UI-UX-JIRA.md). Reference screenshot saved at [references/jira-like-dashboard-reference.png](../ui/references/jira-like-dashboard-reference.png). Cross-linked from AGENTS, TODO, SPRINT-PLAN, and README. Frontend tickets (lists, dashboard, detail chrome, RD-115) must follow this before done.

## 2026-08-21 — Backend structured logging (documented)

Added a zero-dependency logger (`server/src/config/logger.js`): levels `error|warn|info|debug` via `LOG_LEVEL` (default debug in dev, info in prod, error in tests). Pretty lines in development; JSON in production.

Wired:
- HTTP access log middleware (`requestLogger`) — method, path, status, duration_ms, user when present; skips `/health` and test env
- `errorHandler` logs validation/warn vs 500 errors with stack
- Process startup/shutdown + uncaughtException / unhandledRejection in `index.js`

**Docs:** full operator/developer guide in [BACKEND-LOGGING.md](../guides/BACKEND-LOGGING.md); cross-links in [AGENTS.md](../AGENTS.md), root README, `.env.example` files, and compose `LOG_LEVEL`. `server/.env.example` documents `LOG_LEVEL`. **50 tests green.**

## 2026-08-21 — Interview feedback confirmed/extended; recruiter/sales reports get interview + closure depth (RD-132)

**Feedback:** Already supported on `InterviewRound` (`feedback`, `rating`) via `PATCH /interview-rounds/:id`. Extended so recruiters can also submit **feedback + rating + result on create** (`POST /submissions/:id/interview-rounds`) — useful for logging a completed internal screen in one step. Completing a result auto-sets `completed_at`.

**Reports (recruiter-performance + sales-performance)** now include for the date range:
- `interviews_total` / `interviews_completed` / `interviews_pending`
- `interviews_internal` vs `interviews_client`, plus `interviews_by_type` and `interviews_by_result`
- `interviews_with_feedback` / `interviews_missing_feedback`
- `avg_interview_rating`, `avg_days_interview_turnaround` (scheduled → completed)
- `closures_count`, `closure_rate_percentage` (recruiter); sales also gets period closures + same interview stats on owned requirements

Recruiters can call `GET /reports/recruiter-performance` scoped to themselves. Export flatten now expands nested metric objects.

## 2026-08-21 — One-click test login + Admin Users page (RD-126 / RD-131)

**One-click login (temporary):** Login page shows Admin / BDA / Sales / Recruiter buttons that sign in as seeded users (`*@delphic.local` / `Password123!`). Marked clearly as testing-only; hide with `VITE_DISABLE_QUICK_LOGIN=true`. Lives in `client/src/lib/testAccounts.js` — remove when real auth/SSO lands.

**Admin-only user provisioning:** `/users` page (admin nav only) lists users, creates BDA / Sales / Recruiter / Admin with a temporary password shown once for sharing, and activate/deactivate. Backend `POST/PATCH /users` was already `authorize('admin')`; create now returns 409 on duplicate email. Non-admins are redirected away from the page.

Everyone else signs in with credentials the admin shares (or uses one-click for seed accounts during testing).

## 2026-08-21 — Sprint plan filled with previously missing tickets; progress docs synced

**Why:** An audit against the API/build plan found product gaps that existed in the backend (or were only implied in older tickets) but were **not named as sprint tickets** — so they could slip past Aug 28.

**Added / expanded in [SPRINT-PLAN.md](SPRINT-PLAN.md):**

| Ticket | What was missing |
|---|---|
| RD-103 / RD-104 | Explicit **seat stage controls** and **Add seat** (API existed; tickets only said “list seats” / requirement status) |
| RD-111 | Clarified full stage list including **`internal_screening`** |
| **RD-125** | **Interview rounds UI** — recruiter **internal** rounds + client rounds (API/`round_type: internal` already supported; no FE ticket before) |
| **RD-126** | **Admin Users page** (API existed; no UI — needed for real team accounts on deploy) |
| **RD-127** | **Unlock UI** on locked detail pages (API + tests existed; no button) |
| **RD-128** | **Change password** from header/menu (API existed; no UI) |
| RD-113 / RD-114 | Noted that stuck lists, role scoping, avg days, and export **APIs are already done** — FE only |
| RD-119 | E2E walkthrough must include internal interview, seat close, unlock, create user |
| **RD-129** | Ownership + dashboard role scoping — marked **DONE (Aug 21)** |
| **RD-130** | admin/comments/documents module split — marked **DONE (Aug 21)** |
| RD-117 / 118 / 123 / 124 | Already marked DONE; left in plan for history |

Also added a **Backend vs frontend map** table in the sprint plan so owners can see what is API-ready vs still UI.

**TODO.md** resume point updated: next work is frontend Day 1 (RD-101+) plus the new FE tickets above. Backend remains **47 tests green**, uncommitted until asked.

## 2026-08-21 — Split admin / comments / documents into routes/controller/service/validation

Brought the three remaining routes-only modules in line with the rest of the server:

- `admin/` — unlock body/params validation, `admin.service.unlock`, thin controller/routes
- `comments/` — list/create service + Zod validation + controller
- `documents/` — list/create/remove in service (DB + unlink); multer upload stays in routes (transport); meta validated in `documents.validation.js`

Smoke coverage in `server/tests/modules-split.test.js` (comments CRUD-ish, document upload/list/delete, admin unlock). **7 suites / 47 tests green.**

## 2026-08-21 — Remaining backend product gaps closed (RD-123, RD-124, ownership, dashboard scoping)

**Done and verified** (`cd server && npm test` → initially 43 tests; now 47 with module-split suite):

1. **RD-123 — dashboard stuck lists:** `dashboard.service.js` now reuses the same aging rules as the Aging report (7+ days). Spec shape: `stuck_leads: [{id,name,days_in_stage}]`, `stuck_requirements: [{id,title,days_open,submissions_count}]` (top 5 each). Hardcoded `[]` removed.
2. **Dashboard role scoping:** admin = global; BDA = own accounts/leads; sales = own requirements + related pipeline; recruiter = assigned reqs + own submissions/funnel.
3. **RD-124 — avg stage days:** recruiter performance computes `avg_days_*` from `stage_history` (+ interview-round fallback for interview start). Vendor performance computes `avg_days_to_submit` from requirement `created_at` → submission `created_at`. Interview auto-advances now also write `stage_history` so metrics stay accurate.
4. **Ownership on mutate:** BDA can only PATCH/stage own accounts; sales can only mutate own requirements (update/status/assign/unassign/addSeat). Admin unrestricted. List/getOne scoped the same way for BDA/sales.

**New tests:** `server/tests/backend-gaps.test.js` (stuck lists, role scoping, ownership 403s, recruiter/vendor avg days).

**Remaining sprint work** is frontend + infra (see SPRINT-PLAN RD-101+ and RD-125–128 open FE tickets).

## 2026-08-21 — Test suite finished and green (auth, locking, accounts/requirements/submissions stage machines)

**Ran and fixed** the suite Claude left unexecuted, then wrote the two missing files. Final result: **5 suites / 36 tests, all passing** (`cd server && npm test`).

**Fixes found by first run:**
1. Login rate limiter (`max: 5 / 60s` in `server/src/app.js`) was hitting mid-suite → 429. Skipped the limiter when `NODE_ENV === 'test'`.
2. Account stage machine only allows `dropped` from `meeting_scheduled` / `rescheduled` / `active` — not from `lead`. `locking.test.js` and two cases in `accounts-stage.test.js` were dropping from `lead` and would have failed; rewritten to schedule a meeting first. Post-lock transition assertion corrected to **403** (lock check before transition validity), matching the service.

**New files (RD-117):**
- `server/tests/requirements-stage.test.js` — requirement status (incl. `seats_not_closed`, drop+lock), seat machine (skip/join_at/drop reason), auto-close parent when last seat closes or drops, assign/unassign + role mismatch.
- `server/tests/submissions-stage.test.js` — margin on create, vendor_rate gate, duplicate submission, skip/backout/reject reasons, `rounds_not_resolved` / `bgv_not_cleared` gates, auto-advance via interview rounds, full happy path to closed (locks submission + seat).

**Helpers extended:** `createRequirement`, `createProfile` in `server/tests/helpers.js`.

**Still uncommitted** (do not commit unless asked): test suite + app.js rate-limit skip + earlier SPRINT-PLAN RD-123/RD-124 edit + package-lock / jest deps.

## 2026-08-21 — Sprint plan corrected; test suite started but NOT yet run — paused mid-work

**Read this whole entry before touching `server/tests/` — work stopped mid-task, nothing here has been verified to pass.**

**Sprint plan correction (uncommitted):** User asked "are all backend APIs done?" — did a real grep of every route file against every endpoint in `docs/architecture/API-Spec-and-Build-Plan.md`. Result: all 52 spec endpoints exist with correct method + role guard. But that's route *coverage*, not correctness — two known stubs were already tracked (dashboard's `stuck_leads`/`stuck_requirements` hardcoded to `[]`; six `avg_days_*` report fields always `null`). Added these as explicit tickets **RD-123** and **RD-124** to `docs/progress/SPRINT-PLAN.md` (Day 5, Dev A) and to the published artifact, and rewrote the plan's intro to stop implying "backend: done" without qualification. **This edit is saved to disk but not committed** — user explicitly said "do not commit by yourself to github until asked for" (now saved as a standing feedback memory).

**Test suite: infrastructure built, files written, but never executed — this is the important part.** User asked to "run the tests," which surfaced there were none. Set out to write and run a real suite for the highest-risk logic (stage machines, locking, auth — matching `RD-117`/`RD-118`), then got interrupted by a "pause, document everything" instruction before `npm test` was run even once. Concretely, as of this entry:

- Installed `jest` + `supertest` as server devDependencies (`npm install --workspace server` — succeeded, `package-lock.json` updated).
- Added `server/jest.config.js` (setupFiles-based env injection, `testMatch: tests/**/*.test.js`).
- Created an **isolated test database**: `requirement_dashboard_test` on the same Dockerized Postgres the dev DB (`requirement_dashboard`) already lives on (`docker exec delphic_one-db-1 psql -U postgres -c "CREATE DATABASE requirement_dashboard_test;"`), then applied the existing migration to it with `DATABASE_URL=...localhost:5434/requirement_dashboard_test npx prisma migrate deploy` — this succeeded and printed a Prisma update notice (5.22.0 → 7.9.1 available; not acted on, just noted).
- `server/tests/env.setup.js` — points `DATABASE_URL` at the test DB and sets test JWT secrets, loaded via Jest `setupFiles` so it runs before `src/app.js`/`src/config/db.js` are ever required (dotenv in `config/env.js` won't clobber env vars already set, so this is safe).
- `server/tests/helpers.js` — `cleanDatabase()` (raw `TRUNCATE ... RESTART IDENTITY CASCADE` across all 11 tables), `createUser()`, `loginAs()` (hits the real `/auth/login` endpoint via supertest), `createActiveClientAccount()`, `authed()` helper for attaching bearer tokens.
- `server/tests/auth.test.js` — 8 tests: login success/wrong-password/deactivated-user, `/users/me` with and without a token, refresh (valid + garbage token), change-password (wrong current password, then success, then confirms the old password stops working and the new one works).
- `server/tests/locking.test.js` — 2 tests: full lock lifecycle (create account → edit while unlocked → drop it → confirm edit now 403s → confirm a further stage transition now 403s, not 400, because the lock check runs before the transition-validity check → admin unlocks → edit works again), and confirming a non-admin gets 403 from the unlock endpoint itself.
- `server/tests/accounts-stage.test.js` — 6 tests covering the account stage machine: can't skip lead→active, meeting_scheduled requires its fields, dropped requires a reason, the full valid path with history verification, rescheduled looping back to meeting_scheduled, and dropped being terminal (confirmed the *right* status code: 403 locked, not 400 invalid-transition, since drop sets `is_locked` before any further attempt). **One bug in this file was caught and fixed before being run**: a test originally asserted `rescheduled` would 400 without a reason — checked `accounts.validation.js` directly and confirmed `reason` is optional for every transition except `dropped`, so the test was rewritten to assert 200 and actually verify the reschedule → meeting_scheduled loop instead of a guess.
- **Not yet written:** `requirements-stage.test.js` (requirement status transitions, `seats_not_closed` gate, seat stage machine, auto-close-requirement-when-all-seats-close side effect, assignment/unassignment) and `submissions-stage.test.js` (full submission pipeline, `rounds_not_resolved` gate, `bgv_not_cleared` gate, backout/rejection reason requirements, margin calculation). These are exactly `RD-117`'s scope and are the two files most likely to actually catch a bug, since submissions has the deepest state machine.
- **Not yet done, at all:** running `npm test` (or `npx jest`) even a single time. Zero confirmed pass/fail for anything above. Do not report these tests as "passing" or "written and verified" — they are only "written, believed correct by inspection."

**Environment state left behind:** `docker compose up -d` is running (db/server/client containers), plus the extra `requirement_dashboard_test` database sitting alongside the dev one in the same Postgres instance/volume. Next session should: run `cd server && npm test` first (fix whatever it finds — first real signal), then write the two missing test files, then decide with the user whether to commit.

## 2026-08-21 — Dockerized the stack; verified working end-to-end

- Added `server/Dockerfile`, `client/Dockerfile` (multi-stage build → `nginx:1.27-alpine` runtime, `client/nginx.conf` proxies `/api` and `/uploads` to the `server` container), root `docker-compose.yml` (`db`/`server`/`client` services, named volumes for Postgres data and uploads), `.dockerignore`, and root `.env.example` for compose overrides.
- Ran `npm install` for real in both `server/` and `client/` workspaces (previously never installed) — both installed cleanly, no dependency resolution errors. Committed the resulting root `package-lock.json`.
- `docker compose up --build` surfaced a real bug: `node:22-alpine` has no OpenSSL, and Prisma's schema-engine binary needs it — server crash-looped with `Could not parse schema engine response`. Fixed by adding `RUN apk add --no-cache openssl libc6-compat` to `server/Dockerfile`.
- Discovered `prisma migrate deploy` (used in the container's startup command) only *applies* existing migrations — it doesn't generate them, and no `prisma/migrations` folder existed yet. First attempt to generate one via `docker compose run --rm ... prisma migrate dev` *appeared* to succeed (applied against the real `db` service) but the generated migration files were written into that ephemeral `--rm` container's throwaway layer and vanished when it exited — confirmed by checking the host filesystem afterward and finding no `server/prisma/migrations/` directory at all, despite `docker exec ... psql \dt` showing all 12 tables present in the actual database.
- Also hit a host networking gotcha: this machine runs two native (non-Docker) Postgres instances on `localhost:5432` and `localhost:5433`, and native Apache/XAMPP on `localhost:8080`. `docker-compose.yml`'s original default host ports (5433, 8080) collided with these — connections silently reached the *wrong* server (confirmed via `netstat -ano` showing two LISTENING PIDs per port, cross-referenced with `Get-Process` to identify one as `postgres.exe`/`Apache` and the other as Docker's proxy). Fixed by moving the compose defaults to unused ports: Postgres → `5434`, client → `8081`.
- **Resolution:** dropped/recreated the dev database, then ran `prisma migrate dev --name init` directly from the *host* (`server/` with `DATABASE_URL` pointed at `localhost:5434`) — this writes the migration folder to the real host filesystem, unlike running it inside a `docker compose run --rm` container. Confirmed `server/prisma/migrations/20260821054624_init/migration.sql` now exists on disk and is committed.
- Did a full clean-slate verification: `docker compose down -v` (wipes volumes) → `docker compose up -d --build` → server logs show `1 migration found in prisma/migrations` / `All migrations have been successfully applied` (this is the real proof the Docker image works standalone, not dependent on manually-generated state) → seeded via `docker compose run --rm --entrypoint "" server sh -c "node prisma/seed.js"` → `POST /auth/login` returns a real JWT for `admin@delphic.local` / `Password123!`, `GET /users/me` and `GET /dashboard/summary` both return correct data, and the same login works through the client's Nginx proxy on port 8081, not just hitting the API directly on 4000.
- Docker Desktop itself dropped between sessions (daemon stopped responding, `docker info` failed) and had to be relaunched; on restart, the previously-running containers resumed automatically. Environment flakiness, not a project bug — noted in case it recurs.
- Updated `docs/AGENTS.md` "Local setup" with the verified Docker quick-start and the port/migration-generation gotchas above so the next session doesn't have to rediscover them.

## 2026-08-20 — Migrated server from Knex to Prisma

- Replaced Knex query builder with Prisma ORM across the whole server: `server/prisma/schema.prisma` now defines all 11 tables (as Prisma models/enums) that previously lived as 12 numbered Knex migration files — those migration files and `knexfile.js` are deleted.
- `server/src/config/db.js` now exports a `PrismaClient` singleton instead of a Knex instance; every service file and route module (`auth`, `users`, `accounts`, `requirements`, `profiles`, `submissions`, `documents`, `comments`, `admin`, `dashboard`, `reports`, and `middleware/lockCheck.js`) rewritten to Prisma's query API (`findMany`/`findUnique`/`create`/`update`, `$transaction` in place of Knex transactions, `groupBy` in place of raw `count().groupBy()`).
- Seeding moved from `knex seed:run` to `server/prisma/seed.js`, run via `npm run seed` → `node prisma/seed.js`.
- `npm run migrate` in `server/package.json` now runs `prisma migrate dev` instead of `knex migrate:latest`.
- Not yet done: no `npm install` has been run against this Prisma setup, so it has never actually generated a client or run a real migration — first real test is still pending (see TODO).

## 2026-08-20 — Repo pushed to GitHub

- Initial scaffold committed on `main` and pushed to `github.com/deepanshu-chauhan-delphic/delphic-one`.
- `staging` and `dev` branches created from `main` and pushed; CI workflow triggers on all three.
- Hit two auth snags along the way: wrong repo name (`delphic_one` vs `delphic-one`) and a 403 from the cached GitHub credential (`deepanshu-chauhan-483`) lacking write access — resolved by adding that account as a collaborator.

## 2026-08-20 — Initial scaffold
- Client scaffold: Vite + React + Tailwind, `AppLayout`, auth context, `apiClient`, list pages stubbed for accounts / requirements / profiles / submissions / reports, dashboard page, login page.
- Server scaffold: Express app, Knex config, JWT auth middleware, error handler, lock-check middleware.
- DB migrations 000–011: extensions, users, accounts, requirements, requirement_seats, requirement_assignments, profiles, submissions, interview_rounds, stage_history, documents, comments.
- Seed: `001_seed_users` (admin, sales, bda, 2 recruiters).
- Full domain modules (routes/controller/service/validation) built for: **accounts, auth, profiles, requirements, submissions, users**.
- Routes-only (no controller/service split yet) for: **admin, comments, dashboard, documents**; requirements/seats and submissions/interviewRounds routes exist as extra route files within those modules.
- CI workflow and deploy workflow (`deploy.yml`, currently a no-op pending `DEPLOY_ENABLED` + VPS secrets) added under `.github/workflows/`.
- `docs/AGENTS.md`, `docs/progress/PROGRESS.md`, `docs/progress/TODO.md` created to track context going forward.
