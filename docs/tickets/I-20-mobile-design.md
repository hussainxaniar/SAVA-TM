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

- [x] Design system for mobile: tokens, tab bar, row, chips, bottom sheet, floating button (component sheet, dark and light)
- [x] Tab 1 My tasks: grouped list with project / list on each row, add-task button, empty state
- [x] Task details (Todoist-like): sheet, status / date / assignee / priority pickers, subtasks, comments with docked composer
- [x] Tab 2 Calendar: 3-day view, See tasks floating button, tasks bottom sheet, drag-and-drop to schedule, block detail
- [x] Tab 3 All tasks (projects, lists, documents) and the List page grouped by status
- [x] Documents on mobile: page tree, reader / editor, slash menu bar, task link chips
- [x] Tab 4 More drawer (spaces, settings, integrations, sign out), notifications, quick add and error / loading states
- [ ] Review of the design with the owner, notes for the implementer, and implementation tickets — notes written
      (`docs/design/mobile.md`); the review and the tickets wait for the owner

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

## Owner's feedback applied (2026-10-10)

"For due date, comment and subtask number and project use font size 12px. Also increase the gap between this line and the title to 6px. Also
write the project text like [project]/[list], but it gets truncated when it becomes longer than the available space. Also increase the space
between one group and another group." Applied to the row component and every screen: meta 12/16, 6px gap, `Project/List` right-aligned on one
line with an ellipsis (max 200px), 20px extra above each group after the first.

## Completion record (2026-10-11)

- **Model:** Architect only (Opus 5.5); no implementer dispatch, no application code. Branch `develop`.
- **Drawn in Paper, page Mobile:** 12 artboards in light and 12 in dark (list and contents in `docs/design/mobile.md`). The light ones were
  drawn by hand from the component sheet; the dark ones were generated from the light ones by a script that re-writes each artboard with the
  `--dark-*` tokens and dark values for the few literal colours, then checked by eye (component sheet, My tasks, task details, calendar,
  calendar flow, More, shared sheet).
- **Exports:** `docs/design/mobile/*.jsx.txt` (the 12 light artboards). **Notes for the implementer:** `docs/design/mobile.md`.
- **Fixed during review of my own screenshots:** tab bar icon colours, the Done glyph size in the status sheet, chip alignment, a subtask title
  colliding with its date, the drag hint and the toast overlapping other elements, wrapped `Project/List` labels, dark calendar time colours.
- **Not verified / open:**
  - The two Todoist reference screenshots in the task were never seen (no `get_image` tool in this session's connection); the look follows
    the written brief and the owner's feedback on the first screen.
  - Dark artboards have generic layer names (the generator works from the code export, which carries no names).
  - Truncation in Paper cuts at a word ("Website ..."); in code it should be a normal CSS ellipsis.
  - Not designed: see "Not designed" in `docs/design/mobile.md`.
  - The owner added a second "01 My tasks — Light" artboard while the work was running; both were left as they are.
- **Owner's edits (2026-10-11):** a second task row without the project / list (title full width, flag at the end of the meta line), used on the
  List page and for the subtasks in task details; the list chips were removed from task details. The dark Components, My tasks, Task details
  and List page artboards were regenerated from the owner's light ones, and the four exports refreshed.
- **Next:** the owner reviews the design; then the implementation tickets (proposed list M-01 to M-08 in `docs/design/mobile.md`).
