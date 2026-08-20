# Requirement Management Dashboard

Internal requirement/recruitment pipeline dashboard. See [docs/Requirement-Dashboard-System-Design-v2.md](docs/Requirement-Dashboard-System-Design-v2.md) and [docs/API-Spec-and-Build-Plan.md](docs/API-Spec-and-Build-Plan.md) for the full spec and build plan.

## Stack

- **Client:** React + Vite + Tailwind CSS
- **Server:** Node.js / Express + Prisma ORM (PostgreSQL)
- **Deploy:** Nginx + PM2 on a single VPS

## Branching

- `main` — production; pushes here trigger CI and the deploy workflow.
- `staging` — pre-production integration/testing branch.
- `dev` — trunk for merging feature/dev branches before promotion to `staging`.

## Local setup

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

`.github/workflows/deploy.yml` runs on every push to `main`. It is a no-op until the `DEPLOY_ENABLED` repository variable is set to `true` and `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` secrets are configured. See `nginx.conf.example` and `ecosystem.config.js` for the target VPS layout.
