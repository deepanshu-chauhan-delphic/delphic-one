# Sprint Plan — Aug 21 → Aug 28

Plain-language ticket breakdown for two full-stack developers. Goal: everything — including testing — is finished by end of day **Aug 27**. **Aug 28 is deploy day only**, no new feature work.

Where things stand on Aug 21: database, login, all core API modules, and Docker setup are built and verified working (see [PROGRESS.md](PROGRESS.md)). What's missing is mostly the *frontend* — real pages to actually use the tool — plus tests and a proper deploy setup. This plan covers that.

Both developers are full-stack. Each owns a couple of complete features end-to-end (frontend + any backend touch-ups needed) so neither is stuck waiting on the other.

---

## Day 1 — Fri Aug 22 — Clients & Jobs get real pages

| Ticket | Owner | What to build |
|---|---|---|
| RD-101 | Dev A | Full detail page for one Client/Vendor — all their info, current status, a button to move them to the next stage (with a popup asking for a reason when needed) |
| RD-102 | Dev A | "Add new Client/Vendor" and "Edit" forms |
| RD-103 | Dev B | Full detail page for one Job Requirement — all its info, the list of open seats, who's working on it |
| RD-104 | Dev B | "Add new Job Requirement" form, plus the button to change its status (Open → In Progress → Closed, etc.) |

## Day 2 — Sat Aug 23 — Candidates & putting them forward

| Ticket | Owner | What to build |
|---|---|---|
| RD-105 | Dev A | Candidate detail page and "Add/Edit Candidate" form, including uploading a resume |
| RD-106 | Dev A | Popup for assigning a recruiter to a job, plus a small history of who's been assigned |
| RD-107 | Dev B | Submission detail page — shows which candidate is going for which job and where they are in the process |
| RD-108 | Dev B | "Put a candidate forward for a job" flow — pick the candidate, enter the rate, see the profit margin calculate live as you type |

## Day 3 — Sun Aug 24 — Moving people through the pipeline

| Ticket | Owner | What to build |
|---|---|---|
| RD-109 | Dev A | One reusable "Notes" box and "Files" uploader that can be dropped onto any page |
| RD-110 | Dev A | Add the Notes and Files boxes to all four detail pages (Client, Job, Candidate, Submission) |
| RD-111 | Dev B | Buttons for moving a submission through its stages (Screening → Submitted → Interview → Offer → Background Check → Closed), with a popup asking why if someone backs out or gets rejected |
| RD-112 | Dev B | Visual board (like Trello) showing all candidates for one job, grouped by stage |

## Day 4 — Mon Aug 25 — Dashboard & Reports that are actually useful

| Ticket | Owner | What to build |
|---|---|---|
| RD-113 | Dev A | Real home-screen dashboard: summary numbers, a "these are stuck and need attention" list, recent activity — showing different things depending on whether you're a BDA, Salesperson, Recruiter, or Admin |
| RD-114 | Dev B | Turn the Reports page from a wall of raw text into real tables and charts (one look per report type), add a date-range picker, make the Excel/PDF download buttons actually produce a file |

## Day 5 — Tue Aug 26 — Catching what's missing, and writing tests

| Ticket | Owner | What to build |
|---|---|---|
| RD-115 | Dev A | Go through the original spec document page-by-page and check every screen/button described actually exists — fix whatever's missing |
| RD-116 | Dev A | Turn on a basic code checker (linter) so typos and obvious mistakes get flagged automatically instead of slipping through |
| RD-117 | Dev B | Automated tests for the "is this allowed to move to the next stage" rules — for clients, jobs, seats, and submissions (the part most likely to have a hidden bug) |
| RD-118 | Dev B | Automated tests for logging in/out, and for making sure a "locked" record really can't be edited |

## Day 6 — Wed Aug 27 — Full run-through and getting ready to switch on

| Ticket | Owner | What to build |
|---|---|---|
| RD-119 | Both, together | Click through the entire app as each type of user (BDA, Sales, Recruiter, Admin) from start to finish. Write down every bug hit, fix them before the day ends. |
| RD-120 | Dev A | Get the automatic build-check (CI) to actually build and start the Docker containers and test that login works — not just check for typos like it does now |
| RD-121 | Dev B | Decide exactly how the live server deployment will work and get it fully set up and ready, so Aug 28 is "press go," not "figure it out" |

## Day 7 — Thu Aug 28 — DEPLOY DAY

| Ticket | Owner | What to build |
|---|---|---|
| RD-122 | Both, together | One last check that everything still works, then deploy to the real server. Test login and a few key actions on the actual live site. Create real accounts for the team. Stay available for anything urgent. |

---

## Rules for the week

- **No new features on Aug 28.** If it's not done and tested by end of Aug 27, it waits for the next release.
- If a ticket runs long, the other developer helps rather than starting new work — better to finish Day N's tickets a bit late than to start Day N+1 short-handed going into deploy day.
- Update [PROGRESS.md](PROGRESS.md) as tickets land, same as the rest of this project.
