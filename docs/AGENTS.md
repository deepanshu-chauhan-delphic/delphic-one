# AGENTS.md

Context for any AI agent (or human) picking up work on the Requirement Management Dashboard.

## What this project is

Internal requirement/recruitment pipeline dashboard for Delphic. Tracks client accounts → requirements → candidate profiles → submissions → interview rounds, with role-based dashboards and reporting.

## Docs layout

| Folder | Contents |
|---|---|
| [`architecture/`](architecture/) | Diagrams, HLD, field model, API contracts |
| [`ui/`](ui/) | Jira UX rule, RD-115 walkthrough, reference screenshots |
| [`testing/`](testing/) | Demo seed + ticket test guides |
| [`progress/`](progress/) | PROGRESS, TODO, SPRINT-PLAN |
| [`guides/`](guides/) | Operator guides (e.g. backend logging) |
| **This file** | Repo layout, local setup, standing conventions |

### Architecture / diagrams

- [ARCHITECTURE-OVERVIEW.md](architecture/ARCHITECTURE-OVERVIEW.md) — shareable diagrams, feature map, journeys
- [HLD.md](architecture/HLD.md)
- [Requirement-Dashboard-System-Design-v2.md](architecture/Requirement-Dashboard-System-Design-v2.md) — historical, an earlier already-shipped milestone despite the name
- [V2-LEAD-PIPELINE-REQUIREMENTS.md](architecture/V2-LEAD-PIPELINE-REQUIREMENTS.md) — lead classification, meeting attendees, candidate round taxonomy, requirement types, candidate bench flag, client-performance report
- [API-Spec-and-Build-Plan.md](architecture/API-Spec-and-Build-Plan.md)

### UI

- [UI-UX-JIRA.md](ui/UI-UX-JIRA.md) — product must feel like Jira (dense filters + list). Reference: [jira-like-dashboard-reference.png](ui/references/jira-like-dashboard-reference.png)
- [UI-REDESIGN.md](ui/UI-REDESIGN.md) — drawers, list peeks, pipeline KPIs, reports tabs, interview date
- [RD-115-SPEC-WALKTHROUGH.md](ui/RD-115-SPEC-WALKTHROUGH.md)

### Testing

- [TESTING-DEMO-SEED.md](testing/TESTING-DEMO-SEED.md) — team roster + LeadMinds/Jira/vendor seed walkthrough
- [TESTING-RD-103-104.md](testing/TESTING-RD-103-104.md) — requirements UI
- [TESTING-RD-107-108.md](testing/TESTING-RD-107-108.md) — submissions UI
- [TESTING-RD-111-125-112.md](testing/TESTING-RD-111-125-112.md) — pipeline / interviews / kanban
- [TESTING-RD-114-128.md](testing/TESTING-RD-114-128.md) — reports UI (incl. BDA + Sales) + change password

### Progress

- [PROGRESS.md](progress/PROGRESS.md) · [TODO.md](progress/TODO.md) · [SPRINT-PLAN.md](progress/SPRINT-PLAN.md)

### Guides

- [BACKEND-LOGGING.md](guides/BACKEND-LOGGING.md)
- [PRODUCTION-SEED.md](guides/PRODUCTION-SEED.md) — VPS / post-pull seed commands (`seed` → `seed:accounts` → `seed:jira` → `seed:vendors`; `seed-admin` = safe prod bootstrap)

## Stack

- **Client:** React + Vite + Tailwind CSS (`client/`)
- **Server:** Node.js / Express + Prisma ORM on PostgreSQL (`server/`)
- **Deploy:** Docker Compose (`docker-compose.yml` + `docker-compose.prod.yml`), `start-delphic.sh` / `setup-vm.sh`, host nginx + Let's Encrypt (`nginx.conf.example`). Deploy workflow SSHs and runs `./start-delphic.sh --prod`. GitHub Actions on push to `main`.

## Repo layout

