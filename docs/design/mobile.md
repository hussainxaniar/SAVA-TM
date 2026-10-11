# Mobile design: notes for the implementer

Source: Paper file "SAVA TM", page **Mobile** (drawn 2026-10-10/11, ticket `docs/tickets/I-20-mobile-design.md`). Code exports of the light
artboards are in `docs/design/mobile/*.jsx.txt` (inline styles with `var(--color-*)` tokens; the dark artboards are the same markup with
`--dark-*`). Do not open image files. When this note and the Paper file disagree, the Paper file wins.

## Artboards

| Artboard | What it shows |
| --- | --- |
| 00 Components | Status glyphs, tab bar, task rows, group headers, chips, buttons, bottom sheet, navigation bar, screen header, offline banner, composer |
| 01 My tasks | Tab 1: Overdue / Today / Upcoming / No date |
| 02 Task details | Full-height sheet: breadcrumb, status + title, description, property chips, subtasks, activity, docked composer |
| 03 Task pickers | Bottom sheets: status, due date, assignees, priority |
| 04 Calendar | Tab 2: 3-day time grid |
| 05 Calendar flow | See tasks sheet, dragging, dropped (selected block), block detail sheet |
| 06 All tasks | Tab 3: projects with their lists and documents |
| 07 List page | A list grouped by status, nested subtasks |
| 08 / 09 Document | Page tree; page editor with the slash bar attached to the keyboard |
| 10 More | Tab 4: space switcher, notifications, settings, integrations, account |
| 11 Shared | Notifications, quick add, empty state, loading skeleton, offline banner + error toast, list menu sheet, space switcher sheet |

Every artboard exists as "— Light" and "— Dark".

## Tokens

