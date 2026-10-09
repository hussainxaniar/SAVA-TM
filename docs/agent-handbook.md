# Agent handbook: how this project is built

Read this after `CLAUDE.md` and before touching anything. It is the working knowledge from building tickets T-01 to T-21:
roles, the ticket loop, how to dispatch the GLM implementer, how to review and test, the traps that already cost time, and
the rules the owner set. `docs/blueprint.md` stays the single source of truth for *what* to build; this file is *how*.

If something here contradicts the blueprint, the blueprint wins; tell the owner and fix this file.

**Also read [orchestrator-decisions.md](orchestrator-decisions.md)**: every decision the orchestrator made so far, with the reason (process, delegation, product/design, architecture, infrastructure, deviations from the blueprint, open items, mistakes not to repeat). It is the record a new agent needs to carry on exactly as it was being run.

## 1. Who does what

| Role | Model | Does |
| --- | --- | --- |
| **Architect / Orchestrator** | Claude (Opus or Sonnet, the owner's subscription / credit) | Schema and migrations, services, server actions, hooks and pure logic (parsers, grouping, drag maths, autosave), tests for all of that, ticket writing, dispatching, **reviewing every diff**, browser QA, docs and progress records, git. |
| **Implementer** | **GLM 5.3 Flash** via OpenRouter (`z-ai/glm-5.3-flash`) | UI components, pages and wiring over finished hooks and services. **The default for every implementer ticket.** |
| Escalation | GLM 5.3 (`z-ai/glm-5.3`) | Only when Flash fails review twice on the same ticket, or the ticket records why Flash isn't enough. |

The owner wants credit spent carefully: the Architect keeps its own part **light** and delegates UI work to Flash. Do not
write UI the implementer could write, unless it is a few lines of review fixing.

Split of a typical "A + I" ticket: the Architect writes the service, action, schema, hook and tests, then a ticket file with
exact instructions; Flash builds the screen on top. Anything with real logic (conflict handling, drag maths, cache patches)
belongs to the Architect, written as a tested pure function or hook, never left for Flash to invent.

## 2. The ticket loop

0. Pick the task in Sava TM and set it In progress (section 2a).
1. Read `docs/progress.md` (state of all tickets) and the ticket's blueprint sections (Section 12 lists them).
2. **Architect part first**: services, actions, hooks, helpers, tests. Run `pnpm typecheck && pnpm lint && pnpm test`. Commit.
3. **Write the handoff** `docs/tickets/T-XX.md` (template below). For big UIs write several small tickets
   (`T-XX-part.md`), see section 4 for why.
4. **Dispatch to Flash** (section 3). It edits files and runs the three checks; it must not commit.
5. **Review the diff yourself** (section 5). Fix small things directly; re-dispatch only for big misses.
6. **Browser QA** the real behavior (section 6). Unit tests do not catch UI bugs.
7. **Record**: tick the acceptance boxes and add a "Completion record" to the ticket (models used, what review fixed, QA results),
   set the row in `docs/progress.md` (state ✅ and the commit), commit.
8. **Stop and report** to the owner: what changed, what they can do now, what was fixed in review, what's next. Don't start the next
   ticket without their go-ahead unless they said "move on" / "start T-xx". **Never push unless told to** ("push").

Report style the owner likes: plain language, what *they* can now do, honest about what wasn't verified, no jargon walls.

### 2a. Tasks live in Sava TM, details live in the repository (since 2026-10-09)

The owner tracks this project's own work in the app they are building: project **SAVA TM** on `https://tm.sava.af` (lists: Weekly Tasks,
Features, Test & Debug). The `sava` MCP server (tools `whoami`, `list_projects`, `list_tasks`, `get_my_tasks`, `get_task`, `create_task`,
`update_task`, `set_task_status`, `assign_task`, `add_comment`, `quick_add`, `list_members`) reads and writes it as the owner, and every change
shows "via AI". The two places have different jobs:

| Sava TM (tm.sava.af) | Repository (`docs/`) |
| --- | --- |
| What to work on, in what order (priority, status, due date, subtasks, assignee) | How it was built: the ticket (`docs/tickets/I-xx-*.md` or `T-xx*.md`), `progress.md`, decisions |
| The owner's own words (task descriptions, comments) | Architecture, acceptance checklist, review fixes, QA results, what was not verified |

