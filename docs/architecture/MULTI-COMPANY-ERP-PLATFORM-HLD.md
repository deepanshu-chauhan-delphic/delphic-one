# Multi-Company Group ERP Platform — HLD

Status: **design, not yet built**. Target: evolve this repo from a single-tenant
Delphic recruitment dashboard into a multi-company platform for a parent group
(e.g. Delphic, Acconcy, future companies), adding employee ERP — attendance,
timesheets, calendars, leaves, overtime, payroll, company billing, client
billing, and a cross-company "super dashboard" for daily/weekly/monthly/
quarterly profitability per employee per company.

Decisions locked in for this design (confirmed 2026-09-15):

1. **One identity, per-company roles.** A person has one login (email/password)
   for the whole group. They can hold membership + a role in more than one
   company under the group and switch between them, like switching workspaces.
   No per-company passwords.
2. **Shared database, `org_id` on every tenant-scoped table**, not
   schema-per-company or DB-per-company. Row-level isolation, not physical
   isolation. This keeps the super dashboard a normal aggregate query instead
   of an N-way fan-out.
3. **Same modular monolith.** New ERP modules (attendance, timesheet, payroll,
   billing, leave, calendar) live in this same `server/`, following the
   existing `routes → controller → service → validation` convention, sharing
   identity/notifications/calendar infra already built for recruitment. Module
   boundaries are kept clean enough that any one module can be extracted into
   its own service later if it becomes a scaling bottleneck — but nothing is
   physically split today.

---

## 1. Tenancy model

```
OrgGroup (the parent holding entity)
   └── Org (a company under the group: "Delphic", "Acconcy", ...)
         ├── Department / Designation (org-scoped directory)
         ├── Person memberships (who works here, in what role)
         ├── Client/Vendor Accounts (existing Account model, recruitment)
         ├── Calendars, Attendance, Timesheets, Leave, Payroll, Billing
         └── ... every future module
```

- `OrgGroup` exists mainly so a future group might contain multiple sibling
  companies with a shared super-admin layer above all `Org`s. For now there is
  one `OrgGroup` row; it's there so we don't have to retrofit it later.
- `Org` is the tenant boundary. Every module table added by this design
  carries `org_id`.
- **`Person` is global**, not per-org. One row per human being, regardless of
  how many companies they work at.
- **`OrgMembership`** is the join: `(person_id, org_id, roles[], employee_code,
  status, joined_at, left_at)`. This is where "different roles in different
  companies" lives — Person P can be `recruiter` at Delphic and `admin` at
  Acconcy, same login, two membership rows.

## 2. Identity & auth changes

Today: `User` is both the login identity and the role, scoped implicitly to
"the one company this app runs for." That collapses once there's more than
one `Org`.

Target shape (additive, migrated in phases — see §9):

- Keep `User` as the auth table (email, password_hash, mfa, etc.) — it becomes
  the `Person` record. No breaking rename; existing `User.id` stays the FK
  everywhere it's already used for the Delphic org.
- Add `OrgMembership(person_id → User.id, org_id, role, employee_code,
  department_id, designation_id, employment_status, joined_at, left_at)`.
- Add `Org(id, org_group_id, name, slug, timezone, default_currency, status)`.
- JWT gains an **active org context**: `{ user_id, org_id, role }`. Role is
  resolved *for that org*, not globally — mirrors the existing pattern in
  `authorizeSuperadmin` (`middleware/auth.js`), which already re-reads a flag
  from the DB per request instead of trusting a JWT claim. Do the same for
  `role`: the JWT carries `org_id`, the server loads the live `OrgMembership`
  row for `(user_id, org_id)` on every request. This means role changes and
  offboarding take effect immediately, not just on next login.
- **Org switcher**: a person with >1 membership gets a picker (top nav, like a
  workspace switcher) that re-issues a token scoped to the chosen `org_id`.
  Default org = their only membership, or last-used.
- **Group superadmin** is a new, separate flag from `Org`-level
  `is_superadmin` — `User.is_group_superadmin`. It grants read access to the
  super dashboard (§7) across all orgs, and nothing else — it does not imply
  per-org admin powers inside any single company. Gated by a new
  `authorizeGroupSuperadmin` middleware, following the existing
  re-read-from-DB pattern, never a JWT claim.

`can()` / `usePermissions()` on the client keep working as-is; they just start
reading role-for-active-org instead of a single global role.