The Paper tokens use the names of `src/app/globals.css` (`--color-background` = `bg-background`, `--color-muted-foreground`, `--color-border`,
`--color-divider`, `--color-pill`, `--color-primary`, `--color-selected`, `--color-selected-foreground`, `--color-done`, `--color-overdue`,
`--color-priority-1..3`, `--color-status-active`, `--color-success`, `--color-sidebar`, `--color-panel`). The dark artboards use `--dark-*`,
which are the `.dark` values, so in code there is one class per token and dark mode follows. Tokens that are **new for mobile** and need a
decision when implementing (reuse an existing one or add it): `--color-body` #3F3F46, `--color-icon` #52525B, `--color-faint` #A1A1AA,
`--color-sheet` (= popover), `--color-scrim` (#18181B at 40%, black at 60% in dark).

Not tokens (literal values in the design): avatar tints, project colours, and the calendar block tints (light: #DBEAFE / #EDE9FE / #DCFCE7 with
the project colour as a 3px left bar; dark: #1E2A4A / #2E1F5E / #14321F).

## Sizes

| Thing | Value |
| --- | --- |
| Screen | 390 wide, 16px side gutters |
| Touch target | 44px minimum (status circle, icon buttons, sheet actions) |
| Type | Screen title 28/34 bold (-0.02em); task title in details 20/28 semibold; sheet title 17/24 semibold; row title 16/22; body 15/22; chip 13/18 medium; meta 12/16; tab label 11/14 |
| Status glyph | 20px drawn, centred in a 44px target; 24px in task details; 14px inside pills and chips |
| Tab bar | 56px + the bottom safe area; icon 24, active tab = primary colour with a 2px stroke and a semibold label |
| Task row | Left padding 4, right 16. Title up to 2 lines with the priority flag (18px) top right. 6px gap. Meta line: due date (calendar icon 14 + text), subtask count, comment count on the left; assignee avatars (18px) and `Project/List` + the 8px project square on the right. The `Project/List` text is one line, right-aligned, max 200px, truncated with an ellipsis. Divider 1px `divider`, inset 48px from the left. Subtask rows are indented 28px |
| Task row without project (owner's variant, 2026-10-11) | Used where the list is already known: the **List page** and the **subtasks in task details**. No `Project/List`; the title takes the full width; the priority flag moves to the right end of the meta line, after the assignee avatars |
| Group header (date) | 44px, 15/20 semibold + count; 20px extra space above every group except the first; "Reschedule" action on Overdue |
| Group header (status) | 44px: chevron, status pill (24px high, radius 6, 12px semibold uppercase), count, add button |
| Chips | 32px high, radius 8, 10px side padding; outlined (border), filled (pill), selected (selected / selected-foreground), empty (dashed) |
| Floating add button | 56px circle, 16px from the right edge, 16px above the tab bar |
| "See tasks" button | 48px high pill, centred, 16px above the tab bar, count badge |
| Bottom sheet | Top radius 16, grabber 36x4 in a 20px area, header 44px, option rows 52px (members 56px), bottom safe area; scrim behind |
| Calendar | Time gutter 44px, 3 equal day columns, 56px per hour, all-day row 36px, day header 56px (today = filled 30px circle), now line 2px `overdue` with a 9px dot |
| Composer | 40px pill input + 36px send button, docked above the keyboard / safe area |

## Behaviour

- **No hover anywhere.** Tap a row = open the task; tap the status circle = status sheet (never a checkbox); the chips in task details open
  their sheets (status, due date, assignees, priority). The owner removed the list chips from task details on 2026-10-11; the list shows only in the breadcrumb.
- **Task details** opens as a full-height sheet from any list; the chevron or a swipe down closes it. The composer stays docked.
- **My tasks** groups: Overdue, Today, Upcoming, No date (as desktop My Tasks). Empty state has an "Add task" button.
- **Calendar**: "See tasks" opens a sheet with my open tasks. Long-press lifts a task, the sheet closes, and the task follows the finger; the
  drop slot snaps to 15 minutes and is 60 minutes long; a pill names the target ("Drop to schedule · Sun 3:00 PM"). After the drop the block is
  selected with two resize handles, dragging moves it, and a toast offers Undo. Tapping a block opens its detail sheet (Open task, Change time,
  Remove from calendar, Google sync state). Google events are grey and not editable. Due dates show as chips in the all-day row.
- **All tasks**: projects expand and collapse; a list opens the list page, a document opens its page tree.
- **List page**: groups by status, collapsible; subtasks nested under their parent (or separate, from the list menu sheet); rows do not repeat
  the list name. The list menu sheet holds the view options (subtasks nested / separate, show completed), rename, icon, statuses, delete.
- **Documents**: the page tree is its own screen; the editor shows "Saved" in the bar; typing "/" shows the block bar attached to the keyboard
  (scrolls sideways, first match highlighted); task links are chips with the status glyph.
- **More**: the space card opens the space switcher sheet; Notifications shows the unread count.
- **Quick add**: a sheet above the keyboard; recognised words (date, p1, @person, #list) are highlighted in the input and mirrored as chips.
- **States**: loading = skeleton rows, never a spinner over content; offline = a dark banner under the status bar; a failed save = a toast with
  Retry (the optimistic change rolls back as on desktop).
- Drag from anywhere still applies (reordering rows by long-press); no visible drag handles.

## Not designed (ask the owner before building)

Settings sub-pages (members, statuses, tokens, Google connect), sign-in / onboarding on a phone, search results, the month picker behind the
"October" title, reordering tasks, landscape and tablet widths.

## Proposed implementation tickets (to confirm after the owner's design review)

1. M-01 Mobile shell: tab bar, safe areas, routes for the four tabs, large-title header (replaces the T-21 responsive shell under 768px).
2. M-02 Task row and group headers for mobile; My tasks tab with empty and loading states.
3. M-03 Bottom sheet primitive and the four pickers (status, due date, assignees, priority).
4. M-04 Task details sheet (chips, subtasks, activity, docked composer) and quick add.
5. M-05 All tasks tab, list page, list menu sheet.
6. M-06 Calendar 3-day view, tasks sheet, long-press drag to schedule, block detail (Architect: touch drag maths as a tested hook).
7. M-07 Documents: page tree and editor with the keyboard slash bar.
8. M-08 More tab, space switcher, notifications list, offline banner and error toast.
