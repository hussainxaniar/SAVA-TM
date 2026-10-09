# I-06 · In-app notifications (bell, list, mark read)

**Model:** A + I (the Architect part is done and committed; GLM 5.3 Flash builds the UI) · **Sections:** blueprint 16 (all of it), 9.1 ·
**Sava TM task:** "Notification" (SAVA TM > Features, priority Urgent, due 2026-10-10) with 6 subtasks.

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages.
> Tabler icons only, theme tokens only (no hex colors), Base UI conventions as in nearby components (`Popover` has `render=` not `asChild`).
> Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`. No new dependencies.

## Already done (Architect, committed)

- Table `Notification` + migration `20261009012006_notifications`; service `src/server/services/notifications.ts`
  (`notifyFromActivities` is called by `logActivity` / `logActivities`, so notifications appear by themselves).
- Actions `src/server/actions/notifications.ts` and the hook file **`src/hooks/use-notifications.ts`**:
  - `useUnreadCount(spaceId)` → `{ data?: number }`, polls every 30 s and on window focus (this drives the badge).
  - `useNotificationList(spaceId, open)` → `{ data?: NotificationDTO[], isLoading }`, loads only while `open` is true.
  - `useMarkRead(spaceId)` → mutation; call `.mutate(notificationId)`. `useMarkAllRead(spaceId)` → mutation; call `.mutate()`.
- `src/lib/notification-format.ts`: `notificationParts(n)` → `{ before, after }` and `notificationHref(spaceId, n)` → the task URL.
  A row reads `<actor first name> <before> <task title><after>`, e.g. "Ada commented on Write the brief",
  "Ben changed the status of Write the brief to Review". `relativeTime(iso)` is in `src/lib/activity-format.ts`.
- `NotificationDTO` (`src/server/services/types.ts`): `{ id, type, createdAt, readAt, actor: UserLite, task: { id, title, projectId, homeListId }, statusName, completed, dueDate, dueHasTime }`.

## Implementer handoff

```
Ticket: I-06   Read: blueprint 16.4 (only), src/components/sidebar/sidebar.tsx and space-switcher.tsx (style to match),
  src/components/ui/popover.tsx, src/components/tasks/avatar-stack.tsx (Avatar), src/hooks/use-notifications.ts,
  src/lib/notification-format.ts, src/components/task-dialog/activity.tsx (how rows with names and relative times look)
Files to touch: NEW src/components/notifications/notification-bell.tsx, NEW src/components/notifications/notification-list.tsx,
  src/components/sidebar/sidebar.tsx (only the line that renders <SpaceSwitcher />)
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

## What to build

1. **`NotificationBell({ spaceId })`** (client component, `notification-bell.tsx`): a `Popover` whose trigger is a 32px ghost icon button
   (`IconBell`, 18px, `text-muted-foreground`, `hover:bg-sidebar-accent`, rounded-md, `aria-label="Notifications"`). When `useUnreadCount(spaceId).data > 0`
   show a badge on the button's top-right: `min-w-4 h-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground`,
   text = the count, or `99+` above 99; add the count to the button's accessible label ("Notifications, 3 unread"). Control the popover with
   `open` state and pass it to `useNotificationList(spaceId, open)`.
2. **`PopoverContent`** (`align="start"`, `className="w-[min(380px,calc(100vw-24px))] p-0"`): a header row (`flex h-11 items-center px-3 border-b border-border`):
   title "Notifications" (`text-sm font-semibold`, grows) and a ghost `Button` "Mark all as read" (`size="sm"`, disabled when the count is 0 or
   the list is empty) that calls `useMarkAllRead(spaceId).mutate()`. Below, a scroll area (`max-h-[420px] overflow-y-auto`) with
   `<NotificationList />`. Loading: three skeleton lines (`animate-pulse` rounded bars). Empty: centered muted text "You're all caught up".
