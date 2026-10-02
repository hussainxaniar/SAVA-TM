# T-20 (part 2 of 3) · The doc view and its page tree

**Model:** I (GLM 5.3 Flash) · **Sections:** 11.1, 11.3 · **Context:** `docs/tickets/T-20.md`

> **Do not open image files.** Don't browse `node_modules`. One file per Write, each under ~250 lines; don't paste file
> contents into your messages.

## Already done (Architect)

- Route `.../d/[docId]/[pageId]/page.tsx` renders `<DocView initialData me />` (`src/components/docs/doc-view.tsx` is a stub).
  `initialData: DocViewDTO = { doc, tree, page }`.
- `src/hooks/use-doc.ts`: `usePageTree(docId, initialTree)`, `useCreatePage(docId)` → `mutateAsync({ parentId, title? })`
  returns `{ pageId }`, `useMovePage(docId)` → `mutate({ pageId, parentId, beforeId, afterId })` (optimistic),
  `useDeletePage(docId)` → `mutateAsync({ pageId })`.
- `src/lib/page-tree.ts` (tested): `flattenTree(nodes, collapsedSet)` → visible rows `{ node, depth, hasChildren }`;
  `subtreeIds(nodes, id)`; `projectDrop(visibleRows, allNodes, activeId, overId, offsetX, indentPx)` → the new
  `{ parentId, beforeId, afterId, depth }` for a drag, or `null` when nothing changes or the drop is illegal.
- Part 3 builds the editor (`PageEditor`, in `src/components/docs/page-editor.tsx`). Until it exists, render a muted placeholder
  where the editor goes, **or if the file exists import it**: `<PageEditor key={pageId} docId page me />`.

## What to build

`doc-view.tsx` (a thin composer) plus `page-tree.tsx` in `src/components/docs/`:

1. **Layout:** a header band like My Tasks' (28px title = the doc title, with the project color square + project name
   above it, as in the list header's breadcrumb line). Below it, a flex row filling the height: the **page tree** (220px,
   `border-r border-border bg-panel`, scrolls) and the editor area (`flex-1 min-w-0`, scrolls).
2. **Page tree rows** (36px, indent 16px per depth): a chevron when it has children (collapse state in
   `useLocalStorage(\`sava.doc.${docId}.collapsed\`, [] as string[])`), the title (truncate; "Untitled" when empty), the
   current page highlighted like a selected list row in the sidebar (`bg-selected text-selected-foreground`). Clicking a row
   navigates with `router.push(\`/s/${spaceId}/p/${projectId}/d/${docId}/${pageId}\`)`.
   - **Hover actions:** a `+` (add a child page; hidden at depth 2) and a `⋯` with **Delete**. Both stop click
     propagation so they don't navigate.
   - **Add page** (`IconPlus`, text button) at the bottom of the tree creates a top-level page and opens it. Adding a child
     also opens the new page (and expands its parent).
   - **Delete:** a controlled `AlertDialog` "Delete this page?" with "This also deletes N subpage(s)." when N > 0 (N =
     `subtreeIds(...).length - 1`) and Cancel / Delete (destructive; `AlertDialogAction` doesn't auto-close). After deleting,
     navigate to the parent page, else the first remaining top-level page. The server refuses deleting the last page of a doc:
     the hook toasts its message (so call it in try/catch and only navigate on success).
3. **Drag to reorder and re-nest (from anywhere on the row, 4px activation):** one `DndContext id={useId()}` over a
   `SortableContext` of the visible row ids (`verticalListSortingStrategy`), `PointerSensor` with `distance: 4`.
   Track the drag's horizontal offset: `onDragMove={({ delta }) => setOffsetX(delta.x)}` (reset on end/cancel). While dragging,
   render a `DragOverlay` card with the page title. On `onDragEnd({ active, over })`: `projectDrop(visibleRows, tree,
   String(active.id), String(over.id), offsetX, 16)`; if it returns a drop, `movePage.mutate({ pageId: active.id,
   parentId: drop.parentId, beforeId: drop.beforeId, afterId: drop.afterId })`, and when `drop.parentId` is set make sure
   that parent is not collapsed. Rows of the dragged page's own subtree stay in place (hide them while dragging: `flattenTree`
   already gives rows; filter ids in `subtreeIds(tree, activeId)` except the active one).

```
Files to touch: src/components/docs/doc-view.tsx (keep export + props), NEW src/components/docs/page-tree.tsx
Files you may read: src/hooks/use-doc.ts, src/lib/page-tree.ts, src/components/tasks/* (dnd and menu patterns),
  src/components/my-tasks/my-tasks-view.tsx (header band), src/components/sidebar/project-tree.tsx, src/components/ui/*
Do not touch anything else. No dependencies, no installers.
```

Tabler icons only, theme tokens only, `DndContext id={useId()}`, no `@dnd-kit/utilities`.

## Acceptance

- [ ] The doc view shows the tree and (once part 3 exists) the editor; clicking a page opens it; `+` adds children (max
  depth 3); Add page adds top-level pages; collapsing works and persists.
- [ ] Dragging reorders pages and, dragged right/left, nests/un-nests them; deleting shows the subpage count and refuses the last page.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
