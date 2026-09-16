# Multi-Company ERP Platform — Implementation Plan

Companion to [MULTI-COMPANY-ERP-PLATFORM-HLD.md](MULTI-COMPANY-ERP-PLATFORM-HLD.md) (design).
This doc is the **execution plan**: branch, database, workstreams, schedule, and
exit criteria for a working local build. Status: **Phase 0-10 shipped (backend);
frontend + a full cross-suite regression re-run are next.** See "Current status" right below for a one-screen summary
— the rest of this doc is a chronological log, newest work at the bottom of
each dated section but sections themselves added newest-last, so scan the
tail of the file for the latest entry.

## Current status (updated 2026-09-16)

| Phase | What | Status |
|---|---|---|
| 0 | Tenancy scaffold (`OrgGroup`/`Org`/`OrgMembership`, nullable `org_id` backfill) | ✅ shipped — `org_id` → `NOT NULL` deliberately still open |
| 1 | JWT org context, org switcher backend, group superadmin, write-side `org_id` auto-injection | ✅ shipped — switcher **frontend** not built |
| 2 | Directory/calendar/attendance/leave + client-brief amendment (Location, Shift, HR/Sourcing POC, multi-project calendars, auto-overtime) | ✅ shipped — Department/Designation admin frontend, leave accrual, overtime *approval* workflow not built |
| 3 | Project-centric timesheets, daily lock, regularization tickets | ✅ shipped — frontend not built; overtime not yet reconciled against timesheet hours |
| 4 | Payroll — `SalaryStructure`/`PayrollRun`/`Payslip`, attendance+leave-driven computation | ✅ shipped (backend) — frontend not built; no correction/re-run workflow; no payslip PDF generation |
| 5 | Billing — `BillingRate`, `DailyProjectRevenue`, `ClientInvoice`, `GroupBillingCharge` | ✅ shipped (backend) — frontend not built; daily-revenue compute is admin-triggered, not scheduled; no invoice PDF/export |
| 6 | Profitability — `DailyEmployeeProfitability` fact table, nightly job, org-scoped + cross-org super dashboard | ✅ shipped (backend) — frontend not built; no overhead-cost allocation; rollups are a live `SUM()`, no materialized view yet |
| 7 | Expenses + vendor payments — `ExpenseClaim`, `VendorPayment` | ✅ shipped (backend) — frontend not built; no approval-chain policy beyond single-admin-decides |
| 8 | Accounting — `LedgerAccount`, `LedgerEntry`, `TaxRecord` | ✅ shipped (backend) — frontend not built; no period-close/retained-earnings posting; no auto-posting from billing/expense/vendor-payment events |
| 9 | External Legal/CA access — `ExternalAccess`, own bearer-token auth path | ✅ shipped (backend) — frontend not built; no token delivery by email; guest reads limited to accounting reports today |
| 10 | Org chart + lifecycle visualization | ✅ shipped (backend) — **no schema change needed**, `manager_id`/`employment_status`/`notice_end_date` landed in the 2026-09-15 Phase 2 amendment; frontend (the chart itself) not built |

