# I-18 · Slash menu in docs and task descriptions

**Model:** A + I (the extension, keys, filter, wiring, Escape handling, tests by the Architect; the list component by GLM 5.3 Flash, `I-18a-slash-list.md`) · **Sections:** blueprint 11.5 (new)
**Sava TM task:** "Slash menu in the document editor: type "/" for headings, lists, checklist, image, task link" (SAVA TM > Features, priority Medium, due 2026-10-13) with 5 subtasks. Owner's decisions (2026-10-09): the new dependency is OK; docs **and** task descriptions both get it. Reference: a Notion screenshot.

## What was built

- **Dependency:** `@tiptap/suggestion` 2.27.3 (the same version as the other Tiptap packages).
- `src/lib/slash-items.ts`: the 12 options as data (id, title, group, icon key, keywords, shortcut hint, action) plus `filterSlashItems` (word-start matching on title and keywords, ranked) and `groupSlashItems`. Tests: `tests/lib/slash-items.test.ts` (5).
- `src/components/rich-text/slash/slash-command.tsx`: the Tiptap extension (`SlashCommand`, options `spaceId` and `taskLinks`), the floating placement, the image picker, and Escape handling; `slash-menu.tsx`: highlight and keys; `slash-menu-list.tsx` (Flash): grouped rows with icons and hints, scrolling the selected row into view, "No results".
- Wired into `docs/page-editor.tsx` (with Link task; placeholder "Start writing, or type / for commands") and `task-dialog/description-editor.tsx` (without Link task); `task-link-insert.tsx` listens for the window event the Link task item sends and opens its popover.

## Findings while testing (fixed)

1. **Typing `to-do` as `todo` found nothing** (the title is "To-do list"): keywords `todo` and `to-do` added, and `bulleted`, `number`.
2. **Escape closed the whole task dialog.** In this Tiptap version the suggestion plugin does not handle Escape at all, and the dialog listens for it. Fix: the menu catches Escape on `window` in the capture phase while it is open, remembers the `/` as dismissed (so the plugin exits the menu) and stops the key; a new `/` reopens it. (A first attempt on the editor element was too late.)
3. A test pitfall, not a bug: text typed into a description is autosaved, so a later `/` right after leftover text correctly opens nothing; demo data was cleared between runs.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (319) pass; `pnpm e2e` 11/11.
Browser (local, demo account): in a doc page `/` opens the menu with the groups, icons and hints; `/head` + ArrowDown + Enter makes Heading 2 and the typed text becomes the heading; `/todo` + Enter makes a real checkbox; `/task` + Enter opens the task search and picking a task inserts a chip at the cursor; `/imag` + Enter opens the file picker (simulated with a tiny PNG: it uploaded and an image appeared). In a task description: the menu opens above the dialog, "Link task" is not offered, Esc closes only the menu and the dialog stays, a fresh `/` reopens it, heading applied; no console errors. Demo data restored afterwards.

**Not verified:** the light theme, phone width (the menu is clamped to the viewport), a real file dialog, `/` inside a list item or table-less nested blocks, IME composition. Not pushed (no migration; one new dependency).
