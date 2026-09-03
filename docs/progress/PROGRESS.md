# Progress Log

Reverse-chronological log of what's been done. Newest entry on top. See [TODO.md](TODO.md) for what's next and [AGENTS.md](../AGENTS.md) for project context.

## 2026-09-03 — List-page filters, "Tagged Profiles" fix, RVG activity toggle, CWR bucket overlap fix

Branch `feature/list-filters` (off `main`). One server file + validation + client
list pages + Reports page. Server suite green (29 suites / 196 tests). Client
`vite build` + `eslint` clean (0 errors). No schema/migration change.

### 1. "Tagged Profiles" column counted every stage — now client-facing only

- `requirements.service.js`: `DECORATE_INCLUDE.seats._count.submissions` is now
  **stage-filtered** to `submitted_to_client → bgv` (`submitted_to_client`,
  `interview_scheduled`, `interview_result`, `offer_sent`, `bgv`). Excludes
  `sourced` / `internal_screening` (not with the client yet) and
  `closed` / `backout` / `rejected` (out of play).
- Serialized field renamed `tagged_profiles_count` → **`client_submissions_count`**;
  Requirements list column header → **"Client Submissions"**, peek field too.
- Test: `requirements-crud-ui.test.js` — one submission per stage, asserts the
  count is exactly the 5 client-facing ones (list + detail).

### 2. More filters on Requirements / Profiles / Submissions lists

New shared `client/src/lib/lookups.js` — session-cached reference lists
(`useUserOptions(role)`, `useClientAccountOptions`, `useVendorAccountOptions`,
`useRequirementOptions`) so filter bars don't refetch rosters per mount.

- **Requirements** — added Type, Client, Sales owner, Assigned recruiter, Tech
  stack (apply-on-submit), Sort by/order. All URL-synced. (Backend already
  accepted every param — `listQuerySchema` unchanged.)
- **Profiles** — kept Source + On-bench; added a **"More filters"** panel: Vendor,
  Added by, Experience min/max, Expected-CTC min/max, Notice ≤, Work mode,
  Relocate, Active, Skills (apply-on-submit), Sort by/order + Clear. URL-synced.
  Backend `profiles.validation` already had all of these.
- **Submissions** — stage single-select → **multi-select** (CSV, already
  supported); added Recruiter, Client, Requirement, Sort by/order; **added
  pagination** (page/limit + pager — the page had none, footer used to read
  `N of N`). URL-synced.

### 3. recruiter-vendor-gaps — Active / Inactive vendor toggle

- `coverageSchema` gains `vendor_activity: 'active' | 'inactive'`.
  `recruiterVendorGaps` filters the (already not-submitted) gap list by
  `profiles_sourced > 0` (active — "wasted relationship") vs `=== 0` (inactive —
  dormant). Route unchanged (passes the parsed query through).
- Reports page: a two-tab toggle above the table (mirrors the CWR one), default
  **Active**; `vendor_activity` sent on run + export.
- Test: `reports-coverage-gaps.test.js` — active list all `profiles_sourced > 0`,
  inactive list all `=== 0`, disjoint.

### 4. clients-without-requirements — buckets were not mutually exclusive (prod bug)

- Prod showed the same client (e.g. Sinon Tech, Orangebites, DianApps) under
  **both** "with requirements" and "no active requirements". Cause:
  `with_requirements` = `requirements: { some: {} }` (any status), so a client
  whose only reqs are `closed` / `on_hold` / `dropped` matched both toggles.
- Fix: `with_requirements` now `requirements: { some: { status: { in: ['open','in_progress'] } } }`
  — the exact complement of `without_active_requirements`. Verified against the
  restored DB: with=10, without=69, overlap=0.
- Test updated: on_hold-only client is now **only** in the without bucket; added a
  "no id in both buckets" partition assertion.

## 2026-09-03 — Ticket undo/reactivate, actor names, Brought-by admin, report tweaks

`main`, uncommitted. No schema/migration change.

### Pipeline / submissions

- Admin (+ superadmin) may step a submission back one stage or reactivate
  `rejected` / `backout` → `sourced` via `POST /submissions/:id/stage` (reason
  required; stamps cleared on reactivate). Recruiters still forward-only.
- Detail page + Candidate / Requirement / Account boards surface "Move back…" /
  "Reactivate candidate" for admins; reason drawer required for those moves.
- Submission detail no longer blanks when `/history` fails; history endpoint
  matches `getOne` visibility (no extra recruiter-owner 403). `profile_id`
  restored in serialize. Stage history rows now include `changed_by.name`
  (requirement + submission), rendered on both detail pages.

### Accounts

- "Brought by" (`origin_owner_id`) editable by **admin + superadmin** (was
  superadmin-only). Non-admins get a loud 403 instead of a silent drop. Reports
  inline coverage edit uses the same `editBroughtBy` capability.

### Reports

- Recruiter–vendor gaps: hide "Recruiters (our end)" column (table + export).
- Clients without requirements: toggle **With requirements** /
  **No active requirements** (`bucket` query); adds `requirements_count` column.

### Tests

- Updated `submission-stage-machines`, `submissions-stage`, `superadmin-accounts`,
  `reports-coverage-gaps`, `reportViews.test.mjs`.

## 2026-09-03 — Prod data-loss safeguards (deploy backup + destructive-script guards)

`main`, uncommitted. Ops/tooling only — no app code, no schema change. Shell scripts
pass `bash -n`; `_guard.js` unit-checked (local host → allowed; remote host or
`NODE_ENV=production` → refuse with exit 1; `ALLOW_DESTRUCTIVE_SEED=1` → override).

**Trigger:** a prior prod deploy lost ~2–3 h of real data. Root cause was a destructive
DB operation running as (or alongside) a deploy — `--restore` (drop + recreate + restore
an older dump) and/or a CSV seed (`seed.js` wipes every table).

### 1. Every prod deploy takes a verified backup first — `start-delphic.sh`

- New `backup_db()` runs **before** `docker compose up -d --build` / migrations: brings
  `db` up if needed, waits for `pg_isready`, `pg_dump -Fc` → `./backups/predeploy-<ts>.dump`,
  then verifies the dump is readable (`pg_restore --list` inside the container).
- **Aborts the deploy** if `pg_dump` errors or the dump can't be read back — nothing is
  built or migrated. A tiny dump (genuinely empty DB) warns and continues.
