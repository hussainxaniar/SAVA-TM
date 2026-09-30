# Task App — Build Blueprint v1

Sep 27, 2026 · @Xaniar

> Model setup (which command to run for architect vs. implementer): see [docs/model-routing.md](model-routing.md). For dispatching individual tickets from an Opus session to a GLM session, see [docs/orchestration.md](orchestration.md).

## 1. Purpose and scope

We are building a web task manager for our internal team in one weekend: Todoist-level simplicity with a small set of ClickUp structure (spaces, projects, lists, custom statuses, subtasks, docs, calendar). It must be clean enough to commercialize later, so multi-tenancy and permissions are built in from day one.

**Name:** Sava TM (Sava Task Manager).

### In scope (v1)

- Email/password and Google sign-in
- Spaces with multiple members and roles (Owner, Admin, Member), joined through invite links
- Projects inside a space; each project has its own customizable statuses
- Multiple lists per project
- Multiple docs per project, each with nested pages
- Tasks with nested subtasks (max depth 3): title, rich description, status, priority (P1–P4), start date, due date, assignees, comments, activity log
- Move a task to another list in the same project; add a task or subtask to additional lists in the same project
- Per-list subtask display: nested under parent, or shown separately with the parent's title above
- Calendar view: drag tasks into one or more time slots; slots sync to Google Calendar; Google events shown read-only

### Non-goals (v1)

Board/Gantt/timeline views, custom fields, time tracking, automations, recurring tasks, goals, dashboards, whiteboards, chat, email notifications, @mention notifications, real-time collaboration, mobile apps, offline mode, billing, i18n/RTL. Agents must not build any of these, even partially.

### Product principles

1. **One sidebar, one main view, one task dialog.** Tasks open in a centered task dialog over the current view (linkable via `?task=<id>`), never a new page.
2. **Fast by default.** Every mutation is optimistic. Quick add is always one keystroke away (`q`).
3. **Show less.** A task row shows only the status control, title, subtask count, assignee avatars, due date and priority flag. Everything else lives in the task dialog.
4. **Correct before clever.** Permissions and activity logging are never skipped to save time.

## 2. How AI agents use this blueprint

This document is the single source of truth. Save it in the repo as `docs/blueprint.md` and reference it from `CLAUDE.md` (or `AGENTS.md` for other harnesses). When code and blueprint disagree, the blueprint wins until a human updates it.

### Model roles

| Role | Model | Owns |
| --- | --- | --- |
| Architect | Opus 5.5 (or Opus 5) | Schema, service contracts, permissions, Google sync, ticket writing, reviewing every diff under `src/server/` |
| Implementer | GLM 5.3 Flash via OpenRouter (`claude-or z-ai/glm-5.3-flash`) for routine, high-volume UI/scaffolding work; GLM 5.3 via OpenRouter (`claude-or z-ai/glm-5.3`) for tickets needing more careful reasoning | UI components, pages, server actions that call existing services, seed data, tests |
| Reviewer | Opus 5.5 | Diffs touching `src/server/`, `prisma/`, `auth` before merge |

### Rules for every agent session

1. Work on exactly one ticket from Section 12. Read only the blueprint sections the ticket lists plus the files it names.
2. Never change `prisma/schema.prisma` or anything in `src/server/services/` unless the ticket says so. If you believe a schema or contract change is needed, stop and write a note in `docs/questions.md`.
3. Never call Prisma from components, pages or route handlers. All data access goes through `src/server/services/*`.
4. Every mutation service calls `requireMember` (or `requireRole`) first and writes an `Activity` row inside the same transaction when the entity is a task.
5. Use existing shadcn/ui components before writing new primitives. No new dependencies without the ticket allowing it.
6. Finish by running `pnpm typecheck && pnpm lint && pnpm test`. A ticket is not done while any of these fail.
7. Do not build anything listed as a non-goal in Section 1.

### Handoff template (paste into each implementer session)

```
Ticket: T-XX <title>
Read: docs/blueprint.md sections <n, n>
Files to touch: <paths>
Files you may read: <paths>
Do not touch: prisma/, src/server/services/ (unless listed above)
Acceptance criteria: <copied from ticket>
When done: run pnpm typecheck && pnpm lint && pnpm test, then summarize changed files.
```

## 3. Tech stack and repo structure

One Next.js app in one repo, deployed to Vercel with a hosted Postgres. No monorepo, no separate API, no offline layer. Pin exact versions at scaffold time (latest stable of each) and do not upgrade during the build.

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node LTS, pnpm |  |
| Framework | Next.js App Router, React 19, TypeScript strict | Server Components for reads, server actions for writes |
| Database | PostgreSQL on Neon (or Supabase Postgres) | Pooled URL for app, direct URL for migrations |
| ORM | Prisma | Migrations committed to repo |
| Auth | Better Auth with Prisma adapter | Email/password + Google OAuth |
| Validation | Zod | Every server action input is parsed |
| Client data | TanStack Query | Optimistic updates for all task mutations |
| UI | Tailwind CSS + shadcn/ui, lucide-react icons |  |
| Drag and drop | dnd-kit | Task reordering, moving between lists, sidebar |
| Rich text | Tiptap (StarterKit + Placeholder + TaskList + Link) | Task descriptions, comments, doc pages; stored as Tiptap JSON |
| Calendar | FullCalendar (daygrid, timegrid, interaction plugins) | MIT plugins only |
| Dates | date-fns, chrono-node | chrono-node parses quick-add text |
| Google API | googleapis (Calendar v3) | Server only |
| Ordering | fractional-indexing | String `position` fields; no renumbering |
| Testing | Vitest (services), Playwright (smoke) |  |
| Hosting | Vercel + Neon | Preview deploy per branch |

### Repo structure

```
/
├─ CLAUDE.md                     # points agents to docs/blueprint.md + rules
├─ docs/
│  ├─ blueprint.md               # this document
│  ├─ tickets/T-01.md …           # one file per ticket
│  └─ questions.md               # agents write open questions here
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/sign-in/page.tsx
│  │  ├─ (auth)/sign-up/page.tsx
│  │  ├─ invite/[token]/page.tsx
│  │  ├─ api/auth/[...all]/route.ts
│  │  ├─ api/google/callback/route.ts
│  │  └─ (app)/
│  │     ├─ layout.tsx          # validates the session only (no sidebar)
│  │     ├─ page.tsx            # last space, or "Create your space" onboarding
│  │     └─ s/[spaceId]/
│  │        ├─ layout.tsx                   # space shell: sidebar + task dialog host; 404 for non-members
│  │        ├─ page.tsx                     # redirect to first project's first list
│  │        ├─ settings/page.tsx            # members, invites
│  │        ├─ my-tasks/page.tsx
│  │        ├─ calendar/page.tsx
│  │        └─ p/[projectId]/
│  │           ├─ page.tsx                  # redirect to first list
│  │           ├─ settings/page.tsx         # statuses, lists
│  │           ├─ l/[listId]/page.tsx       # list view
│  │           └─ d/[docId]/[pageId]/page.tsx
│  ├─ components/
│  │  ├─ ui/                      # shadcn primitives
│  │  ├─ sidebar/
│  │  ├─ tasks/                   # TaskRow, TaskList, QuickAdd, TaskPanel…
│  │  ├─ calendar/
│  │  └─ docs/
│  ├─ proxy.ts                    # Next 16's name for middleware.ts: session-cookie redirect, last-space cookie
│  ├─ server/
│  │  ├─ db.ts                    # Prisma singleton
│  │  ├─ auth.ts                  # Better Auth config + getSessionUser()
│  │  ├─ guards.ts                # requireUser, requireMember, requireRole
│  │  ├─ services/                # ALL data access lives here
│  │  │  ├─ spaces.ts  projects.ts  statuses.ts  lists.ts
│  │  │  ├─ tasks.ts  comments.ts  activity.ts
│  │  │  ├─ docs.ts  timeblocks.ts  google-calendar.ts
│  │  └─ actions/                 # thin "use server" wrappers: zod parse → service
│  │                               #   x.ts ("use server", exports only actions) + x.schema.ts (zod schemas)
│  ├─ lib/                        # position.ts, quick-add-parser.ts, utils
│  └─ hooks/                      # TanStack Query hooks per entity
└─ tests/
   ├─ services/*.test.ts
   └─ e2e/*.spec.ts
```

