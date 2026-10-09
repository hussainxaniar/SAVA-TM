# I-13 · Rename a doc from its header (and through the MCP)

**Model:** A + I (the MCP tool, hook, tests and blueprint by the Architect; the header title by GLM 5.3 Flash) · **Sections:** blueprint 11.1 (updated), 15.4 (updated)
**Sava TM task:** "Documents: rename from the doc header (title is read-only there) and via the MCP" (SAVA TM > Test & Debug, priority Medium; first written as "Documents can't be renamed", corrected the same day).

> **Do not open image files.** Don't browse `node_modules`. One file per Write; files under ~250 lines; don't paste file contents into your messages.
> Tabler icons only, theme tokens only (no hex colors), Base UI conventions. Never touch `prisma/`, `src/server/`, `src/lib/`, `src/hooks/` or `package.json`.

## What was wrong (and a correction)

The task as first logged said documents cannot be renamed. That was a mistake of the orchestrator (a shell error hid the usages of `renameDocAction` from its search). What exists and works: the sidebar's doc entry has a `⋯` menu with **Rename**
(inline input). What is missing: the 28px **title in the doc view header is plain text** (clicking does nothing), which is where people look, and the MCP could not rename a doc. A doc's name and its pages' titles are separate things (the editor has its own title input),
which can also make renaming look broken.

## Already done (Architect)

- `useRenameDoc(docId)` in `src/hooks/use-doc.ts`: `mutate({ title })`; the action `refresh()`es the server-rendered header and the sidebar, errors toast. No cache to patch.
- MCP tool `rename_doc` (WRITE), tests (24 in `tests/mcp`), blueprint 15.4 and 11.1.

## Implementer handoff

```
Ticket: I-13   Read: src/components/docs/doc-view.tsx, src/components/tasks/list-header.tsx (lines about renaming: the editable list title is the pattern to copy: startRename, saveRename, the `escaped` ref, the Input and the h1 > button),
  src/hooks/use-doc.ts (useRenameDoc only)
Files to touch: NEW src/components/docs/doc-title.tsx, src/components/docs/doc-view.tsx
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json
```

## What to build

1. **`DocTitle({ docId, title })`** (client component, `doc-title.tsx`), same behavior as the list header's title: an `h1` containing a button (`title="Rename doc"`, `type="button"`, the same classes as the current `h1`: `block max-w-full truncate text-left text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground`)
   that starts editing; when editing show an `Input` (`autoFocus`, select all on focus, `aria-label="Doc name"`, `className="h-11 border-0 px-0 text-[28px] font-semibold tracking-[-0.02em] focus-visible:ring-1"`): **Enter** or **blur** saves, **Esc** cancels (use the `escaped` ref so the blur after Esc does not save).
   Save = trimmed, ignore if empty or unchanged, otherwise `useRenameDoc(docId).mutate({ title })`. Keep a local `value` state so the new name shows at once; when the `title` prop changes (after the refresh) take the prop again (derive during render, no effect);
   on a failed rename the toast shows and the value goes back to the prop title.
2. In **`doc-view.tsx`** replace the `<h1 ...>{doc.title}</h1>` with `<DocTitle docId={doc.id} title={doc.title} />` inside the same `mt-2 flex h-11 items-center` wrapper (the wrapper keeps its height, so the header does not jump).
3. Nothing else changes (the sidebar rename stays as it is). The doc view must not treat typing in this input as page-editor shortcuts: the input is outside the editor, nothing to add.

## Acceptance

- [ ] Clicking the doc title in the header turns it into an input; Enter or leaving the field saves, Esc cancels; the sidebar entry shows the new name right after.
- [ ] An empty or unchanged name does nothing; a space can be typed; the header does not change height.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