Loop additions:

1. **Start**: `list_projects` (status ids differ per project; never hard-code them) and `list_tasks` for the SAVA TM lists; pick the task by
   priority and status (Urgent/High, then due date). Read it with `get_task` (the description is plain text: **images in descriptions are not
   returned**, ask the owner for the content). Set it **In progress**.
2. **Ticket**: create `docs/tickets/I-xx-<slug>.md` (follow-ups and bugs) or `T-xx` (planned build tickets) quoting the owner's task text, then
   build as in the loop above. Put the Sava TM task title in the ticket header so both sides can be matched.
3. **Finish**: set the task (and its subtasks) to **Review**, add one comment with the commit, the ticket path, the checks and what is not
   verified. The owner moves it to **Done** (or asks you to, after pushing). Subtasks you create to split work are marked Done when done.
4. **New work you discover** (a bug, a follow-up) becomes a new task in the right SAVA TM list instead of staying only in chat or a TODO.
5. **The full task workflow (lists, statuses incl. Hold and Canceled, what to write in descriptions and comments, planning, reporting) is the skill
   `.claude/skills/task-management/SKILL.md`; it is the single source for those rules. Follow it and keep this section to the repository side.**
6. If the MCP is unreachable or the token is missing, say so and continue from `docs/progress.md`; do not invent task state.

### Ticket template (the handoff)

```
# T-XX · Title
**Model:** I (GLM 5.3 Flash) · **Sections:** blueprint refs · **Design:** docs/design/*.jsx.txt files

> Do not open image files (.jpg/.png): the implementer cannot read images and the session fails.

## Architect part (done)   <- what already exists: services, hooks, helpers, with exact names and signatures
## Implementer handoff
    Ticket / Read: / Files to touch: / Files you may read: / Do not touch: prisma/, src/server/, ...
## What to build           <- numbered, concrete: components, props, behaviors, class names and sizes from the design
## Acceptance              <- checkboxes, ending with: pnpm typecheck && pnpm lint && pnpm test pass with no warnings
```

Write tickets like specs for a careful junior: exact hook names and call shapes, which existing components to reuse, which
files may be touched, and the pitfalls from section 7 that apply. Vague tickets produce vague UI.

## 3. Dispatching GLM Flash

```sh
scripts/dispatch-ticket.sh <ticket-id> z-ai/glm-5.3-flash -- \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash(pnpm typecheck),Bash(pnpm lint),Bash(pnpm test),Bash(git diff:*),Bash(git status)"
```

- The script reads `docs/tickets/<id>.md`, appends a footer (run checks once in the foreground, never `git stash/commit/checkout`,
  **never open images**), clears inherited `CLAUDE*` env vars, and runs the OpenRouter-backed CLI (the key comes from
  `APIKEY-SavaTM` in `.env`; see `docs/model-routing.md`). Never use `--dangerously-skip-permissions` without asking the owner.
- It needs the Postgres container for tests (`pnpm db:up`). **Two test runs at once reset the same database and fail each
  other**, so dispatch sequentially, never in parallel.
- **Long runs must be detached.** The orchestrator session kills background commands at a time limit (about 10 min), which has
  stopped dispatches before they wrote anything. Run them with `nohup ... & disown`, write a `.done` marker file when the
  command exits, and poll with a bounded `until` loop (<10 min per tool call). `scripts/run-batch.sh <log-dir> <ticket>...`
  does exactly this for several tickets in a row and commits after each one.
  Don't chain a dispatch after a long test run in one command; run them separately.
- Check it's alive with `ps -eo pid,etime,command | grep claude`. A fresh dispatch can show no file changes for 5 to 10 minutes.
- If a dispatch dies: look at its log (`grep -v "connectors are disabled\|isn't described\|unrecognized_model"`), `git status` to see
  what it left, and re-dispatch with a "Resuming" note at the top of the ticket pointing at the leftover files.

