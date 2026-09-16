#!/usr/bin/env bash
# Start the EFTA MCP server from the bridged Linux VM (Cowork scheduled tasks)
# WITHOUT touching the Mac-native node_modules.
#
# Layout: services/efta-mcp-server/.linux/ holds a Linux-only npm install
# (gitignored). src/ and .env are mirrored into it on every start so the
# code is always current; the corpus SQLite files stay in ../data via
# CORPUS_DATA_DIR. If .linux/node_modules is missing, it is created with
# `npm ci` (needs registry.npmjs.org egress).
#
# Usage (inside ONE device_bash call — background processes do not survive
# between calls):
#   bash services/efta-mcp-server/scripts/start-linux.sh && curl -s localhost:3001/health
#   ... run queries ...
#   bash services/efta-mcp-server/scripts/start-linux.sh stop
set -euo pipefail
SVC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LX="$SVC/.linux"
LOG="${MCP_LOG:-$HOME/efta-mcp-server.log}"

if [[ "${1:-}" == "stop" ]]; then
  pkill -f '[s]rc/index\.ts' 2>/dev/null || true
  exit 0
fi

if curl -s -m 2 http://localhost:3001/health >/dev/null 2>&1; then
  echo "MCP server already up on :3001"; exit 0
fi

if [[ ! -x "$LX/node_modules/.bin/tsx" ]]; then
  echo "No Linux node_modules — installing into $LX (npm ci)..."
  mkdir -p "$LX"
  cp "$SVC/package.json" "$SVC/package-lock.json" "$LX/"
  (cd "$LX" && npm ci --no-audit --no-fund >/dev/null)
fi

rsync -a --delete "$SVC/src/" "$LX/src/"
cp "$SVC/.env" "$LX/.env"

cd "$LX"
CORPUS_DATA_DIR="$SVC/data" setsid nohup node_modules/.bin/tsx src/index.ts </dev/null >"$LOG" 2>&1 &
disown || true

for i in $(seq 1 20); do
  if curl -s -m 2 http://localhost:3001/health >/dev/null 2>&1; then
    echo "MCP server up on :3001 (log: $LOG)"; exit 0
  fi
  sleep 1
done
echo "MCP server failed to start — last log lines:"; tail -20 "$LOG"; exit 1
