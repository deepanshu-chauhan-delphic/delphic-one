# Lessons

## 2026-08-31: PipelineFilters inline fields array caused API request storm / 429

**Root cause:** Job/Candidate/Lead boards passed `fields={[...]}` inline. `PipelineFilters` keyed `useMemo`/`useEffect` on that array reference, so every parent re-render re-fetched `/users` and `/accounts`, which tripped `express-rate-limit` (and browser `ERR_INSUFFICIENT_RESOURCES`). Login 429s were a separate tight `max: 5/min` cap.

**Failure symptoms:** Flood of `users?role=recruiter` and `accounts?type=client` in Network; 429 on login and after login.

**Fix details:** Stabilize filter field lists with a content `fieldsKey`; skip `onChange` when API params JSON is unchanged; raise login limit to 30/min and API to 1200/min.

**Consulted sources:** Browser Network panel; `server/src/app.js` rate limiters; `PipelineFilters.jsx` effect deps.

**Prevention guidance:** Never put an inline array/object in a React effect dependency without a stable content key; prefer module-level constants for prop lists.

## 2026-08-21: ChangePasswordModal wrong relative imports broke Docker client build

**Root cause:** `ChangePasswordModal.jsx` lives under `client/src/components/`, but imported `apiClient` as `../../lib/apiClient` (resolves outside `src`) and `Modal` as `../ui/Modal.jsx` (one level too high). Sibling components correctly use `../lib/apiClient.js` and `./ui/Modal.jsx`.

**Failure symptoms:** `docker compose up -d --build` failed on client Vite build: `Could not resolve "../../lib/apiClient" from "src/components/ChangePasswordModal.jsx"`.

**Fix details:** Changed imports to `../lib/apiClient.js` and `./ui/Modal.jsx`. Local and Docker client builds then succeeded (923 modules).

**Consulted sources:** Vite/Rollup error output; sibling imports in `NotesPanel.jsx` / `UnlockButton.jsx`.

**Prevention guidance:** When adding a file under `src/components/`, match existing component import depths; run `npm run build --workspace client` before relying on Docker image build.
