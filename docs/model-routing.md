# Model routing: `claude` vs `claude-or`

This project uses two Claude Code entry points, matching the architect/implementer split in [blueprint.md](blueprint.md) Section 2.

| Command | Backend | Login | Use for |
| --- | --- | --- | --- |
| `claude` | Anthropic (api.anthropic.com) | Your Claude.ai / Console account | Architect + Reviewer role: schema, service contracts, permissions, diffs under `src/server/` |
| `claude-or <model-slug> ...` | OpenRouter | OpenRouter API key (from `.env`) | Implementer role: UI components, pages, server actions, seed data, tests |

`claude-or` is a shell function defined in `~/.zshrc`. It does not change how plain `claude` behaves — it only sets `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` for the single command it launches.

## Installing `claude-or` on a machine that doesn't have it yet

`claude-or` lives in `~/.zshrc`, not in this repo, so a fresh clone (a new machine, a
collaborator, a CI/cloud agent) won't have it until it's added. It reads the OpenRouter
key from `.env` in this project — copy `.env.example` to `.env` and fill in
`APIKEY-SavaTM` with a real OpenRouter key first, then append this to `~/.zshrc`:

```sh
claude-or() {
  local model="$1"
  if [ -z "$model" ]; then
    echo "usage: claude-or <model-slug> [claude args...]" >&2
    return 1
  fi
  shift

  local dir="$PWD" env_file=""
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/.env" ] && grep -q '^APIKEY-SavaTM=' "$dir/.env" 2>/dev/null; then
      env_file="$dir/.env"
      break
    fi
    dir=$(dirname "$dir")
  done

  if [ -z "$env_file" ]; then
    echo "claude-or: no .env with APIKEY-SavaTM found in $PWD or any parent directory" >&2
    return 1
  fi

  local key
  key=$(grep -m1 '^APIKEY-SavaTM=' "$env_file" | cut -d '=' -f2-)

  ANTHROPIC_BASE_URL="https://openrouter.ai/api" \
  ANTHROPIC_AUTH_TOKEN="$key" \
  ANTHROPIC_API_KEY="" \
  claude --model "$model" "$@"
}
```

Then `source ~/.zshrc` (or restart the terminal). The function walks up from your
current directory looking for a `.env` containing `APIKEY-SavaTM`, so it works from
anywhere inside this repo (or a clone of it at any path) without editing anything —
nothing here is tied to a specific machine, username, or folder location.

## Example commands

Architect session (your normal login, full Opus):

```sh
claude
```

Implementer session on GLM 5.3 Flash (routine, high-volume UI/scaffolding work):

```sh
claude-or z-ai/glm-5.3-flash
```

Implementer session on GLM 5.3 (tickets needing more careful reasoning), passing extra Claude Code flags through:

```sh
claude-or z-ai/glm-5.3 --dangerously-skip-permissions
```

Any arguments after the model slug are passed straight through to `claude`, so normal flags (`-p`, `--dangerously-skip-permissions`, a prompt string, etc.) work the same as with plain `claude`.

## Confirming which backend is active

Inside a running session, run:

```
/status
```

- Under `claude`: shows your Anthropic account/login and the `api.anthropic.com` endpoint.
- Under `claude-or`: shows the OpenRouter base URL and the `openrouter/<slug>` model name instead of an Anthropic account.

If `/status` ever shows an Anthropic login while you meant to run `claude-or`, the function didn't get picked up — check that you're in a shell that has sourced `~/.zshrc`.

## Switching between Opus and OpenRouter mid-task

There is no automatic or in-session switch between backends. `/model` only cycles between models on your *current* backend (e.g. Opus 5 ↔ Opus 5.5 inside a plain `claude` session, or between OpenRouter slugs inside a `claude-or` session) — it cannot jump from Anthropic to OpenRouter or back, because that requires different `ANTHROPIC_BASE_URL`/auth values that are only read at process start.

To switch, exit the current session (`/exit` or Ctrl-D) and start the other command:

```sh
# Doing architecture/review on Opus, subscription login
claude

# ...done reviewing, handing off a ticket to an implementer model...
claude-or z-ai/glm-5.3-flash
```

Each is a separate process — nothing carries over automatically except what you've written to disk (the ticket file, code, `docs/questions.md`). Reference the relevant ticket/section from `docs/blueprint.md` again when you start the new session so the model has the same context.

## Gotchas

1. **No trailing slash on `ANTHROPIC_BASE_URL`.** It must be `https://openrouter.ai/api`, not `https://openrouter.ai/api/`. Claude Code appends `/v1/messages` itself, so a trailing slash produces a double-slash path and the request fails.
2. **Non-Anthropic hosts disable MCP tool search by default.** Pointing `ANTHROPIC_BASE_URL` at OpenRouter (or any non-Anthropic host) turns off Claude Code's automatic MCP tool search for that session. If you use MCP connectors (ClickUp, Google Drive, Paper, etc.) from a `claude-or` session, re-enable tool search explicitly via the relevant setting in `/mcp` or your Claude Code settings — it will not turn on by itself just because a server is configured.
