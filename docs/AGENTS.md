# AGENTS.md

Context for any AI agent (or human) picking up work on the Requirement Management Dashboard.

## What this project is

Internal requirement/recruitment pipeline dashboard for Delphic. Tracks client accounts → requirements → candidate profiles → submissions → interview rounds, with role-based dashboards and reporting.

Full spec: [docs/Requirement-Dashboard-System-Design-v2.md](Requirement-Dashboard-System-Design-v2.md)
API contract + build plan: [docs/API-Spec-and-Build-Plan.md](API-Spec-and-Build-Plan.md)

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
  middleware/            # auth, errorHandler, lockCheck
  config/                # db.js (Prisma client singleton), env.js

server/prisma/
  schema.prisma          # single schema — all 11 tables as Prisma models
  seed.js                 # seed data (admin, sales, bda, 2 recruiters)
```

Domain modules follow a consistent 4-file pattern: `routes` → `controller` → `service` → `validation`. Some modules (admin, comments, dashboard, documents) currently have only a `routes.js` — check whether they need controller/service split before extending them.

## Branching

- `main` — production; pushes trigger CI + deploy workflow
- `staging` — pre-production integration
- `dev` — trunk for feature work before promotion to `staging`

## Local setup

**Docker (recommended, verified working):**

```bash
docker compose up -d --build
docker compose run --rm --entrypoint "" server sh -c "node prisma/seed.js"
```

Client: http://localhost:8081 · API: http://localhost:4000 · Postgres (host access, e.g. for `psql`): `localhost:5434`.

**Without Docker:**

```bash
npm install --workspaces
cp server/.env.example server/.env   # set DATABASE_URL + JWT secrets
npm run migrate
npm run seed
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`): `admin@delphic.local`, `sales1@delphic.local`, `bda1@delphic.local`, `recruiter1@delphic.local`, `recruiter2@delphic.local`.

**This dev machine specifically** already runs native (non-Docker) Postgres services on `localhost:5432` and `localhost:5433`, and a native Apache/XAMPP on `localhost:8080`. `docker-compose.yml`'s default host ports (5434 for Postgres, 8081 for the client) were chosen to avoid these — if ports still collide, check `netstat -ano | grep <port>` and cross-reference the PID before assuming a Docker container is what you're talking to.

**Generating a new migration** (`prisma migrate dev --name ...`) must be run from the *host* (not `docker compose run`) with `DATABASE_URL` pointed at the compose-mapped Postgres port (`localhost:5434`) — `prisma migrate dev` writes the new `migrations/<timestamp>_name/` folder to disk, and if you run it inside an ephemeral `docker compose run --rm` container that folder is written into the container's throwaway layer and lost the moment the container exits (this happened once already — see PROGRESS.md). Applying already-committed migrations (`prisma migrate deploy`, done automatically on `server` container startup) doesn't have this problem since it only reads.

## Working conventions

- Keep [docs/PROGRESS.md](PROGRESS.md) and [docs/TODO.md](TODO.md) up to date as work lands — check them at the start of a session and update them at the end.
- Deploy workflow (`.github/workflows/deploy.yml`) is a no-op until `DEPLOY_ENABLED` repo variable + VPS secrets are set — don't assume deploys are live.
- Initial scaffold is committed and pushed to `main`, `staging`, and `dev` on `github.com/deepanshu-chauhan-delphic/delphic-one` as of 2026-08-20. Migrations have not yet been run against a real PostgreSQL instance — do that before trusting the schema.
