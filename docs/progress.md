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
| T-20 | Docs and pages | A + I | ⬜ pending | — |
| T-21 | Polish: shortcuts, empty states, responsive | I | ⬜ pending | — |
| T-22 | E2E tests and production release | A + I | ⬜ pending | — |

Notes:
- Google OAuth client configured locally (2026-10-01); T-18 built and tested with Google faked; a real consent test by the human is pending.
- Local development and tests use Postgres in Docker (`pnpm db:up`, docker-compose.yml); the full test suite runs in ~10 s.
- Deploys: Vercel builds `main` with `pnpm build:vercel` (vercel.json) = `prisma migrate deploy && next build`.

States: ⬜ pending · 🔄 in progress · ✅ done · ❌ blocked
