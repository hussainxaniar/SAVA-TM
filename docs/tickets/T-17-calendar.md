# T-17 (part 1 of 2) · The calendar page

**Model:** I (GLM 5.3 Flash) · **Full spec:** `docs/tickets/T-17.md`. Read that file's sections **Architect part**,
**1. Page layout**, **2. Unscheduled rail** and **3. FullCalendar**. Section 4 (the task dialog) is part 2; **don't do it
now**.

> **Do not open image files.** Don't browse `node_modules`: every option you need is named in T-17.md.

## Resuming

An earlier session already wrote `src/components/calendar/block-event.tsx` (a block's content) and
`src/components/calendar/unscheduled-rail.tsx` (the rail with the `Draggable`). Read them first, keep what matches
T-17.md, and fix what doesn't. `calendar-view.tsx` is still the stub.

## Work in small steps

- One file per Write, each under ~250 lines.
- Split the page into `calendar-toolbar.tsx` (the header band's toolbar), `calendar-grid.tsx` (FullCalendar, its
  events and handlers) and a thin `calendar-view.tsx` that composes the header, rail and grid.
- Don't paste file contents back into your messages.

## Files

```
Files to touch: src/components/calendar/* only
Files you may read: docs/tickets/T-17.md, src/hooks/use-calendar.ts, src/server/services/types.ts,
  src/components/my-tasks/my-tasks-view.tsx, src/components/task-dialog/activity.tsx (segmented toggle),
  src/components/ui/*, src/lib/list-view.ts, src/app/globals.css
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

T-17.md's first four acceptance items. Finish with `pnpm typecheck && pnpm lint && pnpm test`.
