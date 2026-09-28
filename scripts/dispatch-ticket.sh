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

ticket_file="docs/tickets/${ticket}.md"

if [ ! -f "$ticket_file" ]; then
  echo "error: $ticket_file not found" >&2
  exit 1
fi

if ! command -v claude-or >/dev/null 2>&1; then
  echo "error: claude-or not found. Run 'source ~/.zshrc' in this shell first." >&2
  exit 1
fi

prompt="$(cat "$ticket_file")

When done: run pnpm typecheck && pnpm lint && pnpm test, then list exactly which files you changed."

claude-or "$model" -p "$prompt" "$@"
