# I-15 · Images for agents

**Model:** A (no UI) · **Sections:** blueprint 15.4 (updated) ·
**Sava TM task:** "Images for agents: readable image URLs and fixes to image handling in the MCP" (SAVA TM > Features, priority Medium, due 2026-10-15).

## Why

Owners put screenshots in task descriptions ("Table columns looks a little bit off" had only an image). Agents saw nothing there (after I-10 a placeholder), could not open the picture, because `/api/images/<id>` only accepted a signed-in session,
and a page written through the MCP could embed any address.

## What was built

- **`GET /api/images/<id>`** (`src/app/api/images/[id]/route.ts`) also accepts `Authorization: Bearer <token>`: the token's user must still be a member (`resolveApiToken` re-checks it) and the image must belong to the token's space (another space: 404). Sessions work as before; no credentials: 401.
- **`src/server/mcp/images.ts`**: `imageRefs` (the picture nodes of a description or page: id, alt, absolute url), `absolutizeImages` / `relativizeImages` (urls out and in), `assertImagesInSpace` (a page may embed only images already uploaded to the token's space; external or foreign addresses are refused), `MAX_INLINE_IMAGE_BYTES` (3 MB).
- **MCP** (`server.ts`): `get_task` and `get_page` return an `images` list (`id`, `alt`, `url`); `get_page` writes image urls as absolute (`APP_URL`); a new READ tool **`get_image { imageId }`** returns the picture as MCP image content (base64 + mime type) with a text block (id, type, size, url); above 3 MB only the url is returned.
  `create_doc`, `create_page` and `update_page` parse the Markdown first (absolute own urls back to `/api/images/<id>`), check the images, and only then create or write anything (a refused create leaves nothing behind).
- **Tests** (`tests/mcp/mcp.test.ts`, 5 new, 30 in total): the lists and absolute urls, the round trip to the stored relative form, `get_image` content, the 3 MB rule, another space's picture, external address and foreign picture refused with nothing written, and the route with a Bearer token (own space 200 with the right bytes, wrong token and no credentials 401, another space's token 404).
- Blueprint 15.4, both task-management skills and the handbook now say agents can look at pictures.

## Decisions

- Agents cannot **upload** pictures (not requested; it needs size and type rules and abuse limits).
- Only whole-line `![alt](/api/images/<id>)` become pictures (the doc editor's image nodes are blocks); a picture mentioned inside a sentence stays text.
- The 3 MB inline limit keeps one tool result reasonable (base64 is a third larger); uploads can be up to 4 MB, so larger pictures are given as a url that the Bearer route serves.

## Acceptance

- [x] An agent can see which pictures a task description or page holds and look at them.
- [x] A token reads pictures of its own space only; other spaces and revoked/wrong tokens are refused.
- [x] Pages cannot embed external or foreign pictures.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] Live check on tm.sava.af after the push, with a real task that has a screenshot (for example "Table columns looks a little bit off"); an MCP client must reconnect to see `get_image`.

## Completion record (2026-10-09)

Built and tested locally by the Architect (Sonnet 5.5); no UI, so no Flash dispatch and no browser QA. Not pushed. Not verified: what a real MCP client does with the image content block (the SDK format is standard; confirm live), the route against a real production image.
