# Orchestrator decision record

Every significant decision made while orchestrating Sava TM (T-01 to T-21 and the follow-up improvements), with the reason, so a
new agent can continue the job the way it was being run. [agent-handbook.md](agent-handbook.md) says *how* to work; this file says
*what was decided and why*. When a decision here is superseded, edit it in place and note the date; don't leave contradictions.

Sources of truth, in priority order: the owner's latest instruction, `docs/blueprint.md`, the Paper designs (`docs/design/`),
then this record. The owner (Hussain Xaniar, hussainxaniar@gmail.com; teammates in Brazil and Afghanistan) is not a developer by
trade: explain outcomes plainly, say what they can now *do*, and be honest about what wasn't verified.

## 1. How the job is run (standing instructions from the owner)

1. **One ticket per check-in.** Finish a ticket, report what changed and what's next, and wait for the go-ahead ("move on",
   "start T-xx"). Do not chain tickets on your own.
2. **Never push unless told.** Pushing triggers a Vercel deploy. Local commits are fine and expected; the owner says "push".
3. **Architect work stays light; delegate UI to GLM 5.3 Flash** (decided 2026-09-30, then re-emphasised 2026-10-02 to save credit).
   The flagship GLM 5.3 only after Flash fails review twice or with a reason recorded in the ticket.
4. **Credits matter.** The owner has run out of subscription limit and OpenRouter credit at times. Prefer: small tickets, one
   test run, no wasted re-dispatches, short reports. If a call returns a credit error, say so and wait.
5. **Update the blueprint when the owner's design/decision changes** ("Update anywhere in blueprint to match the design"). The
   blueprint is meant to describe the product as it should be; code and blueprint should not drift.
6. **Stop and say so when blocked** on something only the human can do (real Google consent, Vercel env, Google Cloud console).
   Give them exact steps; never ask for secrets in chat.
7. **Tell the truth in reports**: what failed, what you fixed in review, what you did not verify.

## 2. Decisions about the process and delegation

| Decision | Why |
| --- | --- |
| Opus/Sonnet is Architect + reviewer; GLM Flash implements UI | Matches blueprint Section 2; cheaper; the Architect keeps control of data and logic |
| Dispatch by running the CLI as a subprocess (`scripts/dispatch-ticket.sh`), not built-in subagents | Built-in subagents inherit the parent's backend; OpenRouter models need their own process (`docs/orchestration.md`) |
| Permission mode `acceptEdits` + an allowlist (read/edit/write/search + the three checks + `git diff/status`) | Unattended runs need edits, but no arbitrary shell; `--dangerously-skip-permissions` only with the owner's explicit OK |
| Dispatch script clears inherited `CLAUDE*` env vars and drops the `--` separator | Without that, flags were ignored and the child forwarded permission prompts to a session nobody answers |
| Footer forbids git stash/commit/checkout, parallel test runs, and opening images | GLM tried `git stash`, ran tests concurrently (they reset the same DB and failed), and crashed on a `.jpg` (it cannot read images) |
| Tickets point to `.jsx.txt` design exports only | Same reason: the implementer model can't read images; the exports have exact sizes/colors |
| Dispatches run **detached** (`nohup`, done markers, bounded polling) | The orchestrator session kills background commands at ~10 minutes; several dispatches were stopped before writing anything |
| Big UIs are split into small tickets (one file per Write, files < ~250 lines) | Flash hit the 32,000-token output cap on a calendar page; splitting worked every time |
| Architect writes logic as tested pure functions/hooks first (parser, grouping, drag maths `projectDrop`, autosave, cache patches) | Flash is weak at inventing cache/optimistic/conflict logic; tests make the Architect's part safe |
| The Architect reviews every diff and browser-tests every UI ticket | Unit tests missed real bugs (menu not opening, content not saving, delete dialog never showing) |
| Review fixes are done directly by the Architect when small; re-dispatch only for big misses | Cheaper and faster than a round trip to the implementer |
| Implementer sessions never commit; the Architect (or `run-batch.sh`) commits | Keeps history clean and lets the Architect review first |
| Sequential dispatches only | Shared test database |
| Records: ticket "Completion record", `docs/progress.md`, memory notes after each ticket | So the next agent (or a new session after compaction) knows state without re-deriving it |

