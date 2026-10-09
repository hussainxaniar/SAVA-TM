# Build progress

Single-glance status for all 22 tickets. Update this file and the matching
`docs/tickets/T-XX.md` whenever a ticket changes state.

| ID | Title | Model | State | Commit |
|----|-------|-------|-------|--------|
| T-01 | Scaffold, tooling, deploy | A | ✅ done | ff03725 |
| T-02 | Schema, migration, seed, position helper | A | ✅ done | 2795b93 |
| T-03 | Auth and guards | A | ✅ done | c58af5a |
| T-04 | Spaces and onboarding | A + I | ✅ done | 80e0a5e |
| T-05 | Members and invite links | A + I | ✅ done | faf7831 |
| T-06 | Projects and sidebar | I | ✅ done | 37f97e1 |
| T-07 | Statuses and lists settings | A + I | ✅ done | 4225c41 |
| T-08 | Task services core | A | ✅ done | dd513d9 |
| T-09 | List view | I | ✅ done | 93ba0f7 |
| T-10 | Quick add and parser | I | ✅ done | b967520 |
| T-11 | Task dialog shell | I | ✅ done | c3beaf7 |
| T-12 | Subtasks and display modes | A + I | ✅ done | ccbc509 |
| T-13 | Move and add-to-list | A + I | ✅ done | 07df9a0 |
| T-14 | Assignees, dates, priority | I | ✅ done | 48e7deb |
| T-15 | Comments and activity feed | A + I | ✅ done | bf7cb9e |
| T-16 | My Tasks | I | ✅ done | 7a9b5a2 |
| T-17 | Calendar and time blocks (local) | A + I | ✅ done | fb9fd9e |
| T-18 | Google connect and push | A | 🔄 built, awaiting a real Google test | 470304e |
| T-19 | Google pull and reconciliation | A | 🔄 built, awaiting a real Google test | 979b2a9 |
| T-20 | Docs and pages | A + I | ✅ done | 6349768 |
| T-21 | Polish: shortcuts, empty states, responsive | I | ✅ done (Flash output reviewed, 5 review fixes, browser-tested) | see git log |
| T-22 | E2E tests and production release | A + I | ✅ done (smoke suite `pnpm e2e` passes locally; production live at tm.sava.af and in daily use; blueprint 13.5 updated). **Open item: database backups (postponed by the owner, 2026-10-08)** | see git log |
| T-23 | API tokens and MCP server (added after v1, blueprint Section 15) | A + I | ✅ built and tested locally; **awaiting push + a real client check on tm.sava.af** (`docs/tickets/T-23.md`) | see git log |

Follow-up improvements (2026-10-02, requested by the owner; all built, reviewed and browser-tested):

| ID | What | Ticket | State |
|----|------|--------|-------|
| I-01 | Images in docs: paste/drop/toolbar upload, resizable | `docs/tickets/I-01-images.md` | ✅ |
| I-02 | Rich-text task descriptions (selection toolbar, checklists, links, images) | `I-02-description.md` | ✅ |
| I-03 | "New list" in the project menu; list icons (24 Tabler keys) | `I-03-lists.md` | ✅ |
| I-04 | In-progress statuses choose their icon (circle, ¼, ½, ¾); icons use the status color | `I-04-status-icons.md` | ✅ |
| — | Wider dropdown menus (labels never wrap) | (Architect, `ui/dropdown-menu.tsx`) | ✅ |

Work tracked on tm.sava.af (project SAVA TM; the owner's own tasks, planned 2026-10-09; order: I-05, Notification, calendar sidebar bug, list rename bug, AI MCP documents, table columns):

| ID | What | Ticket | State |
|----|------|--------|-------|
| I-05 | Activity logs: no subtask lines on the parent, no avatars on activity, Comments first when there are comments | `I-05-activity-logs.md` | ✅ built, browser-tested, pushed |
| I-06 | In-app notifications: bell with unread badge, list, mark read (blueprint Section 16; new `Notification` table, migration `20261009012006_notifications`) | `I-06-notifications.md` | ✅ built, browser-tested, pushed (2026-10-09; the deploy applies the migration) |
| I-07 | Calendar: scheduled tasks stay in the left rail ("My tasks") with their next slot, so they can take more slots | `I-07-calendar-rail.md` | ✅ built, browser-tested, e2e 11/11 locally; not pushed |

Notes:
- Google OAuth client configured locally (2026-10-01); T-18 built and tested with Google faked; a real consent test by the human is pending.
- Local development and tests use Postgres in Docker (`pnpm db:up`, docker-compose.yml); the full test suite runs in ~10 s.
- Deploys: Vercel builds `main` with `pnpm build:vercel` (vercel.json) = `prisma migrate deploy && next build`.

States: ⬜ pending · 🔄 in progress · ✅ done · ❌ blocked
