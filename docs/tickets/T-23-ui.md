# T-23-ui · AI access card, token creation dialog and "via AI" labels

**Model:** I (GLM 5.3 Flash) · **Part of:** T-23 (API tokens and MCP, blueprint Section 15) · **Architect part:** done and committed


> Do not open image files (.jpg/.png): the implementer cannot read images and the session fails.

```
Ticket: T-23-ui   Read: blueprint 15.5 (only), src/components/integrations/google-calendar-card.tsx (style to match),
  src/components/settings/invite-links.tsx (a similar create/list/revoke card with a Select and a table of rows),
  src/server/actions/api-tokens.ts and api-tokens.schema.ts, src/server/services/types.ts (ApiTokenDTO, FeedItemDTO)
Files to touch: src/components/integrations/ai-access-card.tsx (new), src/app/(app)/s/[spaceId]/integrations/page.tsx,
  src/components/task-dialog/activity.tsx (the "via AI" label only)
Do not touch: prisma/, src/server/, src/lib/, src/hooks/, package.json (no new dependencies)
```

### What already exists

- `listApiTokens(ctx, { spaceId })` (server, returns `ApiTokenDTO[]`), `createApiTokenAction({ spaceId, name, scope: "READ" | "WRITE", expiresInDays: 30 | 90 | 365 | null })`
  returning `{ ok: true, data: { id, token, prefix } }` (the secret is only in this result) and `revokeApiTokenAction({ tokenId })`. Both actions call `refresh()`, so the
  page re-renders with the new list; there is no client cache to patch (same pattern as `invite-links.tsx`).
- `FeedItemDTO` comments have `via: string | null`; activity items carry `payload.via === "mcp"` for entries made through a token.

### What to build

1. **Integrations page**: load `const tokens = await listApiTokens({ userId: user.id }, { spaceId })` next to the Google connection and render
   `<AiAccessCard spaceId={spaceId} tokens={tokens} />` under `GoogleCalendarCard`, inside the same `space-y-10` container.
2. **`AiAccessCard`** (client component, same visual language as the Google card): heading "AI access", one sentence: "Tokens let an AI assistant (Claude, for example)
   read and create tasks as you in this space." A list of tokens, one row each: name, a scope badge ("Read-only" or "Read and write"), `prefix…` in mono, "Last used <relative>" or
   "Never used", "Expires <date>" / "Never expires" / "Expired" (destructive text when `expired`), the owner's name when `!mine`, and a Revoke button that opens an `AlertDialog`
   ("Revoke <name>? Anything using it stops working immediately.") calling `revokeApiTokenAction`, toasting errors. Empty state: "No tokens yet". A "Create token" button.
3. **Create dialog** (`Dialog`): name input (required, max 60, autofocus), scope as two radio options (default "Read and write"; describe: "Read-only can look at tasks; read and write can also create
   and change them"), expiry `Select` (30 days / 90 days / 1 year / Never; default 90 days; remember `Select` needs `items`). Submit calls `createApiTokenAction`; show field errors from the result inline.
4. **Secret step**: on success replace the form with: a warning "Copy this token now. You won't be able to see it again.", the token in a read-only mono field with a Copy button
   (`navigator.clipboard.writeText`, button says "Copied" for 2 s), and two tabs of ready-made setup text built with `window.location.origin` and the token:
   - Claude Code: `claude mcp add --transport http sava <origin>/api/mcp --header "Authorization: Bearer <token>"`
   - Claude Desktop: a JSON block `{ "mcpServers": { "sava": { "command": "npx", "args": ["-y", "mcp-remote", "<origin>/api/mcp", "--header", "Authorization: Bearer <token>"] } } }`
   Each snippet has its own Copy button. A "Done" button closes the dialog; closing clears the secret from state (no copy of it kept anywhere).
5. **"via AI" label** in `activity.tsx`: after the author name on a comment whose `comment.via` is set, and after the actor name on an activity item whose `item.payload.via === "mcp"`,
   add a small muted chip "via AI" (`rounded-[4px] border border-border px-1 text-[11px] text-muted-foreground`). Nothing else in that file changes.
6. Tabler icons only (e.g. `IconCopy`, `IconCheck`, `IconKey`, `IconSparkles`); theme tokens only, no hex colors; below 768px the token rows stack (name and badge on top, details below, Revoke full width).
   Keep every file under ~250 lines (split the secret step into `ai-access-secret.tsx` if needed).

### Acceptance

- [ ] Create, copy and revoke work; the secret is visible once; the list shows last-used after a call.
- [ ] Snippets contain the correct URL for the current origin.
- [ ] "via AI" shows for AI-made activity and comments only.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass with no warnings.