Heuristics for **handling a request from the owner**:
- Feature or fix request: find the smallest correct design, do the data/logic part yourself, write a ticket, dispatch, review, QA, record.
- A question ("is X possible?", "where do I add test users?"): answer it directly and plainly; don't start building.
- They report a bug in their own browser: reproduce it in a fresh Playwright context first (never use their session), read the dev
  server log (`/tmp/sava-dev.log`), find the root cause, fix, add a test if logic, verify, then tell them what it was.
- Ambiguity with a conventional default: pick the default, mention it. Ask only when the answer changes what you build.
- Anything outward-facing or hard to reverse (push, deleting data, sending secrets anywhere): confirm unless they already said to.

## 3. Product and design decisions (owner-driven)

- **Task dialog, not a slide-over panel.** The owner designed a centred 1080x780 modal in Paper; the blueprint was rewritten around
  it (principle: one sidebar, one main view, one task dialog; `?task=<id>` in the URL; ↑/↓ steps through the list).
- **A task's circle is a status menu** (ClickUp-style: choose any status), not a Todoist checkbox. "Complete/Reopen" still exist in the
  row menu. Choosing a DONE status for a task with open subtasks asks "Also complete N open subtasks?".
- **List view is grouped by status** with collapsible pills; DONE groups start collapsed. Priority is a filled flag (P1 red, P2 orange,
  P3 blue), not the circle's color.
- **Drag from anywhere** on rows (list rows, sidebar projects, settings rows), 4px activation, no handles. Dropping a task row on a sidebar
  list *moves* it; `Alt` while dropping *adds* it as a linked task.
- **Sidebar matches the design pixel-for-pixel** (project row positions were measured against the Paper export and fixed once the grip
  handle was removed).
- **Icons**: first lucide, then (2026-09-30/10-01) **Tabler** (filled variants, line weights, large set). Exceptions come from the Paper
  "Icons" page: the six task-status glyphs and the subtask glyph. Priority uses Tabler's filled flag. See `docs/design/icons.md`.
  Status glyph rule: To do = dashed circle (first), later To do = empty circle; In progress = circle / ¼ / ½ / ¾ (**choosable per status**
  since 2026-10-02; null falls back to "by position"); Done = filled check.
- **No attachments/paperclip in v1.** Images *inside text* (descriptions, docs) are allowed (decided 2026-10-02) and stored in Postgres.
- **Rich text everywhere text matters**: task descriptions (same editor features and selection toolbar as docs, checklists, links,
  resizable images), comments (basic marks), docs.
- **Quick add** (`q`, sidebar "Add task"): parser tokens are natural dates (chrono-node), `p1-p4`, `@member`, `#list`. Rules: tokens only at
  word starts and only when they resolve; the first date/priority/list wins; a date must name a day/weekday/time (bare "March" and "now" don't
  count); a preposition before a date (`by`, `on`, `at`, `due`, `before`) is removed with it; each chip's × keeps the token as text.
- **Calendar**: FullCalendar, week default (Monday first), user's browser time zone sent with every write; blocks per user; date-only dues
  appear as all-day chips; Unscheduled rail; drop = 60-minute block (09:00 when dropped on a whole day).
- **Google Calendar**: one OAuth client for sign-in and calendar; scope `calendar.events` only (one permission covers read and write);
  `access_type=offline`, `prompt=consent`; tokens encrypted (AES-256-GCM, `ENCRYPTION_KEY`); signed state (HMAC, 10 min). Blocks are pushed
  after commit and kept even if Google fails (ERROR + Retry). Pull (T-19) returns `{ events, changed }` rather than just events.
- **Docs**: pages up to three levels, drag to reorder/re-nest (horizontal drag nests), autosave 800 ms, conflict banner (Reload/Overwrite).
- **Dropdown menus are wide enough** that labels never wrap (`min-w-48`, submenus `min-w-44`, items `whitespace-nowrap`).
- **List icons** (24 curated Tabler icons stored as keys) and **"New list"** in the project's `⋯` menu, like "New doc".

## 4. Architecture and data decisions

- **Layers** UI -> server action (`action(schema, handler)`) -> service -> Prisma; guards first; Activity rows in the same transaction.
  A non-member gets NOT_FOUND (no existence leaks); a low role gets FORBIDDEN.
