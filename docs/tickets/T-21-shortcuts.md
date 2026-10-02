# T-21 (part 1 of 3) · Keyboard shortcuts

**Model:** I (GLM 5.3 Flash) · **Section:** 9.7 · `q` (quick add) and `Esc` already work.

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/` or `package.json`. No dependencies, no installers.

## Build

1. **Global shortcuts hook** `src/hooks/use-global-shortcuts.ts` and a client component
   `src/components/shortcuts/global-shortcuts.tsx` (mounted once in `src/app/(app)/s/[spaceId]/layout.tsx`, next to the quick-add
   dialog; pass `spaceId`). One `window` `keydown` listener that ignores events with Ctrl/Meta/Alt, `e.repeat`, an open dialog
   (`[role="dialog"], [role="alertdialog"]`), or a target that is an `input`, `textarea`, `select` or `[contenteditable]`:
   - `[` toggles the sidebar (part 3 provides the state: for now dispatch `window.dispatchEvent(new CustomEvent("sava:toggle-sidebar"))`);
   - `g` then `m` (within 1.2 s) → `router.push(`/s/${spaceId}/my-tasks`)`; `g` then `c` → `/s/${spaceId}/calendar`;
   - `/` is reserved (v2 search): call `preventDefault()` and do nothing.
2. **List selection** in `src/components/tasks/list-view.tsx` and `src/components/my-tasks/my-tasks-view.tsx`: keep a
   `selectedId` state (null by default). Same ignore rules as above, plus ignore while the task dialog is open (`?task=` in the URL):
   - `j` / `k` select the next / previous row in the on-screen order (`rowOrder` in the list view; the equivalent in My Tasks;
     `ArrowDown`/`ArrowUp` do the same), scrolling it into view (`scrollIntoView({ block: "nearest" })` via an `id`/`data-row-id` lookup);
   - `Enter` opens the selected task (the existing `openTask`);
   - `x` completes or reopens the selected task (list view: the existing `setCompleted`/status mutation with its subtask prompt rules,
     simplest correct way: call the same handler the row menu's **Complete / Reopen** uses; My Tasks: `useMyTaskStatus` to the first DONE status of the task's project);
   - `1`–`4` set the selected task's priority (list view: the existing `setPriority`; skip in My Tasks).
   The selected row shows a ring: `ring-1 ring-primary/40 rounded-md` (add a `selected?: boolean` prop to `TaskRow` (list) and
   to the My Tasks row; `TaskRow` is in `src/components/tasks/task-row.tsx`). Selection clears on `Esc` and when the selected task disappears.
3. **Help**: pressing `?` (Shift+/) opens a small `Dialog` "Keyboard shortcuts" listing every shortcut in 9.7 in a two-column table
   (key chips like the sidebar's `Q` chip, then the action). Add a **Keyboard shortcuts** item to the user menu
   (`src/components/sidebar/user-menu.tsx`) that opens the same dialog (use a window event `sava:show-shortcuts` so both open one dialog
   owned by `global-shortcuts.tsx`).

```
Files to touch: NEW src/hooks/use-global-shortcuts.ts, NEW src/components/shortcuts/*, src/app/(app)/s/[spaceId]/layout.tsx (mount only),
  src/components/tasks/list-view.tsx, task-row.tsx, src/components/my-tasks/my-tasks-view.tsx, src/components/sidebar/user-menu.tsx
```

## Acceptance

- [ ] `j`/`k`/arrows move a ring through the rows, `Enter` opens, `x` completes/reopens, `1`–`4` set priority, `g m` / `g c` navigate,
  `?` shows the shortcut list; none fire while typing in a field or with a dialog open.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
