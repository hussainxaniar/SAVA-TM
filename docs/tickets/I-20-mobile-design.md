# I-20 · Mobile UI design in Paper

**Sava TM task:** "Mobile UI design in Paper (tab bar, My tasks, task details, Calendar, All tasks, More)" (project SAVA TM, list Features, also in Weekly Tasks; priority High, due 2026-10-16)
**Model:** A (design work in Paper by the orchestrator; no application code) · **Branch:** `develop`
**Design:** Paper file "SAVA TM", page "Mobile"

## Owner's brief (from the task, 2026-10-10)

Complete mobile UI design for Sava TM on the Paper page "Mobile", Todoist-like (two reference screenshots are attached to the task), following
the desktop design: same tokens, Tabler icons plus the Paper status and subtask glyphs, status glyph rules, priority flags, dark and light, Inter.
Phone artboards 390 x 844 with the mobile status bar; 44px minimum touch targets; two-line rows; nothing that needs hover; actions through taps
and bottom sheets. Bottom tab bar with 4 tabs: My tasks, Calendar, All tasks, More. Deliverables: all screens as artboards, a component sheet,
dark and light, plus notes for the implementer in the task comments. Implementation is a separate task afterwards.

## Subtasks (as in Sava TM)

- [ ] Design system for mobile: tokens, tab bar, row, chips, bottom sheet, floating button (component sheet, dark and light) — **in progress**
- [ ] Tab 1 My tasks: grouped list with project / list on each row, add-task button, empty state
- [ ] Task details (Todoist-like): sheet, status / date / assignee / priority pickers, subtasks, comments with docked composer
- [ ] Tab 2 Calendar: 3-day view, See tasks floating button, tasks bottom sheet, drag-and-drop to schedule, block detail
- [ ] Tab 3 All tasks (projects, lists, documents) and the List page grouped by status
- [ ] Documents on mobile: page tree, reader / editor, slash menu bar, task link chips
- [ ] Tab 4 More drawer (spaces, settings, integrations, sign out), notifications, quick add and error / loading states
- [ ] Review of the design with the owner, notes for the implementer, and implementation tickets

## Decisions so far

- **Tokens** were created in the Paper file (it had none): the light set uses the names of `src/app/globals.css` (`--color-background`,
  `--color-foreground`, `--color-muted-foreground`, `--color-border`, `--color-divider`, `--color-pill`, `--color-primary`, `--color-selected`,
  `--color-done`, `--color-overdue`, `--color-priority-1..3`, `--color-status-active`, ...) with the same values; the dark set is the `.dark`
  block converted to hex under `--dark-*`. Added for mobile: `--color-sheet`, `--color-scrim`, `--spacing-gutter` 16, `--spacing-touch` 44,
  `--spacing-tabbar` 56, `--radius-chip` 8, `--radius-card` 12, `--radius-sheet` 16 and the type sizes below.
- **Type scale (Inter):** screen title 28/34 bold, sheet title 20/26 semibold, row title 16/22, body 15/22, meta 13/18, group label 13 semibold,
  tab label 11/14 medium.
- **Sizes:** 390 x 844 artboards, 16px gutters, 44px minimum targets, status glyph drawn at 20px inside a 44px target, tab bar 56px plus the
  34px home indicator, bottom sheets with a 16px top radius and a grabber.
- **Paper technique:** icon colours must be set as `stroke` / `fill` attributes with `var(--token)` on each path (`currentColor` and a stroke on
  the `<svg>` do not reach the paths), and such colours are not found by `find_nodes`; dark screens are therefore written with the `--dark-*`
  tokens rather than converted from the light ones.

## State (2026-10-10)

- Artboard "00 Components — Light" is complete: status glyphs, tab bar, task rows (full, overdue, subtask, done), group headers (date group,
  status group, collapsed Done), chips (due, priority, list, selected, empty, task link), buttons (floating add, extended "See tasks",
  primary, secondary, text, icon, send), bottom sheet (status picker), navigation bar, large-title screen header, offline banner, comment
  composer. Screens are assembled from these with `<x-paper-clone>`.
- Artboard "01 My tasks — Light" is drawn (Overdue / Today / Upcoming / No date, floating add button, tab bar).
- Still open in subtask 1: the dark component sheet. Still open in subtask 2: the empty state and the dark version.
- Not yet seen: the two Todoist reference screenshots (this session's `sava` connection did not list a `get_image` tool, and the image URL
  asks for a sign-in), so the direction is from the written brief only and waits for the owner's look before the remaining screens are drawn.
- Row anatomy chosen: line 1 = title (max 2 lines) with the priority flag on the right; line 2 = due date, subtask count, comment count on the
  left and assignee avatars plus the list name with the project colour square on the right.