- **Fractional-indexing positions** (`COLLATE "C"` ordering); move services take `beforeId`/`afterId`; the client optimistic maths mirrors the server.
- **Transactions**: serializable where races matter (`serializableTransaction` retries P2034/40001/40P01); long timeouts (maxWait 15 s,
  timeout 30 s) and `connect_timeout=15&pool_timeout=20` added to `DATABASE_URL` in `db.ts` after P1001 errors on the remote DB.
- **Soft delete** for tasks with a 10-second Undo toast (restore only restores what was deleted together).
- **Subtasks**: depth max 3 levels; `setParent` was built in T-12 (not T-13, as the blueprint listed it) because "Convert to task /
  Make subtask of…" needed it; `parentCandidates` mirrors the server rules on the client.
- **Linked lists**: `TaskListLink` rows; `moveTask` only for top-level tasks; `linkedListIds` on every row; `project.lists` in list view and
  task detail DTOs so pickers never offer other projects' lists.
- **`getTask`** returns project, project lists, statuses (so the dialog needs one query); **`getMyTasks`** returns `{ tasks, statusesByProject }`.
- **Activity is structured**; the browser renders sentences so times are in the viewer's zone; `DUE_DATE_CHANGED` records `fromHasTime/toHasTime`;
  `COMMENT_ADDED` is not shown as its own feed line (the comment is the entry); deleted comments stay as "Comment deleted".
- **Comments**: authors edit own; author or Admin/Owner delete (soft).
- **Task description** autosaves 800 ms with coalesced activity (one per 10 minutes per actor).
- **Time blocks**: any number per task, per user; min 15 min, max 24 h; `retrySync`; pushes awaited inline (so the response already says
  SYNCED/ERROR); rename/delete/restore of a task follow to Google after commit.
- **`savePage`** = one conditional `updateMany` on `updatedAt` (race-safe) returning `{ conflict, updatedBy, updatedAt }`. `DocPage` has no
  `updatedBy` relation; the editor's name is looked up from `updatedById` (avoided a migration).
