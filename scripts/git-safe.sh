#!/usr/bin/env bash
# git-safe.sh — run git on the bridged Linux VM, where stale .lock files
# cannot be DELETED (the bridge denies unlink) and can only be moved aside.
#
# The bug this fixes: on the bridged VM git creates .git/index.lock / HEAD.lock
# (and objects/*/tmp_obj_*, refs/**/*.lock) on nearly every invocation — even a
# read-only `git status` — then cannot unlink them, so each git call strands a
# lock that blocks the NEXT one. That silently stranded a completed run's commit
# on 2026-09-17 (recovered 2026-09-18).
#
# Every scheduled run must call git THROUGH this wrapper:
#     bash scripts/git-safe.sh add -A
#     bash scripts/git-safe.sh commit -m "session-bg: ..."
# It sweeps stale locks aside (unique timestamped names — NEVER `mv -n`, which
# silently no-ops on a name collision and leaves the lock in place), runs git,
# then sweeps again so the next call starts clean. Do NOT `git push` here.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRASH="$REPO_ROOT/.git-lock-trash"
sweep() {
  mkdir -p "$TRASH" 2>/dev/null || true
  local ts; ts="$(date +%s%N)"
  for L in HEAD.lock index.lock config.lock; do
    [ -e "$REPO_ROOT/.git/$L" ] && mv "$REPO_ROOT/.git/$L" "$TRASH/$L.$ts" 2>/dev/null || true
  done
  find "$REPO_ROOT/.git/objects" -name 'tmp_obj_*' -exec mv {} "$TRASH/" \; 2>/dev/null || true
  find "$REPO_ROOT/.git/refs" -name '*.lock'     -exec mv {} "$TRASH/" \; 2>/dev/null || true
}
sweep
git "$@"; rc=$?
sweep
exit $rc
