# M-00 · Mobile UI implementation: summary and completion record

**Sava TM task:** "Mobile UI implementation (from the Paper design, branch develop)" (project SAVA TM, Features; subtasks M-01 to M-08)
**Design:** Paper file "SAVA TM", page Mobile · notes `docs/design/mobile.md` · exports `docs/design/mobile/` · **Branch:** `develop` (not pushed)

> Owner, 2026-10-11: "Now the second phase of this task starts. Following the agentic workflow for Sava TM, and following the designs you created
> in Paper, implement this design in this new branch."

## How it is built

Below 768px the app renders a separate set of phone components (`src/components/mobile/`) over the **same hooks, actions and services** as the desktop
layout. Nothing in `prisma/` or `src/server/` changed. Each desktop view picks its phone twin with `useIsMobile()`:

| Screen | Phone component | Chosen in |
| --- | --- | --- |
| Shell: bottom tab bar instead of the sidebar | `mobile-shell.tsx`, `tab-bar.tsx` | `sidebar/sidebar.tsx` |
| My tasks | `my-tasks.tsx`, `task-row.tsx` | `my-tasks/my-tasks-view.tsx` |
| Task details and pickers | `task-body.tsx`, `task-pickers.tsx`, `task-subtasks.tsx` | `task-dialog/task-dialog.tsx` |
| Calendar | `calendar-view.tsx`, `calendar-tasks-panel.tsx`, `calendar-block-sheet.tsx` | `calendar/calendar-view.tsx` |
| All tasks (new route `/s/[spaceId]/all`) | `all-tasks-view.tsx` | its page |
| List page | `list-view.tsx`, `list-menu-sheet.tsx` | `tasks/list-view.tsx` |
| Documents | `doc-view.tsx`, `rich-text/slash/slash-bar.tsx` | `docs/doc-view.tsx`, `slash-menu.tsx` |
| More (new route `/more`), notifications (new route `/notifications`) | `more-view.tsx`, `notifications-view.tsx` | their pages |

Architect pieces (Opus 5.5), each with its reason:

- **Phone in the first paint** (`src/lib/mobile-hint.ts`, `src/hooks/mobile-hint.tsx`, `useIsMobile`): the server reads `Sec-CH-UA-Mobile` / the user agent, so a phone
  never flashes the desktop layout. Tablets count as desktop. Unit-tested.
- **`BottomSheet`** (`src/components/ui/bottom-sheet.tsx`) on the Base UI dialog: stops event bubbling to the row underneath (handbook bug class 1), keeps its scrim
  when opened from the full-screen task dialog (`forceRender`), rides above the on-screen keyboard.
- **`StatusControl` is phone-aware**: a 44px target that opens the status sheet, so every place that shows a status got it at once.
- **`useKeyboardInset`** (visual viewport; unit-tested): bottom sheets, quick add and the slash bar sit above the iOS keyboard.
- **Calendar drag** (`use-task-drag-source.ts`, phone mode of `calendar-grid.tsx`): FullCalendar's own long-press dragging (350ms). The tasks panel is not a
  `BottomSheet`: it must stay mounted and slide away when the drag starts, because FullCalendar only accepts a drop where the grid is the topmost element.
  After a drop: a "Scheduled …" toast with Undo. A tap on a block opens its sheet; a long press selects it for moving and resizing (FullCalendar built-in).
- **Tokens** `body`, `icon`, `faint`, `scrim` in `globals.css` (light and dark); fields are 16px on phones so iOS does not zoom; toasts sit above the tab bar.
- **`scripts/dispatch-ticket.sh`** pins every model slot to the implementer model (owner's rule, 2026-10-11: no Claude model through OpenRouter).

Implementer (GLM 5.3 Flash, six dispatches): tickets `M-01` to `M-07` in this folder.

## Review fixes (architect)

- M-02 stopped on an OpenRouter 402 before its last file: the phone loading skeleton was written in review.
- Completed tasks keep a neutral due colour; `MyTaskDTO` typing; a row whose only extras are avatars or the flag shows them beside the title.
- Title and description editors shared one React key in the phone task body (duplicate-key warning): distinct keys.
- The task dialog was not truly full screen on a phone (a max-height left a strip); sheets opened from it had no scrim.
- The 16px rule also shrank the big title fields: they are excluded (`data-title-field`).
- One-line drag hint, aligned "New page" row.

## Checks

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (35 files, 329 tests) pass.
- `pnpm e2e` 11/11 (desktop). Two flows were fragile and were fixed in the test: flow 5 navigated before the move had finished; flow 8 broke on the last day of
  the week (ambiguous "Next" button, and the reload returning to this week).
- Browser at phone size (Playwright, iPhone 14 profile, seed user Ada) for every screen: My tasks, status sheet (does not open the task), task details with the
  priority, due date and assignee sheets, add subtask, delete; All tasks; list page (add task, list menu); More, theme, notifications (empty), quick add sheet;
  document, pages sheet, slash bar (12 blocks); calendar: 3 days, tasks panel, **a simulated long-press drag that created a block**, the toast, the block sheet and
  Remove. Dark mode looked at for task details, More and the calendar. No console errors, no sideways scroll. Desktop at 1440px: sidebar layout unchanged.

## Not verified

- **A real phone.** Everything was checked in an emulated phone in desktop Chrome. Not checked on iOS Safari or Android Chrome: the keyboard inset, safe areas,
  long-press drag with a finger, swipe between days, the slash bar above the real keyboard.
- Notification rows with real notifications (the seed user has none), the Google sync row in the block sheet (Google not connected locally), the space switcher with
  more than one space, "Create a space" from the sheet.

## Differences from the design (decided here; tell the owner)

- The page tree is a bottom sheet opened from the editor, not its own screen (keeps the document URLs as they are).
- While a task is dragged over the grid, FullCalendar shows its own placeholder block with the time, and the lifted row is hidden; the hint pill says
  "Drop on the calendar to schedule" without the time.
- The block sheet has no "Change time" row: a long press on the block moves and resizes it.
- Not built: "Reschedule" on the Overdue group (behaviour undefined), search, "New list or document" in All tasks, delete list on a phone, list chips in task details
  (removed by the owner in the design), the month picker behind the calendar title, the offline banner (needs offline detection that does not exist yet), phone layouts for
  the settings, integrations, sign-in and onboarding pages (they keep their responsive desktop layout inside the phone shell).
- My tasks merges "Next 7 days" and "Later" into "Upcoming" and its groups do not collapse, as drawn.

## Follow-ups filed in Sava TM

- Bug: leaving a list right after moving a task shows stale rows in the target list (found by e2e flow 5).