- Keeps the newest `BACKUP_KEEP` (7) predeploy dumps — one per push, oldest deleted.
  Aborts when the backups volume has less than `BACKUP_MIN_FREE_GB` (2) free.
  `--skip-backup` escape hatch for the first-ever deploy only.
- `start-delphic.sh` still has **no `--restore` flag** — restores are manual `pg_restore`
  only, never part of a deploy (runbook §4 rewritten to match; the old runbook told people
  to pass a `--restore=` flag that doesn't exist).

### 2. Destructive CSV seeds refuse against non-local DBs — `server/prisma/_guard.js`

- New guard: `assertNonProdDestructive()` exits 1 when `NODE_ENV=production` or the
  `DATABASE_URL` host isn't in {localhost, 127.0.0.1, ::1, db, postgres,
  host.docker.internal}, unless `ALLOW_DESTRUCTIVE_SEED=1`.
- Wired into `seed.js`, `seed-accounts.js`, `seed-jira.js`, `seed-vendors.js` (just before
  `main()`). `seed-admin.js` is untouched (already non-destructive).

### 3. `start-platform.sh` (local dev tool) guards `--restore` / `--fresh`

- `guard_local_db()` refuses those two when `NODE_ENV=production` or `.env`'s `DATABASE_URL`
  host is remote. `--seed` is covered by the seed-script guard.

### 4. Scheduled backups — `scripts/db-backup.sh` + runbook

- Standalone verified `pg_dump -Fc` → `./backups/auto-<ts>.dump`, keeps newest
  `BACKUP_KEEP` (7), aborts under `BACKUP_MIN_FREE_GB` (2) free, optional
  `BACKUP_OFFSITE_CMD` hook.
- [DEPLOY-RUNBOOK.md](../guides/DEPLOY-RUNBOOK.md) gains: cron / systemd-timer setup,
  pre-flight destructive-migration grep, expand-contract migration rule, row-count
  spot-check, manual PITR-first rollback. `backups/` added to `.gitignore`.

## 2026-09-03 — Pipeline map filters, Tagged Profiles column, sales "submit to client", report/filter fixes

`main`, uncommitted. No schema/migration change. eslint clean on touched files;
`usePipelineFilters.test.mjs` / `reportViews.test.mjs` / `pipelineBoardUtils.test.mjs` /
`submission-stage-machines.test.js` green. **DB-backed suites not run** — Postgres
`localhost:5434` was down (see TODO).

### 1. Pipeline → Requirement map filters

- "All recruiters" single-select → **"Assigned recruiters"** `MultiSelectDropdown`
  (`recruiter_ids`, CSV). "Past SLA" checkbox → **"Submitted by"** `MultiSelectDropdown`
  (`submitted_by_ids`) — filters submissions by `submitted_by` **and** narrows the shown
  requirements to those with a matching submission (same pattern as the candidate-stage
  filter). New **"All admins"** single-select (`admin_id`) — filters on `account.owner_id`
  alongside `bda_id` (both set → `owner_id IN (...)`).
- Server: `pipeline.validation` + `pipeline.service` accept `recruiter_ids` /
  `submitted_by_ids` / `admin_id`; legacy single `recruiter_id` still honoured.
  `usePipelineFilters.js` gained the URL keys + `filtersToApiParams` mapping.
- Matrix filter row got `relative z-40` so open filter dropdowns render above the
  sticky `z-30` requirement/stage header cells (were hidden behind them).

### 2. Requirements list: "Seats" column → "Tagged Profiles"

