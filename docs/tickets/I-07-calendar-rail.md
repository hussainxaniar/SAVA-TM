# I-07 · Calendar: scheduled tasks stay in the left rail

**Model:** A + I (GLM 5.3 Flash builds the rail UI) · **Sections:** blueprint 10.1 (updated), 8.6 ·
**Sava TM task:** "Calendar: scheduled tasks shouldn't disappear from sidebar" (SAVA TM > Test & Debug, priority High).

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages.
> Tabler icons only, theme tokens only (no hex colors). Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

Owner's words (task description): "The sidebar should maintain scheduled tasks, so it can be assigned into another slots."

## Already done (Architect)

- Service `listCalendarTasks` (was `listUnscheduled`) returns **every** open task assigned to the caller, each with
  **`nextBlockStart: string | null`** (ISO start of the caller's next slot that has not ended; `null` = nothing upcoming). Order: tasks with nothing upcoming first
  (list order), then scheduled ones by next slot. Action `listCalendarTasksAction`, hook **`useCalendarTasks(spaceId, projectId)`** in `src/hooks/use-calendar.ts`
  (same data shape plus the new field; creating a block marks the row at once, the list reorders when the server answers). Type `CalendarTaskDTO = MyTaskDTO & { nextBlockStart }`.
- The component file was renamed **`src/components/calendar/task-rail.tsx`**, component **`TaskRail`** (import in `calendar-view.tsx` updated). Its body still
  says "Unscheduled" and uses the old type; that is what this ticket changes.
- Blueprint 10.1 describes the new behavior; the e2e smoke test (flow 8) now expects a scheduled task to stay on the rail.

## Implementer handoff

```
Ticket: I-07   Read: blueprint 10.1 (only), src/components/calendar/task-rail.tsx, src/hooks/use-calendar.ts (useCalendarTasks only),
  src/lib/list-view.ts (formatDue, for the style of date labels), src/components/task-dialog (how the Scheduled section words a slot, to match it)
Files to touch: src/components/calendar/task-rail.tsx only
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

## What to build (all in `task-rail.tsx`)

1. Heading: `h2` text **"My tasks"** (was "Unscheduled"; keep it an `<h2>`, the e2e test finds the rail by that heading). Empty text: "No open tasks assigned to you."
2. Use **`CalendarTaskDTO`** instead of `MyTaskDTO` for the rows and the hook result (`useCalendarTasks`, already imported under that name).
3. **Scheduled rows** (`task.nextBlockStart !== null`): same row, still draggable (keep `data-task-id` / `data-title` / `data-color` on every row, nothing about the
   Draggable setup changes), but on the second line, after the project/list text, show a small clock icon (`IconClock`, 12px) and the slot as short local text, e.g.
   "Thu 10:00" (weekday short + 24-hour time in the browser's time zone; if it is today use "Today 10:00", tomorrow "Tomorrow 10:00"). Put it in a muted style
   (`text-muted-foreground`) and add `title="Next slot: <full local date and time>"`. The due date label that is already on the right stays where it is; if both
   do not fit, the project/list text truncates first (`min-w-0 truncate`, the slot and due are `shrink-0`).
4. Unscheduled rows look exactly as before. Do not add dividers or extra headings; the order from the server (unscheduled first) is what separates them.
5. Do not change the project filter, the Draggable effect or the drop behavior.

## Acceptance

- [x] The calendar's left rail is titled "My tasks" and lists every open task assigned to me.
- [x] After dragging a task into the grid its row stays in the rail, now with a clock and its next slot, and it can be dragged again into another slot.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.

## Completion record (2026-10-09)

**Models:** Architect (Sonnet 5.5): service change (`listCalendarTasks` with `nextBlockStart`), rename of the service/action/hook/component, DTO, hook
optimism, tests, blueprint 10.1 / 8.6 / acceptance list, e2e update. UI: GLM 5.3 Flash (one dispatch, no re-dispatch; diff touched only `task-rail.tsx`).

**Review:** the diff matched the ticket; no fixes needed. (`slotLabel` renders only after the query resolves on the client, so there is no hydration mismatch.)

**Decision:** the rail heading is "My tasks" (not "Unscheduled", which would be wrong now). Scheduled rows sort after unscheduled ones by next slot, and a
block that has already ended does not count as scheduled. Only the caller's own blocks mark a row.

**Checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (281 tests) pass. `pnpm e2e`: all 11 smoke flows pass. Two e2e edits were needed: flow 8 now expects a
scheduled task to stay on the rail (its selector is the "My tasks" heading), and flow 10 clicks "All" before counting the "via AI" labels, because since I-05 a task
with comments opens on "Comments".

**Browser QA** (local, seed user Ben): the rail showed all 7 open tasks; dragging "Email marketing team" into Saturday 10:00 created the block and the row stayed, moved below the
unscheduled ones and labelled "Tomorrow 10:15"; dragging the same row into Sunday 14:00 created a second block; no console errors. The two QA blocks were deleted afterwards.

**Not verified:** a real Google Calendar sync of the new second slot (Google is faked in tests; awaiting the owner's consent test, see T-18/T-19), phone width. **Not pushed.**