3. **`NotificationList({ spaceId, items, onOpen })`** (`notification-list.tsx`): one `<button type="button">` per notification, full width, left-aligned,
   `flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent` with a `border-b border-border` between rows (not after the last). Content: `Avatar user={n.actor}` (28px
   like the comment avatars), then a column: the sentence `<firstName> <before> <b>{task title}</b><after>` (`text-[13px] leading-[18px]`, the actor name and
   task title `font-medium text-foreground`, the rest `text-foreground/75`, title truncated to one line with `truncate`... a sentence may wrap to two lines, fine) and
   below it the relative time (`text-xs text-muted-foreground`). Unread rows (`!n.readAt`) show a 8px `bg-primary` dot at the right
   (`mt-1.5 shrink-0 rounded-full`); read rows show nothing there and use `text-muted-foreground` for the sentence. Clicking a row calls `onOpen(n)`.
4. In the bell, `onOpen(n)`: `useRouter().push(notificationHref(spaceId, n))`, `markRead.mutate(n.id)` if `!n.readAt`, and close the popover.
5. **Sidebar**: in `sidebar.tsx`, replace `<SpaceSwitcher current={space} spaces={spaces} />` with
   `<div className="flex items-center gap-1"><div className="min-w-0 grow"><SpaceSwitcher current={space} spaces={spaces} /></div><NotificationBell spaceId={space.id} /></div>`.
   Nothing else in the sidebar changes.
6. Keyboard: the popover must close on `Esc`; rows are real buttons so `Tab`/`Enter` work. Stop `keydown` propagation only if a parent shortcut would
   fire (the global shortcuts ignore events from popovers; check `use-global-shortcuts.ts` before adding anything).

## Acceptance

- [x] The bell shows in the sidebar header with the unread count; it updates within 30 s of someone else's action and when the window regains focus.
- [x] Opening it lists notifications newest first with avatar, sentence and time; unread ones have a dot.
- [x] Clicking one opens the task dialog on the right list and clears its dot and one from the badge; "Mark all as read" clears everything.
- [x] Works in dark mode and below 768px (the popover never overflows the screen).
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.

## Completion record (2026-10-09)

**Models:** Architect (Sonnet 5.5): blueprint Section 16, schema + migration `20261009012006_notifications`, `notifications.ts` service and its hook into
`logActivity(ies)`, actions, `use-notifications.ts`, `notification-format.ts`, 13 tests. UI: GLM 5.3 Flash (one dispatch, no re-dispatch; the three checks passed
in its own run).

**Review fixes (Architect):** the task title was an `inline-block` with `truncate`, which broke the sentence onto a different baseline; replaced by a plain
inline span and `line-clamp-3` on the paragraph. Nothing else needed changing; Flash touched only the three allowed files.

**Behavior notes:** choosing a DONE status through `updateTask` logs only `STATUS_CHANGED` (no `TASK_COMPLETED`), so that notification reads "changed the status of
X to Done"; the complete / reopen buttons log `TASK_COMPLETED` / `TASK_REOPENED` and read "completed X" / "reopened X". Completing a parent together with its subtasks
notifies the people on each subtask separately.

**Checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (281 tests, 13 of them new) pass.

**Browser QA** (local dev server restarted so it loaded the new Prisma client; seed users): as Ada, a comment and a due-date change on a task assigned to Ben;
as Ben the bell showed badge 2, the popover listed both with Ada's avatar, sentence and "just now" and an unread dot each; clicking one opened the task dialog on
the right list and the badge became 1; "Mark all as read" cleared the badge and the dot and muted the rows; no console errors. The two actions were made with a
throwaway script through the services (deleted); the local seed task "Collect stakeholder input" now has due date Oct 12 from that test.

**Not verified:** phone width (the popover is `min(380px, 100vw - 24px)` by construction), dark/light switch beyond dark, the 30-second poll timing across two
live browsers, and production. **Not pushed.** Pushing runs a database migration on production (`20261009012006_notifications`, additive: one enum, one table,
indexes and foreign keys; no existing data is touched), so the owner should say "push".