- **Images** live in a Postgres `Image` table (bytes), served by `/api/images/[id]` to space members with long private caching; upload limit 4 MB
  (Vercel's request cap is 4.5 MB). Chosen over a storage service to add no new provider/secrets; revisit if volume grows (Hetzner/S3 later).
- **Status/list icons** are validated string keys (`src/lib/list-icons.ts`); a status icon is only valid for ACTIVE and clears when the category changes.
- **Client state**: TanStack Query with initial data from server components; per-user UI preferences (sort, collapsed groups, selected view
  options) in `localStorage` through `useLocalStorage`.
- **Editors**: Tiptap with a JSON round-trip before every server call; remount editors by `key` when content changes externally.

## 5. Environment and infrastructure decisions

- **Local development on Docker Postgres 17** (`pnpm db:up`; `sava_dev` + `sava_test`), not the remote Neon DB: remote latency made every action 2 to 4 s
  (users are in Brazil and Afghanistan; Neon was in Ohio). Tests run in ~10 s against `TEST_DATABASE_URL`. `resetDb` refuses the `public` schema
  (an early bug truncated dev data; fixed and the seed re-run).
- **Production**: Vercel (auto-deploy `main`, `pnpm build:vercel` = migrate deploy + next build) with a hosted Postgres. A move to a **Hetzner
  (Frankfurt) server with app + DB together** is under consideration and decided at T-22.
- **Secrets**: the OpenRouter key and the Neon connection string must **not** go to Vercel. Vercel gets `DATABASE_URL`/`DIRECT_URL`, `AUTH_SECRET`
  (generated by the owner in their own terminal, different from local), `APP_URL`, `GOOGLE_*`, `ENCRYPTION_KEY`. A real Neon credential once
  sat in `.env.example`; it was replaced with a placeholder and never committed.
- **Google OAuth** was put on hold until the calendar tickets (owner's call, 2026-09-29); configured 2026-10-01. The consent screen is External/Testing
  (needs test users; calendar tokens then expire every 7 days) unless the team is on Workspace (Internal). The owner decides about publishing.
- **Auth**: Better Auth (the owner asked): email/password (min 8, no verification) + Google sign-in.
- **Dev server** must be started detached; `/tmp/sava-dev.log` is the log. Restart it when `.env` changes.

## 6. Deviations from the blueprint (all recorded in the blueprint or ticket records)

- Task dialog instead of a right slide-over (design wins); T-11 renamed "Task dialog shell".
- Status control menu instead of checkbox (6.2 rewritten); `updateTask` got `completeSubtasks`.
- `setParent` built in T-12; `getTask`/`getMyTasks`/list view DTOs extended as above.
- `listGoogleEvents` returns `{ events, changed }`; `FeedItemDTO` activity is structured (type, payload, labels).
- Integrations lives at `/s/[spaceId]/integrations`, opened from the user menu.
- Images in text added to scope; status icon choice for ACTIVE statuses; list icons; "New list".

## 7. Timeline of tickets and the notable decisions in each

(Detail is in each `docs/tickets/T-XX.md` completion record.)

- **T-01..T-03** scaffold, schema/migration/seed/position helper, auth and guards. Neon first, then moved to local Docker (above).
- **T-04..T-07** spaces/onboarding, members/invites, projects services, statuses and lists settings. Flash was used from T-04.
  Early dispatch bugs (env inheritance, flags ignored) were fixed in the script here.
- **T-08** task services core (with the soft delete/undo, ordering, activity rules).
- **T-09** list view, redone twice from the owner's Paper designs and feedback (status menu, drag anywhere, sidebar alignment, icons).
- **T-10** quick add: parser (23 tests) + dialog; owner-chosen shortcut `q`.
- **Icons switch** lucide -> Tabler; status/subtask glyphs from Paper's Icons page.
- **T-11** task dialog shell (title, status, description autosave, properties column). **T-12** subtasks, Make subtask of…, Convert to task.
  **T-13** move / add-to-list / sidebar drop (+DragOverlay). **T-14** assignees, dates, priority (date picker, popover). **T-15** comments and
  activity feed. **T-16** My Tasks. **T-17** calendar and time blocks (split into two Flash tickets). **T-18** Google connect and push.
  **T-19** Google pull. **T-20** Docs (services + drag maths + autosave by the Architect; UI in three Flash tickets).
- **I-01..I-04** (2026-10-02, a Flash batch, then reviewed and browser-tested): images in docs/descriptions, rich descriptions, New list + list icons,
  status icon picker. Review fix: the status glyph uses the status's own color, not the theme blue.
- **T-21** shortcuts / responsive / empty states: **paused by the owner (2026-10-02)**. The batch runner had already run all three Flash
  tickets; the unreviewed output was kept on branch `wip/t21-flash-output` and reverted on `main` (see `docs/tickets/T-21.md`).
- **T-22** E2E tests (Playwright) and the production release: done 2026-10-08. Production is on Hetzner (tm.sava.af); backups postponed by the owner.

## 8. Open decisions and things the owner still has to do

- Real Google consent test for T-18/T-19 (their account); add test users, or switch the consent screen to Internal; decide about publishing.
- Put `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`ENCRYPTION_KEY` on Vercel (names exact) and the production redirect URIs in Google Cloud.
- Push the unpushed commits when they say so (Vercel then redeploys; migrations run on build).
- ~~Where to host production~~ Decided: Hetzner at tm.sava.af (auto-deploys `main`). Remaining: database backups (postponed 2026-10-08).
- Cloud-session continuation was discussed and deferred ("needs a lot of rework"); see handbook section 10 for what would be required.

## 9. Mistakes to not repeat

- Starting a multi-ticket batch that includes tickets the owner hasn't approved: the runner ran T-21 to completion before I could stop it. Queue only
  approved tickets, or run them one at a time.
- Printing `.env` via `source` (a parse error echoed the OpenRouter key): read single values with `grep`, never `source`.
- Launching long commands attached to the session (killed at the time limit); chaining a dispatch after a test run in one command.
- Telling the owner a thing "works" from a unit test alone; always click through it.
- Reading portaled UI as part of its row: events bubble through portals.
- Forgetting to restart the dev server after changing `.env`, or to pass `DATABASE_URL` to one-off scripts.
- Assuming Prisma `?schema=` isolates data (it doesn't set `search_path`); name schemas explicitly.
