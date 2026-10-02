# I-02 · Rich-text task descriptions (toolbar, checklists, images)

**Model:** I (GLM 5.3 Flash) · **Depends on:** I-01 (`src/components/rich-text/`)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only (plus the existing `StatusGlyph` etc.), theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/`, `src/lib/` or `package.json`.

## Context

`src/components/task-dialog/description-editor.tsx` already runs Tiptap with StarterKit + Link, but has no way to format
(no toolbar) and no checklists or images. Make it as capable as the doc editor (`src/components/docs/page-editor.tsx` and
`page-toolbar.tsx` are your reference; reuse `PageToolbar` and the image helpers from `src/components/rich-text/`).

## Build

In `description-editor.tsx` only (plus `task-dialog.tsx` to pass a prop):
1. New prop `spaceId: string` (pass `task.spaceId` from `task-dialog.tsx`).
2. Extensions: `StarterKit.configure({ heading: { levels: [1, 2, 3] } })`, `TaskList`, `TaskItem.configure({ nested: true })`,
   `Link.configure({ openOnClick: false, autolink: true })`, the placeholder, and `...imageExtensions`; `editorProps` gets the
   paste/drop image handlers (keep the existing class).
3. Render `<PageToolbar editor={editor} spaceId={spaceId} />` (the selection toolbar) like the doc editor does.
4. Keep everything else: autosave (800 ms), flush on blur/unmount, skip unchanged saves, the `null` for an empty description.
   Make sure the editor JSON sent to `onSave` is JSON-round-tripped (`JSON.parse(JSON.stringify(json))`), as in
   `src/hooks/use-page-autosave.ts` (undefined values break server actions).
5. Links in a description should be clickable: `Link.configure({ openOnClick: false })` stays (editing), and add a click
   handler on the editor wrapper: Ctrl/Cmd+click on an `<a>` opens it in a new tab (`window.open(href, "_blank", "noopener,noreferrer")`).

```
Files to touch: src/components/task-dialog/description-editor.tsx, src/components/task-dialog/task-dialog.tsx
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

- [ ] Selecting text in a description shows the formatting toolbar (bold, italic, link, H2, H3, list, image); checklists and
  `#`/`-`/`[]` shortcuts work; images can be pasted, dropped, added and resized; it all autosaves and survives a reload.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
