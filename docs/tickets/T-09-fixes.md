# T-09 (part 3) · Review fixes from the human

**Model:** I · **Spec:** blueprint 6.2, 9.1, 9.2, 9.8 (updated 2026-09-30) · **Designs:** `docs/design/list-view-*.jsx.txt`
(exact code export of the designs), `docs/design/icons.md`

> **Do not open image files** (`.jpg`, `.png`): the implementer model can't read images and the session will
> fail. Everything you need is in the `.jsx.txt` exports and this ticket.

## Implementer handoff

```
Ticket: T-09 fixes — status menu, drag from anywhere, sidebar alignment, lucide icons
Read: docs/blueprint.md 6.2, 9.1, 9.2, 9.8; this file; docs/design/icons.md; docs/design/list-view-nested.jsx.txt (sidebar block for positions)
Never open .jpg/.png files.
Files to touch: src/components/tasks/* (existing files; new files allowed there),
  src/components/sidebar/project-tree.tsx, src/components/project-settings/sortable-rows.tsx
  (and statuses-editor.tsx / lists-editor.tsx only if the SortableRow API changes)
Files you may read: src/hooks/use-list-view.ts (useSetStatus, useSetCompleted), src/lib/list-view.ts,
  src/components/ui/*, src/server/services/types.ts, src/app/globals.css
Do not touch: prisma/, src/server/, src/app/, src/lib/, src/hooks/, package.json, other components.
Do not add dependencies. Do not run shadcn, prisma or any installer.
```

The Base UI rules from T-09 still apply (`render=` not `asChild`, `closeOnClick` on radio items that should close
the menu, `DropdownMenuLabel` inside `DropdownMenuGroup`, controlled `AlertDialog`), as do the dnd-kit rules
(`DndContext id={useId()}`, no `@dnd-kit/utilities`).

### 1. The circle is a status menu, not a checkbox (ClickUp-style)

- Replace the status "checkbox" button in both row variants with a **`StatusControl`** component
  (put it in `status-icon.tsx`). It's a `DropdownMenuTrigger` showing the task's status icon (sizes as now: 18px, or 16px
  when done), with `aria-label="Status: <status name>"`.
- The menu (`align="start"`) is a `DropdownMenuGroup` with the label "Status", then one item per status in
  `data.statuses` order: its category icon (14px) + its name + a `Check` on the current one. Items close the menu
  on click.
- Choosing the current status does nothing. Choosing another:
  - if it's a **DONE**-category status, the task isn't done, and `task.openSubtaskCount > 0` → the existing
    "Also complete N open subtask(s)?" dialog. "Complete all" →
    `useSetStatus(listId).mutate({ taskId, statusId, completeSubtasks: true })`; "Only this task" → the same
    without `completeSubtasks`;
  - otherwise → `useSetStatus(listId).mutate({ taskId, statusId })`.
- The row menu keeps **Complete / Reopen** (these use `useSetCompleted`, with the same subtask prompt as now).
- Pass `statuses` down to the rows (they're in `data.statuses`).

### 2. Drag from anywhere on the item (no handles)

Like ClickUp and Todoist, an item is dragged by pressing anywhere on it and moving. A plain click still works,
because `PointerSensor`'s `activationConstraint: { distance: 4 }` only starts a drag after 4px.
- **List rows**: remove the 6-dot handle entirely. Put the sortable `{...attributes} {...listeners}` on the
  **row element** itself (NESTED: the root row; the sortable wrapper still contains its subtree so the subtree
  moves with it; SEPARATE: the row). Only roots are draggable, as now, and only with Manual sort. While dragging:
  `cursor-grabbing`, `opacity-50` and `relative z-10` on the dragged item.
- **Sidebar projects** (`project-tree.tsx`): remove the grip button. The whole project row carries the
  listeners (not the list/doc rows beneath it). Keep the chevron, link, `⋯` and inline-rename working.
- **Settings rows** (`sortable-rows.tsx`): remove the grip; the whole row is the drag target. Keep
  `aria-label`-equivalent accessibility by setting `aria-roledescription="sortable"` (from `attributes`) and
  giving the row `title="Drag to reorder"`. Note that inputs inside a row (inline rename) must stay usable:
  `onPointerDown={(e) => e.stopPropagation()}` on the inline `Input`s.

### 3. Sidebar alignment: match the design exactly

With the grip gone, the tree must line up with the design (`docs/design/list-view-nested.jsx.txt`; x from the sidebar's
left edge; the sidebar has 8px horizontal padding):

| Element | Design position |
|---|---|
| project chevron (14px) | starts at x=12 (row `pl-1`) |
| project color square (8px, `mx-1`) | x=36–44 |
| project name | starts at x=54 |
| list icon (16px) | x=44–60 (row `pl-9`) |
| list name | starts at x=68 |
| list count | right-aligned, ends at x=244 |

Nothing may be absolutely positioned or offset to the left of the chevron. Verify it by measuring in the
browser (DevTools) against these numbers.

### 4. Icons: lucide everywhere, except the subtask glyph and the priority flag

Replace **every hand-drawn `<svg>`** in `src/components/tasks/`, `src/components/sidebar/` and
`src/components/project-settings/` with `lucide-react` icons. The **only** two exceptions (see
`docs/design/icons.md`): `SubtaskGlyph` in `status-icon.tsx` (keep as is) and `PriorityFlag` in
`priority-flag.tsx`, the design's **filled** flag (lucide's `Flag` is an outline, so don't use it). Make sure
`PriorityFlag` draws exactly the `icons.md` path, filled and stroked with `currentColor`. Mapping:

| Use | lucide icon | Classes |
|---|---|---|
| Status To do | `CircleDashed` | `text-muted-foreground` |
| Status Active | `ChartPie` | `text-status-active` |
| Status Done (rows, menu) | `CircleCheck` | `fill-done text-white` (a green disc with a white check) |
| Done group pill icon | `CircleCheck` | `fill-white text-done` |
| Priority flag P1–P3 | `PriorityFlag` (custom, see above) | `text-priority-1/2/3` |
| Row hover "+" | `Plus` | as now |
| Anything else | the obvious lucide icon | |

Remove the old custom status SVG components once nothing uses them (keep `SubtaskGlyph` and `PriorityFlag`).

## Acceptance

- [ ] Clicking a task's circle opens the status menu; choosing a status updates the row instantly (and moves it
  to that status's group); Done with open subtasks asks first.
- [ ] Rows, sidebar projects and settings rows drag from anywhere; clicks, menus and inline edits still work.
- [ ] Sidebar matches the design positions above; no visible drag handles anywhere.
- [ ] No hand-drawn SVGs except `SubtaskGlyph` and `PriorityFlag`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no lint warnings.