### Failure modes seen so far (and the fix)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `API Error: 402` | OpenRouter credits ran out | The owner tops up; re-dispatch |
| `API Error: 400 No endpoints found that support image input` | It opened a `.jpg` | Tickets point only at `.jsx.txt` exports; footer forbids images |
| `exceeded the 32000 output token maximum` | One reply (a whole big file) was too long | Split the ticket: one file per Write, files under ~250 lines |
| Stopped with no changes | Background time limit | Run detached (above) |
| Asks permission forever / forwards prompts | Inherited `CLAUDE*` env | The script already clears them; keep it |
| Two runs corrupt tests | Parallel dispatch | Sequential only |
| Lint "Cannot update ref during render", set-state-in-effect | React 19 lint rules | Move ref writes to effects; derive state during render |

Flash is good at: wiring components to existing hooks, matching nearby code, Base UI menus and dialogs, following a precise spec.
It is weak at: inventing cache/optimistic logic, event-bubbling subtleties, and very large single files.

## 4. Reviewing what comes back

Always, before accepting: `git status`, read the **whole** diff, then `pnpm typecheck && pnpm lint && pnpm test`.

- It touched only the files the ticket allows (never `prisma/`, `src/server/`, `src/lib/` unless the ticket says so).
- No hand-drawn SVG icons (Tabler only, plus the two Paper glyphs), no hex colors in components (theme tokens), no
  Prisma in components (everything goes through services via actions).
- The UI uses the **existing hooks** instead of calling actions ad hoc.

### Bug classes that keep recurring (check for each)

1. **Portaled menus/dialogs bubble events to the parent row.** React bubbles events through portals, so a menu click can navigate
   the row or start a drag, and a space typed in a picker can start a keyboard drag. Fix: stop `click`, `pointerdown`, `keydown` at
   the menu/picker boundary (`onClick={(e) => e.stopPropagation()}` on the content or its wrapper). Exception: FullCalendar listens
   natively above React; don't native-`stopPropagation` there (it also kills React's own handling); guard in `eventClick` instead.
2. **Editors read their content once.** Tiptap `content` is applied on mount only; remount with a `key` when content changes
   from outside (edited comment, Reload after a conflict).
3. **`undefined` inside JSON sent to a server action** arrives as a client reference and crashes Prisma
   ("Cannot access toStringTag"). Round-trip with `JSON.parse(JSON.stringify(x))` before sending editor JSON.
4. **Focus**: dialogs should take initial focus on the dialog box (not the first button); inline editors need autofocus so `Esc`
   doesn't close the whole dialog; `Esc` in inline inputs must `stopPropagation`.
5. **Escape/blur double-commit**: after an `Esc` revert, the blur commits the discarded text; use a "cancelled" ref.
6. **Missing React `key`s** in mapped fragments/pickers (console warnings count as failures).
7. **State-clearing**: Tiptap `clearContent()` needs `emitUpdate = true` to trigger update listeners (e.g. hide a Send button).
8. **Hydration**: dnd-kit needs `DndContext id={useId()}`; portals need a hydration gate; no `Date.now()`/random in render.
9. **Date-only values** are UTC midnight of the calendar day; timed values are instants shown locally. Always go through the
   helpers in `src/lib/list-view.ts` (`dateOnlyFromLocal`, `withLocalTime`, `formatDue`, `daysUntilDue`).
10. **Drag from anywhere** on rows (4px activation distance) is the owner's rule: no visible drag handles.

## 5. Browser QA (the part tests don't cover)

Every UI ticket is verified in a real browser by the Architect. Recipe:

- Dev server: `pnpm dev` (port 3000) against the local Docker Postgres (`pnpm db:up`). Start it **detached**
  (`nohup pnpm dev > /tmp/sava-dev.log 2>&1 < /dev/null & disown`); an attached background server dies at the session time limit.
- Playwright with the installed Chrome: `chromium.launch({ channel: "chrome" })` from `@playwright/test`
  (already a dependency). Use a fresh `browser.newContext()` per user. Run scripts with `npx tsx file.mts`
  (use `.mts`; top-level await). Pass `page.evaluate` code as strings if you need it.
- Sign in as the **seed users** (`prisma/seed.ts`): `ada@sava.test` (Owner) and `ben@sava.test` (Member), password `password123`, space
  "Sava Team". **Never mutate or sign out the owner's own account/space** ("Xaniar" / hussainxaniar@gmail.com); only read-only
  checks in their browser.
