# TODO

Working task list. Check off / move to [docs/PROGRESS.md](PROGRESS.md) as items land. See [docs/AGENTS.md](AGENTS.md) for project context.

## Backend

- [x] `npm install` run for real in both workspaces; `prisma migrate dev` generated the first real migration (`server/prisma/migrations/20260821054624_init/`) and applied it; verified all 12 tables (11 + `_prisma_migrations`) exist and seed data loads. Confirmed `^5.18.0` resolves to Prisma 5.22.0 and generates cleanly with the traditional `datasource { url = env(...) }` syntax — the earlier IDE-diagnostic concern was a non-issue.
- [x] Full stack verified end-to-end via Docker Compose from a completely fresh volume: `docker compose up --build` → `migrate deploy` finds and applies the committed migration → seed → login via `POST /auth/login` → `GET /users/me` and `/dashboard/summary` all return real data, both hitting the API directly (port 4000) and through the client's Nginx proxy (port 8081).
- [ ] Flesh out `admin`, `comments`, `dashboard`, `documents` modules to the standard routes/controller/service/validation pattern (currently routes-only, direct Prisma calls in the route file).
- [ ] Confirm auth middleware + lockCheck middleware are wired into every module route that needs them.
- [ ] Cross-check implemented routes against [docs/API-Spec-and-Build-Plan.md](API-Spec-and-Build-Plan.md) for gaps.
- [ ] Still no automated tests and no linter — only manual `curl` checks and `node --check` syntax validation have ever been run against this code. See [docs/PROGRESS.md](PROGRESS.md) for the exact commands used, so this can be turned into a real smoke-test script.

## Frontend

- [x] List pages (accounts, requirements, profiles, submissions, reports) wired to real API endpoints via `apiClient`.
- [ ] Dashboard page: currently generic summary cards + funnel chart — role-based widgets per system design doc still to do.
- [x] Auth flow: login page → session persistence (localStorage + refresh) → protected routes.
- [ ] Detail pages (account/requirement/profile/submission drill-down, stage transition UI, kanban board) not built yet — list pages only.

## Infra / CI

- [x] First commit made; `main`, `staging`, `dev` pushed to `github.com/deepanshu-chauhan-delphic/delphic-one`.
- [x] Full stack dockerized: `server/Dockerfile`, `client/Dockerfile` (→ Nginx runtime), root `docker-compose.yml` (`db`/`server`/`client`), verified working end-to-end (see Backend section above).
- [ ] `ci.yml` doesn't build the Docker images or run `docker compose up` — it only does `npm install`/`npm run build`/`node --check`. Consider adding an image-build (and ideally a compose-up smoke test) job, since that's the part that actually caught real bugs (missing OpenSSL, missing migrations) this session.
- [ ] Set `DEPLOY_ENABLED` repo variable + `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY` secrets when ready to enable auto-deploy. `deploy.yml` still assumes a bare PM2/Nginx VPS layout (`ecosystem.config.js`, `nginx.conf.example`) rather than deploying the new Docker images — decide which deployment story to keep before enabling it.
- [x] `staging` and `dev` branches exist; CI workflow targets all three (not yet confirmed green — no PR/push has triggered a run yet).

## Docs

- [ ] Keep this file and PROGRESS.md current each session.