## 4. Coding conventions

Three layers, strictly one direction: **UI → server action → service → Prisma**. Nothing skips a layer.

### Services (`src/server/services/*.ts`)

- Plain async functions. First argument is always `ctx: { userId: string }`, second is a typed input object.
- Services call guards themselves; they never trust the caller.
- Multi-row writes use `db.$transaction`. Task mutations write their `Activity` row in that same transaction via `logActivity(tx, …)`.
- Services return plain serializable objects (DTOs), never raw Prisma models with relations the UI did not ask for.
- Services throw `AppError` only:

```ts
export class AppError extends Error {
  constructor(
    public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT',
    message: string,
  ) { super(message) }
}
```

### Server actions (`src/server/actions/*.ts`)

- `"use server"` files. Each action: get session → `schema.parse(input)` → call one service → `revalidatePath` if needed → return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
- Wrap with a shared `action(schema, handler)` helper so error mapping is identical everywhere.
- Zod schemas live next to the action and are exported for client-side form validation.

### Client

- Reads in pages use Server Components calling services directly (with the session user) for first paint.
- Interactive lists (task list, task dialog, calendar) hydrate into TanStack Query with query keys `['tasks', listId]`, `['task', taskId]`, `['timeblocks', rangeStart, rangeEnd]`.
- Every task mutation uses `onMutate` optimistic update + rollback on error + invalidate on settle.
- Toasts (sonner) for errors only. Success is silent.

### Naming and style

- Files kebab-case, components PascalCase, functions camelCase.
- IDs: `cuid2` strings generated by Prisma default.
- Ordering: every orderable row has `position String` generated by `generateKeyBetween(before, after)` from fractional-indexing. Lists sort by `position ASC`.
- Dates stored as UTC `DateTime`. `startDate`/`dueDate` on tasks are date-only in the UI unless a time is set; store `dueHasTime Boolean` to know which.
- No `any`. ESLint + Prettier defaults from the Next.js template plus `@typescript-eslint/no-explicit-any: error`.

## 5. Data model

This schema is final for v1; only the Architect changes it. Generate Better Auth's own tables with its CLI (`@better-auth/cli generate`) and treat that output as authoritative for `User`, `Session`, `Account` and `Verification`; the relation fields on `User` below are then added by hand. Adjust the `datasource` block to the installed Prisma version.

```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum SpaceRole      { OWNER ADMIN MEMBER }
enum StatusCategory { TODO ACTIVE DONE }
enum SubtaskDisplay { NESTED SEPARATE }
enum SyncState      { PENDING SYNCED ERROR }

enum ActivityType {
  TASK_CREATED TASK_RENAMED TASK_DESCRIPTION_CHANGED
  STATUS_CHANGED PRIORITY_CHANGED START_DATE_CHANGED DUE_DATE_CHANGED
  ASSIGNEE_ADDED ASSIGNEE_REMOVED
  MOVED_TO_LIST ADDED_TO_LIST REMOVED_FROM_LIST
  SUBTASK_ADDED PARENT_CHANGED
  COMMENT_ADDED
  SCHEDULED UNSCHEDULED
  TASK_COMPLETED TASK_REOPENED TASK_DELETED TASK_RESTORED
}

// ---------- Auth (Better Auth) — relations added by us ----------
model User {
  id            String   @id
  name          String
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // Better Auth relations: sessions Session[], accounts Account[]

  memberships   SpaceMember[]
  assignments   TaskAssignee[]
  comments      Comment[]
  activities    Activity[]
  timeBlocks    TimeBlock[]
  googleCal     GoogleCalendarConnection?
}

// ---------- Tenancy ----------
model Space {
  id          String   @id @default(cuid(2))
  name        String
  icon        String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  members     SpaceMember[]
  invites     Invite[]
  projects    Project[]
}

model SpaceMember {
  spaceId  String
  userId   String
  role     SpaceRole @default(MEMBER)
  joinedAt DateTime  @default(now())
  space    Space @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  user     User  @relation(fields: [userId],  references: [id], onDelete: Cascade)
  @@id([spaceId, userId])
  @@index([userId])
}

model Invite {
  id          String    @id @default(cuid(2))
  spaceId     String
  token       String    @unique            // 32-byte random, base64url
  role        SpaceRole @default(MEMBER)   // never OWNER
  createdById String
  expiresAt   DateTime                      // default now + 7 days
  maxUses     Int?                          // null = unlimited
  uses        Int       @default(0)
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  space       Space @relation(fields: [spaceId], references: [id], onDelete: Cascade)
}

// ---------- Structure ----------
model Project {
  id         String    @id @default(cuid(2))
  spaceId    String
  name       String
  color      String    @default("#64748B")
  icon       String?
  position   String
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  space      Space  @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  statuses   Status[]
  lists      List[]
  tasks      Task[]
  docs       Doc[]
  @@index([spaceId, position])
}

model Status {
  id        String         @id @default(cuid(2))
  projectId String
  name      String
  color     String
  category  StatusCategory
  position  String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks     Task[]
  @@unique([projectId, name])
  @@index([projectId, position])
}

model List {
  id             String         @id @default(cuid(2))
  projectId      String
  name           String
  position       String
  subtaskDisplay SubtaskDisplay @default(NESTED)
  archivedAt     DateTime?
  createdAt      DateTime       @default(now())
  project        Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  homeTasks      Task[]  @relation("HomeList")
  links          TaskListLink[]
  @@index([projectId, position])
}

// ---------- Tasks ----------
model Task {
  id          String    @id @default(cuid(2))
  spaceId     String                        // denormalized for fast guards
  projectId   String
  homeListId  String
  parentId    String?                       // null = top-level task
  depth       Int       @default(0)         // 0,1,2 (max 3 levels)
  title       String
  description Json?                         // Tiptap JSON
  statusId    String
  priority    Int       @default(4)         // 1 = P1 urgent … 4 = none
  startDate   DateTime?
  dueDate     DateTime?
  dueHasTime  Boolean   @default(false)
  position    String                        // order among siblings in home list
  completedAt DateTime?
  deletedAt   DateTime?                     // soft delete
  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  homeList    List    @relation("HomeList", fields: [homeListId], references: [id])
  status      Status  @relation(fields: [statusId], references: [id])
  parent      Task?   @relation("Subtasks", fields: [parentId], references: [id], onDelete: Cascade)
  subtasks    Task[]  @relation("Subtasks")
  links       TaskListLink[]
  assignees   TaskAssignee[]
  comments    Comment[]
  activities  Activity[]
  timeBlocks  TimeBlock[]

  @@index([homeListId, parentId, position])
  @@index([parentId])
  @@index([projectId])
  @@index([spaceId, dueDate])
}

model TaskListLink {                        // task ALSO appears in this list
  taskId    String
  listId    String
  position  String
  addedById String
  createdAt DateTime @default(now())
  task      Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  list      List @relation(fields: [listId], references: [id], onDelete: Cascade)
  @@id([taskId, listId])
  @@index([listId, position])
}

model TaskAssignee {
  taskId     String
  userId     String
  assignedAt DateTime @default(now())
  task       Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([taskId, userId])
  @@index([userId])
}

model Comment {
  id        String    @id @default(cuid(2))
  taskId    String
  authorId  String
  body      Json                           // Tiptap JSON
  bodyText  String                         // plain text for previews/search
  editedAt  DateTime?
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  task      Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author    User @relation(fields: [authorId], references: [id])
  @@index([taskId, createdAt])
}

model Activity {                           // append-only, never updated
  id        String       @id @default(cuid(2))
  spaceId   String
  taskId    String
  actorId   String
  type      ActivityType
  payload   Json                           // { from?, to?, listId?, userId?, … }
  createdAt DateTime     @default(now())
  task      Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  actor     User @relation(fields: [actorId], references: [id])
  @@index([taskId, createdAt])
}

// ---------- Calendar ----------
model TimeBlock {                          // one scheduled slot; a task can have many
  id             String    @id @default(cuid(2))
  taskId         String
  userId         String                    // whose calendar it lives on
  spaceId        String
  start          DateTime
  end            DateTime
  googleEventId  String?
  googleEtag     String?
  syncState      SyncState @default(PENDING)
  lastSyncError  String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  task           Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user           User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, start])
  @@index([taskId])
  @@unique([userId, googleEventId])
}

model GoogleCalendarConnection {
  id              String   @id @default(cuid(2))
  userId          String   @unique
  googleEmail     String
  calendarId      String   @default("primary")
  accessTokenEnc  String                   // AES-256-GCM, key = ENCRYPTION_KEY
  refreshTokenEnc String
  expiresAt       DateTime
  scope           String
  syncToken       String?                  // Calendar API incremental sync
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ---------- Docs ----------
model Doc {
  id          String    @id @default(cuid(2))
  spaceId     String
  projectId   String
  title       String
  icon        String?
  position    String
  createdById String
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pages       DocPage[]
  @@index([projectId, position])
}

model DocPage {
  id          String    @id @default(cuid(2))
  docId       String
  parentId    String?                      // nested pages, max depth 3
  title       String    @default("Untitled")
  content     Json                         // Tiptap JSON
  position    String
  createdById String
  updatedById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  doc         Doc       @relation(fields: [docId], references: [id], onDelete: Cascade)
  parent      DocPage?  @relation("PageTree", fields: [parentId], references: [id], onDelete: Cascade)
  children    DocPage[] @relation("PageTree")
  @@index([docId, parentId, position])
}
```