- `requirements.service` `DECORATE_INCLUDE.seats` now selects `_count.submissions`;
  `serialize()` returns `tagged_profiles_count` (sum of submissions across all the
  requirement's seats, all stages — same semantic as the dashboard `submissions_count`).
  `seats_total` / `seats_closed` still returned.
- `RequirementsListPage` table column swapped; peek panel gains a "Tagged profiles" field
  (Seats kept there).

### 3. Sales can mark a candidate "Submitted to client"

- `POST /submissions/:id/stage` → `authorize('recruiter', 'sales', 'admin')`.
  `submissions.service.changeStage(id, body, user)` (was `userId`): role `sales` is
  allowed **only** `internal_screening → submitted_to_client` and only when
  `user.id === requirement.sales_owner_id`; anything else → `forbidden_stage_change`
  (403). Recruiter/admin behaviour unchanged.
- `SubmissionDetailPage` shows a single "Move to submitted to client" button for a
  qualifying sales owner (`canSalesSubmitToClient`); no field edits, no other transitions.
  Drag-and-drop pipeline boards still gate on `canMutateSubmission` (recruiter/admin).

### 4. Dashboard "Stuck" cards are point-in-time

- "Stuck leads" / "Stuck requirements" KPI cards + panels now show **"as of today"** and
  their hover copy states the dashboard date filter does not scope them ("stuck" = stale
  now). No count-logic change. (The dashboard date-range bar is still inert for **every**
  metric — separate open item, see TODO.)

### 5. Accounts list: "Brought by" filter now works + column

- `origin_owner_id` was missing from `accounts.validation` `listQuerySchema` (Zod stripped
  it) and from `accounts.service` `list()` — the filter did nothing. Added to both
  (`and.push({ origin_owner_id })`).
- New dedicated **"Brought by"** table column; removed the "via …" sub-line under Owner.

### 6. Reports — "Clients w/o requirements"

- Filtered `type: 'client'` only, so **unclassified accounts (`type: null`) — every real
  lead / meeting-scheduled account — never appeared**, and the Stage = Lead/Meeting/etc.
  filter returned nothing. Now `OR: [{ type: 'client' }, { type: null }]`, mirroring the
  Lead board's `include_unclassified`.
- Removed a hardcoded `sales_poc: … : { id: null, name: 'Paras Gulati' }` fallback → `null`.
- Added an explicit **"All stages"** option (previously only reachable via a hover-only ✕).
- Unchanged by design: `requirements: { none: {} }` means *never had a requirement* — a
  client that was active, got requirements, then dropped stays excluded. Switch to
  "no *open* requirement" is a separate decision (see TODO).
- Regression test added (`type: null` lead account appears under `stage=lead`).

### 7. Reports — coverage filter dropdowns role-scoped

- "Brought by" / "Sales POC" (CWR) and "Our POC" (RVG) were three identical all-user
  lists. Now: Brought by = BDA + admin, Sales POC = sales + admin, Our POC = BDA + sales +
  admin. Superadmin inline-edit `CoveragePersonCell` still gets the full user list.
  Tradeoff: a BDA-owned client is no longer selectable in "Sales POC" (use "Brought by").

### 8. Superadmin stage override — submissions + wired onto the boards

- **New:** `POST /submissions/:id/stage/override` (`authorizeSuperadmin`) — force a
  submission to ANY stage (backward, straight to `sourced`, out of a terminal state),
  bypassing `SUBMISSION_STAGE_TRANSITIONS`, the lock, and the round/BGV gates. Reason
  required; audited in `stage_history` as `[override] <reason>`. Deliberately minimal —
  it does not touch seat status. `stageOverrideSchema` + `service.changeStageOverride` +
  `controller` + route. Mirrors the existing account `POST /accounts/:id/stage/override`.
- **New component** `SubmissionStageOverrideDrawer` (stage select + required reason).
  `submissionStages.js` gains `SUBMISSION_ALL_STAGES` + `canOverrideSubmissionStage`.
- Wired so a superadmin dragging a card to a disallowed column opens the override drawer
  (preset to the drop target) instead of the "Cannot move from X to Y" toast:
  - submissions — `SubmissionDetailPage` ("Override stage…" button), `RequirementKanbanPage`,
    `CandidatePipelineBoard`, `AccountPipelineBoardPage`.
  - accounts — `LeadPipelineBoard` + `AccountsListPage` peek now route a disallowed
    move to the existing `AccountStageOverrideDrawer` (which gained a `preferredToStage`
    prop). `AccountDetailPage` already had it.
- Ordinary roles are unaffected — the disallowed-move toast still fires for them.

## 2026-09-02 — Fix: account edit form crashed on null columns ("Failed to update account")

`main`. Client-only. `vite build` + `accountUtils.test.mjs` green.

- **Symptom:** editing almost any client (or vendor) account — as admin or BDA — failed
  with a bare "Failed to update account" toast and no network request.
- **Cause:** `formFromAccount()` did `{ ...EMPTY_FORM, ...account }`; the API returns unset
  optional columns (`industry`, `poc_phone`, `source`, `client_payment_terms`, …) as
  `null`, which overwrote the `''` defaults. `buildAccountBody()` then called
  `form.<field>.trim()` → `TypeError` thrown **inside** `saveAccount`'s try/catch, so the
  user only ever saw the generic fallback string. Not a server bug — the request never
  left the browser.
- **Fix:** moved `EMPTY_FORM` / `EMPTY_CONTACT` / `formFromAccount` / `buildAccountBody`
  into `accountUtils.js` (testable, matches `canMutateAccount` etc. already there).
  `formFromAccount` now coerces every `EMPTY_FORM` string key back to `''` when the row
  has `null`, and sanitizes `additional_contacts`. `buildAccountBody` uses a null-safe
  `str()` helper on every field. Added regression assertions in `accountUtils.test.mjs`
  (null-heavy client row → clean form + body; fresh form still omits `type`/`owner_id`).
- **Swept the other edit forms for the same pattern — none affected.** `profileForm.js`
  `profileToForm`, `RequirementFormPage` `hydrateForm`, `InterviewRoundsPanel` `hydrate`,
  `SubmissionDetailPage` form init and `UsersPage` all re-default every field explicitly
  (`|| ''` / `?? ''` / `|| []`) instead of spreading the raw API row, so their `.trim()` /
  `.split()` calls never see `null`. Reason/notes/label `.trim()`s elsewhere read from
  local `useState('')`, never a hydrated value.

## 2026-09-02 — Dashboard "Stuck" KPI: real count (uncapped) + one "no movement" rule everywhere

`main`. No schema/migration change. Full server suite green
(29 suites / 188 tests, `jest --runInBand`); client eslint clean on touched files.

### 1. Stuck KPI cards were capped at 5

- `dashboard.service.js` `stuckLeads()` / `stuckRequirements()` fetch `take: 5` preview
  rows; `dashboardWidgets.js` used `summary.stuck_*.length` as the **KPI value**, so the
  admin "Stuck leads" / "Stuck requirements" tiles and the "N stuck 7d+" hint badges
  (bda / sales / recruiter) maxed out at 5 regardless of the true total.
- Added `countStuck{Leads,Requirements}()` (`prisma.*.count`, same where clause, no `take`)
  and return `stuck_leads_count` / `stuck_requirements_count` from every role summary
  (`0` where a role has no such list). Front-end now reads the `*_count` fields; the
  `stuck_*` arrays remain only the top-5 preview lists shown in the panels below.

### 2. "Stuck" now means the same thing for requirements as for leads/submissions

- Leads & submissions already used `updated_at <= now-7d` ("no movement"). Requirements
  used `created_at <= now-7d` ("opened 7+ days ago"), so a busy requirement opened 8 days
  ago still counted. Switched the requirement stuck check to `updated_at` in all five
  places: `dashboard.service` (`stuckRequirementsWhere`), `requirements.service`
  (`isStuck` + list `?stuck=` clause), `pipeline.service` (`serializeRequirement`),
  `reports.service` `aging()`, and `explorer.service` `computeAging` (also removed a
  dead `x ? A : A` ternary in the submission-grain `is_stuck`). `reports.service`
  bda/client-performance `stuck_*_count` already used `updated_at` — now consistent.
- Dashboard `stuck_requirements` rows gain `days_idle` (from `updated_at`); the panel
  badge shows "Nd idle" and moves "Nd open" into the sub-line.
- KPI hover copy reworded from "no movement" / "7+ days open" to "no update (no stage
  change or edit) for 7+ days", and the "Open requirements" / "Assigned open" / "Active
  leads" tiles now explain that their badge counts a wider set than the tile number.

### 3. Tests

- Test helpers that aged a requirement via `created_at` only now also set `updated_at`
  (`requirements-stage`, `pipeline-board`, `backend-gaps`, `reports-ui`,
  `reports-explorer`). No assertion changes needed.

## 2026-09-02 — Reports dropdown trimmed + coverage/RVG rework + screening chips + account owner filters

Uncommitted work on `main` (local). No schema/migration change. `client vite build` +
`reportViews.test.mjs` green; **server suite not run** (Docker Desktop down → test DB on
`localhost:5434` unreachable). `node -c` syntax-clean on all touched server files.

### 1. Reports page — only the two coverage-gap reports in the dropdown

