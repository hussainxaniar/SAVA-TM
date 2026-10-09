# I-17 · Link tasks from documents (and show a task's documents)

**Model:** A + I (schema, services, MCP, Markdown, tests, blueprint 11.4 by the Architect; the editor chip + insert popover (I-17a) and the dialog's Documents section (I-17b) by GLM 5.3 Flash) · **Sections:** blueprint 11.1, 11.4 (new), 15.4 (updated)
**Sava TM task:** "Link tasks from documents (and show a document's linked tasks on the task)" (SAVA TM > Features, backlog). Owner's note (2026-10-09): "Even if possible we can link the relevant task sometimes in documents (this part needs updating document feature to support it)."

## Design (decided by the Architect, the owner may change it)

An inline `taskLink` chip in the page (live title and status, click opens the task), inserted from a search popover; a **Documents** section on the task listing the pages that link it; an indexed table kept in step on every save; Markdown `[Title](task:ID)` for agents.
Full rules: blueprint 11.4. Chosen over alternatives: a separate "related tasks" list per page (more UI, no place in the text), and `@` autocomplete (`@` is reserved for the later mentions feature, a non-goal for now).

## Architect part (done, committed first)

- Migration `doc_task_links` (additive: table `DocTaskLink`, one index, two cascading foreign keys); `savePage` rewrites the index in the same transaction as the content write.
- `src/server/services/task-links.ts` (`searchTasks`, `getTaskLabels`, `docsLinkingTask`, `syncPageTaskLinks`), `getTask` returns `linkedDocs`; actions `searchTasksAction`, `getTaskLabelsAction`; hooks `useTaskLabel(taskId)` and `useTaskSearch(query, enabled)` in `src/hooks/use-task-links.ts` (they read the space id from the route).
- `src/lib/doc-task-links.ts`, Markdown both ways in `src/lib/doc-markdown.ts`, MCP: `get_page` (current titles), `get_task` (`documents`), writes refuse tasks outside the space.
- Tests: `tests/services/task-links.test.ts` (6), additions to `tests/lib/doc-markdown.test.ts` and `tests/mcp/mcp.test.ts`.

## I-17a handoff: the chip and the insert popover (Flash)

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

- [ ] "Link task" opens a search; typing filters; Enter or a click inserts a chip at the cursor followed by a space; the page autosaves with the link (reload shows the chip again).
- [ ] The chip shows the task's current title and status glyph; a done task is struck through; clicking opens the task dialog on the same page; a deleted task shows "Task not found".
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.

## I-17b handoff: the task's Documents section (Flash)

```
Ticket: I-17b   Read: blueprint 11.4 (only), src/components/task-dialog/task-dialog.tsx (where Subtasks and ActivitySection are rendered), src/components/task-dialog/subtasks.tsx (section heading style)
Files to touch: NEW src/components/task-dialog/linked-docs.tsx, src/components/task-dialog/task-dialog.tsx
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

- **`LinkedDocs({ task })`** (`linked-docs.tsx`, `task: TaskDetailDTO`): renders nothing when `task.linkedDocs` is empty. Otherwise a `section` with the same heading style and horizontal padding as the Subtasks section (copy its heading classes; text "Documents" and the count in muted text), then one `Link` (next/link) per entry to
  `/s/${task.spaceId}/p/${doc.projectId}/d/${doc.docId}/${doc.pageId}`, `flex h-9 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent`: `IconFileText` (16, muted) and `<span class="truncate">{doc.docTitle}<span class="text-muted-foreground"> / {doc.pageTitle}</span></span>` (when the page title equals the doc title show the doc title once).
- **`task-dialog.tsx`**: render `<LinkedDocs task={task} />` between `<Subtasks .../>` and `<ActivitySection .../>`.

### Acceptance (I-17b)

- [ ] A task that a page links shows a Documents section naming "Doc / Page"; clicking opens that page; a task with no links shows nothing new.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
