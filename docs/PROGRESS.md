# Progress Log

Reverse-chronological log of what's been done. Newest entry on top. See [docs/TODO.md](TODO.md) for what's next and [docs/AGENTS.md](AGENTS.md) for project context.

## 2026-08-21 — Dockerized the stack; verified working end-to-end

- Added `server/Dockerfile`, `client/Dockerfile` (multi-stage build → `nginx:1.27-alpine` runtime, `client/nginx.conf` proxies `/api` and `/uploads` to the `server` container), root `docker-compose.yml` (`db`/`server`/`client` services, named volumes for Postgres data and uploads), `.dockerignore`, and root `.env.example` for compose overrides.
- Ran `npm install` for real in both `server/` and `client/` workspaces (previously never installed) — both installed cleanly, no dependency resolution errors. Committed the resulting root `package-lock.json`.
- `docker compose up --build` surfaced a real bug: `node:22-alpine` has no OpenSSL, and Prisma's schema-engine binary needs it — server crash-looped with `Could not parse schema engine response`. Fixed by adding `RUN apk add --no-cache openssl libc6-compat` to `server/Dockerfile`.
- Discovered `prisma migrate deploy` (used in the container's startup command) only *applies* existing migrations — it doesn't generate them, and no `prisma/migrations` folder existed yet. First attempt to generate one via `docker compose run --rm ... prisma migrate dev` *appeared* to succeed (applied against the real `db` service) but the generated migration files were written into that ephemeral `--rm` container's throwaway layer and vanished when it exited — confirmed by checking the host filesystem afterward and finding no `server/prisma/migrations/` directory at all, despite `docker exec ... psql \dt` showing all 12 tables present in the actual database.
- Also hit a host networking gotcha: this machine runs two native (non-Docker) Postgres instances on `localhost:5432` and `localhost:5433`, and native Apache/XAMPP on `localhost:8080`. `docker-compose.yml`'s original default host ports (5433, 8080) collided with these — connections silently reached the *wrong* server (confirmed via `netstat -ano` showing two LISTENING PIDs per port, cross-referenced with `Get-Process` to identify one as `postgres.exe`/`Apache` and the other as Docker's proxy). Fixed by moving the compose defaults to unused ports: Postgres → `5434`, client → `8081`.
- **Resolution:** dropped/recreated the dev database, then ran `prisma migrate dev --name init` directly from the *host* (`server/` with `DATABASE_URL` pointed at `localhost:5434`) — this writes the migration folder to the real host filesystem, unlike running it inside a `docker compose run --rm` container. Confirmed `server/prisma/migrations/20260821054624_init/migration.sql` now exists on disk and is committed.
- Did a full clean-slate verification: `docker compose down -v` (wipes volumes) → `docker compose up -d --build` → server logs show `1 migration found in prisma/migrations` / `All migrations have been successfully applied` (this is the real proof the Docker image works standalone, not dependent on manually-generated state) → seeded via `docker compose run --rm --entrypoint "" server sh -c "node prisma/seed.js"` → `POST /auth/login` returns a real JWT for `admin@delphic.local` / `Password123!`, `GET /users/me` and `GET /dashboard/summary` both return correct data, and the same login works through the client's Nginx proxy on port 8081, not just hitting the API directly on 4000.
- Docker Desktop itself dropped between sessions (daemon stopped responding, `docker info` failed) and had to be relaunched; on restart, the previously-running containers resumed automatically. Environment flakiness, not a project bug — noted in case it recurs.
- Updated `docs/AGENTS.md` "Local setup" with the verified Docker quick-start and the port/migration-generation gotchas above so the next session doesn't have to rediscover them.

## 2026-08-20 — Migrated server from Knex to Prisma

- Replaced Knex query builder with Prisma ORM across the whole server: `server/prisma/schema.prisma` now defines all 11 tables (as Prisma models/enums) that previously lived as 12 numbered Knex migration files — those migration files and `knexfile.js` are deleted.
- `server/src/config/db.js` now exports a `PrismaClient` singleton instead of a Knex instance; every service file and route module (`auth`, `users`, `accounts`, `requirements`, `profiles`, `submissions`, `documents`, `comments`, `admin`, `dashboard`, `reports`, and `middleware/lockCheck.js`) rewritten to Prisma's query API (`findMany`/`findUnique`/`create`/`update`, `$transaction` in place of Knex transactions, `groupBy` in place of raw `count().groupBy()`).
- Seeding moved from `knex seed:run` to `server/prisma/seed.js`, run via `npm run seed` → `node prisma/seed.js`.
- `npm run migrate` in `server/package.json` now runs `prisma migrate dev` instead of `knex migrate:latest`.
- Not yet done: no `npm install` has been run against this Prisma setup, so it has never actually generated a client or run a real migration — first real test is still pending (see TODO).

## 2026-08-20 — Repo pushed to GitHub

- Initial scaffold committed on `main` and pushed to `github.com/deepanshu-chauhan-delphic/delphic-one`.
- `staging` and `dev` branches created from `main` and pushed; CI workflow triggers on all three.
- Hit two auth snags along the way: wrong repo name (`delphic_one` vs `delphic-one`) and a 403 from the cached GitHub credential (`deepanshu-chauhan-483`) lacking write access — resolved by adding that account as a collaborator.

## 2026-08-20 — Initial scaffold
- Client scaffold: Vite + React + Tailwind, `AppLayout`, auth context, `apiClient`, list pages stubbed for accounts / requirements / profiles / submissions / reports, dashboard page, login page.
- Server scaffold: Express app, Knex config, JWT auth middleware, error handler, lock-check middleware.
- DB migrations 000–011: extensions, users, accounts, requirements, requirement_seats, requirement_assignments, profiles, submissions, interview_rounds, stage_history, documents, comments.
- Seed: `001_seed_users` (admin, sales, bda, 2 recruiters).
- Full domain modules (routes/controller/service/validation) built for: **accounts, auth, profiles, requirements, submissions, users**.
- Routes-only (no controller/service split yet) for: **admin, comments, dashboard, documents**; requirements/seats and submissions/interviewRounds routes exist as extra route files within those modules.
- CI workflow and deploy workflow (`deploy.yml`, currently a no-op pending `DEPLOY_ENABLED` + VPS secrets) added under `.github/workflows/`.
- `docs/AGENTS.md`, `docs/PROGRESS.md`, `docs/TODO.md` created to track context going forward.
