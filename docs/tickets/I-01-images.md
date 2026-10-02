# I-01 · Resizable images in the editors (shared module + docs editor)

**Model:** I (GLM 5.3 Flash)

> **Do not open image files.** Don't browse `node_modules`. One file per Write; keep files under ~250 lines; don't paste file contents into your messages. Tabler icons only (plus the existing `StatusGlyph` etc.), theme tokens only, Base UI conventions as in nearby components. Never touch `prisma/`, `src/server/`, `src/lib/` or `package.json`.

## Already done (Architect)

- `@tiptap/extension-image` is installed. `POST /api/images` (multipart form: `file`, `spaceId`) → `{ id, url }`
  (PNG/JPEG/WebP/GIF, max 4 MB; errors are `{ error }` with a status). `GET url` serves it to space members.
- `DocView` has `initialData.doc.spaceId`.

## Build (new folder `src/components/rich-text/`)

1. **`image-upload.ts`**: `uploadImage(file: File, spaceId: string): Promise<string>` posts the form, returns the
   url, throws `new Error(json.error ?? "Upload failed")`. `insertImageFiles(editor, files, spaceId, pos?)`: for each
   image file (type starts with `image/`) uploads it (`toast.error` on failure) and inserts
   `{ type: "image", attrs: { src: url } }` at `pos` (or the selection).
2. **`resizable-image.tsx`**: `export const ResizableImage` = `Image.extend({...})` with:
   - `addAttributes()`: keep `src`, `alt`, and add `width` (number | null, default null; rendered as a `width` attribute and
     parsed back from it);
   - `addNodeView()`: `ReactNodeViewRenderer(ImageView)` where `ImageView` (`NodeViewWrapper`, inline-block) renders an
     `<img>` with `style={{ width: node.attrs.width ?? undefined, maxWidth: "100%" }}` and, **when selected**
     (`selected` prop) or hovered, a ring plus a square handle (10px, `bg-primary`, bottom-right corner) you drag
     horizontally to resize: on `pointerdown` capture the pointer, track `pointermove` and call
     `updateAttributes({ width })` with the new pixel width clamped to 80–1200 and never wider than the editor; release on
     `pointerup`. The image keeps its aspect ratio (only width is stored). Double-click the handle resets to natural size
     (`width: null`).
   - Export `imageExtensions = [ResizableImage.configure({ inline: false, allowBase64: false })]`.
3. **`image-handlers.ts`**: `imageEditorProps(spaceId, getEditor)` returns Tiptap `editorProps` pieces
   `handlePaste` (pasted image files → `insertImageFiles`, return true) and `handleDrop` (dropped image files → insert
   at the drop position via `view.posAtCoords`, return true).
4. **Toolbar button**: add an Image button (`IconPhoto`, aria-label "Image") to `src/components/docs/page-toolbar.tsx`:
   it needs the `spaceId`, so `PageToolbar` takes an optional `spaceId?: string` prop and shows the button only when it's set;
   clicking opens a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">` and inserts the file.
5. **Docs editor** (`src/components/docs/page-editor.tsx`, `doc-view.tsx`): pass `spaceId={doc.spaceId}` to
   `PageEditor`; add `...imageExtensions` to its extensions, the paste/drop handlers to `editorProps`, and `spaceId` to
   `<PageToolbar />`.
6. **Styles** are already scoped to `.rich-text`; if images need it, add to `src/app/globals.css` only:
   `.rich-text img { max-width: 100%; height: auto; border-radius: 6px; }` and `.rich-text img.ProseMirror-selectednode { outline: 2px solid var(--primary); }`.

```
Files to touch: NEW src/components/rich-text/*, src/components/docs/page-toolbar.tsx, page-editor.tsx, doc-view.tsx, src/app/globals.css (the two image rules only)
Do not touch anything else. No dependencies, no installers.
```

## Acceptance

- [ ] In a doc page: paste or drop an image, or use the toolbar's Image button; it uploads and appears; dragging its corner
  handle resizes it; the width survives autosave and a reload.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
