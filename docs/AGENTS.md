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
- [Requirement-Dashboard-System-Design-v2.md](architecture/Requirement-Dashboard-System-Design-v2.md)
- [API-Spec-and-Build-Plan.md](architecture/API-Spec-and-Build-Plan.md)

### UI

- [UI-UX-JIRA.md](ui/UI-UX-JIRA.md) — product must feel like Jira (dense filters + list). Reference: [jira-like-dashboard-reference.png](ui/references/jira-like-dashboard-reference.png)
- [RD-115-SPEC-WALKTHROUGH.md](ui/RD-115-SPEC-WALKTHROUGH.md)

### Testing

- [TESTING-DEMO-SEED.md](testing/TESTING-DEMO-SEED.md) — demo data inventory + role walkthroughs
- [TESTING-RD-103-104.md](testing/TESTING-RD-103-104.md) — requirements UI
- [TESTING-RD-107-108.md](testing/TESTING-RD-107-108.md) — submissions UI
- [TESTING-RD-111-125-112.md](testing/TESTING-RD-111-125-112.md) — pipeline / interviews / kanban
- [TESTING-RD-114-128.md](testing/TESTING-RD-114-128.md) — reports UI + change password
- [TESTING-RD-114-128.md](testing/TESTING-RD-114-128.md) — reports UI + change password

### Progress

- [PROGRESS.md](progress/PROGRESS.md) · [TODO.md](progress/TODO.md) · [SPRINT-PLAN.md](progress/SPRINT-PLAN.md)

### Guides

- [BACKEND-LOGGING.md](guides/BACKEND-LOGGING.md)

## Stack

- **Client:** React + Vite + Tailwind CSS (`client/`)
- **Server:** Node.js / Express + Prisma ORM on PostgreSQL (`server/`)
- **Deploy:** Dockerized (`docker-compose.yml`: `db`/`server`/`client` services, `server/Dockerfile`, `client/Dockerfile` → Nginx runtime). `ecosystem.config.js`/`nginx.conf.example` (bare PM2+Nginx VPS layout) also still exist from before dockerization — `deploy.yml` targets that older layout, not the Docker images; this needs to be reconciled before enabling auto-deploy. GitHub Actions on push to `main`.

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
  middleware/            # auth, requestLogger, errorHandler, lockCheck
  config/                # db.js, env.js, logger.js (structured stdout logging)

server/prisma/
  schema.prisma          # single schema — all 11 tables as Prisma models
  seed.js                 # demo seed: users + accounts/reqs/profiles/submissions (see testing/TESTING-DEMO-SEED.md)

docs/
  AGENTS.md              # this file
  architecture/          # diagrams + HLD + specs
  ui/                    # UX rules + walkthroughs + references/
  testing/               # how-to-test guides
  progress/              # PROGRESS, TODO, SPRINT-PLAN
  guides/                # logging and other operator guides
```

Domain modules follow a consistent 4-file pattern: `routes` → `controller` → `service` → `validation` (including `admin`, `comments`, `documents`, and `dashboard` which has routes + service).

## Branching

- `main` — production; pushes trigger CI + deploy workflow
- `staging` — pre-production integration
- `dev` — trunk for feature work before promotion to `staging`

## Local setup

**Docker (recommended, verified working):**

```bash
docker compose up -d --build
```

Seed (PowerShell-safe — empty `--entrypoint ""` breaks on Windows). From **repo root**:

```powershell
docker compose cp server/prisma/seed.js server:/app/server/prisma/seed.js
docker compose exec server node prisma/seed.js
```

Or if the image already includes the latest seed:

```powershell
docker compose exec server node prisma/seed.js
```

If the server container is not running yet:

```powershell
docker compose run --rm --entrypoint sh server -c "node prisma/seed.js"
```

Client: http://localhost:8081 · API: http://localhost:4000 · Postgres (host access, e.g. for `psql`): `localhost:5434`.

**Without Docker:**

```bash
npm install --workspaces
cp server/.env.example server/.env   # set DATABASE_URL + JWT secrets; optional LOG_LEVEL
npm run migrate
npm run seed
npm run lint         # ESLint (server + client)
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`): `admin@delphic.local`, `sales1@delphic.local`, `bda1@delphic.local`, `recruiter1@delphic.local`, `recruiter2@delphic.local`.

Demo domain data (accounts, requirements, seats, profiles, submissions, interviews, history) is included in the same seed so dashboards and lists are non-empty. Full inventory and role walkthroughs: [testing/TESTING-DEMO-SEED.md](testing/TESTING-DEMO-SEED.md). Re-running seed wipes and recreates everything.

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
- Deploy workflow (`.github/workflows/deploy.yml`) is a no-op until `DEPLOY_ENABLED` repo variable + VPS secrets are set — don't assume deploys are live.
- Initial scaffold is committed and pushed to `main`, `staging`, and `dev` on `github.com/deepanshu-chauhan-delphic/delphic-one` as of 2026-08-20. Migrations have not yet been run against a real PostgreSQL instance — do that before trusting the schema.
