# Agent instructions — Sava TM (Sava Task Manager)

The single source of truth for this project is [docs/blueprint.md](docs/blueprint.md). Read it before doing anything else. When code and the blueprint disagree, the blueprint wins until a human updates it.

**Build progress:** check [docs/progress.md](docs/progress.md) to see which tickets are done and which is next. Update it and the matching `docs/tickets/T-XX.md` when you finish a ticket.

**Tasks are managed in Sava TM itself** (project "SAVA TM" on tm.sava.af, through the `sava` MCP server; the token is in the user's Claude config). Find work there (`list_projects` for list and status ids, then `list_tasks` / `get_my_tasks`), move a task to In progress when you start it and to Review when it is built and committed, and describe what you did in a comment. Every task you work on is also recorded as a ticket in `docs/tickets/` (see [docs/agent-handbook.md](docs/agent-handbook.md) section 2a). Never mark a task Done without the owner's OK.

**Orchestrators and implementers: read [docs/agent-handbook.md](docs/agent-handbook.md)** (the ticket loop, how to dispatch GLM Flash, review checklist, browser QA recipe, rules and pitfalls learned so far) and **[docs/orchestrator-decisions.md](docs/orchestrator-decisions.md)** (every orchestrator decision so far, with its reason).

See [docs/model-routing.md](docs/model-routing.md) for how to switch between `claude` (Opus, architecture/review) and `claude-or` (OpenRouter implementer models), and [docs/orchestration.md](docs/orchestration.md) for how an Opus session dispatches individual tickets to a GLM implementer session.

## Model roles

| Role | Model | Owns |
| --- | --- | --- |
| Architect | Opus 5.5 (or Opus 5) | Schema, service contracts, permissions, Google sync, ticket writing, reviewing every diff under `src/server/` |
| Implementer | GLM 5.3 Flash via OpenRouter (`claude-or z-ai/glm-5.3-flash`) by default for every implementer ticket; GLM 5.3 via OpenRouter (`claude-or z-ai/glm-5.3`) only after Flash fails review twice or with a reason recorded in the ticket (docs/orchestration.md) | UI components, pages, server actions that call existing services, seed data, tests |
| Reviewer | Opus 5.5 | Diffs touching `src/server/`, `prisma/`, `auth` before merge |

## Rules for every agent session

1. Work on exactly one ticket from `docs/blueprint.md` Section 12. Read only the blueprint sections the ticket lists plus the files it names.
2. Never change `prisma/schema.prisma` or anything in `src/server/services/` unless the ticket says so. If a schema or contract change seems needed, stop and write a note in `docs/questions.md`.
3. Never call Prisma from components, pages or route handlers. All data access goes through `src/server/services/*`.
4. Every mutation service calls `requireMember` (or `requireRole`) first and writes an `Activity` row inside the same transaction when the entity is a task.
5. Use existing shadcn/ui components before writing new primitives. No new dependencies without the ticket allowing it.
6. Finish by running `pnpm typecheck && pnpm lint && pnpm test`. A ticket is not done while any of these fail.
7. Do not build anything listed as a non-goal in Section 1.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
