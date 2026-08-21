# Testing RD-114 + RD-128 (Reports UI + Change password)

Manual checks for Dev B Day 4–5 product tickets (no infra).

## Prerequisites

- Stack running (`docker compose up` or local API + Vite).
- Seeded users (or Users page). Prefer Admin for full report list.

## RD-114 — Reports

1. Log in as **Admin** → **Reports**.
2. Confirm default **From** = first day of month, **To** = today.
3. Run each report:
   - Recruiter / Sales / Vendor / Closure → **bar chart** + **dense table** (not raw JSON).
   - Aging → threshold days + four section tables.
4. Change dates → **Run** → table/chart refresh.
5. Closure: switch **Group by** (month / client / recruiter).
6. Click **Excel** and **PDF** — browser downloads a usable file (open Excel; PDF has headers/rows).
7. Log in as **Recruiter** → only Recruiter performance; no Excel/PDF buttons.
8. Log in as **Sales** → no Sales performance report; can export allowed reports.

## RD-128 — Change password

1. Click avatar in header → **Change password**.
2. Wrong current password → error.
3. New password &lt; 8 chars or mismatch confirm → client validation error.
4. Valid change → success message.
5. Logout → login with **new** password works; old password fails.
6. Avatar menu **Logout** still works.

## Automated

```bash
cd server && npm test -- reports-ui.test.js auth.test.js
```