- Create a throwaway **"QA …" project** through the services (a small `.mts` script using `src/server/services/*` with
  `DATABASE_URL` set from `.env` via `grep`, see section 6), run the checks, then delete everything whose project name starts
  with `QA ` (activity, time blocks, comments, links, tasks by depth 2,1,0, then the project) and remove the script folder.
- Check behavior, not just presence: reload to prove persistence, test keyboard paths, check console errors (`page.on("console")`),
  take screenshots to a scratch folder and **look at them** against the design. Real mouse drags: `mouse.move/down/move(steps)/up`.
- Selectors that bit us: toasts also contain the task title (look at rows, not page text); popover/menu content is portaled
  (query the page, not the row); FullCalendar slots have `data-date`/`data-time`.
- Things only a human can verify (record them as "awaiting the owner"): a real Google consent, the owner's own Google account.

## 6. Environment, secrets, git

- Stack: Next.js 16 (App Router, Turbopack; `proxy.ts` replaces `middleware.ts`; async `params`/`searchParams`),
  React 19, Prisma 6 + Postgres, Better Auth, TanStack Query 5, Tailwind v4 + shadcn **Base UI** variants (`render=` instead of
  `asChild`, `closeOnClick` on radio items, `Select` needs `items`, `AlertDialogAction` does not auto-close), Tiptap 2,
  dnd-kit core+sortable (no `@dnd-kit/utilities`), FullCalendar 6, googleapis, Tabler icons. Read the Next docs in
  `node_modules/next/dist/docs/` before relying on memory (`CLAUDE.md` says so).
- `.env` (git-ignored) holds the OpenRouter key (`APIKEY-SavaTM`), `DATABASE_URL`/`DIRECT_URL`/`TEST_DATABASE_URL`, `AUTH_SECRET`,
  `APP_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`. **Never print, source or commit it.**
  Do not `source .env` in the shell (a parse error echoes the key). Read single values with
  `grep -m1 '^NAME=' .env | cut -d= -f2- | tr -d '"'`, and check shape (length, suffix) instead of printing.
  Don't paste secrets into chat; the owner generates production values themselves.
- Local DB: Docker `sava-postgres` (`pnpm db:up`), databases `sava_dev` and `sava_test`; tests (`pnpm test`, ~10 s) use
  `TEST_DATABASE_URL`. `resetDb` refuses the `public` schema unless that is set. Schema changes: edit `prisma/schema.prisma`,
  `npx prisma migrate dev --name <what>`; Vercel runs `prisma migrate deploy` in `pnpm build:vercel`.
- Git: work on `main`, small commits with the attribution trailer the session specifies. **Push only when the owner says "push"**
  (Vercel auto-deploys `main`). Commit architect and implementer parts separately where possible. Don't use `git stash`, `reset --hard`
  or force pushes.
- Tests: services get real-database tests (`tests/services`), pure logic gets unit tests (`tests/lib`). Google is always faked:
  `googleApi` in `src/server/google/api.ts` is the only module that touches Google, and tests `vi.spyOn` its methods.
- `docs/questions.md` is where schema/contract questions go when a ticket needs something outside its scope.

## 7. Architecture rules that matter

- Layers: UI -> server action (`action(schema, handler)` returns `ActionResult`) -> service (guards first, Activity row in the same
  transaction for task changes) -> Prisma. Components never call Prisma or services directly.
- Every mutation service starts with `requireMember` / `requireRole`. A non-member gets `NOT_FOUND`, a too-low role `FORBIDDEN`.
- Side effects to third parties (Google) run **after** the DB commit, never inside a transaction, and failures become `ERROR` state
  with Retry, never rolled-back user edits.
- Optimistic UI: every mutation hook patches the TanStack Query cache immediately, rolls back with an error toast, and
  invalidates on settle. Query keys: `['tasks', listId]`, `['task', taskId]` (+ `'feed'`), `['my-tasks', spaceId]`,
  `['calendar', spaceId, …]`, `['doc', docId, …]`. Task edits invalidate lists, task details and My Tasks.
- Ordering uses fractional-indexing positions (`src/lib/position.ts`); services take `beforeId`/`afterId` (`afterId` = item now
  below, `beforeId` = item now above).
- Activity is append-only and structured; the browser formats sentences (`src/lib/activity-format.ts`) so dates read in the viewer's
  time zone.
