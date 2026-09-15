# Multi-Company ERP Platform — Implementation Plan

Companion to [MULTI-COMPANY-ERP-PLATFORM-HLD.md](MULTI-COMPANY-ERP-PLATFORM-HLD.md) (design).
This doc is the **execution plan**: branch, database, workstreams, schedule, and
exit criteria for a working local build. Status: **kickoff — branch + DB created,
no phase code written yet.**

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
