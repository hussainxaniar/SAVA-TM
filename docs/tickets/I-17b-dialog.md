# I-17b · Documents section in the task dialog

**Model:** I (GLM 5.3 Flash) · part of `docs/tickets/I-17-doc-task-links.md` (read its Design and Architect sections for context: blueprint 11.4 is the spec; the services, hooks and node attributes named below already exist).

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages. Tabler icons only, theme tokens only. Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

```
Ticket: I-17b   Read: blueprint 11.4 (only), src/components/task-dialog/task-dialog.tsx (where Subtasks and ActivitySection are rendered), src/components/task-dialog/subtasks.tsx (section heading style)
Files to touch: NEW src/components/task-dialog/linked-docs.tsx, src/components/task-dialog/task-dialog.tsx
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

- **`LinkedDocs({ task })`** (`linked-docs.tsx`, `task: TaskDetailDTO`): renders nothing when `task.linkedDocs` is empty. Otherwise a `section` with the same heading style and horizontal padding as the Subtasks section (copy its heading classes; text "Documents" and the count in muted text), then one `Link` (next/link) per entry to
  `/s/${task.spaceId}/p/${doc.projectId}/d/${doc.docId}/${doc.pageId}`, `flex h-9 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent`: `IconFileText` (16, muted) and `<span class="truncate">{doc.docTitle}<span class="text-muted-foreground"> / {doc.pageTitle}</span></span>` (when the page title equals the doc title show the doc title once).
- **`task-dialog.tsx`**: render `<LinkedDocs task={task} />` between `<Subtasks .../>` and `<ActivitySection .../>`.

### Acceptance (I-17b)

- [x] A task that a page links shows a Documents section naming "Doc / Page"; clicking opens that page; a task with no links shows nothing new.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
