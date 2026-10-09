# I-14 · MCP: add a task to another list

**Model:** A (no UI) · **Sections:** blueprint 6.6, 15.4 (updated) ·
**Sava TM task:** "MCP: add a task to another list (so agents can put a task in Weekly Tasks)" (SAVA TM > Features, priority High, due 2026-10-13).

## Why

A task shows in its home list and can also be linked into other lists of its project (this is how a task gets into Weekly Tasks). The app does it, but the MCP could not, so an agent could not plan a task into the week and a human had to do that step.
That blocked the automated planning workflow described in both task-management skills.

## What was built

- Two MCP tools in `src/server/mcp/server.ts`, WRITE scope, thin wrappers over the existing services `addTaskToList` / `removeTaskFromList` (section 6.6), so every rule still comes from the service:
  - `add_task_to_list { taskId, listId }`: same project only, not the home list, no duplicates, works for subtasks, logs `ADDED_TO_LIST` (with `via: "mcp"`);
  - `remove_task_from_list { taskId, listId }`: undoes the link only; the home list cannot be left and the task is never deleted; logs `REMOVED_FROM_LIST`.
  Both return `{ taskId, homeList, alsoIn: [list names] }`. Ids from another space answer `NOT_FOUND`; a READ token does not see the tools.
- Tests (`tests/mcp/mcp.test.ts`, 2 new, 26 in total): linking and unlinking, one task shown in two lists, subtask link, the refusals (twice, home list, another project's list, not linked), the activity row, READ token and foreign ids.
  The scope test's name guard was narrowed (it rejected any name containing "move", which matched `remove_task_from_list`): it now rejects `delete`, `archive` and names starting with `move`.
- Blueprint 15.4 lists both tools; 15.7 no longer lists "adding a task to a second list" as out of scope.
- Both task-management skills (`.claude/skills/task-management`, `docs/skills/sava-erp-task-management`) now tell agents to use `add_task_to_list` for Weekly Tasks and no longer list it as a limit.

## Acceptance

- [x] An agent can put a task into Weekly Tasks (or any list of the same project) and take it out again.
- [x] The service rules apply unchanged; a READ token and other spaces are refused.
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] Live check on tm.sava.af after the push (an MCP client must reconnect to see the new tools).

## Completion record (2026-10-09)

Built and tested locally by the Architect (Sonnet 5.5); no UI, so no Flash dispatch and no browser QA. Not pushed. Follow-ups: the Sava ERP document in Sava TM and the uncommitted copy in the ERP repository still say agents cannot add a task to Weekly Task; refresh the document after this is deployed.