## 3. Module map

Every module below is a normal `server/src/modules/<name>/` folder
(`*.routes.js` / `*.controller.js` / `*.service.js` / `*.validation.js`),
same convention as `accounts`, `requirements`, etc. All models carry `org_id`.

| Module | Owns | Depends on |
|---|---|---|
| `orgs` | `Org`, `OrgGroup`, `Department`, `Designation`, `OrgMembership` | identity |
| `attendance` | check-in/out, daily attendance status, regularization requests | orgs, calendar (holidays) |
| `calendar` | `Calendar`, `CalendarEvent`, per-employee calendar assignment; extends the **existing** interview/meeting calendar rather than replacing it | orgs |
| `leave` | leave types, policies, balances, requests, approvals | orgs, calendar |
| `timesheet` | daily work-log entries, linked to a project/requirement/client | orgs, requirements (existing), billing |
| `overtime` | OT requests/approvals, computed from attendance + timesheet | attendance, timesheet |
| `payroll` | salary structures, payroll runs, payslips | orgs, attendance, leave, overtime |
| `billing-client` | client invoices (per org, billing that org's clients) | requirements/submissions (existing), timesheet |
| `billing-group` | intra-group billing (parent charges each `Org` a management fee, shared-service cross-charges) | orgs |
| `profitability` | the analytics fact tables and rollups behind the super dashboard | timesheet, payroll, billing-client, billing-group |
| `super-dashboard` | cross-org read-only aggregation API + UI | profitability, group superadmin auth |

The existing recruitment domain (`accounts`, `requirements`, `profiles`,
`submissions`, `pipeline`, `reports`) becomes **one business capability that
runs inside `Org = Delphic`** (and, if Acconcy also recruits, inside
`Org = Acconcy` too, isolated by `org_id`) — not a special case architecturally.

## 4. Core new data model (sketch)

Naming avoids collision with the existing `Account`/`CompanySize` (client
company) vocabulary by using `Org`, not `Company`.

```
OrgGroup      { id, name }
Org           { id, org_group_id, name, slug, timezone, default_currency, status }
Department    { id, org_id, name }
Designation   { id, org_id, name, department_id? }
OrgMembership { id, person_id(User.id), org_id, role, employee_code,
                department_id, designation_id, employment_status,
                joined_at, left_at }

Calendar        { id, org_id, name, kind[internal|client|custom], is_default }
CalendarHoliday { id, calendar_id, date, label }
EmployeeCalendar{ id, org_membership_id, calendar_id }  // customizable per employee

AttendanceRecord { id, org_membership_id, date, check_in_at, check_out_at,
                    status[present|absent|half_day|leave|holiday|wfh],
                    source[web|mobile|manual], regularized_by, regularized_reason }

LeaveType    { id, org_id, name, paid, annual_quota }
LeaveBalance { id, org_membership_id, leave_type_id, year, accrued, used }
LeaveRequest { id, org_membership_id, leave_type_id, from_date, to_date,
               status[pending|approved|rejected|cancelled], approver_id, reason }

TimesheetEntry { id, org_membership_id, date, project_ref (client_account_id
                  or requirement_id, existing models), hours, billable,
                  notes, approved_by, status }

OvertimeRecord { id, org_membership_id, date, hours, approved_by, status }

SalaryStructure { id, org_membership_id, effective_from, ctc, components(json) }
PayrollRun      { id, org_id, period_month, period_year, status, run_at }
Payslip         { id, payroll_run_id, org_membership_id, gross, deductions,
                   net, generated_pdf_doc_id }

ClientInvoice     { id, org_id, client_account_id, period, amount, currency,
                     status, line_items(json) }
GroupBillingCharge{ id, org_id, org_group_id, period, amount, currency, kind }

DailyEmployeeProfitability { id, org_membership_id, org_id, date,
                              revenue, cost, margin }   // fact table, see §6
```

All of the above (except `OrgGroup`) carry `org_id` directly or transitively
via `org_membership_id → OrgMembership.org_id`. Composite indexes:
`(org_id, date)` on every time-series table, `(org_membership_id, date)` for
per-employee lookups — these are the two access patterns the super dashboard
and per-company dashboards both need.

## 5. Row-level isolation

Two layers, same belt-and-suspenders pattern the codebase already uses for
soft-delete (`config/db.js`'s `prisma.$use` middleware that injects
`deleted_at: null`):

1. **App layer (primary):** a Prisma middleware injects `org_id: <active org
   from request context>` into every `findMany/findFirst/count/aggregate/
   groupBy/update/delete` on org-scoped models, the same way soft-delete
   already works. Request-scoped `org_id` comes from AsyncLocalStorage set by
   auth middleware at the top of the request, so service code doesn't have to
   remember to filter — same ergonomics as today.
2. **DB layer (defense-in-depth):** Postgres **Row-Level Security** policies
   on every org-scoped table, keyed off a session variable
   (`SET LOCAL app.org_id = ...`) set at the start of each request's
   transaction. This catches any query that bypasses the Prisma middleware
   (raw SQL, a forgotten model, future code). It does not replace layer 1 — it
   backstops it.

Group-superadmin / super-dashboard queries explicitly opt out of both (a
dedicated `withoutOrgScope()` escape hatch, used only by the
`super-dashboard` and `profitability` modules), never a default.

## 6. Profitability pipeline (the "daily/weekly/monthly/quarterly margin per
employee" requirement)

This is the part that breaks if it's built naively — computing margin per
employee per company by joining live attendance + timesheet + billing +
payroll tables on every dashboard load does not stay low-latency as data
grows across companies.

- **OLTP tables** (attendance, timesheet, payroll, invoices) stay
  write-optimized, as above.
- A **nightly batch job** (extendable to near-real-time via a queue later)
  computes `DailyEmployeeProfitability` per `(org_membership_id, date)`:
  `revenue` = that day's billable timesheet hours × client rate (or an
  allocated share of the period's invoice), `cost` = salary/CTC prorated to
  the day + overhead allocation, `margin = revenue - cost`.
- **Weekly / monthly / quarterly numbers are never recomputed from scratch on
  read** — they're `SUM()`s over the daily fact table, which is cheap because
  the fact table is narrow, indexed on `(org_id, date)`, and orders of
  magnitude smaller than the source tables it was built from.
- Start with a **Postgres materialized view** (or a plain summary table
  refreshed by the nightly job) for the rollups; only reach for a separate
  analytics warehouse (ClickHouse, etc.) if/when row counts make Postgres
  aggregation too slow for the dashboard's latency budget — don't build that
  upfront.
- Implementation: a `node-cron` (or BullMQ repeatable job, see §8) job in the
  `profitability` module, same shape as the existing
  `jobs/interviewReminders.js` cron already in this repo.

## 7. Super dashboard

- A single cross-org read API (`GET /super-dashboard/...`), `org_id`-agnostic
  by design, gated by `authorizeGroupSuperadmin` only.
- Reads exclusively from `DailyEmployeeProfitability` and its rollups — never
  joins live OLTP tables directly — so it stays fast regardless of how many
  companies or employees exist.
- Per-company drill-in reuses the *same* per-company dashboard components,
  just with `org_id` no longer fixed to "mine" — one UI, parameterized, not a
  second dashboard to maintain.

## 8. Low-latency / scalability posture

- **Composite indexes** `(org_id, date)` / `(org_membership_id, date)` on
  every new time-series table (attendance, timesheet, overtime,
  profitability) from the first migration — not retrofitted later.
- **Partitioning**: once a table like `AttendanceRecord` or
  `DailyEmployeeProfitability` crosses the range where index scans stop being
  enough (rule of thumb: tens of millions of rows), convert it to native
  Postgres range partitioning by month on `date`. The `org_id` + `date`
  composite index makes this a mechanical change, not a redesign.
- **Background jobs, not request-path work**: payroll runs, invoice
  generation, the nightly profitability ETL, and bulk notifications move to a
  job queue (BullMQ + Redis is the standard pairing with this stack) instead
  of blocking an HTTP request. Redis is a new piece of infra for this repo —
  add it once the first job that needs it (profitability ETL) is built,
  not speculatively.
- **Caching**: Redis (same instance as the job queue) for the org directory,
  active-membership lookups, and dashboard KPI tiles with a short TTL (30–60s)
  — mirrors what `GET /users/directory` and `GET /dashboard/summary` already
  are, just with a cache in front once multi-org traffic makes them hot.
- **Read replica**: once there's real multi-company write volume, point
  `reports`/`profitability`/`super-dashboard` reads at a Postgres read replica
  so heavy aggregate queries never contend with OLTP writes (check-ins,
  stage moves). Not needed at current scale — flagged so the module
  boundaries (service-layer DB access, not scattered raw queries) make this a
  connection-string change later, not a rewrite.
- **PgBouncer** in front of Postgres once total connections (multiple org
  workspaces × background jobs × app instances) approach Postgres's
  connection limit.
- None of this is needed on day one for two companies. It's sequenced in §9
  so each piece is added when its trigger condition is actually hit, not
  upfront.

## 9. Migration plan (phased, additive-only — HARD RULE from AGENTS.md applies:
no `DROP` ships with feature code, every phase is an expand, contraction is
always its own later PR)