- Docs: `savePage` is last-write-wins with a conditional update on `updatedAt` (conflict banner, Overwrite, Reload).

## 8. Design rules from the owner

The Paper file "SAVA TM" is the visual source of truth; exports live in `docs/design/` (`.jsx.txt` code exports; images are for
humans only). Paper MCP tools may be unavailable; they are read-only anyway. When design and blueprint disagree, the design wins.

- A task's circle is a **status menu** (ClickUp-style), not a checkbox.
- **Drag from anywhere** on rows/items; never visible drag handles. Dropping a row on a sidebar list moves it, `Alt` adds it.
- Icons: **Tabler** everywhere. Exceptions are SVGs from the Paper "Icons" page: task status glyphs and the subtask glyph
  (`docs/design/icons.md`). In-progress statuses may choose circle / ¼ / ½ / ¾; To do is always the dashed circle, Done the check.
- Match sizes, spacing and colors pixel-exactly; use theme tokens (`globals.css`), never hex in components. Dark mode must work.
- The owner reviews visually and will notice small misalignments.
- No attachments/paperclip in v1 (images inside text are allowed, stored in the `Image` table, max 4 MB).

## 9. Current state (update this when it changes)

- Done and committed: T-01 to T-23 plus the follow-up improvements I-01 to I-04 (images in docs and descriptions with resize,
  rich-text task descriptions, "New list" and list icons, status icon picker with the status's own color) and wider dropdown menus.
- T-21 (shortcuts, empty/loading/error states, responsive shell) is done: the Flash output was reviewed, fixed and browser-tested on 2026-10-08.
  T-22 is done too (Playwright smoke suite; production live on Hetzner at tm.sava.af). T-23 (API tokens + MCP, blueprint Section 15) is built; it needs a push and a real-client check on tm.sava.af.
- T-18 (Google connect and push) and T-19 (pull) are built and tested with Google faked, **awaiting a real consent test by the owner**
  (OAuth client configured locally; Vercel env names must be `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`ENCRYPTION_KEY`; redirect URIs
  `…/api/auth/callback/google` and `…/api/google/callback` per domain; a consent screen in Testing needs test users).
- T-22 is done: `pnpm e2e` runs the nine smoke flows locally; production is on Hetzner (`https://tm.sava.af`, redeploys when `main` is pushed) and the team uses it daily. Open item: database backups (postponed by the owner, see blueprint 13.5).
- Not pushed: check `git log origin/main..HEAD`; the owner pushes by saying so. Migrations added since the last push:
  `20261009012006_notifications` (I-06; the production deploy applies it; additive).
- Added 2026-10-09: I-05 (activity feed) and I-06 (in-app notifications, blueprint Section 16) are pushed; I-07 (calendar rail keeps scheduled tasks) is built and tested locally, awaiting "push".
- `pnpm e2e` runs 11 smoke flows against the local dev server (restart it first if the Prisma schema changed: a stale server holds the old client). When a UI change alters a default (like I-05's Comments-first), update the flow that relied on it.
- The authoritative status table is `docs/progress.md`; per-ticket records are in `docs/tickets/`.

## 10. Running this in a different environment (cloud session, new machine)

Things that do not travel with the repo and must be set up first:

1. **`.env`** with the values in section 6 (the OpenRouter key for dispatching; local/test database URLs).
2. **Postgres**: `pnpm db:up` needs Docker; without it point `DATABASE_URL`/`TEST_DATABASE_URL` at any reachable Postgres 17
   (separate schemas/databases for dev and test) and run `pnpm db:migrate:deploy` and `pnpm db:seed`.
3. **The implementer CLI**: `scripts/dispatch-ticket.sh` falls back to the OpenRouter setup from `.env` when the `claude-or` shell
   function is missing; it needs the `claude` CLI on the machine and OpenRouter credits.
4. **Browser QA** needs Chrome or Playwright's Chromium (`npx playwright install chromium`, then drop `channel: "chrome"`).
5. **Paper** (designs) is only reachable on the owner's Mac; use the saved exports in `docs/design/`.
6. **Orchestrator memory** is not in the repo; this handbook, `docs/progress.md` and the ticket records are the shared memory.
   Keep them current at the end of every ticket.
7. Push policy still applies: the owner decides when `main` is pushed.
