# I-04 · Choosing the icon of an In-progress status

**Model:** I (GLM 5.3 Flash)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only (plus the existing `StatusGlyph` etc.), theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/`, `src/lib/` or `package.json`.

## Already done (Architect)

- `Status.icon` is stored and returned (`StatusDTO.icon`, also in project settings statuses): for **ACTIVE** statuses one of
  `"circle" | "quarter" | "half" | "threeQuarter"` (`STATUS_ICON_KEYS`, `src/lib/list-icons.ts`), else null. To-do statuses
  always show the dashed circle and Done ones the check; null on an ACTIVE status falls back to the old by-position icon.
- `createStatusAction({ ..., icon? })` and `updateStatusAction({ statusId, icon })` (null clears it) exist; the server
  rejects an icon on non-ACTIVE statuses and clears it when a status leaves ACTIVE.
- `StatusGlyph` (`src/components/tasks/status-icon.tsx`) already draws a status's chosen icon: pass the whole status object.

## Build (only `src/components/project-settings/statuses-editor.tsx`, plus callers' types if needed)

1. In each status row of the editor, **only for ACTIVE statuses**, show an **icon picker** next to the color picker: a
   `Popover` (or the same kind of control the color picker uses) whose trigger shows the current `StatusGlyph` (18px, tinted
   with the status color is NOT needed: it uses the theme's active color) and whose content is a 4-option row: circle,
   ¼, ½, ¾. Render each option with `StatusGlyph` using `status={{ id: "x", category: "ACTIVE", icon: key }}` and
   `statuses={[]}` at 20px, in a 36px button with a tooltip (`title`): "Circle", "Quarter", "Half", "Three quarters"; the
   current one gets `bg-selected`. Picking calls `updateStatusAction({ statusId, icon: key })` (toast on error,
   `router.refresh()` like the other edits in this editor). When `status.icon` is null, highlight the option that matches what
   `StatusGlyph` shows by default (use `statusGlyphKind(status, allStatuses)`, export it if needed, and map
   empty→circle).
2. **To do** and **Done** rows show no picker (their icons are fixed), but a small static glyph at the start of the row is fine.
3. The "add status" form (where a new status's category is chosen): when the new status's category is ACTIVE, let the user pick
   its icon too and send it as `icon` in `createStatusAction`.
4. Keep the editor's drag-to-reorder, rename, color, category and delete behaviors exactly as they are.

```
Files to touch: src/components/project-settings/statuses-editor.tsx (and export statusGlyphKind from status-icon.tsx if it isn't)
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

- [ ] In project settings an In-progress status has an icon picker (circle, ¼, ½, ¾); the choice shows in list rows,
  status groups, the status menu and the dialog. To-do and Done statuses can't change their icon.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.

## Completion record (2026-10-02)

Models: UI by GLM 5.3 Flash. Review fix by the Architect: the glyph was always the theme's blue; `StatusGlyph` now takes the status's own `color` (inline) and the picker previews icons in it. Browser QA: each status shows its icon in its own color (Review: purple three-quarter circle).

Checks: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm test` (236 tests) pass.