**Phase 0 — tenancy scaffold, invisible to users**
Add `OrgGroup`, `Org`, `OrgMembership`. Backfill: create one `Org` row
("Delphic"), one `OrgGroup` row, and one `OrgMembership` per existing `User`
pointing at it. Every existing table (`Account`, `Requirement`, `Submission`,
etc.) gets a nullable `org_id` column, backfilled to Delphic's `org_id`, then
(next migration, per HARD RULE) made `NOT NULL`. App behavior unchanged —
this phase is pure plumbing.

**Phase 1 — org switcher + group superadmin**
JWT gains `org_id`; `authorize()` resolves role via `OrgMembership` instead of
`User.role`; org switcher UI ships but there's still only one selectable org
(Delphic) until Acconcy is created. `authorizeGroupSuperadmin` added.
Recruitment app behaves identically to today for every existing user.

**Phase 2 — directory + calendar + attendance + leave**
`Department`/`Designation`, `Calendar`/`CalendarHoliday`/`EmployeeCalendar`
(extends, doesn't replace, the existing interview/meeting calendar),
`AttendanceRecord`, `LeaveType`/`LeaveBalance`/`LeaveRequest`. These are the
modules every later module depends on (payroll needs attendance + leave;
timesheet needs calendar for working days).

**Phase 3 — timesheet + overtime**
Daily work-log entries linked to existing `Account`/`Requirement` as the
"project" reference, so recruiters/BDAs logging time against a client
requirement don't need a new "project" concept invented — reuse what exists.
Overtime computed off attendance + timesheet.

**Phase 4 — payroll**
Salary structures, payroll runs, payslips. Depends on attendance + leave +
overtime being live and trusted (at least one full month of clean data)
before payroll math is allowed to read them.

**Phase 5 — billing**
Client billing (extends existing client `Account` — this is closer to
"finish what's there" than new ground, since accounts/requirements/
submissions already model the client relationship) + intra-group billing.

**Phase 6 — profitability + super dashboard**
The `DailyEmployeeProfitability` fact table, its nightly job, rollup views,
and the cross-org super-dashboard API/UI, gated to
`is_group_superadmin`. This is deliberately last: it's the one module that
depends on every other module already producing real data.

**Onboarding Acconcy (or any second `Org`)** is then just: create the `Org`
row, create `OrgMembership` rows for its employees (existing `User`s get a
second membership if they're shared with the group; new hires get a fresh
`User` + membership), configure its calendar/leave policy/salary structures.
No schema changes required — that's the point of Phase 0–1 landing first.

## 10. What this deliberately does not do yet

- No physical multi-tenancy (schema/DB-per-company) — row-level isolation
  only, per the confirmed decision. Revisit only if a specific company has a
  hard compliance requirement for physical data separation.
- No microservices — module boundaries are enforced in code (own
  routes/controller/service/schema slice per module) so any one module
  *could* be extracted later, but nothing is deployed separately today.
- No analytics warehouse (ClickHouse/BigQuery/etc.) — Postgres materialized
  views/rollup tables until row counts prove that's insufficient.
- No mobile app / biometric device integration for attendance — `source`
  enum on `AttendanceRecord` leaves room for it, but web/manual check-in is
  the Phase 2 scope.

## Open items to confirm before Phase 0 starts

- Exact list of companies to onboard beyond Delphic (Acconcy confirmed; any
  others, and their target timeline) — affects how much of Phase 1's org
  switcher UX gets built up front vs. deferred.
- Salary/payroll compliance requirements (India PF/ESI/TDS specifics if any
  company operates outside India, given `Currency`/`ProfileCurrency` already
  span INR/USD/AED/SAR/EUR/GBP) — affects `SalaryStructure.components` shape.
- Who holds `is_group_superadmin` day one, and whether it's a brand-new set of
  people or a superset of existing Delphic superadmins.
