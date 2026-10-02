# T-21 (part 3 of 3) · Empty states and loading skeletons

**Model:** I (GLM 5.3 Flash) · **Section:** T-21 acceptance

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/` or `package.json`. No dependencies, no installers.

## Build

1. **Loading skeletons**: add `loading.tsx` files (server components, no data) with muted `animate-pulse rounded bg-muted` bars that match each page's header
   band and a few rows, for: `src/app/(app)/s/[spaceId]/p/[projectId]/l/[listId]/loading.tsx` (header + three status groups with rows),
   `.../my-tasks/loading.tsx`, `.../calendar/loading.tsx` (header + a grid of lines), `.../p/[projectId]/d/[docId]/[pageId]/loading.tsx`
   (tree column + title + paragraph bars), `.../settings/loading.tsx` and `.../integrations/loading.tsx` (title + a card). Reuse the same
   widths and paddings as the real pages so nothing jumps.
2. **Error boundaries**: `src/app/(app)/error.tsx` ("use client"): a centered muted message "Something went wrong." with a **Try again** button
   (`reset()`) and a link to My Tasks; and `src/app/(app)/s/[spaceId]/not-found.tsx`: "We can't find that." with a link back to the space.
3. **Empty states** (centered, muted, one title line + one hint + an action where it makes sense):
   - an **empty list** (no tasks at all): under the header, "No tasks yet" / "Press Q or add one below." with an **Add task** button that opens
     the first To-do group's inline add (the existing handler); keep the groups' own `+ Add task` rows;
   - **My Tasks** already has one; **calendar rail** has one; **project with no docs**: nothing needed;
   - **Unscheduled rail / dialog subtasks / comments** already have theirs;
   - a **doc page** with no content already shows the placeholder.
   Add what's missing from this list only.

```
Files to touch: NEW loading.tsx / error.tsx / not-found.tsx files under src/app/(app)/..., src/components/tasks/list-view.tsx (empty state only)
```

## Acceptance

- [ ] Every main route shows a skeleton while loading (throttle the network in DevTools to see them), errors show the retry screen,
  and an empty list shows its empty state.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
