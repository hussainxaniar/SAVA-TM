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
| T-06 | Projects and sidebar | I | ⬜ pending | — |
| T-07 | Statuses and lists settings | A + I | ⬜ pending | — |
| T-08 | Task services core | A | ⬜ pending | — |
| T-09 | List view | I | ⬜ pending | — |
| T-10 | Quick add and parser | I | ⬜ pending | — |
| T-11 | Task panel shell | I | ⬜ pending | — |
| T-12 | Subtasks and display modes | A + I | ⬜ pending | — |
| T-13 | Move and add-to-list | A + I | ⬜ pending | — |
| T-14 | Assignees, dates, priority | I | ⬜ pending | — |
| T-15 | Comments and activity feed | A + I | ⬜ pending | — |
| T-16 | My Tasks | I | ⬜ pending | — |
| T-17 | Calendar and time blocks (local) | A + I | ⬜ pending | — |
| T-18 | Google connect and push | A | ⬜ pending | — |
| T-19 | Google pull and reconciliation | A | ⬜ pending | — |
| T-20 | Docs and pages | A + I | ⬜ pending | — |
| T-21 | Polish: shortcuts, empty states, responsive | I | ⬜ pending | — |
| T-22 | E2E tests and production release | A + I | ⬜ pending | — |

Notes:
- Google OAuth (sign-in and Calendar) is **on hold** until the calendar work (T-17/T-18); T-03's Google sign-in is wired but untested.
- Deploys: Vercel builds `main` with `pnpm build:vercel` (vercel.json) = `prisma migrate deploy && next build`.

States: ⬜ pending · 🔄 in progress · ✅ done · ❌ blocked