- `reportViews.js` `ALL_REPORTS` — every report except `clients-without-requirements`
  and `recruiter-vendor-gaps` now carries `hidden: true`; `reportsForRole` filters
  `!r.hidden`. Reports stay fully defined (routes, columns, charts, export all still
  resolve by key) — they're just gone from the picker. `reportViews.test.mjs` updated
  to assert the dropdown is exactly those two per role.

### 2. `clients-without-requirements` — stage filter, default Active

- New `stage` on `coverageSchema` (5 account stages) → `clientsWithoutRequirements`
  adds `...(stage ? { stage } : {})`. `ReportsPage` renders a clearable Stage
  `SearchableSelect` that **defaults to `active`** on load / report switch; wired into
  `buildParams` + run-report deps + `/reports/export`.

### 3. `recruiter-vendor-gaps` — one row per vendor account, filterable

- Reworked `recruiterVendorGaps` from `(recruiter × vendor)` profile-driven pairs to
  **one row per vendor account** (`type = 'vendor'`) whose profiles were never
  submitted anywhere. Row carries `vendor`, `our_poc` (`account.owner`), `brought_by`
  (`account.origin_owner`), `recruiters[]` (everyone who sourced a profile from it —
  derived, there is no stored vendor↔recruiter link), `profiles_sourced`,
  `last_sourced_at`, `days_since_sourced`. Vendors with **zero** sourced profiles are
  included (admin view); a recruiter is self-scoped to vendors they've sourced from.
- **Filter correctness fix:** `any_submitted` is now computed from ALL of a vendor's
  profiles, never a single recruiter's slice — so `recruiter_id` no longer surfaces a
  vendor as a "gap" when another recruiter's profile from it was submitted. `recruiter_id`
  now post-filters on the displayed `recruiters[]` set (was an indirect `profiles_sourced > 0`
  after query-scoping).
- Filters `vendor_id` + `owner_id` on `coverageSchema`; `ReportsPage` adds a Vendor
  `SearchableSelect` (from `/accounts?type=vendor`) and an "our POC" people select. The
  shared "individual" recruiter picker is kept (admin) — note only users who have sourced
  a vendor profile can ever match, so most picks return an empty report by design.
- **Superadmin inline edit** on this report too: "Our POC" (`owner_id`) and "Brought by"
  (`origin_owner_id`) are editable in place, same `CoveragePersonCell` mechanism as
  `clients-without-requirements` (`PATCH /accounts/:vendorId`). "Recruiters" stays
  read-only (derived from candidate sourcing; an "assigned recruiters" vendor field was
  scoped out).
- `reportViews.js` columns/rows-id/chart bucket updated; `reports-coverage-gaps.test.js`
  rewritten for the vendor-centric shape + filter tests (incl. the cross-recruiter
  `any_submitted` case) + a `clients-without-requirements` stage-filter test.
  `cd server && npm test` → **29 suites / 188 tests green**.

### 4. Internal screening round results on pipeline cards

- New `client/src/pages/pipeline/ScreeningRoundChips.jsx` — renders every
  `internal_r1`/`internal_r2` round as an `IS1: pass` / `IS2: fail` chip (colour by
  result). Added to the **Candidate pipeline** card (uses `submission.interview_rounds`
  from `/submissions`) and the **Requirement map** card (new `submission.internal_rounds`
  from `/pipeline/board` — that endpoint's `interview_rounds` select now also pulls
  `round_type` + `round_number`).

### 6. Local dev launcher

- New `start-platform.sh` / `start-platform.ps1` at repo root + `npm run platform[:restore|:seed|:fresh|:down]`.
  Brings up only the compose `db` service (Postgres :5434), runs `prisma generate` +
  `migrate deploy`, optional data load, then runs the API (nodemon :4000) and client
  (Vite :5173) with hot reload — `.sh` foreground+prefixed, `.ps1` in separate windows.
- `--restore` / `-Restore` loads real-like data: safety-dumps the current DB, drops &
  recreates `requirement_dashboard`, `pg_restore`s the newest `backup-*.dump` (or
  `--restore=FILE`) inside the `db` container, then `migrate deploy` applies the
  migrations the dump predates. Validated: `backup-2026-09-01-113412.dump` →
  13 users / 123 accounts / 43 requirements / 27 profiles / 24 submissions / 213 comments,
  3 migrations auto-applied (`account_origin_owner`, `drop_lead_generated_date`,
  `add_is_superadmin`), `admin@delphic.in` back to `is_superadmin`. Mutually exclusive
  with `--seed`/`--fresh`. Docs: AGENTS.md "Local setup".

### 5. Accounts list — filter by Owner and Brought by

- `listQuerySchema` gains `origin_owner_id`; `accounts.service.list` adds an
  `origin_owner_id` AND-clause (`owner_id` was already supported). `AccountsListPage`
  adds two clearable people `SearchableSelect`s (active-user roster), URL-synced via
  `?owner_id=` / `?origin_owner_id=`. (BDA role is still server-scoped to own accounts.)

## 2026-09-01 — Coverage-report rework + manual interview_result

Uncommitted work on `main` (local). No schema/migration change (an interim
`sales_owner_id` field was added then reverted — "Sales POC" == the account owner /
"POC from our end", one person, no new column). `cd server && npm test` →
**28 suites / 178 tests green**; client `vite build` + `reportViews.test.mjs` green.

### 1. "Sales POC" == account owner

- Clarified: **POC from our end (`Account.owner_id`) and "Sales POC" are the same person.**
  The LeadMinds CSV "Sales POC" column stays as free text in `meeting_notes` (not a
  structured field). "Brought by" (`origin_owner_id`) remains the separate originator.
- `seed-accounts.js` — BDA-owner fallback for an unrecognised "Account manager" is now
  **Paras Gulati → Biswajit Dey** (was Chahak); added `paras`/`biswajit` manager aliases.

### 2. `clients-without-requirements` report

- Columns: Client · Stage · **Brought by** (`origin_owner`) · **Sales POC** (`owner`,
  renamed from "BDA owner") · Created · Days idle. The old always-empty "Sales owner"
  column is gone.
- Filters: **Brought by** (`origin_owner_id`) and **Sales POC** (`bda_id` = `owner_id`),
  both by person name from the active-user roster. **Department filter removed** from both
  coverage reports (`coverageSchema` drops `department_id`, adds `origin_owner_id`;
  `recruiterVendorGaps` no longer takes `department_id`).
