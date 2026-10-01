# T-17 (part 2 of 2) · The task dialog's Scheduled section

**Model:** I (GLM 5.3 Flash) · **Full spec:** `docs/tickets/T-17.md`. Read that file's sections **Architect part** and
**4. Task dialog: Scheduled section**. The calendar page (part 1) is done; don't change it.

> **Do not open image files.** Don't browse `node_modules`.

## Work in small steps

- One file per Write.
- Put the scheduling popover's content in a new `src/components/task-dialog/schedule-popover.tsx` (under ~150
  lines), and keep `properties-column.tsx` edits small.
- Don't paste file contents back into your messages.

## Files

```
Files to touch: src/components/task-dialog/properties-column.tsx, src/components/task-dialog/task-dialog.tsx (pass
  `me` to the column), NEW src/components/task-dialog/schedule-popover.tsx
Files you may read: docs/tickets/T-17.md, src/hooks/use-calendar.ts, src/components/task-dialog/*,
  src/components/ui/*, src/lib/list-view.ts, src/server/services/types.ts
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

T-17.md's acceptance item about the dialog's Scheduled section. Finish with `pnpm typecheck && pnpm lint && pnpm test`.
