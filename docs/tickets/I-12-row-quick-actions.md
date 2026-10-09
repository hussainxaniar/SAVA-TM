# I-12 · List rows: quick actions in the Assignee, Due and Priority columns

**Model:** A + I (GLM 5.3 Flash builds the cells) · **Sections:** blueprint 9.2 · **Design:** `docs/design/list-view-nested.jsx.txt` (row layout; the cells keep their sizes)
**Sava TM task:** "When hovering on the row, there should be options to action on each column." (SAVA TM > Test & Debug, subtask of "Table Columns"; owner's example: "add assignee, due date, and priority").

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages.
> Tabler icons only, theme tokens only (no hex colors), Base UI conventions as in nearby components (`PopoverTrigger render={...}`, no `asChild`). Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

## Already done (Architect, committed with this ticket)

- `useSpaceMembers()` (`src/hooks/use-space-members.tsx`) returns the current space's members (`UserLite[]`), provided by the space layout.
- `TaskRowProps` has a new callback **`onToggleAssignee(task, member)`** (adds the member at the end, or removes them if already assigned; optimistic, handled in `list-view.tsx`). Already passed to every `TaskRow`
  through `rowProps`, but **`task-row.tsx` does not destructure or use it yet**. Existing callbacks you will use: `onSetDue(task, day | null)` (a local day at 00:00, date only, `null` clears) and
  `onSetPriority(taskId, priority)` (1 to 4; 4 = none).
- Existing building blocks: `AssigneePicker` (`src/components/task-dialog/assignee-picker.tsx`, props `members`, `assignees`, `onToggle`; goes inside a `PopoverContent`, stays open so several can be toggled),
  `DatePicker` (`src/components/task-dialog/date-picker.tsx`, props `day`, `time`, `allowTime`, `onChange(day, time)`, `closeOnPick`, `showClear`), `PRIORITY_META` and `PriorityFlag`
  (`src/components/tasks/priority-flag.tsx`), `Popover` / `PopoverTrigger` / `PopoverContent` (`src/components/ui/popover.tsx`), `DropdownMenu*` (`src/components/ui/dropdown-menu.tsx`),
  `AvatarStack` (`src/components/tasks/avatar-stack.tsx`), `formatDue` and `dateOnlyFromLocal` / `quickDays` (`src/lib/list-view.ts`). `task-row-menu.tsx` shows how priority and due are offered in the row's `⋯` menu.

## Implementer handoff

```
Ticket: I-12   Read: blueprint 9.2 (only), src/components/tasks/task-row.tsx, src/components/tasks/task-row-menu.tsx (priority and due items),
  src/components/task-dialog/properties-column.tsx (how the dialog uses AssigneePicker / DatePicker in popovers), the files named above
Files to touch: NEW src/components/tasks/row-cell-actions.tsx, src/components/tasks/task-row.tsx
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

## What to build

Only the **NESTED row layout** (the fixed right columns, `md` and up). The SEPARATE (stacked) layout stays as it is.

1. In **`row-cell-actions.tsx`** export three components, each rendering the whole cell (keep the cell's current width and alignment: Assignee `w-[72px]`, Due `w-24`, Priority `w-8`, same flex classes as in `task-row.tsx` now):
   - **`AssigneeCell({ task, onToggle })`**: a `Popover` whose trigger is a full-cell button (`type="button"`, `aria-label="Assignees"`, `h-full w-full`, left-aligned). It shows `<AvatarStack users={task.assignees} />`; when there are **no assignees** it shows an
     `IconUserPlus` (16px, `text-muted-foreground`) that is **invisible until the row is hovered or focused**: `opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100` (the row already has the `group/row` class). The popover content
     (`align="start"`, `className="w-60 p-1"`) holds `<AssigneePicker members={useSpaceMembers()} assignees={task.assignees} onToggle={(m) => onToggle(task, m)} />`. **Keep one `Popover` mounted for the cell in both states**
     (empty and filled), so adding the first assignee does not unmount the open picker.
   - **`DueCell({ task, onSetDue })`**: same pattern. The trigger shows the due label exactly as the cell does today (pass the already computed `due` label and class in as props `label` and `className`, so there is one source), or, when there is
     no due date, an `IconCalendarPlus` revealed on row hover like above. The popover content holds `<DatePicker day={…} time={null} allowTime={false} onChange={(day) => onSetDue(task, day)} />`, where `day` is the task's due date as a local day at 00:00
     (parse `task.dueDate` with `new Date(task.dueDate)` for date-only values, then take its UTC y/m/d into a local `new Date(y, m, d)`; use `null` when there is none), and a **Clear** (the picker's own `showClear`) that calls `onSetDue(task, null)`.
   - **`PriorityCell({ task, onSetPriority })`**: a `DropdownMenu` whose trigger is the flag button (`aria-label="Priority"`): `PriorityFlag` when the priority is 1 to 3, and when it is 4 (none) an outline `IconFlag` (14px, muted) revealed on row hover. The menu content is a `DropdownMenuRadioGroup`
     of the four `PRIORITY_META` entries (flag glyph + label), value = current priority, `onValueChange={(v) => onSetPriority(task.id, Number(v) as Priority)}` (copy the radio items from `task-row-menu.tsx`, `closeOnClick`).
2. **Events (the traps from `docs/agent-handbook.md`, section 4, bug class 1):** the triggers must not open the task or start something else on the row. On every trigger `onClick={(e) => e.stopPropagation()}`; on the `PopoverContent` and the `DropdownMenuContent`
   stop `onClick`, `onPointerDown` **and** `onKeyDown` from bubbling (they are portaled, but React bubbles through portals into the row, which opens the task dialog or starts a drag). Do **not** stop `pointerdown` on the triggers themselves: the row still drags from anywhere.
3. In **`task-row.tsx`** destructure `onToggleAssignee`, and in the NESTED return replace the three cells (Assignee, Due, Priority) with `<AssigneeCell …/>`, `<DueCell …/>`, `<PriorityCell …/>` passing the existing `due` object and `onSetDue` / `onSetPriority`.
   Temporary rows (`task.id.startsWith("temp-")`) render the cells without triggers (plain, as before), because they cannot be edited yet.
4. Hover affordances only apply on devices with hover; do nothing special for touch.

## Acceptance

- [ ] Hovering a row with no assignee, due date or priority shows a faint user-plus, calendar-plus and flag in their columns; they are not visible when the row is not hovered. Clicking each opens its picker and changes the task (the row updates at once).
- [ ] Clicking a filled cell (avatars, date, flag) opens the same picker to change it; clicking elsewhere on the row still opens the task dialog; dragging a row still works from every cell.
- [ ] Adding the first assignee keeps the picker open (more members can be toggled); Esc and outside click close it; no sentence in the picker starts a keyboard drag (space in the member search works).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
