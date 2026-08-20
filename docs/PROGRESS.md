# Progress Log

Reverse-chronological log of what's been done. Newest entry on top. See [docs/TODO.md](TODO.md) for what's next and [docs/AGENTS.md](AGENTS.md) for project context.

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