## 6. Domain rules and invariants

Every rule here is enforced in the service layer and covered by a Vitest test. The UI may prevent invalid actions too, but never instead of the service.

### 6.1 Statuses

1. Statuses belong to one project. A new project gets three defaults: **To do** (TODO, `#94A3B8`), **In progress** (ACTIVE, `#3B82F6`), **Done** (DONE, `#22C55E`).
2. When creating a project, the user may instead copy the statuses of another project in the same space. This is how statuses are reused across projects.
3. A project always has at least one TODO status and at least one DONE status. Deleting or recategorizing the last one is rejected.
4. Deleting a status requires a `replacementStatusId` from the same project. All its tasks move to the replacement, each logging `STATUS_CHANGED`.
5. Status names are unique per project (case-insensitive check in the service).

### 6.2 Completion

Tasks have no checkbox: the circle on every task is its **status control**, which opens a menu of the project's statuses (ClickUp-style, 9.2). Choosing a status is an `updateTask` status change (logs `STATUS_CHANGED`).

1. **Complete** (row menu, the `x` shortcut) sets the project's first DONE status (lowest position) and `completedAt = now()`. Logs `TASK_COMPLETED`.
2. **Reopen** sets the first TODO status and clears `completedAt`. Logs `TASK_REOPENED`.
3. Any status change into a DONE category sets `completedAt`; any change out of DONE clears it.
4. Moving a parent with open subtasks into DONE (Complete, or choosing a DONE status) asks "Also complete N open subtasks?" (default Yes). `setCompleted` takes `includeSubtasks`; `updateTask` takes `completeSubtasks` (descendants move to the chosen DONE status). Each completed subtask logs `TASK_COMPLETED`.

### 6.3 Lists

1. A project always has at least one list. A new project gets one list named **General**.
2. Deleting a list requires `targetListId` in the same project. Home tasks move there (with subtrees); links to the deleted list are removed.
3. `subtaskDisplay` is stored per list and changed from the list's view menu. It is a shared team setting, not per-user.

### 6.4 Tasks and subtasks

1. A subtask sets `parentId`; `depth = parent.depth + 1`; max `depth` is 2 (three levels total). Deeper creation is rejected with `VALIDATION`.
2. A subtask always inherits `spaceId`, `projectId` and `homeListId` from its parent. Its status defaults to the project's first TODO status.
3. Re-parenting (`setParent`) is allowed only within the same project, must not create a cycle, and must keep the whole moved subtree within max depth. Setting `parentId = null` promotes a subtask to a top-level task in the parent's home list. Logs `PARENT_CHANGED`.
4. `position` orders a task among its siblings (same `homeListId` and same `parentId`).
5. Deleting is a soft delete of the task and its whole subtree (`deletedAt = now()`). The UI shows an Undo toast for 10 seconds, which calls `restoreTask`. Soft-deleted tasks are excluded from every query.

### 6.5 Moving a task (changes the home list)

1. Only top-level tasks can be moved. Moving a subtask returns `VALIDATION`; the UI instead offers "Add to list" or "Convert to task, then move".
2. The target list must be in the same project. Anything else returns `VALIDATION`.
3. The task and all its descendants get the new `homeListId` in one transaction.
4. If the task already had a `TaskListLink` to the target list, that link is deleted (it is now home there).
5. Logs `MOVED_TO_LIST` with `{ fromListId, toListId }`.

### 6.6 Adding a task to another list (a link, home unchanged)

1. Allowed for top-level tasks and subtasks.
2. The list must be in the same project, must not be the home list, and must not already be linked.
3. New link goes to the end of the target list (`position` after the last root).
4. `removeTaskFromList` deletes only the link. You cannot remove a task from its home list; you move it.
5. Logs `ADDED_TO_LIST` / `REMOVED_FROM_LIST` with `{ listId }`.

### 6.7 What a list view shows

For list **L**:

- **Members(L)** = non-deleted tasks whose `homeListId = L` or that have a `TaskListLink` to L.
- **Visible(L)** = Members(L) plus all non-deleted descendants of any member.
- **Roots(L)** = visible tasks whose parent is not visible (or who have no parent).

In **NESTED** mode, the view renders Roots(L) in order, each with its visible subtree indented beneath (collapsible). A root that has a parent (a subtask linked into L) shows its parent's title as a small muted line above its own title.

In **SEPARATE** mode, every visible task renders as its own flat row. Any task with a parent shows the parent title as a small muted line above its title. Clicking the parent line opens the parent in the task dialog.

Ordering in both modes follows the list's sort: **Manual** (default; roots by `position` for home tasks or link `position` for linked tasks, then depth-first for children), **Due date** (nulls last), or **Priority**. Sort is a per-user preference stored in `localStorage`. Completed tasks are hidden by default behind a "N completed" toggle at the bottom.

### 6.8 Assignees

1. Assignees must be current members of the task's space.
2. Removing a member from a space removes their assignments in that space, logging `ASSIGNEE_REMOVED` per task.

### 6.9 Activity log

1. Append-only. Rows are never updated or deleted except by cascade.
2. Written only through `logActivity(tx, { spaceId, taskId, actorId, type, payload })` inside the mutating transaction.
3. Payload shapes: value changes store `{ from, to }` (ids for status/list, ISO strings for dates, numbers for priority); assignee changes store `{ userId }`; list changes store `{ listId }` or `{ fromListId, toListId }`; comments store `{ commentId }`; scheduling stores `{ timeBlockId, start, end }`.
4. Description edits are coalesced: skip logging if the same actor logged `TASK_DESCRIPTION_CHANGED` on the same task within the last 10 minutes.
5. The activity feed renders human sentences from type + payload in one formatter, `formatActivity()`, with names and list/status labels resolved at read time.

### 6.10 Comments

Any member can comment. Authors can edit and delete their own comments; Owner/Admin can delete any. Deletion is soft and shows "Comment deleted" in the feed.

## 7. Auth and permissions

All members of a space see everything in that space. There is no per-project privacy in v1. Roles only gate structural and administrative actions.

### 7.1 Authentication

