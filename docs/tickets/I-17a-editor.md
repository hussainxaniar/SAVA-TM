# I-17a · Task link chip and insert popover

**Model:** I (GLM 5.3 Flash) · part of `docs/tickets/I-17-doc-task-links.md` (read its Design and Architect sections for context: blueprint 11.4 is the spec; the services, hooks and node attributes named below already exist).

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only, Base UI conventions (`PopoverTrigger render={...}`). Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

```
Ticket: I-17a   Read: blueprint 11.4 (only), src/components/rich-text/resizable-image.tsx (how a Tiptap node with a React node view is built here), src/components/docs/page-editor.tsx,
  src/components/docs/page-toolbar.tsx, src/hooks/use-task-links.ts, src/components/tasks/status-icon.tsx (StatusGlyph), src/components/ui/popover.tsx, src/components/ui/input.tsx
Files to touch: NEW src/components/docs/task-link-node.tsx, NEW src/components/docs/task-link-insert.tsx, src/components/docs/page-editor.tsx
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

1. **`task-link-node.tsx`** exports `TaskLink`, a Tiptap `Node.create({ name: "taskLink", group: "inline", inline: true, atom: true, selectable: true })` with attributes `taskId` (string, default `""`) and `title` (string, default `""`), `parseHTML: [{ tag: "span[data-task-link]" }]`,
   `renderHTML` returning `["span", { "data-task-link": node.attrs.taskId }, node.attrs.title]` (this is the fallback text), and `addNodeView() { return ReactNodeViewRenderer(TaskLinkView) }`.
2. **`TaskLinkView`** (same file, a `NodeViewWrapper as="span"` with `className="inline-block align-baseline"`): reads `const { data: label, isLoading } = useTaskLabel(node.attrs.taskId)` and renders one chip button (`type="button"`, `contentEditable={false}`):
   `inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-pill px-1.5 py-px text-[0.92em] leading-5 text-foreground hover:bg-accent`, with `selected` adding `ring-1 ring-primary/50`. Content: when `label` exists, a `StatusGlyph` (size 13; its props are `status`, `statuses`, `size`: pass `statuses={[label.status]}` and `status={label.status}`) then the **live** `label.title` (`truncate`, `line-through text-muted-foreground` when `label.completed`);
   while `isLoading` the snapshot `node.attrs.title` in `text-muted-foreground`; when `label === null` (finished loading, task gone) `IconLinkOff` (13px, muted) and the text "Task not found" in `text-muted-foreground`, and the chip does nothing on click. A click on a found task opens it: `router.push(`${pathname}?task=${id}`, { scroll: false })` with `usePathname`/`useRouter` from `next/navigation` (the dialog host reads `?task=` on any page).
   `onClick` must `e.preventDefault()` and `e.stopPropagation()` so the editor keeps its selection logic out of it.
3. **`task-link-insert.tsx`** exports `TaskLinkInsert({ editor }: { editor: Editor })`: a ghost `Button` (`size="sm"`, `IconSubtask` icon + text "Link task", `type="button"`) that is the trigger of a `Popover`; content `align="start"`, `className="w-80 p-1"`: a borderless search `input` (autofocus, placeholder "Search tasks", same classes as the assignee picker's input) and below it the results of `useTaskSearch(query, open)` as full-width buttons (`flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent`): `StatusGlyph` (13) + title (`truncate`).
   Empty result: "No tasks found" (muted); while the first load runs, "Searching…". **Enter** in the input picks the first result; **Esc** closes (the popover does it); picking calls
   `editor.chain().focus().insertContent([{ type: "taskLink", attrs: { taskId: t.id, title: t.title } }, { type: "text", text: " " }]).run()`, then closes the popover and clears the query. Stop `keydown` propagation on the content so the page editor's keys do not see the typing.
4. **`page-editor.tsx`**: add `TaskLink` to the editor's `extensions`, and render `<div className="mb-2 flex justify-end"><TaskLinkInsert editor={editor} /></div>` above `<EditorContent />` (inside the `editor &&` branch, next to `PageToolbar`). Nothing else changes.

### Acceptance (I-17a)

- [x] "Link task" opens a search; typing filters; Enter or a click inserts a chip at the cursor followed by a space; the page autosaves with the link (reload shows the chip again).
- [x] The chip shows the task's current title and status glyph; a done task is struck through; clicking opens the task dialog on the same page; a deleted task shows "Task not found".
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.

