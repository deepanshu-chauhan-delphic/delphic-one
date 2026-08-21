# Requirement Management Dashboard

Internal requirement/recruitment pipeline dashboard. See [docs/Requirement-Dashboard-System-Design-v2.md](docs/Requirement-Dashboard-System-Design-v2.md) and [docs/API-Spec-and-Build-Plan.md](docs/API-Spec-and-Build-Plan.md) for the full spec and build plan.

## Stack

- **Client:** React + Vite + Tailwind CSS
- **Server:** Node.js / Express + Prisma ORM (PostgreSQL)
- **Deploy:** Dockerized (`docker-compose.yml`) — see below

## Branching

- `main` — production; pushes here trigger CI and the deploy workflow.
- `staging` — pre-production integration/testing branch.
- `dev` — trunk for merging feature/dev branches before promotion to `staging`.

## Local setup (Docker — recommended)

```bash
docker compose up -d --build
docker compose run --rm --entrypoint "" server sh -c "node prisma/seed.js"
```

- Client: http://localhost:8081
- API: http://localhost:4000
- Postgres (host tools, e.g. `psql`): `localhost:5434`

Copy `.env.example` to `.env` first if you want to override any port or secret — see that file for the full list. To generate a *new* Prisma migration after changing `server/prisma/schema.prisma`, run it from the host (not inside a `docker compose run` container — see `docs/AGENTS.md` for why) with `DATABASE_URL` pointed at `localhost:5434`.

## Local setup (without Docker)

```bash
npm install --workspaces

cp server/.env.example server/.env
# edit server/.env with your local DATABASE_URL and JWT secrets

npm run migrate      # prisma migrate dev — creates the DB schema
npm run seed         # prisma db seed equivalent (prisma/seed.js)

npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seeded users (password `Password123!`):

- `admin@delphic.local` — admin
- `sales1@delphic.local` — sales
- `bda1@delphic.local` — bda
- `recruiter1@delphic.local` / `recruiter2@delphic.local` — recruiter

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`. It is a no-op until the `DEPLOY_ENABLED` repository variable is set to `true` and `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` secrets are configured. Note: that workflow still targets the older bare PM2/Nginx VPS layout (`nginx.conf.example`, `ecosystem.config.js`), not the Docker images built by `docker-compose.yml` — reconcile before enabling.
