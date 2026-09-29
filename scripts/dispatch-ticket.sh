#!/usr/bin/env bash
# Hand one ticket file to an OpenRouter implementer model via claude-or.
#
# Usage: scripts/dispatch-ticket.sh <ticket-id> <model-slug> [-- <extra claude args>]
# Example: scripts/dispatch-ticket.sh T-09 z-ai/glm-5.3-flash
#
# Permission mode is intentionally NOT hardcoded here. By default this runs
# claude-or in its normal interactive permission mode; pass extra flags
# after `--` (e.g. `-- --dangerously-skip-permissions`) if you want to
# run it unattended for that one call. See docs/orchestration.md.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: scripts/dispatch-ticket.sh <ticket-id> <model-slug> [-- <extra claude args>]" >&2
  exit 1
fi

ticket="$1"
model="$2"
shift 2
# Drop the `--` separator; passed through, claude would read every flag after it as
# prompt text and silently ignore it.
if [ "${1:-}" = "--" ]; then shift; fi

ticket_file="docs/tickets/${ticket}.md"

if [ ! -f "$ticket_file" ]; then
  echo "error: $ticket_file not found" >&2
  exit 1
fi

# When this script is launched from inside a Claude Code session (the Opus orchestrator),
# the CLAUDE* variables it inherits make the implementer act as that session's child and
# forward its permission prompts upstream, where nobody answers them. Run it standalone.
for var in $(env | grep -oE '^CLAUDE[A-Z0-9_]*' || true); do
  unset "$var"
done

# claude-or is usually a zsh function (docs/model-routing.md), which a bash script can't
# see. Fall back to the same OpenRouter setup it performs.
run_implementer() {
  if command -v claude-or >/dev/null 2>&1; then
    claude-or "$@"
    return
  fi
  local model="$1"; shift
  local key
  key="$(grep -m1 '^APIKEY-SavaTM=' .env 2>/dev/null | cut -d '=' -f2- | sed -E 's/^"(.*)"$/\1/')"
  if [ -z "$key" ]; then
    echo "error: claude-or not found and no APIKEY-SavaTM in .env" >&2
    exit 1
  fi
  ANTHROPIC_BASE_URL="https://openrouter.ai/api" \
  ANTHROPIC_AUTH_TOKEN="$key" \
  ANTHROPIC_API_KEY="" \
  claude --model "$model" "$@"
}

prompt="$(cat "$ticket_file")

When done: run pnpm typecheck && pnpm lint && pnpm test, then list exactly which files you changed.
pnpm test uses a shared remote test database and takes several minutes: run it ONCE, in the
foreground, with a Bash timeout of 600000 ms. Never start a second test run while one is still
running (two runs reset the same database and fail each other). Do not use git stash, commit or checkout."

run_implementer "$model" -p "$prompt" "$@"
