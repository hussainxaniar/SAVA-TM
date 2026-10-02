# T-20 (part 1 of 3) · Docs in the sidebar

**Model:** I (GLM 5.3 Flash) · **Sections:** 11.1, 11.3 · **Context:** `docs/tickets/T-20.md` (overview)

> **Do not open image files.** Don't browse `node_modules`. Don't paste file contents into your messages; one file per Write.

## Already done (Architect)

Services and actions (tested) in `src/server/actions/docs.ts`: `createDocAction({ projectId })` → `{ docId, firstPageId }`,
`renameDocAction({ docId, title })`, `archiveDocAction({ docId })`. Each calls `refresh()`, so the sidebar re-renders
with the new data. The sidebar already lists each project's docs (rows link to `/s/:space/p/:project/d/:doc/:firstPage`).

## What to build

In `src/components/sidebar/project-tree.tsx` only:
1. **New doc:** the project's `⋯` menu gets **New doc** (`IconFilePlus`). It calls `createDocAction({ projectId })`; on
   success `router.push(\`/s/${spaceId}/p/${project.id}/d/${docId}/${firstPageId}\`)`; on failure
   `toast.error(res.error.message)`.
2. **Doc row menu:** a doc row gets a hover `⋯` button at its right (same size and style as the project row's `⋯`;
   visible on hover and while its menu is open), with **Rename** and **Archive**:
   - **Rename:** turns the row's title into an inline input (autofocus, selected text); Enter saves via
     `renameDocAction` (empty or unchanged cancels), Esc cancels.
   - **Archive:** `archiveDocAction({ docId })` and `toast("Archived \"<title>\"")`. If you are viewing that doc
     (pathname contains `/d/${doc.id}/`), `router.push(\`/s/${spaceId}/p/${project.id}\`)` afterwards.
3. Keep every measured sidebar position from T-09 (doc rows keep their current layout and alignment).

```
Files to touch: src/components/sidebar/project-tree.tsx
Files you may read: src/components/sidebar/*, src/server/actions/docs.ts, src/components/ui/*
Do not touch anything else. No dependencies, no installers.
```

Tabler icons only, theme tokens only, Base UI conventions as in the existing sidebar menus.

## Acceptance

- [ ] **New doc** creates "Untitled doc" and opens it; Rename and Archive work from the doc row's `⋯`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
