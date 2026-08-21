# Requirement Management Dashboard

Internal recruitment pipeline for Delphic. Tracks **client / vendor accounts → requirements → seats → candidate profiles → submissions → interview rounds**, with role-based dashboards, margin tracking, locking, and reporting.

| | |
|---|---|
| **Tenancy** | Single tenant |
| **UI rule** | Jira-like dense lists and filters — [docs/UI-UX-JIRA.md](docs/UI-UX-JIRA.md) |
| **Detailed HLD** | [docs/HLD.md](docs/HLD.md) |
| **Field model** | [docs/Requirement-Dashboard-System-Design-v2.md](docs/Requirement-Dashboard-System-Design-v2.md) |
| **API contract** | [docs/API-Spec-and-Build-Plan.md](docs/API-Spec-and-Build-Plan.md) |
| **Diagrams & journeys** | [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md) |

## Table of contents

1. [What it does](#what-it-does)
2. [Design principles](#design-principles)
3. [Architecture](#architecture)
4. [Feature map](#feature-map)
5. [Domain model](#domain-model)
6. [User journeys](#user-journeys)
7. [Stage pipelines](#stage-pipelines)
8. [Roles and permissions](#roles-and-permissions)
9. [Security](#security)
10. [Reporting](#reporting)
11. [API surface](#api-surface)
12. [Codebase structure](#codebase-structure)
13. [Stack](#stack)
14. [Branching](#branching)
15. [Local setup](#local-setup)
16. [Deployment](#deployment)
17. [Further reading](#further-reading)

---

## What it does

| Role | Goal |
|---|---|
| **BDA** | Capture and convert client / vendor leads |
| **Sales** | Open job requirements and seats; assign recruiters |
| **Recruiter** | Source candidates, submit to seats, run interviews through join, track margin |
| **Admin** | Manage users, unlock locked records, read org-wide reports |

### In scope

- Full core pipeline with stage machines and append-only stage history
- Role-based access and ownership scoping
- Record locking on terminal states, with admin unlock + reason
- Margin / commercials on submissions
- Role-scoped dashboard (including stuck lists)
- Reports with date range and Excel / PDF export
- Comments and documents on core entities
- Jira-like dense list / filter UX

### Deferred

- Notifications
- Vendor / client external portals
- JIRA / Sheets migration tooling
- Multi-tenant SaaS isolation
- Real-time collaboration (WebSockets)
- SSO

---

## Design principles

1. **Pipeline as state machines** — Account, seat, and submission progress only through documented transitions; every move is audited in `stage_history`.
2. **Auth and authorization at the edge** — JWT and role checks live in transport middleware; services receive a narrowed identity (user id, role).
3. **Thin transport, fat domain** — Route handlers parse HTTP and call services; stage advance, margin, ownership, and lock rules live in services.
4. **Ownership scopes visibility and mutation** — BDA owns accounts; Sales owns requirements; Recruiter works assigned requirements; Admin sees everything.
5. **Lock is editability, not visibility** — Terminal records stay in lists and reports; mutations are blocked until Admin unlocks with a reason.
6. **Single source of schema truth** — Prisma models and migrations define persistence; API validation mirrors enums and required fields.
7. **Readable modules** — Domain folders follow `routes → controller → service → validation`.

---

## Architecture

### System context

```mermaid
flowchart LR
  subgraph Actors
    BDA[BDA]
    Sales[Sales]
    Rec[Recruiter]
    Admin[Admin]
  end

  RMD[Requirement Management Dashboard]

  BDA --> RMD
  Sales --> RMD
  Rec --> RMD
  Admin --> RMD

  RMD --> PG[(PostgreSQL)]
  RMD --> Files[Document store]
```

### Containers and request path

```mermaid
flowchart TB
  User[Browser user]
  Nginx[Nginx — TLS, static SPA, /api proxy]
  Client[React client — Vite + Tailwind]
  API[Node Express API]
  DB[(PostgreSQL via Prisma)]
  Store[Uploads — disk / S3 later]

  User --> Nginx
  Nginx -->|/| Client
  Nginx -->|/api| API
  Client -->|REST + JWT| API
  API --> DB
  API --> Store
```

| Container | Responsibility |
|---|---|
| **Web client** | Screens, forms, JWT session, role-gated navigation |
| **API server** | Auth, validation, stage machines, ownership, reports, uploads |
| **PostgreSQL** | Durable entities, history, assignments |
| **Nginx** | TLS, static assets, API reverse proxy |
| **Document store** | Binary uploads (API gates access) |

### Server call graph

```mermaid
flowchart TB
  HTTP[HTTP request] --> Routes[Domain routes]
  Routes --> MW[Auth · role · lockCheck]
  MW --> Ctrl[Controller]
  Ctrl --> Val[Validation]
  Val --> Svc[Service — stage machines, ownership, margin]
  Svc --> Prisma[Prisma / filesystem]
```

Services do not import Express request types. Controllers stay thin.

---

## Feature map

| Domain | Covers |
|---|---|
| **Auth & users** | Login, refresh, change password, admin user provisioning |
| **Accounts** | Client / vendor leads, stage machine, BDA ownership, lock on drop |
| **Requirements & seats** | Jobs, seats, assign / unassign history, seat stages |
| **Profiles** | Candidates, skills, CTC, availability, resume upload |
| **Submissions** | Put candidate forward, pipeline stages, margin, kanban by stage |
| **Interviews** | Internal and client rounds, schedule, feedback, rating, result |
| **Collaboration** | Comments, documents, stage history audit |
| **Ops & insights** | Role-scoped dashboard, stuck lists, reports, Excel / PDF export |

---

## Domain model

### Entity chain

```mermaid
flowchart LR
  User[User + role] --> Account
  Account --> Requirement
  Requirement --> Seat
  Seat --> Submission
  Profile --> Submission
  Submission --> Interview[Interview round]
```

Supporting entities: **RequirementAssignment**, **Comment**, **Document**, **StageHistory**.

### Entity catalogue

| Entity | Purpose | Lock trigger |
|---|---|---|
| **User** | Identity + role (`bda` \| `sales` \| `recruiter` \| `admin`) | Soft-deactivate via `active` |
| **Account** | Unified client / vendor lead | `dropped` |
| **Requirement** | Job / project on an **active client** | `closed` / `dropped` |
| **RequirementSeat** | One headcount slot | `closed` / `dropped`; `joined_at` counts as closure |
| **RequirementAssignment** | Recruiter / sales assignment history (never deleted) | Soft end via `unassigned_at` |
| **Profile** | Candidate | — |
| **Submission** | Candidate × seat + commercials | Terminal pipeline stages |
| **InterviewRound** | Internal or client round + feedback / rating | Completing result sets `completed_at` |
| **StageHistory** | Append-only audit of stage moves / unlock | Immutable |
| **Document** / **Comment** | Files and notes linked by entity type + id | — |

### Key invariants

1. A **requirement** may only attach to an account with `type = client` and `stage = active`.
2. **Submissions** target a seat (headcount), not only a requirement.
3. **Assignments** are historical rows; unassign sets `unassigned_at` instead of deleting.
4. **Interview rounds** may be `internal` or client; advancement toward offer depends on required rounds passing.
5. **Margin** is computed on the server from commercial fields.
6. **Unlock** requires Admin + mandatory reason; audited; next terminal transition re-locks.

---

## User journeys

### End-to-end handoff

```mermaid
sequenceDiagram
  participant BDA
  participant Sales
  participant Recruiter
  participant Admin

  BDA->>BDA: Create lead → meeting → active client
  Sales->>Sales: Create requirement + seats
  Sales->>Recruiter: Assign recruiter
  Recruiter->>Recruiter: Profile → submit → interviews → join
  Admin-->>Admin: Users, unlock, org reports as needed
```

| # | Who | Handoff |
|---|---|---|
| 1 | BDA | Creates lead → converts client to **active** |
| 2 | Sales | Opens requirement + seats; **assigns** recruiter |
| 3 | Recruiter | Adds profile, submits to seat, runs interviews to **join** |
| 4 | Admin | Unlocks records, manages users, reads **org** reports |

### BDA — lead to active account

| Step | Action | Outcome |
|---|---|---|
| 1. Capture lead | Create account (client or vendor) with company + POC | Stage = `lead`; BDA is owner |
| 2. Schedule meeting | Move → `meeting_scheduled`; set mode, date, notes | Tracked; can appear on stuck list if idle |
| 3. Convert or loop | → `active`, or `rescheduled` → meeting again | Active client unlocks Sales requirements |
| 4. Exit | Drop with reason → record locks | Visible in reports; Admin can unlock |

### Sales — open job and assign

| Step | Action | Outcome |
|---|---|---|
| 1. Pick active client | Open an active client account | Requirements only on active clients |
| 2. Create requirement | JD, tech stack, budget, seats, SLA | Status = `open`; Sales is owner |
| 3. Add seats | One seat per headcount | Seat status = `open` |
| 4. Assign recruiters | Assign / unassign (history kept) | Recruiters see assigned jobs |
| 5. Steer status | `open` → `in_progress` → hold / closed / dropped | Terminal states lock the requirement |

### Recruiter — source through join

| Step | Action | Outcome |
|---|---|---|
| 1. Add profile | Candidate + resume + skills / CTC / source | Ready to submit |
| 2. Put forward | Submission: seat + rates; live margin | Stage = `sourced` |
| 3. Internal screen | → `internal_screening`; internal interview + feedback | Pass → client; fail → rejected |
| 4. Client cycle | Schedule rounds → offer → BGV | Multi-round until required rounds pass |
| 5. Close | `closed` + `joined_at`, or backout / rejected + reason | Locks; counts in reports |

### Admin — keep the org unblocked

| Step | Action | Outcome |
|---|---|---|
| 1. Provision users | Create / deactivate BDA, Sales, Recruiter, Admin | Team can log in with roles |
| 2. Oversee pipeline | Dashboard: stuck lists, activity | Intervene when aging / SLA slips |
| 3. Unlock | Unlock locked entity with mandatory reason | Audited; re-locks on next terminal move |
| 4. Report & export | Recruiter / sales / vendor / aging / closure | Org-wide visibility |

---

## Stage pipelines

### Account (lead)

```mermaid
stateDiagram-v2
  [*] --> lead
  lead --> meeting_scheduled
  meeting_scheduled --> active
  meeting_scheduled --> rescheduled
  rescheduled --> meeting_scheduled
  lead --> dropped
  meeting_scheduled --> dropped
  active --> [*]
  dropped --> [*]
```

Same machine for `client` and `vendor`. Owner is the BDA.

### Requirement status

```text
open → in_progress → on_hold
                   → closed | dropped
```

### Seat status

```mermaid
stateDiagram-v2
  [*] --> open
  open --> interviewing
  interviewing --> offer
  offer --> bgv
  bgv --> closed
  open --> dropped
  interviewing --> dropped
  closed --> [*]
  dropped --> [*]
```

Usually derived from the furthest-advanced active submission; can be overridden. **`joined_at`** is what counts as closure for performance.

### Submission pipeline

```mermaid
stateDiagram-v2
  [*] --> sourced
  sourced --> internal_screening
  internal_screening --> submitted_to_client
  submitted_to_client --> interview_scheduled
  interview_scheduled --> interview_result
  interview_result --> offer
  offer --> bgv
  bgv --> closed
  sourced --> backout: reason required
  sourced --> rejected: reason required
  closed --> [*]
  backout --> [*]
  rejected --> [*]
```

From **any** stage: `backout` or `rejected` (reason required).

---

## Roles and permissions

| Capability | BDA | Sales | Recruiter | Admin |
|---|---|---|---|---|
| Own accounts (leads) | Yes | View | View | Full |
| Requirements + seats | View | Own | Assigned | Full |
| Assign recruiters | — | Yes | — | Yes |
| Profiles + submissions | View | View | CRUD | Full |
| Unlock locked records | — | — | — | Yes |
| Reports scope | Own leads | Own reqs | Own subs | Org-wide |

---

## Security

| Control | Design |
|---|---|
| Transport | HTTPS at the edge (Nginx / TLS) |
| AuthN | JWT access + refresh; bcrypt passwords |
| AuthZ | Role middleware on routes; ownership filters in services |
| Locking | `is_locked` on terminal states; Admin unlock with audited reason |
| Input | Schema validation on write paths; uniform response envelope |
| Login abuse | Rate limit on `/auth/login` |
| CORS | Locked to frontend origin |
| Secrets | Environment / `.env` (never committed); `.env.example` as template |

Response envelope: `{ success: boolean, data: T, message?: string, errors?: [] }`.

---

## Reporting

| Report | Intent |
|---|---|
| Recruiter performance | Sourced vs submitted vs interviewed vs closed; funnel; time-in-stage; interview feedback / ratings; closures |
| Sales performance | Lead conversion; requirements opened/closed; closure time; budget pipeline; margin |
| Vendor performance | Vendor-sourced profiles through shortlist/close; margin; backout; time-to-submit |
| Aging / SLA | Stuck leads, requirements with no submissions, submissions stuck in stage, past `sla_days` |
| Closure | Joins with dates, final rates, margins — by period / client / recruiter |

In-app tables and charts plus server-side **Excel / PDF export**. Dashboard adds live widgets: counts, stuck lists, recent activity — different per role.

---

## API surface

Base path: `/api/v1` (full contracts in the API spec).

| Area | Representative endpoints |
|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/change-password` |
| Users | `GET /users/me`, admin `GET/POST/PATCH /users` |
| Accounts | CRUD + `POST /accounts/:id/stage` |
| Requirements | CRUD + assign / unassign + status |
| Seats | List/create under requirement + `POST /seats/:id/stage` |
| Profiles | CRUD + resume via documents |
| Submissions | CRUD + `POST /submissions/:id/stage` |
| Interviews | `POST /submissions/:id/interview-rounds`, `PATCH /interview-rounds/:id` |
| Comments / documents | List/create/delete by entity |
| Admin | `POST /admin/:entity/:id/unlock` |
| Dashboard | Role-scoped summary + stuck lists |
| Reports | Recruiter / sales / vendor / aging / closure + export |

---

## Codebase structure

```text
delphic_one/
  client/                   # React SPA
    src/app/                # Router + layout
    src/pages/<domain>/     # Screens by domain
    src/components/         # UI primitives + layout
    src/lib/                # apiClient, auth context
  server/                   # Express API
    prisma/                 # schema, migrations, seed
    src/modules/            # domain: routes → controller → service → validation
    src/middleware/         # auth, lock, errors, request logging
    src/config/             # env, Prisma client, logger
    tests/
  docs/                     # Specs, HLD, UX, logging
  docker-compose.yml
```

**Domain modules (examples):** `auth`, `users`, `accounts`, `requirements` (incl. seats), `profiles`, `submissions` (incl. interview rounds), `comments`, `documents`, `admin`, `dashboard`, `reports`.

---

## Stack

- **Client:** React + Vite + Tailwind CSS
- **Server:** Node.js / Express + Prisma ORM (PostgreSQL)
- **Edge:** Nginx (TLS, SPA, `/api` proxy)
- **Runtime:** Docker Compose (`db`, `server`, `client`) — see below
- **Logging:** Structured backend logger — [docs/BACKEND-LOGGING.md](docs/BACKEND-LOGGING.md)

---

## Branching

- `main` — production; pushes here trigger CI and the deploy workflow
- `staging` — pre-production integration
- `dev` — trunk for feature work before promotion to `staging`

---

## Local setup

### Docker (recommended)

```bash
docker compose up -d --build
docker compose run --rm --entrypoint "" server sh -c "node prisma/seed.js"
```

- Client: http://localhost:8081
- API: http://localhost:4000
- Postgres (host tools, e.g. `psql`): `localhost:5434`

Copy `.env.example` to `.env` to override ports, secrets, or `LOG_LEVEL`. API logs: `docker compose logs -f server`.

To generate a **new** Prisma migration after changing `server/prisma/schema.prisma`, run it from the host (not inside an ephemeral `docker compose run` container) with `DATABASE_URL` pointed at `localhost:5434`. See [docs/AGENTS.md](docs/AGENTS.md).

### Without Docker

```bash
npm install --workspaces

cp server/.env.example server/.env
# edit server/.env with DATABASE_URL, JWT secrets, optional LOG_LEVEL

npm run migrate
npm run seed

npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`):

- `admin@delphic.local` — admin
- `sales1@delphic.local` — sales
- `bda1@delphic.local` — bda
- `recruiter1@delphic.local` / `recruiter2@delphic.local` — recruiter

---

## Deployment

`.github/workflows/deploy.yml` runs on push to `main`. Enable it with repository variable `DEPLOY_ENABLED=true` and secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

Production edge layout:

```text
Internet → Nginx (TLS)
             ├── /     → React static build
             └── /api  → Node (Compose or PM2)
                           → PostgreSQL
                           → upload volume
```

Compose defines Docker images for `db` / `server` / `client`. An older PM2 + Nginx layout (`ecosystem.config.js`, `nginx.conf.example`) also exists; align the deploy workflow with the chosen runtime before enabling auto-deploy.

Operational expectations: health checks, `prisma migrate deploy` on server start, nightly `pg_dump`, secrets only via environment.

---

## Further reading

| Doc | Contents |
|---|---|
| [docs/HLD.md](docs/HLD.md) | Full high-level design |
| [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md) | Shareable diagrams and journeys |
| [docs/Requirement-Dashboard-System-Design-v2.md](docs/Requirement-Dashboard-System-Design-v2.md) | Field-level data model |
| [docs/API-Spec-and-Build-Plan.md](docs/API-Spec-and-Build-Plan.md) | Exact HTTP contracts |
| [docs/UI-UX-JIRA.md](docs/UI-UX-JIRA.md) | Frontend UX standing rule |
| [docs/BACKEND-LOGGING.md](docs/BACKEND-LOGGING.md) | Logging guide |
| [docs/AGENTS.md](docs/AGENTS.md) | Agent / contributor context |