Every phase's own suite is green in isolation, eslint clean, on branch
`feature/multi-company-erp` (isolated local DB `requirement_dashboard_erp`,
never merged/pushed to `main`/`staging`/`dev` by an agent). Phases 0-7 were
last verified together as **50 suites / 405 tests green**; Phases 8-10 add
27 more tests across 3 new suites (14 + 7 + 6), each confirmed green on its
own, but **the full cross-suite regression has not been re-run to
completion since** — it was deliberately paused mid-run to prioritize
shipping Phase 8-10 functionality first (see this doc's Phase 8-10 log
entry, tail of file). Re-run it before merge. No frontend has been built
for any ERP phase yet — every phase so far is backend + tests only, by
deliberate scoping (see each phase's "not built" notes below for why).

## 2026-09-15 — client brief received, plan updated

A full product brief landed (HLD doc's new "Product brief" section, top of
file) — 3 client-facing phases (Core ERP/HRMS → project timesheets/revenue →
financials/analytics/multi-company), each broader than this doc's original
phase-by-phase build order. The HLD's §11 has the exact mapping table; the
short version:

- **Nothing already shipped had to be thrown away** — the client's Phase 1
  is what Phase 0-2 already built, plus 4 concrete gaps (below).
- **The internal phase list grew**: Phase 5 now includes real-time daily
  project revenue (not just invoicing); three new phases were added —
  **Phase 7** (expenses + vendor payments), **Phase 8** (accounting
  ledger/tax), **Phase 9** (external Legal/CA access), **Phase 10** (org
  chart + lifecycle visualization) — none of which existed in the original
  design at all.
- **Phase 2 got amended same-day** (below) rather than deferring the 4 gaps
  to a later phase, because they change the *shape* of already-shipped
  tables (`EmployeeCalendar`'s cardinality, in particular) — better to fix
  that now while only two orgs' worth of demo data exists than after
  Phase 3-6 have built on top of the old shape.
- **Infra (S3, dedicated server + RDS) stays explicitly last**, per the
  client's own stated dev strategy ("begin implementation locally... before
  executing cloud migration") — this doc's existing local-DB-first approach
  already matches that; no change needed there, just confirmation.

## Revised workstream table (supersedes the one below where it conflicts)

| Stream | Owns | Depends on |
|---|---|---|
| A — Platform | Phase 0, 1 | — |
| B — Directory/Calendar/Attendance/Leave | Phase 2 (+ amendment) | A |
| C — Timesheet/Locking/Regularization | Phase 3 | B |
| D — Payroll | Phase 4 | B, C |
| E — Billing + daily revenue | Phase 5 | C, existing Account/Requirement |
| F — Profitability + Super Dashboard | Phase 6 | D, E |
| H — Expenses + Vendor Payments | Phase 7 | A (Location) |
| I — Accounting + tax | Phase 8 | E, H |
| J — External access (Legal/CA) | Phase 9 | I |
| K — Org chart + lifecycle | Phase 10 | A (manager_id, employment_status) |
| G — Frontend | every phase's UI | contract-first per stream |

H/I/J/K were new relative to the original plan; all four are now **shipped
(backend)** as of 2026-09-16 — see the Phase 8-10 log entry at the tail of
this file. Frontend for every stream in this table remains open.

## 2026-09-15 — Phase 2 amended for the client brief (4 gaps closed)

Migration `20260915120000_phase2_amend_location_shift_poc_multiproject_calendar`
— additive only (one `DROP INDEX`, relaxing a uniqueness rule with zero data
loss; everything else is `ADD COLUMN`/`CREATE TABLE`). Applied to
`requirement_dashboard_erp` and the shared test DB.

- **`Location`** (new model, org-scoped): default (Ahmedabad/Indore/Gurgaon)
  + custom locations. `Calendar.location_id` (nullable — a client-specific
  calendar isn't tied to a physical office) and `OrgMembership.location_id`.
  New endpoints `GET/POST /orgs/locations` (admin creates).
- **HR POC / sourcing POC / manager**: `OrgMembership` gains `hr_poc_id` /
  `sourcing_poc_id` (both → `User`, since an HR/sourcing contact may not
  share this org) and a self-referencing `manager_id` (→ `OrgMembership`,
  for the not-yet-built org chart, Phase 10). New `PATCH
  /orgs/memberships/:id` (admin) sets any of these — validated so a
  membership can't manage itself, and a manager must be a membership in the
  same org.
- **`Shift`** (new model, org-scoped): `start_minutes`/`end_minutes`
  (minutes-from-midnight, so an overnight shift works) + `grace_minutes`
  (default 15). `OrgMembership.shift_id`. New `GET/POST /attendance/shifts`.
  **Automatic overtime**: `AttendanceRecord.overtime_minutes`, computed in
  `attendance.service.checkOut()` as `max(0, worked_minutes - (shift
  duration + grace))`, `null` when no shift is assigned. This is the
  auto-*calculation* the brief asks for — an approval workflow on top of it
  (matching the original HLD sketch's `OvertimeRecord`) is a separate,
  still-open question (HLD "Open items").
- **Multi-project calendar mapping** (the change with the most blast
  radius): `EmployeeCalendar` was a strict one-per-membership
  (`org_membership_id @unique`) in the original Phase 2 build; the client
  brief requires an employee on more than one concurrent client engagement
  to follow more than one calendar at once. Dropped that unique constraint,
  added `account_id` (nullable — `null` = the employee's default/base
  calendar), new compound unique `(org_membership_id, calendar_id,
  account_id)`. `calendars.service.assign()` now takes an optional
  `account_id` and does a find-then-upsert per `(membership, project)`
  rather than a single `upsert` on the old unique key (Postgres unique
  constraints don't dedupe `NULL` against `NULL`, so the service layer
  enforces "one mapping per project" itself — documented as a known gap in
  the schema comment, same pattern as `Department`'s name-uniqueness gap).
  New `GET /calendars/assignments/:orgMembershipId`.
- **Tests**: `server/tests/erp-phase2-amendment.test.js` (10 cases —
  location CRUD + admin gate, POC/manager mapping + self-manager rejection
  + cross-org manager rejection, shift CRUD + overtime math including the
  overnight-safe duration calc and the "within grace, no OT" case,
  multi-project assignment + listing + reassignment-replaces-not-duplicates).
  Full suite **44 suites / 338 tests green**; eslint clean (same
  pre-existing warnings only).
- Local: seeded Ahmedabad/Indore/Gurgaon + a "General 9-6" shift into
  `requirement_dashboard_erp`, assigned the shift to all 13 memberships.
## 2026-09-16 — Pre-Phase-3 hardening: org_id write-side auto-injection + Designations module

Before starting Phase 3, closed two loose ends flagged as "remaining" in the
Phase 1/2 logs — both zero-regression, verified against the full suite.

- **`org_id` auto-injection on create** (HLD §5 layer 1, the write-side
  half only — see below for why the read-side half and the `NOT NULL` flip
  stay deferred). New `server/src/lib/orgContext.js`
  (`AsyncLocalStorage`-based, empty outside a request — cron jobs/scripts
  are unaffected). `middleware/auth.authenticate` now runs the rest of the
  request inside `orgContext.run({ org_id, org_membership_id }, next)`.
  `config/db.js` gained a second `prisma.$use` (alongside the existing
  soft-delete one) that stamps `org_id` onto a `create` for 17 org-scoped
  models (the Phase 0 list + `Department`/`Designation`/`Calendar`/
  `AttendanceRecord`/`LeaveType`/`LeaveRequest`) **only when** the request
  has resolved org context **and** the caller didn't already set `org_id`
  explicitly. Every existing service that already sets `org_id` explicitly
  (all of Phase 2/2-amendment) is unaffected; every caller with no org
  membership (still the default for a plain `createUser()` in tests, and
  for any real user before they're backfilled) is unaffected.
  **Why not the read-side half or the `NOT NULL` flip too**: auto-filtering
  every read by `org_id` would change results for any caller who already
  has an org membership, and the entire recruitment domain's read paths
  (accounts/requirements/profiles/submissions/reports/dashboard — dozens of
  service functions) have never been audited against that; and `NOT NULL`
  can't land while `createUser()`-style membership-less users are still a
  deliberately-supported, tested case (Phase 1's own backward-compat
  guarantee). Both stay open, larger, separately-scoped decisions — not
  silently dropped, tracked in TODO.md.
- **`designations` module** (new, org-scoped, mirrors the existing global
  `departments` module's shape): `GET/POST /designations`, `PATCH
  /designations/:id`, gated by `requireOrgMembership` + `authorize('admin')`
  for writes. Same designation name is allowed in two different orgs
  (unlike `Department`'s still-global unique).
- Tests: `server/tests/designations.test.js` (8 — membership gate, CRUD +
  admin gate, cross-org name reuse, rename-collision rejection, plus 3
  cases proving the auto-injection: a department created with org context
  gets stamped, one created without context stays `null` exactly as before,
  and an explicitly-set `org_id` from an existing service is never
  overridden). Full suite **45 suites / 346 tests green**, eslint clean.
- Local: smoke-tested the auto-injection directly against
  `requirement_dashboard_erp` (a `Department` created inside
  `orgContext.run()` came back correctly stamped).
- **Side note**: mid-session, Docker Desktop went down (unrelated to this
  work — confirmed by the error being a Postgres-unreachable connection
  failure, not a test failure) while a test run was in flight; relaunched
  it, confirmed all three local databases and the `max_connections=200`
  setting survived, and reran clean.

## 2026-09-16 — Phase 3 shipped (project-centric timesheets, daily lock, regularization tickets)

Two migrations (`20260916052421_phase3_project_timesheets` +
`20260916052614_phase3_timesheet_decision_reason`, both additive-only, no
`DROP`), applied to `requirement_dashboard_erp` and the shared test DB.

- **Schema**: new `TimesheetEntry` — one row per **(employee, day,
  project)**, per the client brief (a split day like 4h Project A + 4h
  Project B is two rows, not one blended entry). `account_id` (required, the
  client) + `requirement_id` (optional, a specific engagement under that
  account) reuse the existing recruitment domain rather than inventing a
  new "project" concept, per the original HLD's own reasoning. `org_id`
  denormalized directly (same reasoning as `AttendanceRecord`/
  `LeaveRequest` — a real `(org_id, date)` index, not a join). New
  `TimesheetLock` — one row per `(org_id, date)`, an **org-wide** daily
  lock (not per-employee — matches "Admins can lock timesheets daily").
  New `TimesheetRegularizationTicket` — `requested_change` is a small JSON
  patch restricted to `hours`/`billable`/`notes` by validation (never
  trusted as an arbitrary write), applied field-by-field on approval inside
  a transaction alongside the ticket's own status update.
- **New `timesheets` module** (`server/src/modules/timesheets/`), gated by
  `requireOrgMembership`:
  - `POST /timesheets/entries` — checks the day isn't locked, the account
    (and requirement, if given) belongs to the caller's org, and the day's
    total hours across all of that employee's entries won't exceed 24.
  - `GET /timesheets/entries/me`, `GET /timesheets/entries` (admin, team-wide).
  - `PATCH /timesheets/entries/:id` — owner-only, and only while `status`
    is still `submitted` **and** the day isn't locked; a decided or
    locked-day entry can only change via a regularization ticket.
  - `POST /timesheets/entries/:id/decision` (admin) — approve/reject,
    reason optional but stored (`decision_reason`), one-shot (can't
    re-decide).
  - `POST /timesheets/entries/:id/regularization-tickets` — **only valid
    once the day is locked** (422 otherwise — "just edit it directly").
  - `GET /timesheets/regularization-tickets` (admin), `POST
    /timesheets/regularization-tickets/:id/decision` (admin) — approving
    applies the patch to the entry inside a transaction; rejecting leaves
    the entry untouched; one-shot.
  - `POST /timesheets/locks`, `GET /timesheets/locks` (admin) — locking is
    idempotent-checked (409 on a day already locked), and deliberately has
    **no unlock endpoint** — the brief's whole point is that a lock is a
    one-way freeze; corrections go through the ticket flow, not an admin
    toggle.
  - `TimesheetEntry`/`TimesheetLock` added to the write-side `org_id`
    auto-injection set in `config/db.js` (redundant with the service
    explicitly setting `org_id` — defense-in-depth, matching the pattern
    for every other Phase 2/3 module).
- **Tests**: `server/tests/erp-phase3-timesheets.test.js` (14 cases —
  org-membership gate, basic logging, multi-project split-day logging, the
  24h/day cap, requirement-must-belong-to-account validation, cross-org
  account rejection, owner-edit-while-submitted then blocked-after-approval,
  non-admin can't decide, lock freezes both new entries and edits on that
  day, a ticket is rejected before the day is locked and required after,
  approving a ticket applies the change transactionally, rejecting one
  doesn't, admin team view, non-admin blocked from the team view and from
  locking). Full suite **46 suites / 360 tests green**, eslint clean.
- Local: smoke-tested `createEntry` end-to-end against
  `requirement_dashboard_erp` inside a real `orgContext.run()` block.
- **Not built this phase**: any frontend (timesheet entry form, admin lock
  button, ticket review screen); overtime is still computed only from
  attendance check-in/out (Phase 2), not cross-checked against logged
  timesheet hours — the HLD's `overtime` module description
  ("computed from attendance + timesheet") is only half-built; that
  reconciliation is a reasonable next add, not done here to keep this pass
  scoped to what the client brief's Phase 2.1/2.2 actually asked for.

- **Not built this pass** (see HLD §11 for the full remaining map):
  everything in Phase 3 onward (timesheet locking/regularization tickets,
  billing/daily revenue, payroll, profitability/super-dashboard) and all
  four brand-new phases (7 expenses/vendor, 8 accounting, 9 external
  access, 10 org chart) — schema-sketched in the HLD, zero code. Also not
  built: an overtime *approval* workflow (only the auto-calc), and any
  frontend for locations/shifts/POC-mapping/multi-project calendars.

## Branch & database (do this once, per machine)

- Branch: **`feature/multi-company-erp`**, cut from `main` at `d7068cc` (2026-09-15).
  All 9 HLD phases land here via short-lived sub-branches merged into it.
  **Never merged into `main`/`staging`/`dev` by an agent** — same standing rule
  as everywhere else in this repo (`AGENTS.md` "Working conventions"). When it's
  ready, the agent hands the human the exact merge/push commands.
- Database: a **second local Postgres database**, `requirement_dashboard_erp`,
  created inside the *same* Docker container already used for dev
  (`delphic_one-db-1`, mapped to `localhost:5434`). The existing
  `requirement_dashboard` DB (and whatever your `server/.env` currently points
  at — e.g. a restored `prodcopy`) is **completely untouched**; this is a
  parallel, empty DB that only this branch's migrations touch.
  ```bash
  docker compose exec -T db createdb -U postgres requirement_dashboard_erp
  ```
  (Already run as of this doc's creation — safe to re-run, `createdb` no-ops if
  it exists.)
- Env template: **`server/.env.erp.example`** (committed — carved out of the
  `.env.*` gitignore rule so it ships with the repo). Copy it to `server/.env`
  when you want to actively run against the ERP DB, or run it as a second
  instance on `PORT=4001` alongside your normal dev server (the template
  defaults to 4001 for exactly this). Your regular `server/.env` is never
  touched by this workflow — swap it back with `server/.env.example` (or
  whatever you were using) to resume normal recruitment-dashboard work.
- First migration on this branch (`prisma migrate dev`, from `server/`, with
  `DATABASE_URL` pointed at `requirement_dashboard_erp`) will replay the full
  existing migration history first, then layer on new Phase-0 migrations — so
  the ERP DB starts as a clean copy of today's schema, then diverges.
- Seed: run the normal seed chain (`seed` → `seed:accounts` → `seed:jira` →
  `seed:vendors`) against the ERP DB for baseline recruitment data, then the
  new Phase-0 backfill script (below) to create the `Org`/`OrgMembership` rows,
  then a to-be-built `seed-erp-history.js` that backdates ~60 days of synthetic
  attendance/timesheet/leave so payroll and profitability have something to
  compute against without waiting on a real month of data.

## Scope for the local build (all 9 HLD phases, thin-but-working)

Target: every module wired end-to-end and demoable locally against seeded
synthetic history — not production-trustworthy (see "Deliberately thin" below).

## Dependency graph / workstreams

```
Phase 0 (tenancy scaffold)
   └─ Phase 1 (JWT org context, org switcher, group superadmin)
        └─ Phase 2 (Department/Designation/Calendar/Attendance/Leave)
             ├─ Phase 3 (Timesheet/Overtime) ── needs Phase 2's Calendar
             └─ Phase 5 (Billing) ── needs Phase 3's Timesheet + existing Account/Requirement
                  └─ Phase 4 (Payroll) ── needs Phase 2 Attendance/Leave + Phase 3 Overtime
                       └─ Phase 6 (Profitability + Super Dashboard) ── needs Phase 4 + 5 producing rows
```

| Stream | Owns | Depends on | Can start |
|---|---|---|---|
| A — Platform | Phase 0, 1, then an RLS/hardening pass at the end | — | immediately |
| B — Directory/Calendar/Attendance/Leave | Phase 2 backend + UI | A | Day 1 draft schema, full speed once A lands |
| C — Timesheet/Overtime | Phase 3 | B's Calendar | once B's Calendar schema is fixed |
| D — Payroll | Phase 4 | B's Attendance/Leave, C's Overtime | once B+C have schema + seed data |
| E — Billing (client + group) | Phase 5 | existing Account/Requirement, C's Timesheet | schema Day 1, full build alongside C |
| F — Profitability + Super Dashboard | Phase 6 | D + E producing rows | last, thin nightly-job + rollup + read-only UI |
| G — Frontend shell | Org switcher, per-module UI, super-dashboard UI | contract-first per stream | Day 1, against agreed API contracts, not blocked on real endpoints |

Critical path (A: Phase 0 → Phase 1 → B's Phase 2 schema) is the bottleneck
regardless of headcount — budget it fully before fanning out.

## Day-by-day (assuming 3-4 devs; see HLD-planning conversation for the
1-dev and 6+-dev variants)

- **Day 1** — A: Phase 0 schema (`OrgGroup`/`Org`/`OrgMembership`, nullable
  `org_id` everywhere), migration, backfill script (one `Org` = Delphic, one
  `OrgGroup`, one `OrgMembership` per existing `User`). B: Phase 2 schema draft
  reviewed against A's shape, not migrated yet. E: billing schema draft
  (`ClientInvoice`/`GroupBillingCharge`). G: org-switcher UI + nav shell against
  a mocked `/orgs/me/memberships`.
- **Day 2** — A: Phase 1 (JWT `org_id`, `authorize()` reads `OrgMembership`,
  `authorizeGroupSuperadmin`, org-switcher endpoint) + `org_id` → `NOT NULL`
  (second migration, additive-only per the repo's HARD RULE — no `DROP` ships
  with feature code). B: Phase 2 migration lands, attendance check-in/out +
  leave request/approve endpoints + UI. C: timesheet schema against B's
  Calendar. E: client-invoice CRUD skeleton against existing
  Account/Requirement.
- **Day 3** — B: leave balances/accrual, holiday-calendar assignment UI. C:
  timesheet entries (linked to existing Account/Requirement as "project"),
  overtime from attendance+timesheet. D: payroll schema
  (`SalaryStructure`/`PayrollRun`/`Payslip`) + `seed-erp-history.js`.
- **Day 4** — D: payroll run + payslip generation (a synchronous "run now"
  admin action locally — no BullMQ/Redis yet, that's an explicit
  add-when-needed item in HLD §8). E: group billing charge, invoice line-items
  from C's timesheet. F: `DailyEmployeeProfitability` fact table + a manual
  "recompute" endpoint (skip the nightly cron locally).
- **Day 5** — F: super-dashboard API + UI (`is_group_superadmin`-gated, reads
  only the fact table), per-company drill-in reusing normal dashboard
  components. Everyone: create the second `Org` ("Acconcy"), give one seeded
  user a second `OrgMembership`, verify isolation, run the demo script below.
  A: RLS pass if time allows — otherwise explicitly deferred (see below).

## Deliberately thin at the end of Day 5 — call these out, don't hide them

- No BullMQ/Redis — payroll runs and the profitability ETL are synchronous
  admin-triggered actions, not background jobs.
- No Postgres RLS unless Day 5 has slack — app-layer `org_id` injection
  (Prisma middleware, same pattern as the existing soft-delete middleware) is
  the only isolation layer. **Real gap before this touches shared/prod data.**
- Payroll math runs against synthetic backdated data, not a real trusted
  month — fine to see it work locally, not fine to trust the numbers for an
  actual payroll run.
- No mobile/biometric attendance, no read replica, no PgBouncer, no analytics
  warehouse — out of scope per HLD §10, unchanged here.

## Local demo script (Day 5 exit criteria)

1. Log in as a user with two `OrgMembership` rows → switch between Delphic and
   Acconcy via the org switcher.
2. Check in/out, see it on the attendance calendar; submit and approve a leave
   request.
3. Log a timesheet entry against an existing requirement; see overtime
   computed.
4. Trigger a payroll run for the current period; open the generated payslip.
5. Generate a client invoice referencing logged timesheet hours.
6. As `is_group_superadmin`, open the super dashboard, see aggregated margin
   across both orgs, drill into one company's dashboard.
7. Confirm an Acconcy-only user never sees a Delphic row anywhere above.

## Open items (carried from the HLD's own "confirm before Phase 0" list)

- Who gets `is_group_superadmin` locally for testing — default plan:
  `admin@delphic.in` only.
- Whether the second `Org` ("Acconcy") gets realistic seeded data or is just a
  throwaway isolation-test org.

## Database connection pooling & latency

See [guides/DATABASE-CONNECTION-POOLING.md](../guides/DATABASE-CONNECTION-POOLING.md)
for the full writeup (this was a repo-wide gap, not ERP-specific, fixed while
working this branch since three DB consumers now share one Postgres
instance). Summary: every `DATABASE_URL` now carries explicit
`connection_limit`/`pool_timeout` instead of Prisma's default guess; local
Postgres bumped to `max_connections=200`; graceful `$disconnect()` on
shutdown; PgBouncer and a read replica stay deferred with concrete triggers
documented (not needed at current scale).

## Log

- **2026-09-15** — Branch `feature/multi-company-erp` cut from `main`
  (`d7068cc`). DB `requirement_dashboard_erp` created in the existing Docker
  Postgres container (`localhost:5434`), current `requirement_dashboard` /
  `server/.env` (`prodcopy`) untouched. `server/.env.erp.example` +
  `.gitignore` carve-out added. No phase code written yet.
- **2026-09-15 — Phase 0 shipped (schema + migration + backfill).**
  `schema.prisma`: new `OrgGroup` / `Org` / `OrgMembership` models, new enums
  `OrgStatus` / `EmploymentStatus`, `User.is_group_superadmin` (default
  `false`, unused until Phase 1), and a nullable `org_id` column + `Org?`
  relation added to every existing tenant-scoped model: `Account`,
  `Requirement`, `Profile`, `Submission`, `InterviewRound`, `StageHistory`,
  `Document`, `Comment`, `Notification`, `NotificationPreference`,
  `AuditLog`. Migration `20260915103201_phase0_org_tenancy_scaffold` —
  additive only (no `DROP`, no `NOT NULL`), applied to
  `requirement_dashboard_erp` and the shared `requirement_dashboard_test` DB.
  **Deliberately not touched:** `Department`/`Designation` (Phase 2's job per
  the module map) and pure join tables (`RequirementSeat`,
  `RequirementAssignment`, `AccountMeetingAttendee`,
  `InterviewRoundInterviewer`) — they inherit tenancy transitively via their
  parent row's `org_id`, no direct column needed.
  New `server/prisma/erp/phase0-backfill.js` (idempotent, non-destructive —
  no `_guard.js` needed since it never deletes): creates one `OrgGroup`
  ("Delphic Group") + one `Org` ("Delphic", slug `delphic`), one
  `OrgMembership` per existing `User`, then stamps `org_id` on every row of
  the 11 models above. New script: `npm run erp:phase0:backfill` (from
  `server/`). Verified against `requirement_dashboard_erp` seeded with the
  full CSV chain (team + accounts + jira + vendors): 13 users → 13
  memberships, 111 accounts / 34 requirements / 213 comments stamped;
  re-running is a no-op (org reused, 0 duplicate memberships, 0 re-stamped).
  **App behavior unchanged** — full server suite **41 suites / 307 tests
  green** against `requirement_dashboard_test` post-migration; client not
  touched. `org_id` stays `NULL` on every table until Phase 1 starts writing
  it and flips the column to `NOT NULL` (own migration, per the repo's
  additive-only HARD RULE).
  **Windows note:** `prisma generate` failed with `EPERM` (query-engine
  `.dll` locked by the running dev server/vite processes sharing this
  workspace's `node_modules`) — stopped the 7 project node processes
  (`dev:server`/`dev:client`/nodemon/vite/`src/index.js`) to clear the lock,
  regenerated, then reran `npm test` clean. Restart your dev server/client
  after pulling this — nothing else needed, Phase 0 is purely additive.
- **2026-09-15 — Phase 1 shipped (JWT org context, org switcher backend,
  group superadmin).** No schema change — pure app-code wiring on top of
  Phase 0.
  - **JWT**: `auth.service.signAccessToken`/`signRefreshToken` gain an
    `org_id` claim. `login()` resolves the caller's earliest-joined active
    `OrgMembership` as the default org (HLD §2 "default org = only
    membership, or last-used" — no last-used tracking yet, so first-joined
    stands in) and returns `{ ..., memberships: [...], active_org }`
    alongside the existing `user` shape. `refresh()` re-verifies the
    membership on the refresh token is still active on every refresh
    (offboarding takes effect on next refresh, not just next login), falling
    back to the current default org if it's gone.
  - **`middleware/auth.js`**: `authenticate` now calls `resolveOrgContext()`
    after decoding the JWT — if the token carries `org_id`, it re-reads the
    live `OrgMembership` row for `(user, org_id)` and overrides `role` with
    it (never trusts the JWT's role claim), matching the existing
    `authorizeSuperadmin` re-read-from-DB pattern. A token with no `org_id`
    (any pre-Phase-1 token, or a user with zero memberships) is a full no-op
    — `authorize()` itself is untouched. New `authorizeGroupSuperadmin`
    (mirrors `authorizeSuperadmin`) re-reads `User.is_group_superadmin` +
    `active` per request.
  - **New `orgs` module** (`server/src/modules/orgs/`): `GET
    /orgs/me/memberships` (any authenticated user — powers the org
    switcher) and `GET /orgs` (`authorizeGroupSuperadmin` — every org in the
    group, for the future super dashboard's org picker).
  - **Org switcher backend**: `POST /auth/switch-org` `{ org_id }` —
    verifies an active membership, re-issues both tokens scoped to that org
    (`403 not_a_member` otherwise). No frontend yet — see "Remaining" below.
  - **Tests**: new `server/tests/orgs-phase1.test.js` (11 cases — no-membership
    backward compat, default-org selection, live per-org role resolution
    ignoring a lying JWT claim, ended-membership fallback, the switcher happy
    path + rejection, group-superadmin gate + live demotion). Full suite
    **42 suites / 318 tests green**; `eslint` 0 errors (same pre-existing
    warnings only).
  - Local: `admin@delphic.in` flipped to `is_group_superadmin: true` in
    `requirement_dashboard_erp` (the plan's default pick for who tests the
    super dashboard locally).
  - **Remaining for Phase 1** (deferred, tracked in TODO.md): the
    AsyncLocalStorage + Prisma-middleware auto-injection of `org_id` on
    every write (HLD §5 layer 1) and the `org_id` → `NOT NULL` migration —
    doing the `NOT NULL` flip before that auto-injection exists would break
    every existing create call (accounts, requirements, profiles, …), none
    of which set `org_id` today. Also deferred: the actual org-switcher
    **frontend** (dropdown in the header, `authContext` storing
    `memberships`/`active_org`) — meaningless to build further until there's
    a second org to switch to, and the backend contract above is what it'll
    be built against.
- **2026-09-15 — Phase 2 shipped (directory + calendar + attendance + leave,
  backend).** Migration `20260915110152_phase2_directory_calendar_attendance_leave`
  — additive only, applied to `requirement_dashboard_erp` and the shared test
  DB.
  - **Schema**: new `Designation`, `Calendar`/`CalendarHoliday`/
    `EmployeeCalendar`, `AttendanceRecord`, `LeaveType`/`LeaveBalance`/
    `LeaveRequest` + `CalendarKind`/`AttendanceStatus`/`AttendanceSource`/
    `LeaveRequestStatus` enums. `OrgMembership` gains `designation_id`
    (nullable). `Department` gains a nullable `org_id` — **its global
    `name` unique is deliberately left alone** (not tightened to
    `@@unique([org_id, name])` yet); today's single-org data has no
    collisions, and enforcing per-org uniqueness is a follow-up once
    `org_id` is actually enforced app-side. `AttendanceRecord`/`LeaveRequest`
    denormalize `org_id` directly (not just reachable via
    `org_membership_id`) so the HLD §8 `(org_id, date)` composite index is a
    real index, not a join. All new tables are brand new (no legacy rows),
    so their `org_id` is `NOT NULL` from creation — unlike Phase 0/1's
    nullable-until-enforced columns on existing tables.
  - **New modules** (`server/src/modules/{calendars,attendance,leave}/`),
    all gated by new `requireOrgMembership` middleware (403 if the caller
    has no active `OrgMembership` for the token's org — unlike the existing
    recruitment routes, which stay oblivious to org context per Phase 1):
    - `calendars`: `GET/POST /calendars`, `GET/POST /calendars/:id/holidays`,
      `POST /calendars/:id/assign` (assigns a calendar to an
      `OrgMembership`, one active calendar per membership).
    - `attendance`: `POST /attendance/check-in` / `check-out` (today, IST
      calendar day via new `src/lib/istDate.js`, shared with reports'
      existing `asIst` logic), `GET /attendance/me`, `GET /attendance`
      (admin, team-wide), `POST /attendance/:id/regularize` (admin,
      reason required).
    - `leave`: `GET/POST /leave/types`, `POST /leave/requests`, `GET
      /leave/requests/me`, `GET /leave/requests` (admin), `POST
      /leave/requests/:id/decision` (approve/reject — approving increments
      `LeaveBalance.used`), `POST /leave/requests/:id/cancel` (owner,
      pending only).
  - New `src/lib/zodDate.requiredDate` (sibling to the existing
    `optionalDate`) for required date fields (holiday date, leave
    from/to_date).
  - **Tests**: `server/tests/erp-phase2.test.js` (10 cases — org-membership
    gate returns 403 not a crash for every new module, calendar create +
    holiday + duplicate-holiday rejection + assignment, admin-only gates,
    check-in/check-out happy path + both double-action rejections, team
    listing + regularization, leave request → approve → balance increments
    → re-decide rejected, cancel-then-cancel-again rejected, from>to
    validation). Full suite **43 suites / 328 tests green**; eslint clean.
  - Local: seeded a default "Delphic Standard" calendar (2 holidays) assigned
    to all 13 memberships, plus 3 leave types, in
    `requirement_dashboard_erp`. Verified `checkIn()` end-to-end against
    `admin@delphic.in`'s real membership.
  - **Not built this phase** (by design, per the plan's day-by-day split):
    Department/Designation CRUD endpoints (schema only — `OrgMembership` can
    reference them, but nothing creates/lists them via API yet; the real
    Phase 2 deliverables are calendar/attendance/leave, not directory admin
    screens); any frontend; leave accrual (balances only move via approved
    requests, nothing seeds `accrued` yet).
- **2026-09-16 — Phase 4 shipped (payroll, backend).** Everything shipped
  between this entry and the Phase 2 one above (Phase 2 amendment, Phase 2
  remaining/designations, DB connection pooling, pre-Phase-3 hardening,
  Phase 3 timesheets) is logged in [PROGRESS.md](../progress/PROGRESS.md)
  rather than backfilled here — see the "Current status" table at the top of
  this doc for the one-screen summary. Migration `20260916074851_phase4_payroll`
  — additive only.
  - **Schema**: `SalaryStructure` (`org_membership_id`, versioned by
    `effective_from`; `ctc` is **monthly** gross throughout, `components`
    json validated on write to sum to it), `PayrollRun` (`org_id` +
    `period_month`/`period_year`, unique per period; `draft → processed` is
    **one-way**, same freeze posture as `TimesheetLock`; `skipped` json
    records uncovered memberships + why), `Payslip` (`gross`/`deductions`/
    `net` + a full `breakdown` json). `payslip` added to
    `DocumentEntityType` so a future generated PDF attaches via the
    existing polymorphic Document model — deliberately no dedicated FK
    column on `Payslip` for this.
  - **Payroll math** (`payroll.service.computeBreakdown`) — documented
    assumptions: a day is paid in full on a weekend (**5-day work week
    assumed; no weekly-off calendar exists yet to configure this per org**),
    an org-default-`Calendar` holiday, or `present`/`wfh` attendance;
    half-paid on `half_day`; a paid-`LeaveType` approved `LeaveRequest`
    covers it fully, an unpaid one docks a day; anything else on a working
    day (absent, or no attendance record and no leave) is loss-of-pay.
    Deduction = `(ctc / days_in_month) × lop_days`. Overtime minutes are
    summed into the breakdown for visibility but **not paid** — no
    overtime-pay policy exists yet (a Phase 3 deferred item, still open).
  - **New `payroll` module**, mirrors `timesheets`' route shape, gated by
    `requireOrgMembership`: salary-structure CRUD (admin) + self view;
    run create (admin) + `POST /runs/:id/process` (admin, one-way — pulls
    every membership employed during the period, skips anyone with no
    applicable salary structure rather than failing the run, computes every
    `Payslip` in one transaction); payslip views (self, admin per-run team
    list, single payslip by owner or admin). `SalaryStructure`/`PayrollRun`
    added to the write-side `org_id` auto-injection set in `config/db.js`
    (belt-and-suspenders — the service already sets `org_id` explicitly).
  - **Tests**: `erp-phase4-payroll.test.js` (13 — org-membership gate,
    components-must-sum-to-ctc validation + cross-org salary-structure
    rejection, duplicate-run rejection, a fully-present employee nets
    exactly `ctc` with zero deductions, unpaid absences deduct correctly
    while approved paid leave doesn't, a member with no salary structure is
    skipped not failed, a run can't be processed twice, payslip ownership +
    admin access, admin per-run team listing). Full suite **47 suites / 373
    tests green**, eslint clean (0 errors, pre-existing warnings only).
  - **Local environment note (this specific dev machine)**: port 5434 is
    *also* occupied by a native `postgres.exe` here (beyond the 5432/5433
    conflicts AGENTS.md already documents), so the Docker `db` service is
    remapped to **5435** via a local gitignored root `.env`
    (`POSTGRES_PORT=5435`); `server/.env`/`server/.env.erp` follow suit.
    `tests/env.setup.js` gained a `TEST_DATABASE_URL` override (default
    unchanged for every other machine) instead of hardcoding this machine's
    remap into the checked-in file. The isolated `requirement_dashboard_erp`
    + `requirement_dashboard_test` databases didn't exist yet in this
    machine's Docker volume and were created fresh.
  - **Not built this phase**: frontend (salary-structure admin screen, run
    processing + payslip UI); a correction/re-run workflow for a mistaken
    run (today: one-way, no undo — a deliberate gap, not an oversight, same
    reasoning as `TimesheetLock`); payslip PDF generation (the
    `DocumentEntityType` value is ready for it, nothing generates one yet).
- **2026-09-16 — Phase 5 shipped (billing + real-time project revenue,
  backend).** Migration `20260916092941_phase5_billing` — additive only.
  - **Schema**: `BillingRate` (`account_id` + optional `requirement_id`,
    versioned by `effective_from` — same pattern as `SalaryStructure`;
    `hourly`/`monthly` `rate_type`). `DailyProjectRevenue` (one row per
    (project, day) — the client brief's real-time revenue metric; idempotent
    by design, recompute updates in place rather than duplicating — no DB
    unique constraint, since `requirement_id`'s nullability would let
    Postgres treat two account-level rows as distinct under one). `ClientInvoice`
    (one per client account/period; `draft → sent → paid` forward-only, same
    freeze posture as `PayrollRun`). `GroupBillingCharge` (intra-group charge
    against a member org; `kind` is free text — the HLD doesn't enumerate
    charge kinds, so this isn't an invented enum).
  - **Rate resolution** (`billing.service.resolveRate`) — most-specific-wins:
    a requirement-specific rate beats the account-wide default
    (`requirement_id: null`) on a given date.
  - **Revenue computation** (`billing.service.computeDayRevenue`) — that
    day's **approved + billable** `TimesheetEntry` hours only, grouped by
    (account, requirement), × the resolved rate: `hourly` = hours × rate;
    `monthly` = rate ÷ days-in-month (only earned on a day with billable
    activity — no activity, no row). No applicable rate → the pairing is
    skipped and reported, not failed.
  - **New `billing` module**, mirrors `payroll`'s route shape for
    rates/revenue/invoices (`requireOrgMembership` + `authorize('admin')`):
    rate CRUD, `POST /daily-revenue/compute` (date range, capped at 31 days,
    admin-triggered — not a background job yet), invoice generate (sums a
    period's computed revenue into a draft with a per-requirement
    `line_items` breakdown; rejects with no revenue computed) + forward-only
    status transition. Group charges follow the `orgs` module's cross-org
    pattern instead: `POST/GET /group-charges/all` gated to
    `authorizeGroupSuperadmin` alone (no `requireOrgMembership` — this is
    inherently not a self-org action), `GET /group-charges` (any admin,
    self-org view). `BillingRate`/`ClientInvoice` added to the write-side
    `org_id` auto-injection set; `GroupBillingCharge` deliberately excluded
    since its `org_id` is the org *being charged*, not the caller's own.
  - **Tests**: `erp-phase5-billing.test.js` (12 — org-membership gate, rate
    CRUD + cross-account requirement rejection, hourly revenue from
    approved+billable hours only, monthly proration, requirement-specific
    override, no-rate skip, idempotent recompute, invoice generation +
    duplicate-period + line_items + no-revenue rejection, forward-only
    transitions + non-admin block, group-charge creation gated + self-org
    vs. cross-org visibility). Full suite **48 suites / 385 tests green**,
    eslint clean.
  - **Not built this phase**: frontend (rate admin, invoice list/detail,
    group-charge screens); a scheduled/nightly auto-compute for daily
    revenue (today it's a manual admin call, matching the HLD §8 posture —
    add a job queue only once something needs it); invoice PDF/export.
- **2026-09-16 — Phase 6 shipped (profitability fact table + super
  dashboard, backend).** Migration `20260916103733_phase6_profitability` —
  additive only.
  - **Schema**: `DailyEmployeeProfitability` — one row per
    (org_membership, day): `revenue`/`cost`/`margin` + a `breakdown` json
    for audit. The only table the super dashboard reads (HLD §7).
  - **Computation** (`profitability.service.computeDayForOrg`) chains two
    batch steps in one call: (1) calls `billing.service.computeDayRevenue`
    directly to guarantee that day's `DailyProjectRevenue` is fresh — a
    cross-module service import, same precedent as `interviews.service`
    importing from `submissions.service`; (2) allocates each project-day's
    revenue **pro-rata by approved+billable hours** across everyone who
    logged time on it that day (a 6h/2h split gets 75%/25% of that project's
    revenue, regardless of the underlying rate being hourly or monthly);
    (3) nets against `cost` = latest `SalaryStructure.ctc` ÷ days-in-month
    (Phase 4's own per-day method — **no overhead allocation yet**, the HLD
    mentions it but nothing computes it); a membership with no salary
    structure is skipped, not failed, matching payroll's posture. Cost
    accrues every employed day regardless of billable activity, so a
    bench/leave/weekend day correctly nets a negative margin — that's the
    point of the metric. Upserts on `(org_membership_id, date)`, a real DB
    unique constraint this time (unlike `DailyProjectRevenue`, neither key
    column is nullable here).
  - **Rollups** (`profitability.service.rollup`) are a live `SUM()` over the
    fact table by day or month — no materialized view yet, per HLD §6's own
    sequencing ("start with a live query, add a materialized view only once
    the fact table is too large for that to stay fast"). Shared by both
    modules below; `orgId: undefined` reads across every org.
  - **New `profitability` module** (org-scoped): `POST /compute` (date
    range, capped 31 days), `GET /me`, `GET /team`, `GET /rollup`.
  - **New `super-dashboard` module** (cross-org): `POST /compute` +
    `GET /rollup`, gated to `authorizeGroupSuperadmin` **alone** —
    deliberately no `requireOrgMembership`, mirroring `orgs`' `GET /orgs`
    (verified a group-superadmin with zero org memberships anywhere still
    works). `org_id` optional on rollup: omitted = group-wide total, passed
    = the identical query drilling into one company (HLD §7 — one UI,
    parameterized).
  - **New nightly job** `jobs/profitabilityCompute.js` (node-cron, same
    shape as `jobs/interviewReminders.js`) — computes *yesterday* daily at
    02:00 UTC across every active org, per-org try/catch, a no-op wherever
    no orgs exist. Wired into `jobs/index.js`.
  - **Tests**: `erp-phase6-profitability.test.js` (10 — org-membership gate,
    exact-number pro-rata allocation across two employees, no-salary skip,
    pure-cost negative-margin day + idempotent recompute, non-admin block,
    month rollup with headcount, super-dashboard 403 + no-membership-still-
    works + cross-org compute + group-wide-vs-drill-in rollup, the nightly
    job's date selection). Full suite **49 suites / 395 tests green**,
    eslint clean.
  - **Confirmed, not caused by this work**: while chasing intermittent
    full-suite failures on this resource-constrained dev machine,
    `tests/orgs-phase1.test.js`'s "earliest-joined" case turned out to be
    genuinely flaky — `OrgMembership.joined_at` is `@db.Date` (day
    precision), so two memberships created moments apart in one test tie,
    and `auth.service.js`'s `orderBy: { joined_at: 'asc' }` has no secondary
    key. `git diff` against that file and `orgs.service.js` is empty for
    this session. Flagged, not fixed (out of scope) — see PROGRESS.md.
  - **Not built this phase**: frontend (super dashboard UI, drill-in,
    org-scoped profitability view); overhead-cost allocation; a
    materialized-view refresh layer (not needed yet at this data volume).
- **2026-09-16 — Phase 7 shipped (expenses + vendor payments, backend).**
  Migration `20260916115320_phase7_expenses_vendor_payments` — additive
  only. First of the four brand-new phases (7-10) that only existed as an
  HLD schema sketch before this session — no prior day-by-day section here
  to extend, so this entry starts fresh.
  - **Schema**: `ExpenseClaim` (`org_membership_id` + `location_id`,
    free-text `category`; `pending → approved → reimbursed` or
    `→ rejected` — `reimbursed` is a separate step only reachable from
    `approved`, since deciding and actually paying out are different
    events). `VendorPayment` (`vendor_name` plain text, `vendor_type` ∈
    `contractor`/`external_resource`/`third_party`, `period_month`/
    `period_year`; same `pending → approved → paid` or `→ rejected` shape).
    **`VendorPayment` carries zero FK to the recruitment domain's
    `Account`** — deliberate, per the HLD's module-map note: a recruitment
    `Account(type=vendor)` is a sourcing vendor (candidates/money coming
    *in*); `VendorPayment` is money going *out* to a contractor/external
    resource — same English word, unrelated real-world relationship, and
    the schema keeps them fully separate rather than overloading one model.
    `expense_claim`/`vendor_payment` added to `DocumentEntityType` so a
    receipt/invoice attaches via the **existing** polymorphic documents
    module — zero new upload code.
  - **New `expenses` module**: claims are self-serve
    (`POST /expenses/claims` for the caller's own membership,
    `GET /expenses/claims/me`), admin decides/reimburses/views the team
    (`GET /expenses/claims`, `POST .../decision`, `POST .../reimburse`).
    Vendor payments are admin-only throughout (raising one isn't a
    self-serve action) — `POST/GET /expenses/vendor-payments`,
    `GET .../:id`, `POST .../:id/decision`, `POST .../:id/pay`. Both models
    added to the write-side `org_id` auto-injection set.
  - **Tests**: `erp-phase7-expenses.test.js` (10 — org-membership gate,
    claim submission + cross-org location rejection, approve→reimburse +
    reimburse-before-approval rejected + double-decide rejected, a
    rejection's reason blocks reimbursement, self-view vs. admin team-view
    scoping, non-admin blocked everywhere admin-only, vendor payment
    creation gated, decide→pay + pay-before-approval rejected +
    double-decide rejected, status/vendor_type/period list filters, and an
    explicit proof that `VendorPayment` shares no FK with a same-named
    recruitment `Account`). Full suite **50 suites / 405 tests green**,
    eslint clean.
  - **Not built this phase**: frontend (claim submission + admin
    approval/reimbursement queue, vendor payment admin screens); any
    approval-chain policy beyond single-admin-decides (matches every other
    decision flow already in this codebase); claim/payment amount limits.
- **2026-09-16 — Phases 8, 9, 10 shipped (accounting, external CA/Legal
  access, org chart — all backend).** Closes out every phase the
  2026-09-15 client brief added; the streams table's H/I/J/K rows above are
  now all shipped.
  - **Phase 8 — accounting.** Migration
    `20260916123254_phase8_accounting_ledger_tax` — additive only.
    `LedgerAccount` (asset/liability/equity/revenue/expense, unique per org
    by `name`); `LedgerEntry` — one row per debit/credit line, no separate
    journal-entry header table, a posting is just >=2 rows sharing one
    `transaction_id`; `accounting.service.postJournalEntry` is the only
    place `sum(debit) === sum(credit)` is enforced, not the DB, same
    documented-gap posture as `PayrollRun`/`ClientInvoice`'s forward-only
    transitions. `TaxRecord` (`pending → filed → paid`; `jurisdiction`/
    `kind` **kept free text, not enums** — §10's open questions flag which
    tax regimes apply as undecided, so this doesn't guess). New
    `accounting` module, router-wide `authorize('admin')` (every route is
    finance data): ledger-account CRUD, `POST /journal-entries`,
    `GET /ledger-entries` (filter by account/transaction/date range), and
    three reports — `GET /reports/trial-balance`, `/profit-and-loss`,
    `/balance-sheet`. The balance sheet's `balances` field
    (`assets − (liabilities + equity)`) is reported, not hidden: this
    module posts journal entries but doesn't do period-close/
    retained-earnings postings, so a non-zero value there just means that
    period's net profit hasn't been closed into equity yet — a test proves
    `balances === net_profit` on an intentionally-unclosed book.
    Trial-balance/P&L aggregation is one `prisma.ledgerEntry.groupBy` call
    per report, not one query per ledger account.
  - **Phase 9 — external Legal/CA access.** Migration
    `20260916130602_phase9_external_access` — additive only.
    `ExternalAccess` (`org_id`, `email`, `scope` json
    `{ resources: [...] }`, `token_hash`, `granted_by`, `expires_at`,
    `revoked_at`, `last_used_at`/`use_count`). Deliberately **not** an
    `OrgMembership` — a CA/Legal reviewer has no role-in-a-company and no
    password, so this gets its own auth path end to end:
    `middleware/auth.js` gained `authenticateExternal` (hashes the
    incoming bearer token with SHA-256 and looks it up — same posture as a
    password hash, the plaintext is never stored) and
    `requireExternalScope` (checks the grant's `scope.resources`
    allow-list). New `externalAccess` module:
    `POST/GET /external-access` + `POST /external-access/:id/revoke`
    (ordinary JWT+org admin auth; the plaintext `ext_…` token is returned
    exactly once, in the create response, never recoverable after) plus a
    guest portal at `/external-access/guest/accounting/*` that calls the
    accounting module's own report functions directly — a CA sees numbers
    computed identically to an org admin, no parallel read path to keep in
    sync. Guest resources are an explicit enum
    (`externalAccess.validation.js`'s `RESOURCE`, currently just
    `'accounting'` — the HLD's own worked example, "read accounting for
    Org X, expires in 30 days") rather than a wildcard.
  - **Phase 10 — org chart + lifecycle visualization. No migration.**
    `OrgMembership.manager_id`, `employment_status`
    (`pending_onboarding`/`notice_period` included), and `notice_end_date`
    all landed already in the 2026-09-15 Phase 2 amendment — specifically
    so this phase wouldn't need a schema change once built. New `orgChart`
    module: `GET /org-chart` (any active org member, not admin-only — a
    directory view) builds the `manager_id` reporting tree **in memory**
    from one `OrgMembership.findMany`, not a recursive SQL CTE (one
    company's headcount doesn't need one — same no-analytics-warehouse
    reasoning as HLD §12); `include_terminated` toggle defaults to
    excluding them. `GET /org-chart/group`
    (`authorizeGroupSuperadmin`, mirrors the super-dashboard's cross-org
    gating exactly) returns every org's tree, optionally narrowed by
    `org_group_id`. Lifecycle fields carry straight onto each node — no
    separate workflow engine, an admin sets them via the existing
    `PATCH /orgs/memberships/:id`.
  - **Tests**: `erp-phase8-accounting.test.js` (14),
    `erp-phase9-external-access.test.js` (7),
    `erp-phase10-org-chart.test.js` (6) — 27 new tests, each suite
    confirmed green **in isolation**, eslint clean across all three new
    modules (`accounting`, `externalAccess`, `orgChart`).
  - **Verification posture, stated plainly**: the full ~54-file
    cross-suite regression was **not** re-run to completion this session.
    It was started, then explicitly paused mid-run at the human's request
    ("complete the remaining test cases later... do all the functionality
    of remaining phases first") to prioritize shipping Phase 8-10 before
    circling back. Mid-session, this machine's known RAM ceiling (documented
    in the Phase 4-7 entries above) made a `prisma migrate dev` and a
    backgrounded jest batch collide into a literal Node
    `Fatal process out of memory` crash — recovered by retrying once the
    colliding process had exited, not by any code change. **Run the full
    suite before merge.**
  - **Not built this session**: frontend for any of the three phases;
    Phase 8's auto-posting from billing/expense/vendor-payment events
    (manual/API journal entries only); Phase 9's email delivery of the
    guest token (API-response-only, matching this project's local-first
    posture) and any per-view audit trail beyond `last_used_at`/
    `use_count` (§10 flags a finer-grained trail as still an open
    question); Phase 10's actual chart visualization (the API returns the
    tree; nothing renders it).
