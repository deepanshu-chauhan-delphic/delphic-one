# RD-115 — Spec / UX walkthrough (Aug 21)

**Status:** Dev A pass complete for owned surfaces  
**Sources:** [API-Spec-and-Build-Plan.md](API-Spec-and-Build-Plan.md), [UI-UX-JIRA.md](UI-UX-JIRA.md), [SPRINT-PLAN.md](SPRINT-PLAN.md)

## 1. Purpose

Page-by-page check: does each intended screen/button exist, and do primary lists feel Jira-like (dense filters + issue keys)?

## 2. Surfaces checked

| Surface | Status | Notes |
|---|---|---|
| Login + quick role login | Present | RD-131 |
| Role dashboard home | Present | RD-113 — named dashboard, role widgets, stuck + activity |
| Accounts list / detail / create / edit / stage move | Present | RD-101/102 — Basic filter bar, ACC keys |
| Account Notes + Files | Present | RD-109/110 |
| Account Unlock (admin) | Present | RD-127 |
| Profiles list / detail / create / edit / resume files | Present | RD-105 — Basic filter bar, PRF keys |
| Profile Notes + Files | Present | RD-109/110 |
| Requirements list | Present | Dense Basic filters + REQ keys (RD-115 polish) |
| Requirement detail shell | Present | Notes/Files, seats table, unlock job/seat (RD-110/127); full seat stages = RD-103 |
| Assign recruiters | Present | RD-106 |
| Add Job / status / Add seat forms | Missing | **Dev B RD-103/104** |
| Submissions list | Present | Dense Basic filters + SUB keys (RD-115 polish) |
| Submission detail shell | Present | Notes/Files + unlock (RD-110/127); pipeline = RD-107/111 |
| Put candidate forward | Missing | **Dev B RD-108** |
| Interview rounds UI | Missing | **Dev B RD-125** |
| Kanban | Missing | **Dev B RD-112** |
| Reports charts (not raw JSON) | Partial | Page exists; rich charts = **Dev B RD-114** |
| Admin Users | Present | RD-126 |
| Unlock UI | Present | RD-127 on account / requirement / seat / submission |
| Change password | Missing | **Dev B RD-128** |

## 3. Jira-like UX checklist (Dev A lists)

- [x] Dense list + Basic filter bar on Accounts, Profiles, Requirements, Submissions
- [x] Issue-style keys (ACC / PRF / REQ / SUB) + title links
- [x] Compact top chrome (Delphic brand, role chip, avatar initial)
- [x] Detail issue headers with status + Locked badge where relevant
- [ ] Full Create-from-chrome for Jobs/Submissions — blocked on Dev B forms
- [ ] Kanban alternate view — RD-112

Compared against [references/jira-like-dashboard-reference.png](references/jira-like-dashboard-reference.png) for filter/list density on owned pages.

## 4. Fixes landed this ticket

1. **RD-127** — reusable `UnlockButton`; wired on locked account, requirement, seat row, submission.
2. **Requirements / Submissions lists** — Basic filter bar, mono keys, denser rows, footer count.
3. **AppLayout** — Delphic brand, tighter header, role chip + initials avatar.
4. **Requirement detail** — seats table so admin can unlock locked seats without waiting for full RD-103 UI.

## 5. Explicitly not claimed as done

Anything owned by Dev B in the table above remains open. RD-115 does not invent those screens.