- **Superadmin inline edit**: on the Reports page a superadmin gets a person `<select>` in
  the "Brought by" and "Sales POC" cells — changing it `PATCH`es the account
  (`origin_owner_id` / `owner_id`) and refreshes the report (`ReportsPage.CoveragePersonCell`
  + `saveCoverageField`).

### 3. Interview stage stays manual

- `interview_scheduled → interview_result` is **no longer auto-advanced** when all interview
  rounds are resolved. Removed the auto-advance from `addInterviewRound` and
  `updateInterviewRound` (`submissions.service.js`). The only remaining round side-effect is
  `submitted_to_client → interview_scheduled` when the first round is created. Moving to
  `interview_result` now always requires `POST /submissions/:id/stage`.
- Tests updated in `submissions-stage.test.js`; API-Spec doc notes updated.

## 2026-09-01 — Superadmin tier (`admin@delphic.in`)

Uncommitted work on `main` (local). One migration added (`20260901131738_add_is_superadmin`).
`cd server && npm test` → **28 suites / 177 tests green**; client `vite build` green.

### Model

- New `User.is_superadmin Boolean @default(false)` (`schema.prisma` + migration, which also
  backfills `is_superadmin = true WHERE email = 'admin@delphic.in'`). A superadmin keeps
  `role: 'admin'` — every existing `authorize('admin')` gate is unchanged; the flag only
  *adds* powers. Seeds set it: `team-roster.js` (Admin entry), `seed.js` `seedUsers`,
  `seed-admin.js` (first bootstrap admin).

### Server authz — never trusts the JWT

- `middleware/auth.js` gains `authorizeSuperadmin` (hard 403 gate) and `loadSuperadminFlag`
  (non-failing) — both re-read `is_superadmin && active` from the DB every request, so a
  demoted superadmin loses access immediately. `lockCheck` now lets a superadmin through
  (`row.is_locked && !req.user?.is_superadmin`) — only effective where `loadSuperadminFlag`
  ran first (accounts PATCH).

### Users — full edit, update-only (no delete)

- `PATCH /users/:id` (`authorize('admin')` + `loadSuperadminFlag`): `updateSchema` gains
  `password?` and `is_superadmin?`. Service guards (`update(id, patch, actor)`): only a
  superadmin may set `is_superadmin`, set another user's `password`, or edit a user who is
  already a superadmin; the last active superadmin can't be demoted / deactivated
  (`countActiveSuperadmins() <= 1` → 409 `last_superadmin`). Password is bcrypt-hashed
  (cost 10) into `password_hash`. New `GET /users/:id`. `PUBLIC_SELECT` now returns
  `is_superadmin` (flows to `/users/me` and `login`).

### Accounts — brought-by + free-form stage override (accounts only)

- `PATCH /accounts/:id` honours `origin_owner_id` ("Brought by") **only** for a superadmin
  (validated active user); silently stripped otherwise. Superadmin also bypasses the lock
  on this route (middleware order: `loadSuperadminFlag` → `lockCheck`).
- New `POST /accounts/:id/stage/override` (`authorizeSuperadmin`) → `changeStageOverride`:
  any target stage incl. `lead` / backward, ignores `canTransition` / ownership / lock /
  meeting-field rules, `reason` required, optional `is_locked` toggle, still writes a
  `stage_history` row with a `[override]`-prefixed reason.

### Frontend

- `permissions.js` — new `userCan(user, cap)` (superadmin passes everything; new
  superadmin-only caps `editBroughtBy` / `overrideStage` / `editAnyUser`).
  `usePermissions` exposes `isSuperadmin` and routes through `userCan`; `<Can>` too.
  `authContext` exposes `isSuperadmin`.
- `UsersPage` — new `EditUserDrawer` (name / email / role / dept / phone / active, plus
  superadmin-only superadmin-toggle + password reset) behind an **Edit** button shown only
  to a superadmin; `· super` badge on the Role column.
- `AccountFormPage` — superadmin-only "Brought by (origin owner)" `SearchableSelect`;
  superadmin can open the edit form on a locked account.
- `AccountDetailPage` + new `AccountStageOverrideDrawer` — superadmin-only **Override
  stage** button (all five stages, reason required, keep-locked checkbox).
- New tests: `superadmin-users.test.js`, `superadmin-accounts.test.js`;
  `helpers.createUser` takes `is_superadmin`.

### Not done / notes

- Delete routes were explicitly out of scope — update only.
- A newly promoted superadmin must reload / re-login before the SPA shows the extra UI
  (flag is read at mount via `/users/me`).
- `client/scripts/check-permissions.mjs` still fails on a pre-existing `bda`/`viewReports`
  assertion — unrelated to this change.

## 2026-09-01 — Drop `lead_generated_date`; lead board now shows unclassified leads

Uncommitted work on `main` (local). Two migrations added.

### 1. Removed `Account.lead_generated_date`

