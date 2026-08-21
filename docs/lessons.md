# Lessons

## 2026-08-21: ChangePasswordModal wrong relative imports broke Docker client build

**Root cause:** `ChangePasswordModal.jsx` lives under `client/src/components/`, but imported `apiClient` as `../../lib/apiClient` (resolves outside `src`) and `Modal` as `../ui/Modal.jsx` (one level too high). Sibling components correctly use `../lib/apiClient.js` and `./ui/Modal.jsx`.

**Failure symptoms:** `docker compose up -d --build` failed on client Vite build: `Could not resolve "../../lib/apiClient" from "src/components/ChangePasswordModal.jsx"`.

**Fix details:** Changed imports to `../lib/apiClient.js` and `./ui/Modal.jsx`. Local and Docker client builds then succeeded (923 modules).

**Consulted sources:** Vite/Rollup error output; sibling imports in `NotesPanel.jsx` / `UnlockButton.jsx`.

**Prevention guidance:** When adding a file under `src/components/`, match existing component import depths; run `npm run build --workspace client` before relying on Docker image build.
