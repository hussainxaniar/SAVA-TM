# I-11 · Space in a rename field started a keyboard drag

**Model:** A (a small fix: one helper and two one-line uses; no Flash dispatch) · **Sava TM task:** "Renaming lists inside project setting" (SAVA TM > Test & Debug, priority Medium).

Owner's words: "While renaming a list inside project setting, if hit space, the field gets grayed out, like if it loses focus, hitting space again, it revokes focus again. It doesn't type ' ' (space)."

## Root cause

The rows of the project-settings editors (lists, statuses) and the sidebar's project row drag from anywhere: dnd-kit's `listeners` are spread on the whole row, including its **keyboard** handler.
That handler starts a drag on Space or Enter and cancels the key. Key events bubble from the rename input up to the row, and because the row has no separate drag handle (`activatorNode`
is not set), dnd-kit does not check where the event came from. So the first Space started a keyboard drag (the row went gray through `isDragging`) and was swallowed; the second Space dropped it. This is
bug class 1 of the handbook (events bubbling to a draggable parent), here through the keyboard rather than a portal.

## Fix

- `src/lib/dnd.ts`: `rowKeyboardOnly(listeners)` wraps dnd-kit's listeners so the keyboard handler runs only when the **row itself** is the target, never for events from an input, button or menu inside it. Pointer dragging is untouched.
- Used in `SortableRow` (`project-settings/sortable-rows.tsx`, which covers the lists **and** the statuses editor, same bug) and in the sidebar project row (`sidebar/project-tree.tsx`, whose rename input had the same exposure).
- Test: `tests/lib/dnd.test.ts` (2).

## Acceptance

- [x] A space typed into the list rename field is typed; focus stays in the field; the row does not turn gray.
- [x] Keyboard dragging still works when the row itself is focused.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass (297 tests); `pnpm e2e` 11/11.

## Completion record (2026-10-09)

Browser check (local, seed user Ada, project settings of "Website relaunch"): clicked the list "Design", pressed End, Space, P with real key events: the field held "Design P", the active element stayed the input, no gray row; Escape cancelled the rename; focusing the row and pressing Space started a keyboard drag (dnd-kit announced it) and Escape ended it.
Not verified in a browser: the statuses editor and the sidebar project rename with the fix (same code path; covered by the helper's unit test). Not pushed.

Related ideas noted, not built: page-tree rows (`docs/page-tree.tsx`) also spread dnd listeners but have no text input inside, so they are unaffected today.