- Lead "generated" date is now just `created_at` (the row's creation date). Dropped the column + its index (`schema.prisma`, migration `20260901125143_drop_lead_generated_date`), the zod field (`accounts.validation.js`), the form input + request-body/formFromAccount mapping (`AccountFormPage.jsx`), the "Lead generated" detail row (`AccountDetailPage.jsx` — "Created" row already shows it), and the test payload key.
- `reports.service.js` `avg_days_lead_to_meeting` now measures `created_at → meeting_date`.
- Also applied migration `20260901120000_account_origin_owner` to the freshly-restored local DB (dump predated it → `origin_owner_id` missing).

### 2. Lead pipeline board hid every account in the `lead` stage

- `LeadPipelineBoard` hard-filtered `type: 'client'`, but an unclassified lead sits at `type IS NULL` (v2 nullable type). Result: LEAD / early columns always empty on the board even when such accounts existed.
- `GET /accounts` gains `include_unclassified=true` (only meaningful with `type=client`) → matches `type = 'client' OR type IS NULL`. `accounts.service.list` rebuilt around an `AND` array so the type-scope OR and the search OR no longer clobber each other in the object literal. `LeadPipelineBoard` passes the new flag.
- Verified headless (admin): LEAD/MEETING SCHEDULED columns now populate; `accounts-stage` (10) + `pipeline-board` (14) suites green.

## 2026-09-01 — Vendor name on pipeline cards + candidate-stage filter fix + coverage-gap reports

Uncommitted work on `main` (local). No schema/migration changes. `cd server && npm test` → **26 suites / 163 tests green**; client `vite build` + `reportViews.test.mjs` + `usePipelineFilters.test.mjs` green.

### 1. Vendor name on candidate cards

- `GET /pipeline/board` and `GET /submissions` now select `profile.vendor_account { id, name }` (`pipeline.service.js` submission include; `submissions.service.js` `INCLUDE.profile.select` — flows through the existing pass-through serializers).
- Requirement-map `CandidateCard` and candidate-pipeline `CandidateCard` show a `via <Vendor>` line when `profile.source === 'vendor'`.

### 2. Pipeline filter fixes (`pipeline.service.js` + client filter helpers)

- **Candidate-stage bug:** `submission_stage` was applied only to the submissions query, so requirements with zero matching candidates still rendered. Now, when a stage is selected, requirements are filtered to those with ≥1 candidate in that stage.
- **"Stuck" de-duped:** removed `stuck_only` from the pipeline entirely (checkbox + `usePipelineFilters` key + `pipeline.validation` + service). The `stuck` tri-state (`all`/`stuck`/`not_stuck`) is the single control. Reports-explorer `stuck_only` is a separate feature, untouched.
- **Search** on the board now also matches candidate/profile name (added an `OR` branch through `seats.some.submissions.some.profile.name`).
- **Date-range filter wired up:** server already applied `date_from`/`date_to` to `requirement.created_at`; added a compact "Created" date-range control (`PipelineFilters`, gated by the new `date_range` field) and put it on the requirement matrix.
- **Candidate board multi-stage:** `CandidatePipelineBoard` now forwards all selected stages as CSV; `GET /submissions` `list()` parses `stage` as a CSV → `{ stage: { in: [...] } }`.

### 3. New coverage-gap report tabs (`/api/v1/reports/*`, separate tabs)

- **`clients-without-requirements`** (`admin` / `sales` / `bda`, BDA self-scoped) — client accounts with `requirements: { none: {} }`; columns Client / Stage / BDA owner / Brought by / Sales owner (null by definition — kept to show the BDA→sales handoff gap) / Created / Days idle.
- **`recruiter-vendor-gaps`** (`admin` / `recruiter`, recruiter self-scoped) — `(recruiter, vendor)` pairs from `Profile.added_by` + `Profile.vendor_account_id` where the recruiter sourced ≥1 profile from the vendor but none was ever submitted.
- New shared `coverageSchema` (`department_id` + `bda_id` + `recruiter_id`, no date range). Both wired into `reports.routes.js` (`REPORTS` map + GET routes + `/export` branch), `reportViews.js` (`ALL_REPORTS`, columns, rows id, bar chart), and `ReportsPage.jsx` (`isCoverage` → no date presets; individual picker maps to `bda_id` / `recruiter_id` for admins).
- Tests: `server/tests/reports-coverage-gaps.test.js` (shape, self-scoping, 403 gates, xlsx export); pipeline-board tests updated for the stage filter, candidate-name search, vendor-account exposure, and `stuck` rename.

## 2026-09-01 — Admin-editable account type + dashboard KPI fixes/split + app-wide searchable dropdowns

Uncommitted work on `main` (local). No schema/migration changes in this entry. Client `vite build` green.

### 1. Account `type` is now editable (admin-only re-classification)

Previously `type` was write-once via `POST /accounts/:id/classify` (one-way, `already_classified` guard) and hard-disabled on the edit form. Now an **admin** can switch an already-typed account between `client` / `vendor` from `AccountFormPage`:

- `updateSchema` accepts `type: z.enum(['client','vendor']).optional()` (`accounts.validation.js`).
- `accounts.service.update`: a real `type` change is **admin-only** (`forbidden_type_change` otherwise) and refreshes `classified_at` / `classified_by`; a no-op `type` is stripped from the patch.
- `accounts.controller.js` maps `forbidden_type_change → 403`.
- `AccountFormPage`: `canEditType = isEditing && role === 'admin'`; the type `<select>` is `disabled={isEditing && !canEditType}`, `buildAccountBody` sends `type` on create **or** admin edit, plus an "Admin only · re-classifies" hint. Switching back to undecided/lead is intentionally not supported (enum has no empty member); non-admins still can't touch it. The one-way `/classify` flow for undecided leads is unchanged.

### 2. Home dashboard KPI corrections + client/vendor split + 4-col grid

Backend `dashboard.service.js` (`summaryForAdmin` + `summaryForBda`):

- **`leads_active` bug fixed** — was `count({ type: 'client', stage: 'lead' })`, which silently dropped every unclassified lead (type is `null` until classified, independent of stage) and every vendor-classified lead. Now `count({ stage: 'lead' })` across all types. The card count now also matches its `/accounts?stage=lead` drill-through.
- **`leads_in_meeting`** now `stage IN ('meeting_scheduled','rescheduled')` (was `meeting_scheduled` only) — matches the card copy and how `stuckLeads` treats rescheduled.
- `clients_active` / `vendors_active` unchanged (already correct: `type` + `stage: 'active'`).

Frontend `dashboardWidgets.js` + `DashboardPage.jsx`:

- KPI grid `xl:grid-cols-6` → **`xl:grid-cols-4`** (real grid + skeleton; skeleton bumped to 8 tiles).
- **Admin KPI set is now 10 tiles** (4 + 4 + 2): Active leads · Open requirements · **In progress** *(new — splits `requirements_in_progress`, previously returned but never rendered for admins)* · Active submissions // Interviews this week · Closures this month · Active clients · **Active vendors** *(new — `vendors_active` was returned but never shown for admins)* // **Stuck leads** · **Stuck requirements** *(new dedicated cards, red theme, `AlertTriangle`; the redundant "N stuck 7d+" hint badge dropped from Active leads / Open requirements — bottom stuck panels stay)*.
- New `KPI_LINKS`: `stuckLeads → /accounts?stage=lead` (accounts list has no stuck filter), `stuckRequirements → /requirements?stuck=stuck`.
- Lead-tile descriptions reworded (no longer claim "client accounts").
- BDA/Sales/Recruiter tile sets unchanged; they wrap fine in the 4-col grid.

### 3. App-wide searchable dropdowns

New **`client/src/components/ui/SearchableSelect.jsx`** — hand-rolled single-select combobox (no new dependency), styled to match `MultiSelectDropdown`: type-to-filter on `label` + `hint`, ↑/↓/Enter/Esc keyboard nav, click-outside close, `disabled` / `required` (native form validation kept via a 1px opacity-0 focusable mirror input) / `allowClear` / `ariaLabel` / `className` (width). API: `options={[{ value, label, hint?, disabled? }]}`, `onChange(value)` (raw value, not an event).

Scope agreed with the user: **convert data-driven or 6-plus-option selects; leave small fixed enums native.** 25 selects across 12 files converted:

| File | Converted |
|---|---|
| `RequirementFormPage` | client account, sales owner, budget currency |
| `AccountFormPage` | owner, billing currency, vendor rate currency |
| `ProfileFormPage` | vendor account |
| `SubmissionCreatePage` | candidate, job requirement, seat |
| `InterviewRoundsPanel` | round type |
| `AssignRecruiterDrawer` | recruiter |
| `UsersPage` | department |
| `components/ui/FilterBar` | individual, department |
| `pipeline/PipelineFilters` | client, BDA, sales, recruiter |
| `AccountsListPage` | stage filter |
| `SubmissionsListPage` | stage filter |
| `RequirementsListPage` | status filter |
| `reports/ReportsPage` | report type, explorer status |

Filter dropdowns got `allowClear` to return to "All". **Left native** (fixed enums < ~6 options): gender, work mode, engagement type, req type, priority, company size, 4-option currency pickers, rate types, BGV status, interview result, meeting mode, stage/status **transition** pickers (`AccountStageMoveDrawer`, `JobPipelineBoard`, `CandidatePipelineBoard`), closure group-by, `stuck` tri-state, profile source. `SubmissionDetailPage` untouched (all seven selects are 3–4-option enums).

## 2026-09-01 — Editable account owner + immutable "brought by" + relaxed API rate limit

Uncommitted work on `main` (local). **Includes a Prisma migration — see deploy note below.**

- **Account owner (POC from our end) is now editable** from the edit-account form (`AccountFormPage`) by **anyone who can edit the account** (admin, or the owning BDA) — not admin-only. New `owner_id` on `updateSchema`; `accounts.service.update` only checks the target is an **active user of any role** (`user_not_found`); no role/admin gate on the reassignment itself. The owner select is **required** (no "Unassigned") and lists every active user. `GET /users` list opened to `bda` too (unclamped) so the roster loads for them.
- **New `Account.origin_owner_id`** — immutable "brought by" the BDA/admin who first added the client/vendor. Set once in `create()` (= first owner), never updated; `owner_id` can be reassigned freely without losing acquisition credit. Nullable column + FK + index; migration backfills `origin_owner_id = owner_id` for all existing rows.
- **Surfaced** on account detail (header + "Brought by" field), list (Owner column shows "via <origin>" when reassigned; peek drawer "Brought by"), and edit form hint.
- **`bda-performance` report**: "brought"/funnel metrics (`leads_created`, meeting, converted, dropped, vendors_created, unclassified, via_linkedin, avg_days_lead_to_meeting) now credit `origin_owner_id`; `*_current` snapshots still credit `owner_id` (present POC).
- **Rate limit relaxed** (`server/src/app.js`): general `apiLimiter` now skips GET/HEAD/OPTIONS and allows 6000 writes/min/IP (was 1200 all-methods) so the request-dense dashboard behind a shared office IP stops hitting "Too many requests". `loginLimiter` raised 30 → 60/min.

### Deploy note — migration `20260901120000_account_origin_owner`

Additive and safe on populated data (nullable ADD COLUMN + backfill UPDATE + FK + index; no drops, no rewrite-locking default). On the VPS the `server` container runs `prisma migrate deploy` on startup, so `./start-delphic.sh --prod` applies it automatically. **Before deploying:** `pg_dump` backup. **After:** verify `SELECT count(*) FROM accounts WHERE origin_owner_id IS NULL;` returns `0`. Rollback (only if needed, and no new accounts created since): `ALTER TABLE accounts DROP COLUMN origin_owner_id;` then delete the migration row from `_prisma_migrations`.

Uncommitted work on `main` (local).

- **Seed chain:** `seed` (team only) → `seed:accounts` (LeadMinds clients) → `seed:jira` (34 reqs) → `seed:vendors` (optional). Fake Acme/Stuck Lead demo data removed from base seed.
- **`client-aliases.js`:** GirnarSoft + Girnarsoft_Pragya → Girnarsoft; Devlabs → Devlabsalliance; other Jira short names map to LeadMinds display names.
- **`seed-jira`:** full Jira `Description` → `job_description`; sales owner prefers `sales` role (Tanvi) so assign UI works; recruiter assignments from Multi-Assignee + comment mentions.
- **Requirements list:** Previous/Next pagination (20/page) — pipeline still loads all rows.
- **Assign recruiters:** ownership-aware UI messaging; Assign button on requirement detail.
- Docs: `AGENTS.md`, `guides/PRODUCTION-SEED.md`, `testing/TESTING-DEMO-SEED.md` updated for the new seed order.

## 2026-08-31 — Vendor accounts seeded from the vendor tracker sheet

Uncommitted work on `main` (local). `server/prisma/seed-vendors.js` is untracked.

- New `server/prisma/seed-vendors.js` + `npm run seed:vendors` (root + server). Inline data array of the **32 vendors whose sheet Status is "Active"** (Hold / In Budget rows excluded, per instruction). Idempotent: wipes `source: 'vendor_csv'` accounts then recreates.
- Each row → `Account { type: 'vendor', stage: 'active', source: 'vendor_csv' }`. POC initials map to the internal owner (`garv`→Garv, `krupali`→Krupali Vala, `prashant`→Prashant Singh Hada; blank → admin). Sheet fields: email → `poc_email`, location → `location`, Technologies → `vendor_specializations[]`, the free-text "Budget" column → `meeting_notes`.
- Seeded locally: 32 vendor accounts (owners: Garv 10, Prashant 10, Krupali 8, Admin 4). Total accounts now 43 (11 client + 32 vendor).

## 2026-08-31 — Stuck requirements: visible by default + tri-state filter, plus graceful token-expiry handling

Uncommitted work on `main` (local).

- **Requirements list (`GET /requirements`):** every row now carries `is_stuck` (active status `open`/`in_progress` **and** no movement for `STUCK_THRESHOLD_DAYS` = 7, using `created_at` as the movement proxy — same rule as the pipeline board). Stuck rows are **not hidden** — they list normally with a red "Stuck" pill on the Status cell and in the peek. New optional `stuck` query param: `stuck` (only stuck) / `not_stuck` (exclude stuck); absent = all. Implemented as a Prisma `AND` / `NOT` clause so pagination stays correct.
- **Requirements list page:** added a "Stuck: All / Stuck only / Not stuck" `<select>` next to Status/Priority, URL-synced via `?stuck=`.
- **Requirement × stage matrix board (`GET /pipeline/board`):** the old `stuck_only` checkbox is replaced (on this board only) by the same tri-state `stuck` selector. `stuck_only` still works server-side and on the other pipeline boards for backward compatibility. `usePipelineFilters` gains a `stuck` field (`'all'` default, omitted from the URL/params when `all`).
- **Token expiry (`client/src/lib/apiClient.js`):** the 401 refresh interceptor was surfacing "Invalid or expired access token" as a page error whenever there was no refresh token, or when parallel requests raced the refresh. Now: a single shared refresh promise de-dupes concurrent 401s; a missing/failed refresh token, or a 401 from `/auth/refresh` itself, clears the session and redirects to `/login` (guarded so it doesn't loop when already there).
- Tests: `requirements-stage.test.js` +2 (`is_stuck` truth table + `stuck` filter narrowing; closed-but-old requirement is never stuck). `usePipelineFilters.test.mjs` +1 block (tri-state round-trip, `all` omitted). Full server suite green (25 suites / 155 tests).

## 2026-08-31 — Admin can reassign a requirement's Sales owner

Uncommitted work on `main` (local).

- **Server:** `updateSchema` gains `sales_owner_id`; `requirements.service.update()` only lets an **admin** change it, and only to a `sales` / `bda` / `admin` user that is active (`forbidden_owner_change` → 403, `invalid_owner_role` → 400, reuses `user_not_found`). Non-owner-change PATCHes are unaffected.
- **Client:** `RequirementFormPage` shows a "Sales owner" dropdown when editing **and** the current user is admin — options are active sales/bda/admin users, plus the current owner pinned if they fall outside that set.
- **BDA stays account-level only** (per decision) — no per-requirement BDA field. Recruiter assignment left strict (recruiters only); the existing "Assign recruiters" drawer already covers add/remove.
- Tests: `requirements-stage.test.js` +2 (admin reassigns owner / non-admin blocked / recruiter rejected).

## 2026-08-31 — Jira import repointed to full export (`Jira_all.csv`)

Uncommitted work on `main` (local). Seed helper files are still untracked.

- `docs/jira/Jira_all.csv` — full Jira export (142 cols, 34 `Requirement` rows, project OUT). Replaces the older 39-row `docs/jira/Jira.csv` as the import source. The 8 requirements that existed only in the old file (OUT-22313/22311/22308/22307/22301/22300/22292/22239) are intentionally dropped; 3 new ones added (OUT-22320/22319/22318).
- `server/prisma/seed-jira.js` rewritten to parse **by header name** (old version was positional and assumed the old layout + `Comments` header; new export uses a different column order and a singular `Comment` header). Now also imports: `Number of Positions` → `seats_total` + N seats, `Requirement Type` (C2C/C2H → `contract`, Perm → `full_time`), `Budget` ("1.8 LPM" → monthly INR ₹180000, "1000/hr" → hourly, ranges → min/max, "0" → none), `Priority` "Highest" → `urgent`. Reporter now owns the requirement regardless of role (was sales-only), so Chahak (bda) and Diksha (admin) own their own rows.
- `server/prisma/team-roster.js` — added **Biswajit Dey** (`biswajit.dey@delphic.in`, role `admin`; creator of OUT-22317) and renamed `Prashant Hada` → `Prashant Singh Hada` to match the Jira display name. All 8 Jira comment-author IDs (incl. Biswajit's creator id) map to roster users.
- Seeded: 13 users, 11 client accounts, 34 requirements, 41 seats, 213 comments, 89 recruiter assignments (8 via comment-mention regex for dheeraj/krupali/nikhil). Owners: Tanvi 23, Chahak 9, Diksha 2.

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

## 2026-08-27 — Internal round interviewer multiselect + alert banners

Commit `7ba5c90` (cherry-picked onto main with matrix/closure). Internal interview rounds (`internal_r1` / `internal_r2`) can assign one or more active users via `interview_round_interviewers`; UI uses searchable `MultiSelectDropdown`. Client rounds keep free-text interviewer name/email. App-wide dismissable alert banners (`AlertBannerStack` + `useAlerts`) and shared form validation helpers replace many inline error divs.

## 2026-08-27 — Dashboard KPI cards drill into their filtered list view

Commit `c76d0af` on `feature/v2-lead-pipeline-requirements` (follows the V2 entry below; `676db9d` + `e06b359` committed the V2 work and a CI Prisma-generate fix in between).

**What:** every KPI card on the role dashboard is now a link into the matching list page, pre-filtered to exactly what the card counts — click "Active clients" → `/accounts?stage=active&type=client`, "Open requirements" → `/requirements?status=open`, "Closures this month" → `/submissions?stage=closed`, etc. Full map in `KPI_LINKS` (`client/src/pages/dashboard/dashboardWidgets.js`), one entry per KPI across all four roles (admin / bda / sales / recruiter).

- **`KpiCard.jsx`** — new optional `to` prop; when set the card's root element becomes a react-router `Link` (plain `div` otherwise), with a subtle hover shadow (`cardHover`, added to `client/tailwind.config.js`) and a focus ring so linked cards read as interactive. No visual change for cards without a link.
- **List pages now honour their filter query params on mount** so the drill-through actually lands filtered: `RequirementsListPage` now reads `?status=` / `?priority=` (previously ignored — status/priority were local state only), `AccountsListPage` now reads `?type=` (it already read `?stage=`), and both re-sync when the query string changes. `SubmissionsListPage` already honoured `?stage=`. (These three list-page edits landed folded into `676db9d`.)
- **Semantics note:** "Interviews this week" links to `/submissions?stage=interview_scheduled` (closest available filter — not week-scoped) and "Active submissions" links to the unfiltered `/submissions` table (no single "active" stage value exists).

**Verify:** `npm run build --workspace client` — succeeds (3145 modules). `npx eslint` on the five changed files — clean.

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
