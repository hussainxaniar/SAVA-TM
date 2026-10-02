#!/usr/bin/env bash
# Runs several implementer tickets one after another (never in parallel: they share the test database).
# Usage: scripts/run-batch.sh <log-dir> <ticket> [<ticket> ...]   (always Flash; writes <log-dir>/<ticket>.log and .done)
set -u
dir="$1"; shift
mkdir -p "$dir"
for t in "$@"; do
  scripts/dispatch-ticket.sh "$t" z-ai/glm-5.3-flash -- --permission-mode acceptEdits \
    --allowedTools "Read,Edit,Write,Glob,Grep,Bash(pnpm typecheck),Bash(pnpm lint),Bash(pnpm test),Bash(git diff:*),Bash(git status)" \
    > "$dir/$t.log" 2>&1
  touch "$dir/$t.done"
  git add -A src docs >/dev/null 2>&1 && git commit -qm "$t (implementer): GLM 5.3 Flash output, before review

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" >/dev/null 2>&1
done
touch "$dir/ALL.done"
