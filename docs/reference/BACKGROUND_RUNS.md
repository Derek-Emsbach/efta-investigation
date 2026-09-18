# Background (Scheduled) Runs — Runbook

Scheduled Cowork tasks run in a **bridged Linux VM (linux-arm64)** with the repo
mounted at `$HOME/mnt/efta-investigation`. The Mac's own `node_modules` contain
darwin binaries (esbuild, better-sqlite3), so they must not be used — or
reinstalled — from that VM. Two facts every run must respect:

1. **Background processes do not survive between `device_bash` calls.** Start the
   server, run every query, and stop it inside the *same* call.
2. **There are no git credentials.** Commit locally with a `session-bg:` message;
   never `git push`. Derek pushes.
3. **Git locks cannot be deleted on the VM — always commit through the wrapper.**
   Run every git command as `bash scripts/git-safe.sh <args>` (e.g.
   `bash scripts/git-safe.sh add -A`, `bash scripts/git-safe.sh commit -m "..."`),
   NOT bare `git`. The VM creates `.git/index.lock`/`HEAD.lock` on nearly every
   git call and cannot unlink them, so a bare `git` strands a lock that blocks the
   next call — this silently ate a completed run's commit on 2026-09-17. The
   wrapper moves stale locks aside (into gitignored `.git-lock-trash/`) before and
   after each call. If you ever see "Unable to create '.git/index.lock': File
   exists", you used bare git — re-run through the wrapper.

## Starting the MCP corpus server (Linux)

```bash
cd "$HOME/mnt/efta-investigation"
bash services/efta-mcp-server/scripts/start-linux.sh      # idempotent; ~5s
curl -s http://localhost:3001/health
curl -s "http://localhost:3001/api/corpus/search?q=Wexner&limit=5"
bash services/efta-mcp-server/scripts/start-linux.sh stop
```

What the script does: keeps a **separate Linux npm install** in
`services/efta-mcp-server/.linux/` (gitignored, created on first run with
`npm ci`), mirrors `src/` and `.env` into it on every start, and points
`CORPUS_DATA_DIR` at the real `data/` directory. The Mac's `node_modules` are
never read or written. Log: `$HOME/efta-mcp-server.log`.

Do **not** run `npm install` / `pnpm install` inside `services/efta-mcp-server`
from the VM — that overwrites the darwin binaries and breaks Derek's local dev
(this happened on 2026-09-14).

## Required run log

Every scheduled run — including no-op runs — appends one line to the
"Background Run Log" section at the bottom of `docs/TODO.md`:

```
- YYYY-MM-DD <task-name> — MCP: up|down|started | <task-specific counts> | note: <short phrase>
```

and commits it **via `bash scripts/git-safe.sh commit`** (see rule 3 above). A run that leaves no trace is indistinguishable from a broken one — and a bare-`git` commit that hits a stale lock leaves no trace even when the run did its work.

## Scheduled tasks (as of 2026-09-16, times MT)

| Task | When | Writes |
|---|---|---|
| Daily Investigation & Story Draft | daily 8:00 | entities (T4–T6 only), threads, story drafts, TODO/STORY_QUEUE |
| Congressional/DOJ Monitor | daily 7:00 | `public_events` only + run log |
| Infra/Uptime Health Check | daily 6:00 | nothing (report only) |
| Connection Discovery Sweep | Wed 9:00 | TODO.md proposals only |
| Entity Pipeline Review | Thu 9:00 | T4–T6 publishes, TODO.md |
| Weekly Status Check-in | Fri 4:00pm | nothing (report only) |