```
client/src/
  app/App.jsx           # router + layout shell
  pages/<domain>/        # one folder per domain (accounts, requirements, profiles, submissions, reports, dashboard, auth)
  components/ui/         # DataTable, StatCard, Badge, shared primitives
  components/layout/     # AppLayout (nav/shell)
  lib/apiClient.js       # fetch wrapper
  lib/authContext.jsx    # auth/session context

server/src/
  modules/<domain>/      # <domain>.routes.js, .controller.js, .service.js, .validation.js
                         # domains include accounts, requirements, profiles, submissions, pipeline
                         # (GET /pipeline/board), admin, comments, documents, dashboard, reports, …
  utils/closureProgress.js  # pure closure % + step breakdown for submissions/profiles/matrix
  middleware/            # auth, requestLogger, errorHandler, lockCheck
  config/                # db.js, env.js, logger.js (structured stdout logging)

server/prisma/
  schema.prisma          # single schema — all domain tables as Prisma models
  team-roster.js         # Delphic @delphic.in users + Jira name/id maps
  client-aliases.js      # Jira client name → LeadMinds canonical name
  seed.js                # wipe + departments + team roster only
  seed-accounts.js       # LeadMinds client accounts CSV
  seed-jira.js           # Jira_all.csv requirements (JD, assignees, comments)
  seed-vendors.js        # active vendor accounts from tracker sheet
  seed-admin.js          # non-destructive prod admin bootstrap

docs/
  AGENTS.md              # this file
  jira/                  # Jira_all.csv, LeadMinds-Accounts.csv
  architecture/          # diagrams + HLD + specs
  ui/                    # UX rules + walkthroughs + references/
  testing/               # how-to-test guides
  progress/              # PROGRESS, TODO, SPRINT-PLAN
  guides/                # logging, production seed, other operator guides
```

Domain modules follow a consistent 4-file pattern: `routes` → `controller` → `service` → `validation` (including `admin`, `comments`, `documents`, and `dashboard` which has routes + service).

## Branching

- `main` — production; pushes trigger CI + deploy workflow
- `staging` — pre-production integration
- `dev` — trunk for feature work before promotion to `staging`

## Local setup

**Docker (recommended):**

```bash
docker compose up -d --build
```

Full CSV seed (PowerShell-safe). From **repo root** after containers are up:

```powershell
docker compose exec server mkdir -p /app/docs/jira
docker compose cp docs/jira/Jira_all.csv server:/app/docs/jira/Jira_all.csv
docker compose cp docs/jira/LeadMinds-Accounts.csv server:/app/docs/jira/LeadMinds-Accounts.csv
docker compose exec server node prisma/seed.js
docker compose exec server node prisma/seed-accounts.js
docker compose exec server node prisma/seed-jira.js
docker compose exec server node prisma/seed-vendors.js
```

Client: http://localhost:8081 · API: http://localhost:4000 · Postgres: `localhost:5434`.

**Without Docker (hot reload):**

```bash
npm install --workspaces
cp server/.env.example server/.env   # DATABASE_URL → localhost:5434; JWT secrets; optional LOG_LEVEL
npm run migrate
npm run seed
npm run seed:accounts
npm run seed:jira
npm run seed:vendors
npm run lint
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`): `admin@delphic.in`, `diksha.yadav@delphic.in`, `paras.gulati@delphic.in`, `chahak.pandya@delphic.in`, `dheeraj.kumar@delphic.in`, `tanvi.saxena@delphic.in`, `Garv@delphic.in`, `prashant.hada@delphic.in`, `sarthak.solanki@delphic.in`, and the rest of the roster in `server/prisma/team-roster.js`.

`npm run seed` wipes everything and loads **team only**. Domain data comes from `seed:accounts` (LeadMinds clients), `seed:jira` (requirements + JDs + assignments), and optional `seed:vendors`. VPS steps: [guides/PRODUCTION-SEED.md](guides/PRODUCTION-SEED.md). Walkthrough: [testing/TESTING-DEMO-SEED.md](testing/TESTING-DEMO-SEED.md).

## Backend logging

Zero-dependency structured logger. Full guide: [guides/BACKEND-LOGGING.md](guides/BACKEND-LOGGING.md).

- Env: `LOG_LEVEL=debug|info|warn|error` (defaults: debug in development, info in production, error in tests).
- Production (`NODE_ENV=production`) emits one JSON object per line; development prints a readable line.
- Automatic: HTTP access (`requestLogger`), validation/errors (`errorHandler`), start/shutdown/crash hooks (`index.js`).
- Health checks (`GET /api/v1/health`) are not access-logged. Tests do not emit access logs.
- In modules: `const logger = require('../../config/logger');` then `logger.info('event_name', { … })`. Never log passwords, JWTs, or upload bodies.
- Docker: `docker compose logs -f server` (optional root `.env` `LOG_LEVEL`).