- Better Auth with email/password (min 8 chars, email verification off in v1) and Google social sign-in. Built-in rate limiting stays on.
- Session cookie; `src/proxy.ts` (Next 16's rename of `middleware.ts`) redirects unauthenticated requests under `/(app)` to `/sign-in?next=<path>`.
- `getSessionUser()` in `src/server/auth.ts` returns `{ id, name, email, image }` or throws `UNAUTHENTICATED`.
- Google sign-in requests only `openid email profile`. Calendar access is a separate, later consent (Section 10), so people can use the app without granting calendar access.

### 7.2 Onboarding and invites

1. After sign-up, a user with no memberships sees "Create your space" (name only). The creator becomes OWNER. A project **Getting started** with default statuses and list **General** is created.
2. Admins create invite links from Space settings: role (Admin or Member), expiry (1, 7 or 30 days), optional max uses. Links look like `/invite/<token>`.
3. Opening an invite: signed-out users go through sign-in/up and return to the invite; signed-in users see "Join \<space>" and confirm. Expired, revoked or used-up invites show a clear error.
4. Joining when already a member is a no-op redirect to the space.
5. The last OWNER cannot leave or be demoted. Ownership transfers by promoting another member to OWNER first.

### 7.3 Role matrix

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| View all projects, lists, tasks, docs | Yes | Yes | Yes |
| Create/edit/complete tasks, subtasks, comments | Yes | Yes | Yes |
| Create/edit docs and pages | Yes | Yes | Yes |
| Create projects and lists; rename them | Yes | Yes | Yes |
| Edit statuses; delete lists; archive projects | Yes | Yes | No |
| Create/revoke invite links | Yes | Yes | No |
| Remove Members | Yes | Yes | No |
| Change roles; remove Admins; rename/delete space | Yes | No | No |
| Delete others' comments | Yes | Yes | No |

### 7.4 Guards (`src/server/guards.ts`)

```ts
requireUser(): Promise<SessionUser>
requireMember(userId: string, spaceId: string): Promise<SpaceMember>          // NOT_FOUND if not a member (never leak existence)
requireRole(userId: string, spaceId: string, min: 'ADMIN' | 'OWNER'): Promise<SpaceMember> // NOT_FOUND if not a member; FORBIDDEN if role too low
// Resolvers: load entity, return its spaceId, then call requireMember
spaceIdOfProject(projectId) / spaceIdOfList(listId) / spaceIdOfTask(taskId) / spaceIdOfDoc(docId)
```

Rule: every service resolves the `spaceId` of the entity it touches **from the database**, never from client input, then calls `requireMember` or `requireRole`. A missing entity and a forbidden entity both return `NOT_FOUND` to avoid leaking existence.

## 8. Service layer contracts

These signatures are the contract between Architect and Implementer. The Architect implements everything marked **\[A\]**; the Implementer may implement the rest by following an existing \[A\] service as the pattern. Every function takes `ctx: Ctx` first, where `type Ctx = { userId: string }`.

### 8.1 Shared DTOs

```ts
type UserLite = { id: string; name: string; image: string | null }

type StatusDTO = { id: string; name: string; color: string; category: 'TODO' | 'ACTIVE' | 'DONE'; position: string }

type TaskRowDTO = {
  id: string; title: string; priority: 1 | 2 | 3 | 4
  status: StatusDTO; completedAt: string | null
  startDate: string | null; dueDate: string | null; dueHasTime: boolean
  assignees: UserLite[]
  parentId: string | null; parentTitle: string | null; depth: number
  homeListId: string; isLinkedHere: boolean     // true when shown via TaskListLink
  subtaskCount: number; openSubtaskCount: number; commentCount: number
  position: string                               // home position or link position
}

type TaskDetailDTO = TaskRowDTO & {
  description: unknown | null                    // Tiptap JSON
  projectId: string; spaceId: string
  homeList: { id: string; name: string }
  linkedLists: { id: string; name: string }[]
  breadcrumb: { id: string; title: string }[]    // ancestors, root first
  subtasks: TaskRowDTO[]                         // direct children
  timeBlocks: { id: string; start: string; end: string; syncState: string }[]
  createdBy: UserLite; createdAt: string; updatedAt: string
}

type FeedItemDTO =
  | { kind: 'comment'; id: string; author: UserLite; body: unknown; createdAt: string; editedAt: string | null; deleted: boolean }
  | { kind: 'activity'; id: string; actor: UserLite; text: string; createdAt: string }
```

### 8.2 Spaces and members — `spaces.ts`

```ts
createSpace(ctx, { name }): Promise<{ spaceId: string }>                          // [A] also creates Getting started project
listMySpaces(ctx): Promise<{ id; name; icon; role }[]>
renameSpace(ctx, { spaceId, name }): Promise<void>                                  // OWNER
listMembers(ctx, { spaceId }): Promise<(UserLite & { role; joinedAt })[]>
changeRole(ctx, { spaceId, userId, role }): Promise<void>                           // [A] OWNER; last-owner rule
removeMember(ctx, { spaceId, userId }): Promise<void>                               // [A] matrix + unassign
leaveSpace(ctx, { spaceId }): Promise<void>                                         // [A] last-owner rule
createInvite(ctx, { spaceId, role, expiresInDays, maxUses? }): Promise<{ url }>     // [A] ADMIN
revokeInvite(ctx, { inviteId }): Promise<void>
getInvite(ctx, { token }): Promise<{ spaceName; role; valid: boolean; reason? }>
acceptInvite(ctx, { token }): Promise<{ spaceId }>                                  // [A] atomic uses++
```

### 8.3 Projects, statuses, lists — `projects.ts`, `statuses.ts`, `lists.ts`

```ts
createProject(ctx, { spaceId, name, color?, copyStatusesFromProjectId? }): Promise<{ projectId; firstListId }>  // [A]
updateProject(ctx, { projectId, name?, color?, icon? }): Promise<void>
archiveProject(ctx, { projectId }): Promise<void>                                   // ADMIN
reorderProject(ctx, { projectId, beforeId?, afterId? }): Promise<void>
getSidebar(ctx, { spaceId }): Promise<{ projects: { id; name; color; lists: { id; name }[]; docs: { id; title }[] }[] }>

listStatuses(ctx, { projectId }): Promise<StatusDTO[]>
createStatus(ctx, { projectId, name, color, category }): Promise<StatusDTO>         // ADMIN
updateStatus(ctx, { statusId, name?, color?, category? }): Promise<void>           // [A] ADMIN; min-one rule
reorderStatus(ctx, { statusId, beforeId?, afterId? }): Promise<void>
deleteStatus(ctx, { statusId, replacementStatusId }): Promise<void>                // [A] ADMIN

createList(ctx, { projectId, name }): Promise<{ listId }>
updateList(ctx, { listId, name?, subtaskDisplay? }): Promise<void>
reorderList(ctx, { listId, beforeId?, afterId? }): Promise<void>
deleteList(ctx, { listId, targetListId }): Promise<void>                           // [A] ADMIN
```

### 8.4 Tasks — `tasks.ts` (all \[A\])

```ts
getListView(ctx, { listId }): Promise<{ list: { id; name; subtaskDisplay }; statuses: StatusDTO[]; tasks: TaskRowDTO[] }>
  // returns Visible(L) incl. completed; client applies NESTED/SEPARATE rendering and sort (Section 6.7)
getTask(ctx, { taskId }): Promise<TaskDetailDTO>
getMyTasks(ctx, { spaceId }): Promise<TaskRowDTO[]>                                  // assigned to me, open only

createTask(ctx, {
  listId, title, parentId?, description?, priority?, statusId?,
  startDate?, dueDate?, dueHasTime?, assigneeIds?, afterTaskId?
}): Promise<TaskRowDTO>          // parentId given → list comes from parent; logs TASK_CREATED (+ SUBTASK_ADDED on parent)

updateTask(ctx, {
  taskId, title?, description?, priority?, statusId?,
  startDate?: string | null, dueDate?: string | null, dueHasTime?,
  completeSubtasks?                // with a status change into DONE: complete open descendants too (6.2.4)
}): Promise<TaskRowDTO>          // one Activity row per changed field; completion rules 6.2

setCompleted(ctx, { taskId, completed: boolean, includeSubtasks?: boolean }): Promise<void>
setAssignees(ctx, { taskId, userIds: string[] }): Promise<void>        // diff → ADDED/REMOVED rows
reorderTask(ctx, { taskId, listId, beforeId?, afterId? }): Promise<void>  // home → Task.position, linked → link.position
moveTask(ctx, { taskId, toListId, beforeId?, afterId? }): Promise<void>   // rules 6.5
addTaskToList(ctx, { taskId, listId }): Promise<void>                      // rules 6.6
removeTaskFromList(ctx, { taskId, listId }): Promise<void>
setParent(ctx, { taskId, parentId: string | null }): Promise<void>         // rules 6.4.3
deleteTask(ctx, { taskId }): Promise<void>                                 // soft, subtree
restoreTask(ctx, { taskId }): Promise<void>
```

### 8.5 Comments and activity — `comments.ts`, `activity.ts`

```ts
addComment(ctx, { taskId, body }): Promise<FeedItemDTO>        // logs COMMENT_ADDED
editComment(ctx, { commentId, body }): Promise<void>           // author only
deleteComment(ctx, { commentId }): Promise<void>               // author or ADMIN
getFeed(ctx, { taskId, filter: 'all' | 'comments' }): Promise<FeedItemDTO[]>   // oldest first

// internal, [A]
logActivity(tx, { spaceId, taskId, actorId, type, payload }): Promise<void>
formatActivity(row, lookups): string
```

### 8.6 Calendar — `timeblocks.ts`, `google-calendar.ts` (all \[A\])

```ts
listTimeBlocks(ctx, { spaceId, rangeStart, rangeEnd }): Promise<TimeBlockDTO[]>     // current user's blocks
listUnscheduled(ctx, { spaceId, projectId? }): Promise<TaskRowDTO[]>               // assigned to me, open, no future blocks
createTimeBlock(ctx, { taskId, start, end, timeZone }): Promise<TimeBlockDTO>      // logs SCHEDULED, then pushes
updateTimeBlock(ctx, { timeBlockId, start, end, timeZone }): Promise<TimeBlockDTO>
deleteTimeBlock(ctx, { timeBlockId }): Promise<void>                                // logs UNSCHEDULED
retrySync(ctx, { timeBlockId }): Promise<void>

getGoogleConnection(ctx): Promise<{ connected: boolean; email?: string }>
getGoogleAuthUrl(ctx): Promise<{ url }>
handleGoogleCallback(ctx, { code, state }): Promise<void>
disconnectGoogle(ctx): Promise<void>
listGoogleEvents(ctx, { rangeStart, rangeEnd }): Promise<GoogleEventDTO[]>          // read-only layer + reconciliation

type TimeBlockDTO = { id; taskId; taskTitle; projectColor; start; end; syncState; lastSyncError }
type GoogleEventDTO = { id; title; start; end; allDay: boolean; htmlLink }
```

### 8.7 Docs — `docs.ts`

```ts
createDoc(ctx, { projectId, title }): Promise<{ docId; firstPageId }>
renameDoc / reorderDoc / archiveDoc
getPageTree(ctx, { docId }): Promise<{ id; title; parentId; position }[]>
getPage(ctx, { pageId }): Promise<{ id; title; content; updatedAt; updatedBy: UserLite }>
createPage(ctx, { docId, parentId?, title? }): Promise<{ pageId }>          // depth ≤ 3
savePage(ctx, { pageId, title?, content?, baseUpdatedAt }): Promise<{ updatedAt } | { conflict: true; updatedBy: UserLite }>
movePage(ctx, { pageId, parentId?, beforeId?, afterId? }): Promise<void>
deletePage(ctx, { pageId }): Promise<void>                                   // cascades children; not the last page
```

## 9. UI/UX spec

The app has one layout: sidebar left, main view center, and a **task dialog** that opens over the view. If a design choice isn't covered here, pick the option ClickUp or Todoist would pick.

**Designs are the visual source of truth.** Paper file "SAVA TM" (https://app.paper.design/file/01M3QHGC3XJ75BKH8QP6BVSM3B), exported to `docs/design/` (screenshots + exact JSX): `list-view-nested`, `list-view-separate`, `task-dialog-empty`, `task-dialog-filled`. Where this section and a design disagree, the design wins. Icons: `lucide-react` everywhere, except two custom glyphs from the list-view designs: the subtask icon and the filled priority flag (`docs/design/icons.md`).

### 9.1 Layout

| Region | Width | Contents |
| --- | --- | --- |
| Sidebar | 260px, collapsible (`[`) | Space switcher (its menu also holds **Space settings**); **Add task** (blue, with a `Q` key hint; opens quick add); My Tasks; Calendar; **Projects** header with `+`; project tree (project → its lists with open-task counts, then its docs, no group label); `+ New project`; footer: user menu (avatar, name → sign out, integrations) and a theme toggle |
| Main view | fluid, content max-width 880px | Header band (breadcrumb, Share, title, View menu, `⋯`, counts) + the view |
| Task dialog | 1080×780 centered modal over the dimmed view, radius 12px | Full task detail (9.4). Closes with `Esc`, `×` or a click outside. URL keeps `?task=<id>` so tasks are linkable |

Below 768px: sidebar becomes a left drawer, the task dialog becomes full-screen. Desktop is the priority.

**Drag and drop everywhere** (list rows, sidebar projects, settings rows) starts from anywhere on the item after a small movement (4px), as in ClickUp and Todoist. There are no visible drag handles; a plain click still opens or activates the item.

### 9.2 List view

Design: `docs/design/list-view-nested.jpg` and `list-view-separate.jpg`.

- **Header band:** project color square + project name (breadcrumb), **Share** (copies the list link); list name 28px semibold (click to rename); **View** menu (Subtasks: Nested / Separate, a shared per-list setting; Sort: Manual / Due date / Priority; Show completed) and `⋯` (Rename list, Project settings, Delete list… for Admins); "N tasks · M statuses".
- **Status groups:** tasks are grouped by status in status order. Each group has a collapsible header with a status pill (uppercase name + status icon; DONE pills are filled green) and a count. DONE groups start collapsed; "Show completed" opens them. Each non-DONE group ends with `+ Add task` (creates in that status).
- **Status control:** the circle at the start of every row is the task's **status**, not a checkbox. Its icon shows the category: `CircleDashed` (To do), `ChartPie` (Active, blue), `CircleCheck` filled green (Done). Clicking it opens a **status menu** listing the project's statuses (with their icons); choosing one sets it (6.2). Choosing a DONE status for a task with open subtasks asks "Also complete N open subtasks?" (6.2.4).
- **Nested rows** (36px): chevron to collapse subtasks (20px indent per depth, collapsed state per task in `localStorage`) · status control · title (medium weight when it has subtasks) · link icon when `isLinkedHere` · columns **Subs** (subtask icon + done/total), **Assignee** (up to 3 avatars), **Due** (green "Today", red when overdue), **Pri** (the filled design flag, colored P1 red / P2 orange / P3 blue; none for P4). The first group shows the column labels.
- **Separate rows:** two lines: an optional `↳ Parent title` line (clickable, opens the parent), the title, then a meta line (due, subtasks, flag); assignees on the right.
- **Hover:** row background tint and two buttons: `+` (add subtask inline, hidden at depth 2) and `⋯` (row menu).
- **Inline add:** `Enter` creates and keeps the field open; `Esc` or blur-when-empty closes.
- **Drag and drop:** grab a row anywhere to reorder within its group (Manual sort only; subtrees move with their root). Dropping a top-level task onto a list in the sidebar **moves** it; holding `Alt` while dropping **adds** it to that list instead.
- **Row menu** (right-click or `⋯`): Open, Complete / Reopen, Set priority, Set due date, Move to…, Add to list…, Remove from this list (linked only), Convert to task / Make subtask of…, Delete (Undo toast).

### 9.3 Quick add

Pressing `q` anywhere (or the sidebar's **Add task**) opens a small centered quick-add dialog. One input line plus chips showing what was parsed. `Enter` saves into the current list (or the project's first list; or the last used list when on My Tasks/Calendar).

| Token | Meaning | Example |
| --- | --- | --- |
| natural date | due date (chrono-node) | `tomorrow`, `fri 3pm`, `next week` |
| `p1`–`p4` | priority | `p1` |
| `@name` | assignee (autocomplete members) | `@ahmad` |
| `#list` | list in current project (autocomplete) | `#design` |

Parsed tokens are removed from the title. Parser lives in `src/lib/quick-add-parser.ts` with unit tests.

### 9.4 Task dialog

Design: `docs/design/task-dialog-empty.jpg` (new task) and `task-dialog-filled.jpg`. A 1080×780 modal: a 56px header, then a main column and a 320px properties column (light gray background, left border).

1. **Header:** breadcrumb Project / List / ancestors (project color square; each part clickable). Right side: `↑` `↓` (previous / next task in the current list order), `⋯` menu (Move to…, Add to list…, Copy link, Delete) and `×` close.
2. **Title row:** the status control (as in 9.2) and the title, 24px semibold, inline-editable.
3. **Description:** an `AlignLeft` icon row. Empty: the placeholder "Description". Otherwise the Tiptap editor (14px/22px), autosave debounced 800ms.
4. **Subtasks:** "Subtasks" + `done/total` + a green progress bar; compact rows (status control, title, due, avatar); `+ Add subtask`; drag to reorder.
5. **Activity** (below a divider): heading + a segmented toggle **All | Comments** (default All). Oldest at top. Activity lines: avatar + sentence + relative time. Comments: avatar, name · time, body. Composer at the bottom: the viewer's avatar + a rounded "Comment" field (`Ctrl/Cmd+Enter` sends). Attachments are **not** in v1 (the design's paperclip is not built).
6. **Properties column** (section titles 13px semibold, separated by dividers):
   - **Status:** the status pill; click → status menu.
   - **Assignees** (`+`): avatar + name rows.
   - **Dates:** Start and Due with calendar icons (due colored like the list); due supports an optional time.
   - **Priority:** flag + P1–P4.
   - **Lists** (`+`): the home list as a filled chip, linked lists as outlined chips with `×`.
   - **Scheduled** (`+`): time blocks ("Today 10:45–12:00") with a sync-state icon.

### 9.5 My Tasks

Open tasks assigned to me across the current space, grouped: **Overdue**, **Today**, **Next 7 days**, **Later**, **No date**. Each row shows its project/list as muted text. Same row component and task dialog.

### 9.6 Settings pages

- **Space settings** (opened from the space switcher menu): name; Members table (avatar, name, email, role dropdown, remove); Invite links (create, copy, revoke, uses, expiry).
- **Project settings:** name, color; Statuses (drag reorder, rename, color, category, delete with replacement picker); Lists (rename, reorder, delete with target picker).
- **User → Integrations:** Google Calendar connect/disconnect, connected email, calendar used.

### 9.7 Keyboard shortcuts

| Key | Action |
| --- | --- |
| `q` | Quick add |
| `/` | Focus search (v2; reserve the key) |
| `[` | Toggle sidebar |
| `Esc` | Close the task dialog / any dialog |
| `j` / `k` | Next / previous task in list |
| `Enter` | Open selected task |
| `x` | Complete selected task |
| `1`–`4` | Set priority of selected task |
| `g` then `m` / `c` | Go to My Tasks / Calendar |

### 9.8 Visual tokens

- Font: Inter (UI), JetBrains Mono (code in docs). Base size 14px; list title 28px semibold; task title in the dialog 24px semibold.
- Neutrals: zinc (`#18181B` text, `#71717A` muted, `#E8E8EA` borders, `#F6F6F7` sidebar). One accent via CSS variable `--primary` (`#2563EB`) so the brand can change later without touching components. All design colors are theme tokens in `globals.css` (e.g. `bg-sidebar`, `border-divider`, `bg-pill`, `bg-selected`, `text-overdue`, `text-priority-1…3`), never hex in components.
- Spacing on a 4px grid; radius 6px (inputs, pills, rows), 12px (the task dialog).
- Icons: `lucide-react`; the only custom icons are the subtask glyph and the filled priority flag (`docs/design/icons.md`).
- Light and dark themes through shadcn CSS variables; follow system by default.
- Empty states: one short line + one primary action (e.g. "No tasks yet — press Q to add one"). No illustrations in v1.
- Loading: skeleton rows, never full-page spinners.

## 10. Calendar and Google Calendar sync

A task can be scheduled into any number of time slots (`TimeBlock`s). Each slot becomes an event on the user's Google Calendar. Google events are shown read-only beside them, and moves made in Google flow back when the calendar is opened. The app works fully without Google connected; blocks simply stay local.

### 10.1 Calendar page (`/s/[spaceId]/calendar`)

- FullCalendar with `timeGridWeek` (default), `timeGridDay`, `dayGridMonth`. Week starts Monday; the user's browser time zone is used and sent with every write.
- **Left rail "Unscheduled"**: open tasks assigned to me with no future time blocks, filterable by project. Rows are draggable into the grid via FullCalendar's `Draggable`.
- **Drop** a task on the grid → `createTimeBlock` with a 60-minute default. Dropping the same task again creates another block, so one task can occupy several slots.
- **Drag** a block to move it, **resize** its bottom edge to change duration (15-minute snap). Both call `updateTimeBlock`.
- **Click** a block → opens the task dialog. Block popover `⋯` → "Remove from calendar" (`deleteTimeBlock`).
- **Rendering:** our blocks = solid, with a 3px left bar in the project color and the task title; completed tasks' blocks show strikethrough. Google events = light gray, not draggable, click opens `htmlLink` in a new tab. Tasks with a due date (and no time) show in the all-day row as small chips (local only, never synced).
- **Sync status:** a small icon on each block — nothing when `SYNCED`, a clock when `PENDING`, a warning with "Retry" when `ERROR`.
- Header shows "Connect Google Calendar" when not connected.

### 10.2 Connecting Google

1. User → Integrations → **Connect Google Calendar** → `getGoogleAuthUrl` builds an OAuth URL with scopes `openid email https://www.googleapis.com/auth/calendar.events`, `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, and a signed `state` (user id + nonce, HMAC with `AUTH_SECRET`, 10-minute expiry).
2. `/api/google/callback` verifies `state`, exchanges the code, and upserts `GoogleCalendarConnection` with tokens encrypted by AES-256-GCM using `ENCRYPTION_KEY`. `calendarId` = `primary`.
3. A helper `getCalendarClient(userId)` refreshes the access token when it expires within 60 seconds and saves the new one. If refresh fails with `invalid_grant`, delete the connection and surface "Reconnect Google Calendar".
4. **Disconnect** revokes the token at Google (best effort), deletes the connection, and leaves blocks and their Google events untouched.

### 10.3 Push: app → Google

- Writes happen **after** the DB transaction commits, never inside it. The block is saved as `PENDING`, then the Google call runs; success sets `SYNCED` + `googleEventId` + `googleEtag`; failure sets `ERROR` + `lastSyncError`.
- Event body:

```ts
{
  summary: task.title,
  description: `${APP_URL}/s/${spaceId}/p/${projectId}/l/${homeListId}?task=${taskId}\n${projectName} › ${listName}`,
  start: { dateTime: start, timeZone },
  end:   { dateTime: end,   timeZone },
  extendedProperties: { private: { appTaskId: taskId, appTimeBlockId: timeBlockId } },
  reminders: { useDefault: true },
}
```

- `updateTimeBlock` → `events.patch`; `deleteTimeBlock` → `events.delete` (treat 404/410 as success).
- Renaming a task patches the summary of its blocks that end in the future.
- Deleting a task deletes its future blocks' events; completing it leaves events alone.

### 10.4 Pull: Google → app

When the calendar view loads a date range, `listGoogleEvents` fetches `events.list` on the connected calendar with `timeMin`, `timeMax`, `singleEvents=true`, `showDeleted=true`, then:

1. Events carrying `extendedProperties.private.appTimeBlockId` are **ours**. If start/end differ from the block, update the block (Google wins, it is the newer edit) and log `SCHEDULED`. If `status = cancelled`, delete the block and log `UNSCHEDULED`. Ours are never returned as gray events (no duplicates).
2. Blocks in range with a `googleEventId` that did not appear in the results are checked with `events.get`: moved outside range → update the block; cancelled or 404 → delete the block.
3. All other events are returned as read-only `GoogleEventDTO`s.

Conflict rule: last write wins. The app's own edits push immediately; Google-side edits are pulled next time the range is viewed. `syncToken` and push notifications (watch channels) are v2.

### 10.5 Google Cloud setup and gotchas

- One Google Cloud project, one OAuth web client. Redirect URIs: `${APP_URL}/api/auth/callback/google` (sign-in) and `${APP_URL}/api/google/callback` (calendar), for production and a fixed staging domain (Vercel preview URLs change, so don't use them for OAuth).
- If the team is on Google Workspace, set the OAuth consent screen to **Internal**: no verification and no token expiry issues.
- If not, the app stays in **Testing** with teammates added as test users. In Testing mode, refresh tokens for external users expire after 7 days, so people will need to reconnect weekly until the app is published. Publishing for commercial use requires Google's verification for the calendar scope; start it early.
- Enable the Google Calendar API in the Cloud project before testing.

## 11. Docs

Each project can hold many docs; each doc is a tree of pages up to 3 levels deep. Docs are plain team notes, not a Notion clone: one editor, autosave, last write wins with a conflict warning.

### 11.1 Behavior

- Sidebar: under each project, a **Docs** group lists its docs; `+` creates a doc named "Untitled doc" with one page and opens it.
- Doc view (`/p/[projectId]/d/[docId]/[pageId]`): a 220px **page tree** on the left of the main area (nested, collapsible, drag to reorder or re-nest, `+` on hover to add a child page) and the **editor** on the right.
- Editor: page title as a large plain input, then Tiptap with StarterKit (headings H1–H3, bold, italic, strike, code, bullet/ordered lists, blockquote, code block, horizontal rule), TaskList/TaskItem (checklists), Link, Placeholder ("Start writing…"). Markdown shortcuts on (`#`, `-`, `[]`, `>`). No images, tables or embeds in v1.
- A small toolbar appears on text selection (bold, italic, link, H2, H3, list). Slash menu (`/`) is a stretch goal.
- Footer line: "Edited by \<name> · \<relative time>".

### 11.2 Saving and conflicts

1. Changes autosave 800ms after typing stops and on blur, via `savePage` with `baseUpdatedAt` = the `updatedAt` the client last loaded or saved.
2. If the server's `updatedAt` is newer, nothing is written and the response is `{ conflict: true, updatedBy }`. The UI shows a banner: "\<name> changed this page. Reload to see their version." with **Reload** and **Overwrite** buttons. Overwrite resends with the server's current `updatedAt`.
3. Unsaved state shows "Saving…" / "Saved" next to the footer; leaving the page with unsaved changes flushes the save first.

### 11.3 Rules

- Page depth max 3 (`createPage` / `movePage` reject deeper).
- A doc always has at least one page; deleting the last page is rejected.
- Deleting a page deletes its children after a confirm dialog that states how many pages will be removed.
- All space members can create, edit and delete docs and pages. Archiving a doc is available to everyone; archived docs are hidden from the sidebar.

## 12. Tickets in build order

22 tickets across the weekend. Each becomes `docs/tickets/T-XX.md` using the handoff template in Section 2. "A" = Architect (Fable / Opus 5.5), "I" = Implementer (GLM 5.3 Flash, or GLM 5.3 for tickets needing more careful reasoning). Where both are listed, the Architect writes the services first, then the Implementer builds the UI.

| ID | Title | Slot | Model | Depends on | Sections |
| --- | --- | --- | --- | --- | --- |
| T-01 | Scaffold, tooling, deploy | Fri evening | A | — | 2, 3, 4 |
| T-02 | Schema, migration, seed, position helper | Fri evening | A | T-01 | 5, 6 |
| T-03 | Auth and guards | Fri evening | A | T-02 | 7 |
| T-04 | Spaces and onboarding | Sat morning | A + I | T-03 | 7.2, 8.2 |
| T-05 | Members and invite links | Sat morning | A + I | T-04 | 7, 8.2, 9.6 |
| T-06 | Projects and sidebar | Sat morning | I | T-04 | 8.3, 9.1 |
| T-07 | Statuses and lists settings | Sat morning | A + I | T-06 | 6.1, 6.3, 8.3, 9.6 |
| T-08 | Task services core | Sat afternoon | A | T-07 | 6, 8.4 |
| T-09 | List view | Sat afternoon | I | T-08 | 6.7, 9.2 |
| T-10 | Quick add and parser | Sat afternoon | I | T-09 | 9.3 |
| T-11 | Task dialog shell | Sat afternoon | I | T-09 | 9.4 |
| T-12 | Subtasks and display modes | Sat afternoon | A + I | T-11 | 6.4, 6.7 |
| T-13 | Move and add-to-list | Sat afternoon | A + I | T-12 | 6.5, 6.6, 9.2 |
| T-14 | Assignees, dates, priority | Sat evening | I | T-11 | 6.8, 9.4 |
| T-15 | Comments and activity feed | Sat evening | A + I | T-11 | 6.9, 6.10, 8.5 |
| T-16 | My Tasks | Sat evening | I | T-14 | 9.5 |
| T-17 | Calendar and time blocks (local) | Sun morning | A + I | T-14 | 10.1, 8.6 |
| T-18 | Google connect and push | Sun morning | A | T-17 | 10.2, 10.3, 10.5 |
| T-19 | Google pull and reconciliation | Sun morning | A | T-18 | 10.4 |
| T-20 | Docs and pages | Sun afternoon | A + I | T-06 | 11, 8.7 |
| T-21 | Polish: shortcuts, empty states, responsive | Sun evening | I | all UI | 9 |
| T-22 | E2E tests and production release | Sun evening | A + I | all | 13 |

### Acceptance criteria

**T-01 Scaffold, tooling, deploy**

- [ ] Next.js App Router + TS strict + Tailwind + shadcn/ui initialized; repo matches the tree in Section 3.
- [ ] Scripts: `dev`, `build`, `typecheck`, `lint`, `test` (Vitest), `e2e` (Playwright), `db:migrate`, `db:seed`.
- [ ] `CLAUDE.md` links to `docs/blueprint.md` and repeats the agent rules of Section 2.
- [ ] App deploys to Vercel; a placeholder page loads on the production URL.

**T-02 Schema, migration, seed, position helper**

- [ ] `schema.prisma` matches Section 5; first migration applied to Neon dev branch.
- [ ] `seed.ts` creates 2 users, 1 space, 2 projects with default statuses, 3 lists, 15 tasks including 2 levels of subtasks, 1 linked task, 1 doc with 3 pages.
- [ ] `lib/position.ts` wraps fractional-indexing; tests cover insert at start, end, and between.

**T-03 Auth and guards**

- [ ] Sign up, sign in, sign out with email/password and with Google.
- [ ] Middleware redirects signed-out users to `/sign-in?next=…` and back after sign-in.
- [ ] `guards.ts` implemented; tests prove non-members get `NOT_FOUND`/`FORBIDDEN` and role checks follow the matrix in 7.3.

**T-04 Spaces and onboarding**

- [ ] New user without spaces sees "Create your space"; creating one yields Getting started project + General list and lands in it.
- [ ] Space switcher lists all memberships and remembers the last space (cookie).

**T-05 Members and invite links**

- [ ] Admin creates an invite with role, expiry and max uses; copying the link works.
- [ ] A second browser signs up through the link and lands in the space as the chosen role.
- [ ] Expired, revoked and used-up links show clear errors. Last-owner rules enforced.

**T-06 Projects and sidebar**

- [ ] Create, rename, recolor, reorder (drag) projects; sidebar shows projects → lists → docs.
- [ ] New project dialog offers "Copy statuses from…".

**T-07 Statuses and lists settings**

- [ ] Project settings page edits statuses (name, color, category, order) and lists (rename, reorder).
- [ ] Deleting a status requires a replacement; deleting a list requires a target list; min-one rules enforced with readable errors.

**T-08 Task services core**

- [ ] All `tasks.ts` functions in 8.4 implemented except move/link/setParent (T-13).
- [ ] Every mutation writes the right `Activity` rows in the same transaction.
- [ ] `getListView` returns Visible(L) exactly as defined in 6.7; tests cover home tasks, linked tasks, linked subtasks and completed tasks.

**T-09 List view**

- [ ] Rows match 9.2 and the list-view designs; the status control's menu changes status with optimistic update and rollback on failure.
- [ ] Inline add, drag reorder (Manual sort), View menu (sort, show completed) work; 200 tasks scroll smoothly.

**T-10 Quick add and parser**

- [ ] `q` opens quick add from any page; tokens in 9.3 parse into chips and are stripped from the title.
- [ ] Parser has at least 15 unit tests (dates, priorities, assignee and list tokens, combinations, no tokens).

**T-11 Task dialog shell**

- [ ] Opens from any row as the centered task dialog (design `task-dialog-*`); URL gains `?task=<id>`; reload keeps it open; `Esc`, `×` and a click outside close it; `↑`/`↓` step through the list.
- [ ] Breadcrumb, title edit, status control, description editor with autosave, properties column layout.

**T-12 Subtasks and display modes**

- [ ] Add subtasks inline from rows and the task dialog; creating at depth 3 is blocked with a message.
- [ ] View menu switches Nested / Separate for the list; Separate shows the parent title above each subtask; clicking it opens the parent.
- [ ] Convert to task / Make subtask of… works with cycle and depth checks.

**T-13 Move and add-to-list**

- [ ] "Move to…" and sidebar drop move top-level tasks with their subtrees; subtasks cannot be moved (menu item hidden, service rejects).
- [ ] "Add to list…" and Alt-drop link tasks or subtasks; linked marker shows; "Remove from this list" removes only the link.
- [ ] Cross-project targets never appear in pickers and are rejected by services (tested).

**T-14 Assignees, dates, priority**

- [ ] Panel pickers for assignees (members only), start date, due date with optional time, priority; rows reflect changes instantly.
- [ ] Overdue dates show red, today green.

**T-15 Comments and activity feed**

- [ ] Comment composer with Tiptap (basic marks), edit and delete own comments.
- [ ] Feed merges comments and activity, filter toggle works, every `ActivityType` renders a readable sentence.

**T-16 My Tasks**

- [ ] Groups Overdue / Today / Next 7 days / Later / No date; completing a task removes it with an undo toast.

**T-17 Calendar and time blocks (local)**

- [ ] Week/day/month views; Unscheduled rail; drop creates a 60-minute block; drag and resize update it; dropping again adds a second slot.
- [ ] Panel's Scheduled section lists and adds blocks. Works with Google not connected.

**T-18 Google connect and push**

- [ ] Connect/disconnect from Integrations; tokens stored encrypted; refresh handled.
- [ ] Creating, moving, resizing and removing a block creates/patches/deletes the Google event within 2 seconds; failures show ERROR with working Retry.

**T-19 Google pull and reconciliation**

- [ ] Google events for the visible range show read-only in gray, without duplicating our own events.
- [ ] Moving or deleting one of our events in Google updates or removes the block the next time the range is viewed.

**T-20 Docs and pages**

- [ ] Create docs, nested pages (max depth 3), reorder/re-nest via drag, autosave, conflict banner as in 11.2.

**T-21 Polish**

- [ ] All shortcuts in 9.7 work; empty states and skeletons on every view; mobile drawer and full-screen task dialog below 768px; no console errors.

**T-22 E2E tests and production release**

- [ ] Playwright smoke suite in Section 13 passes against a preview deployment.
- [ ] Production env vars set, migrations deployed, real space created, team invited.

### If you fall behind, cut in this order

1. T-19 (Google pull) → push-only sync.
2. Nested doc pages → flat page list (keep `parentId` null).
3. Drag-reorder in list view → "Move up/down" menu items.
4. Subtask depth 3 → depth 2.
5. T-16 My Tasks → later.

Never cut: permission guards, activity logging, same-project checks, soft delete with undo.

## 13. Testing, definition of done, deployment

Service tests protect the rules; a small Playwright suite protects the main flows. That is enough for an internal v1 and a solid base for commercial hardening.

### 13.1 Vitest service tests (must exist before release)

Run against a dedicated Neon test branch (or local Postgres in Docker), resetting data per test file.

- Guards: non-member gets `NOT_FOUND`; each role hits the matrix in 7.3 correctly.
- Invites: expiry, revocation, max uses, duplicate join, cannot invite as OWNER.
- Last-owner rules for `changeRole`, `removeMember`, `leaveSpace`.
- Statuses: min-one TODO/DONE rule, delete with replacement moves tasks and logs activity.
- Completion: Complete sets first DONE status + `completedAt`; status change out of DONE clears it; `includeSubtasks` / `completeSubtasks`.
- Subtasks: depth limit, inheritance of project/list, `setParent` cycle and depth checks.
- Move: cross-project rejected; subtask move rejected; subtree `homeListId` updated; existing link to target removed.
- Link: duplicate and home-list links rejected; remove link keeps the task in its home list.
- `getListView` visibility for all 6.7 cases.
- Activity: each mutation writes the expected type and payload; description coalescing.
- Soft delete and restore of a subtree.
- Docs: depth limit, last-page rule, `savePage` conflict.
- Google (mocked `googleapis`): push states PENDING → SYNCED / ERROR; reconciliation updates and deletes blocks correctly.

### 13.2 Playwright smoke suite

1. Sign up → create space → see Getting started.
2. Quick add `Write brief tomorrow p1` → row shows P1 and tomorrow's date.
3. Open task → add 2 subtasks → switch list to Separate → subtasks show parent title.
4. Create second list → add a subtask to it → appears there with parent title and link marker.
5. Move parent task to the second list → subtasks follow; activity feed shows the move.
6. Comment on a task → appears in the feed.
7. Create invite → second browser context joins → sees the same project.
8. Calendar: drag an unscheduled task into two slots → two blocks exist (Google mocked).
9. Create a doc → add a child page → type → reload → text persists.

### 13.3 Definition of done (every ticket)

- [ ] Acceptance criteria met and demonstrated on a preview deployment.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] No Prisma calls outside `src/server/services/`.
- [ ] Every new mutation is guarded and, for tasks, logged.
- [ ] No new dependency unless the ticket allowed it.
- [ ] Reviewer approved any diff touching `src/server/`, `prisma/` or auth.

