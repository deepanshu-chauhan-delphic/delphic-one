# AGENTS.md

Context for any AI agent (or human) picking up work on the Requirement Management Dashboard.

## What this project is

Internal requirement/recruitment pipeline dashboard for Delphic. Tracks client accounts → requirements → candidate profiles → submissions → interview rounds, with role-based dashboards and reporting.

Full spec: [docs/Requirement-Dashboard-System-Design-v2.md](Requirement-Dashboard-System-Design-v2.md)
API contract + build plan: [docs/API-Spec-and-Build-Plan.md](API-Spec-and-Build-Plan.md)

## Stack

- **Client:** React + Vite + Tailwind CSS (`client/`)
- **Server:** Node.js / Express + Prisma ORM on PostgreSQL (`server/`)
- **Deploy:** Nginx + PM2 on a single VPS, GitHub Actions on push to `main`

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

```bash
npm install --workspaces
cp server/.env.example server/.env   # set DATABASE_URL + JWT secrets
npm run migrate
npm run seed
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`): `admin@delphic.local`, `sales1@delphic.local`, `bda1@delphic.local`, `recruiter1@delphic.local`, `recruiter2@delphic.local`.

## Working conventions

- Keep [docs/PROGRESS.md](PROGRESS.md) and [docs/TODO.md](TODO.md) up to date as work lands — check them at the start of a session and update them at the end.
- Deploy workflow (`.github/workflows/deploy.yml`) is a no-op until `DEPLOY_ENABLED` repo variable + VPS secrets are set — don't assume deploys are live.
- Initial scaffold is committed and pushed to `main`, `staging`, and `dev` on `github.com/deepanshu-chauhan-delphic/delphic-one` as of 2026-08-20. Migrations have not yet been run against a real PostgreSQL instance — do that before trusting the schema.
