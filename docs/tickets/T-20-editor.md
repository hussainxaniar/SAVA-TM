# T-20 (part 3 of 3) · The page editor

**Model:** I (GLM 5.3 Flash) · **Sections:** 11.1, 11.2 · **Context:** `docs/tickets/T-20.md`

> **Do not open image files.** Don't browse `node_modules`. One file per Write, each under ~250 lines; don't paste file
> contents into your messages.

## Already done (Architect)

- `src/hooks/use-page-autosave.ts` — read it first. `usePageAutosave({ docId, page, me })` returns
  `{ status, conflict, version, change, flush, overwrite, reload }`:
  - `change({ title?, content? })` records an edit (content = `editor.getJSON()`) and debounces the save (800 ms);
  - `flush()` saves now (call it on blur); it also runs on unmount, tab hide and tab close;
  - `status`: `"saved" | "dirty" | "saving" | "conflict" | "error"`;
  - `conflict`: `{ updatedBy: UserLite; updatedAt } | null`; `overwrite()` resends over their version, `reload()` takes the
    server's version and bumps `version`.
- `usePage(docId, pageId, initial)` (use-doc.ts) gives the page with its current `updatedAt` / `updatedBy` (kept in sync by the autosave hook).
- `globals.css` has `.rich-text` styles incl. headings, lists, code, quotes and checklists (`ul[data-type="taskList"]`).
- Part 2's `doc-view.tsx` renders `<PageEditor key={page.id} docId page me />`. The editor remounts its body when you Reload (see 2).

## What to build

`src/components/docs/page-editor.tsx` (the composer, `PageEditor({ docId, page: DocPageDTO, me: UserLite })`) and
`src/components/docs/page-toolbar.tsx` (the selection toolbar):

1. **Title:** a large plain `<textarea rows={1}>` (28px/34px semibold, `tracking-[-0.02em]`, no border, auto-grow with
   `field-sizing-content`, `placeholder="Untitled"`), above the editor. Controlled by local state initialised from the page;
   on change `change({ title: value })` (the server rejects an empty title, so send `title: value.trim() || "Untitled"`);
   Enter moves focus into the editor (`editor.commands.focus("start")`) instead of adding a line; blur → `flush()`.
2. **Editor:** Tiptap with `StarterKit` (default: headings H1–H3 only: `heading: { levels: [1, 2, 3] }`), `TaskList`,
   `TaskItem.configure({ nested: true })`, `Link.configure({ openOnClick: false, autolink: true })`,
   `Placeholder.configure({ placeholder: "Start writing…" })`. `content: page.content`, `immediatelyRender: false`,
   `editorProps.attributes.class: "rich-text min-h-[50vh] outline-none"`. `onUpdate` → `change({ content: editor.getJSON() })`
   (**only for real edits**: skip the update Tiptap fires when content is set programmatically). `onBlur` → `flush()`.
   Markdown shortcuts (`#`, `-`, `1.`, `[]`, `>`, `` ``` ``) come from StarterKit and TaskItem. Remount the whole
   editor on Reload: render it in a child component keyed `version` (`<Body key={version} …/>`).
3. **Selection toolbar:** Tiptap's `BubbleMenu` (from `@tiptap/react`) shown on text selection with icon buttons:
   Bold, Italic, Link (prompts with `window.prompt("Link URL")`; empty removes the link), H2, H3, Bullet list. Active
   state `bg-accent`; the bar `rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 p-0.5`. Buttons use
   `onMouseDown={(e) => e.preventDefault()}` so the selection stays.
4. **Conflict banner** (when `conflict`): above the title, a rounded bordered banner with an `IconAlertTriangle`:
   "<name> changed this page. Reload to see their version." with **Reload** (`reload()`) and **Overwrite** (`overwrite()`)
   buttons (ghost + default `size="sm"`). While in conflict the editor stays editable.
5. **Footer** under the editor (13px muted): "Edited by <name> · <relative time>" using `page.updatedBy.name` and
   `relativeTime(page.updatedAt)` from `@/lib/activity-format`, then the status: "Saving…" while `saving`/`dirty`, "Saved"
   when `saved`, "Couldn't save. Retrying on your next edit." on `error`. Read `page` from `usePage(...)` so the footer
   updates after each save.

```
Files to touch: NEW src/components/docs/page-editor.tsx, NEW src/components/docs/page-toolbar.tsx,
  src/components/docs/doc-view.tsx (only to render <PageEditor key={page.id} docId page me /> where part 2 left the placeholder)
Files you may read: src/hooks/use-page-autosave.ts, src/hooks/use-doc.ts, src/components/task-dialog/description-editor.tsx
  and comment-editor.tsx (Tiptap setup), src/lib/activity-format.ts, src/components/ui/*, src/app/globals.css
Do not touch anything else. No dependencies, no installers (the BubbleMenu ships with @tiptap/react).
```

Tabler icons only, theme tokens only.

## Acceptance

- [ ] Typing saves automatically about 0.8 s after you stop, and on blur; the footer says Saving… then Saved, and the
  tree title follows title edits. Reload keeps the content.
- [ ] The selection toolbar formats text; `#`, `-`, `1.`, `[]` and `>` shortcuts work; checklists tick.
- [ ] A save from a stale version shows the conflict banner with working Reload and Overwrite.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
