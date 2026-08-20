# TODO

Working task list. Check off / move to [docs/PROGRESS.md](PROGRESS.md) as items land. See [docs/AGENTS.md](AGENTS.md) for project context.

## Backend

- [ ] Flesh out `admin`, `comments`, `dashboard`, `documents` modules to the standard routes/controller/service/validation pattern (currently routes-only).
- [ ] Verify all migrations run cleanly end-to-end (`npm run migrate`) and seed data matches what the client list pages expect.
- [ ] Confirm auth middleware + lockCheck middleware are wired into every module route that needs them.
- [ ] Cross-check implemented routes against [docs/API-Spec-and-Build-Plan.md](API-Spec-and-Build-Plan.md) for gaps.

## Frontend

- [x] List pages (accounts, requirements, profiles, submissions, reports) wired to real API endpoints via `apiClient`.
- [ ] Dashboard page: currently generic summary cards + funnel chart — role-based widgets per system design doc still to do.
- [x] Auth flow: login page → session persistence (localStorage + refresh) → protected routes.
- [ ] Detail pages (account/requirement/profile/submission drill-down, stage transition UI, kanban board) not built yet — list pages only.

## Infra / CI

- [x] First commit made; `main`, `staging`, `dev` pushed to `github.com/deepanshu-chauhan-delphic/delphic-one`.
- [ ] Set `DEPLOY_ENABLED` repo variable + `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY` secrets when ready to enable auto-deploy.
- [x] `staging` and `dev` branches exist; CI workflow targets all three (not yet confirmed green — no PR/push has triggered a run yet).

## Docs

- [ ] Keep this file and PROGRESS.md current each session.