### 13.4 Environment variables

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection (app runtime) |
| `DIRECT_URL` | Direct Postgres connection (migrations) |
| `AUTH_SECRET` | Better Auth secret; also signs Google OAuth `state` |
| `APP_URL` | Absolute base URL for links and OAuth redirects |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in and Calendar OAuth |
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM token encryption |

### 13.5 Deployment

1. Neon: one project with branches `main` (production), `staging`, `test`.
2. Vercel: production on `main`, a fixed staging domain on a `staging` branch. Build command: `prisma migrate deploy && next build`.
3. Google Cloud: enable Calendar API, configure consent screen (Internal if on Workspace), add redirect URIs for production and staging (10.5).
4. Security basics: HTTPS only, secure cookies, Better Auth rate limiting on, no secrets in client bundles, CSP default from Next.js.
5. Backups: rely on Neon point-in-time restore; note the retention window of your plan.

## 14. After v1: roadmap toward commercial

Nothing below is built this weekend. The v1 schema already leaves room for each item without migrations that break existing data.

| Stage | Additions | Schema impact |
| --- | --- | --- |
| v1.1 (after 2–3 weeks of team use) | Search (Postgres full-text on titles, `bodyText`, doc pages), Board view grouped by status, @mentions with in-app notifications, recurring tasks | New `Notification` table; tsvector indexes |
| v1.2 | Real-time updates (Postgres LISTEN/NOTIFY or a hosted realtime service), Google sync via `syncToken` + watch channels, email notifications | Uses reserved `syncToken`; new `WatchChannel` table |
| v2 (commercial) | Billing and plans per space, usage limits, project-level privacy, audit log UI, data export, Dari/Pashto/English i18n with RTL, Google OAuth verification | `Plan`/`Subscription` on `Space`; `ProjectMember` for private projects |

Open questions to settle before v1.1: whether statuses should also exist as space-level templates, and whether guests (external clients) need a restricted role.
