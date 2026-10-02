# Orchestrating tickets: Opus architect → GLM implementer

> The full working knowledge (review checklist, QA recipe, failure modes, detached batch runs) is in [agent-handbook.md](agent-handbook.md). This file stays the short reference for the dispatch mechanics.

This describes how to have an Opus session (your subscription, plain `claude`) act as
the Architect/Orchestrator from `docs/blueprint.md` Section 2, and dispatch individual
tickets to a GLM implementer session (`claude-or`, OpenRouter) instead of building the
UI itself.

## Why this needs a shell, not a built-in subagent

Claude Code's built-in subagents (`.claude/agents/*.md`, dispatched via the Task tool)
inherit whatever backend the parent process is running under — see
[model-routing.md](model-routing.md). A session started as `claude-or` cannot spawn an
in-process subagent that uses your Anthropic subscription, and vice versa. Crossing
that boundary means literally running the other CLI command as a subprocess. That's
what this workflow does: the Opus orchestrator uses its own Bash tool to invoke
`claude-or <model> -p "<ticket>"` as a separate, independent process per ticket.

Each dispatched call is stateless — it shares no conversation memory with the
orchestrator, only whatever is on disk (the ticket file, `docs/blueprint.md`, the
current repo state). That's why every ticket needs a self-contained file.

## The dispatch script

`scripts/dispatch-ticket.sh <ticket-id> <model-slug> [-- <extra claude args>]` reads
`docs/tickets/<ticket-id>.md`, appends a standard "when you're done" footer, and pipes
it into `claude-or <model-slug> -p "..."`.

```sh
scripts/dispatch-ticket.sh T-09 z-ai/glm-5.3-flash
```

Model choice follows the Model roles table in `CLAUDE.md`:
- `z-ai/glm-5.3-flash` — **the default for every implementer ticket.** The Architect does the logic-heavy parts
  (services, parsers, hooks, cache patches) and writes precise handoffs, so the implementer's part is routine UI.
- `z-ai/glm-5.3` — only when Flash's attempt fails review twice on the same ticket, or the Architect records in
  the ticket why Flash isn't enough. (Decided with the human on 2026-09-30, to save credits.)

### Permission mode — read this before running unattended

The script does **not** hardcode a permission-bypass flag. By default, `-p` (print /
non-interactive) mode without any permission flag will not actually let the model
edit files or run commands unattended — there's no terminal to approve prompts.

**Recommended (used since T-04):** auto-accept file edits, and allow only the check
commands. The implementer can read and edit files in the repo and run the three checks
plus `git diff`/`git status`, but no other shell command. You still review the diff.

```sh
scripts/dispatch-ticket.sh T-09 z-ai/glm-5.3-flash -- \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash(pnpm typecheck),Bash(pnpm lint),Bash(pnpm test),Bash(git diff:*),Bash(git status)"
```

The script drops the `--` separator before passing the flags on, and it clears the
`CLAUDE*` variables inherited from the orchestrator's session. Without that, the
implementer acts as the orchestrator's child and forwards its permission prompts to a
session that never answers them.

**Last resort:** the full bypass flag, passed explicitly at the point of use:

```sh
scripts/dispatch-ticket.sh T-09 z-ai/glm-5.3-flash -- --dangerously-skip-permissions
```

This is a real risk, not boilerplate: that flag lets the implementer model edit any
file and run any shell command in this repo with no confirmation step, for the
duration of that one ticket. It is deliberately **not** baked into the script or
committed anywhere — decide per call whether a ticket is scoped and low-risk enough
to run that way. Never point it at a ticket that touches `prisma/`,
`src/server/services/`, or auth — those are Architect/Reviewer-only per the blueprint.

## Reviewing what comes back

After every dispatch, before moving to the next ticket:
1. `git diff` — read the actual change.
2. `pnpm typecheck && pnpm lint && pnpm test` — the ticket isn't done if any fail.
3. Confirm it only touched the files the ticket named. If it touched
   `prisma/schema.prisma` or `src/server/services/*` without the ticket allowing it,
   don't accept the diff — revert and write a note in `docs/questions.md` instead.

## Running the orchestrator

Start a plain `claude` session (subscription, Opus) in the project root:

```sh
cd "/Users/LENOVO/Dev-Projects/React/Sava TM"
claude
```

CLAUDE.md loads automatically. Then give it a starting prompt, for example:

```
You are the Architect/Orchestrator for this project. Read docs/blueprint.md and
docs/orchestration.md in full before doing anything else.

Work through the tickets in blueprint.md Section 12, in build order, one at a time:

- If a ticket's Model column is "A", do the work yourself.
- If it's "I" or "A + I": do any Architect part yourself first (e.g. services), write
  or refine docs/tickets/<id>.md using the Section 2 handoff template if it doesn't
  exist yet, then dispatch the implementer part with
  scripts/dispatch-ticket.sh <id> <model-slug> — z-ai/glm-5.3-flash by default;
  z-ai/glm-5.3 only after Flash fails review twice or with a recorded reason.
- After a dispatch, review it yourself: git diff, then
  pnpm typecheck && pnpm lint && pnpm test. Fix or re-dispatch before moving on.
- If a schema or service-layer change seems needed outside a ticket's stated scope,
  stop and write a note in docs/questions.md instead of making it.

Start with T-01. After each ticket, stop and tell me what changed and what's next —
don't start the next ticket without my go-ahead yet.
```

The last line is deliberate: keep it to one ticket per check-in until you've seen a
few diffs come back clean. Once you trust the loop, you can tell it to keep going
through several tickets unattended between check-ins — that's your call to make as
you watch how the first few go, not a default to start with.
