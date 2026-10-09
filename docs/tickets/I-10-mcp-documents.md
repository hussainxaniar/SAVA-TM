# I-10 · Documents in the MCP

**Model:** A (all of it: a converter, five MCP tools and tests; no UI) · **Sections:** blueprint 11, 15.4 (updated) ·
**Sava TM task:** "Document tools: list, read, create and edit docs and pages" (subtask of "AI MCP to manage tasks and documents"), priority Medium.

## Why

The owner wants documents to be reachable from the task workflow: agents should read and write the project's documents (the permanent knowledge) through the same MCP as tasks, and the
Sava ERP task-management skill should live as a document in Sava TM so Mahdi can open and copy it. Before this the MCP had no document tools, and images in task descriptions
vanished from what agents read.

## What was built

- **`src/lib/doc-markdown.ts`**: `markdownToDoc` and `docToMarkdown` (Tiptap JSON <-> Markdown) for exactly what the docs editor has: headings 1-3, bold, italic, strike, inline code, links,
  bullet / numbered / task lists (nested), blockquotes, fenced code, rules, block images. A pipe table is kept as a code block (the editor has no tables). A single newline is a line break.
  Tests: `tests/lib/doc-markdown.test.ts` (9, including a full round trip).
- **`docToPlain`** (`src/lib/plain-to-doc.ts`): an image node reads as `[image: alt]` or `[image]` instead of being dropped, so agents know a task or comment has a picture.
- **MCP tools** (`src/server/mcp/server.ts`): READ `list_docs`, `get_page`; WRITE `create_doc`, `create_page`, `update_page` (replace or append; stale version gives `CONFLICT`). All go through the existing
  services (`createDoc`, `createPage`, `getPage`, `getPageTree`, `savePage`), so guards and the conditional-update conflict rule are unchanged; every id is checked against the token's space first.
  No delete / move / rename-doc / archive. Tests: 5 new in `tests/mcp/mcp.test.ts` plus the scope-list test (read: 8 tools, write: 13).
- **Blueprint 15.4 and 15.7** describe the tools and the Markdown rules.

## Decisions

- Markdown (not plain text, not Tiptap JSON) is the interchange format: agents write it naturally and it covers the editor's features.
- Page-level concurrency uses `savePage`'s `baseUpdatedAt`; without it the tool uses the version it just read, so only a race inside one call can conflict.
- `create_doc` names the first page like the doc (the app's default would be "Untitled").
- Docs have no activity log, so no "via AI" label; the page footer shows the token's owner as editor.
- Images: the placeholder says an image exists; its bytes are not served to tokens (the image route needs a session). A later task could add a token-readable image URL.

## Acceptance

- [x] An agent can list docs and pages, read a page as Markdown, create a doc and pages, and replace or append to a page; a stale edit is refused.
- [x] A READ token cannot write; ids from another space answer NOT_FOUND; there is no delete/move tool.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass (295 tests, 14 new).
- [ ] Live check on tm.sava.af after the push (needs the deploy, and the MCP client to reconnect so it sees the new tools).

## Completion record (2026-10-09)

Written and tested locally by the Architect (Sonnet 5.5); no UI, so no Flash dispatch and no browser QA. **Not pushed** (no migration; the push only changes the MCP endpoint and a helper).
Browser check (local, seed user Ada): a page written from Markdown through the same converter and `savePage` opened in the real editor with headings, bold / italic / strike / code / link, a numbered list with a nested bullet, a task list with a checked item, a quote, a code block (the table), a rule and a paragraph, no console errors; the QA doc was deleted afterwards. Not verified: the live endpoint.