**Temporary testing:** the login page has one-click buttons for Admin / BDA / Sales / Recruiter. Hide with `VITE_DISABLE_QUICK_LOGIN=true` when moving to real auth. Only **admin** can create new users (Users page in the nav); share email + password with BDA / Sales / Recruiter / other admins.

**This dev machine specifically** already runs native (non-Docker) Postgres services on `localhost:5432` and `localhost:5433`, and a native Apache/XAMPP on `localhost:8080`. `docker-compose.yml`'s default host ports (5434 for Postgres, 8081 for the client) were chosen to avoid these — if ports still collide, check `netstat -ano | grep <port>` and cross-reference the PID before assuming a Docker container is what you're talking to.

**Generating a new migration** (`prisma migrate dev --name ...`) must be run from the *host* (not `docker compose run`) with `DATABASE_URL` pointed at the compose-mapped Postgres port (`localhost:5434`) — `prisma migrate dev` writes the new `migrations/<timestamp>_name/` folder to disk, and if you run it inside an ephemeral `docker compose run --rm` container that folder is written into the container's throwaway layer and lost the moment the container exits (this happened once already — see [progress/PROGRESS.md](progress/PROGRESS.md)). Applying already-committed migrations (`prisma migrate deploy`, done automatically on `server` container startup) doesn't have this problem since it only reads.

## Working conventions

- Keep [progress/PROGRESS.md](progress/PROGRESS.md) and [progress/TODO.md](progress/TODO.md) up to date as work lands — check them at the start of a session and update them at the end.
- Prefer `logger` over bare `console.*` in server code. See [guides/BACKEND-LOGGING.md](guides/BACKEND-LOGGING.md).
- **Frontend must follow Jira-like UX** ([ui/UI-UX-JIRA.md](ui/UI-UX-JIRA.md)). Dense tables, filter bar, Create, inline status, avatar stacks — not a generic CRUD admin look. Compare list/dashboard work to the reference screenshot before calling UI tickets done.
- All frontend role checks go through `can()` / `usePermissions()` / `<Can>` in `client/src/lib/permissions.js`. Do not add new scattered `user?.role ===` gates for nav, routes, or panels. See [ui/UI-REDESIGN.md](ui/UI-REDESIGN.md).
- **Superadmin** is `role: 'admin'` **plus** `User.is_superadmin = true` (never a new role value — every `authorize('admin')` gate keeps working, the flag only *adds* powers). `admin@delphic.in` is the seeded superadmin. Server-side, the extra powers are gated by `authorizeSuperadmin` / `loadSuperadminFlag` in `middleware/auth.js`, which **re-read the flag from the DB each request** — never trust an `is_superadmin` JWT claim (there isn't one). Frontend gating goes through `userCan(user, cap)` / `usePermissions(user).isSuperadmin`; superadmin-only caps: `editBroughtBy`, `overrideStage`, `editAnyUser`. Current superadmin-only surface: edit any user field incl. role / email / password / `is_superadmin` (`PATCH /users/:id`), edit account `origin_owner_id` ("Brought by"), edit locked accounts, and `POST /accounts/:id/stage/override` (free-form/backward account stage move). No delete routes — update only.
- Product forms (create candidate, put forward, create account/requirement/user, assign recruiters, interview rounds) open in an RHS `Drawer` only — never a page-wide centered modal. List row click opens a peek drawer with actions, not a full-page navigate.
- Dropdowns: use `components/ui/SearchableSelect.jsx` (single-select, `options`/`onChange(value)`) for any data-driven or ~6-plus-option picker, and `MultiSelectDropdown.jsx` for multi-select. Plain `<select>` is only for small fixed enums (gender, currency, work mode, stage-transition pickers, etc.).
- Leads are owned by **BDA** (`account.owner_id`); requirements by **Sales** (`sales_owner_id`). Admin reports: `bda-performance` vs `sales-performance` must stay separate.
- Interview round create requires `scheduled_at` (interview date & time).
- Keep CSS lean: layout and component structure as Tailwind classNames inline; `global.css` holds only tokens for spacing, typography, font, colors, and hover/button color utilities.
- Deploy workflow (`.github/workflows/deploy.yml`) is a no-op until `DEPLOY_ENABLED` repo variable + VPS secrets are set — don't assume deploys are live.
- Initial scaffold is committed and pushed to `main`, `staging`, and `dev` on `github.com/deepanshu-chauhan-delphic/delphic-one` as of 2026-08-20. Migrations have not yet been run against a real PostgreSQL instance — do that before trusting the schema.
