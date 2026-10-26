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

## Editorial identification rules (Derek, 2026-09-29)

These apply to every run that touches entity names, aliases, bios or stories.

1. **Read the entity's origin before enriching it.** Before any enrichment pass on an existing entity, read its full `metadata`, `bio` and `source_docs` to learn where the record came from (the 2026-09-18 Jacobson near-miss).
2. **Journal names need three things before a real person is attached:** the page has been read, it says what we claim, and something *outside the journals* corroborates that specific person. A surname match or circumstantial proximity (guest lists, correspondence) is not corroboration.
3. **Probable IDs never go in `aliases`.** The entity-linker matches on `aliases`. Put unconfirmed candidate names in `metadata.candidate_identification_unconfirmed` and set `metadata.publication_hold`.
4. **Deceased persons:** no deceased person is named from the victim journals without direct documentary corroboration tying that specific person to the journal reference. They cannot respond.
5. **Respect `metadata.publication_hold`.** Never publish, re-tier or change aliases on an entity that has an active hold. Flag it for Derek instead.
6. **Stale flags:** once Derek resolves a "Flag for Derek" item, it is recorded under "Resolved Flags" in `docs/TODO.md`. Do not carry resolved items forward.

## Recurring `device_bash` wedge (2026-10-15, 2026-10-18)

The 2026-10-15 daily-investigation session hit a failure mode worse than a flaky MCP-server start: `device_bash` itself stopped responding entirely mid-session (6 consecutive identical failures, harness said stop retrying) — no shell command of any kind could run on the Mac for the rest of that session.

**This recurred on 2026-10-18, and more severely: every single `device_bash` call failed from the very first attempt** (5/5 failures, including a bare `echo`) — unlike 2026-10-15, no MCP server start, no query, nothing shell-based succeeded at all this time. `device_list_dir`/`device_stage_files`/`device_commit_files` worked both times, so the file-level bridge is not the problem — it's specifically the shell.

Separately, as of this run the **"EFTA — Weekly Status Check-in" scheduled task has been auto-disabled by the platform** with `suspension_reason: device_absent` (as of 2026-10-16). That is an independent signal (from the scheduler itself, not from inside a session) that this Mac's shell/device bridge has been unreliable enough to trip an automatic disable — not just two unlucky sessions.

**If this happens again:** don't retry past ~5 identical failures (the harness already says so). Fall back to `device_list_dir` for reads and the `device_stage_files` → edit in the cloud workspace → `device_commit_files` round-trip for writes — this bypasses git entirely, so **no commit happens**; say so plainly in the run log and leave the working tree for Derek to `git status`/`git diff`/commit by hand. Do not attempt any DB-backed work (entity pipeline, connections, events) without the MCP server — there is no fallback for that; just document the gap and move on to file-only work or stop.

**Worth Derek's attention, not a session's to fix:** two occurrences in 3 days plus an auto-disabled scheduled task is a pattern, not noise. Possible causes worth checking on his end: the Mac sleeping/losing its device-bridge connection during the task's fire time, Terminal/shell permission prompts silently blocking non-interactive `device_bash` calls, or a stuck process from the 2026-10-15 session (the MCP server that was "never explicitly stopped" that night) still holding something open. If it keeps happening, this scheduled task's ROI drops to near zero until fixed — most of what it's supposed to do requires the shell.

**4th occurrence, 2026-10-19:** the 2026-10-19 daily-investigation session hit the identical failure — 5/5 `device_bash` calls failed, this time across several different trivial commands (`cd`+`pwd`, `echo hello`, `pwd`+`ls`, `whoami`), ruling out "one bad command" as an explanation. `device_list_dir`/`device_stage_files` again worked fine immediately. This makes it 4 occurrences in 3 consecutive scheduled-run days (10-15, 10-18 x2, 10-19), plus the standing auto-disabled Weekly Status Check-in task from 10-16. The pattern is now well past "worth checking" — it's a confirmed, recurring, multi-day environment issue on the Mac side that no amount of in-session retrying will fix. Recommend Derek check directly before the next scheduled fire time: is the Mac asleep or losing its device-bridge connection around the task's scheduled hour, is there a Terminal/shell permission dialog silently blocking non-interactive `device_bash` calls, and is a stuck process (e.g. an MCP server left bound to :3001 from 10-15, "never explicitly stopped") holding a resource open.

**5th, 6th, 7th occurrences, 2026-10-19 (congressional-monitor) and 2026-10-20 (congressional-monitor + daily-investigation):** the wedge kept recurring on every single scheduled run across two more days, now spanning every task type that needs the shell. `device_list_dir`/`device_stage_files`/`device_commit_files` remain unaffected every time — this is specifically `device_bash`. As of the 2026-10-20 daily-investigation session this is 7 occurrences across 5 consecutive scheduled-run days with zero successful `device_bash` calls on any of them (not even a bare `echo`), and the repo's working tree now has several scheduled sessions' worth of file-bridge edits (TODO.md/BACKGROUND_RUNS.md bookkeeping only, no entity/thread/story/corpus work since none of that is possible without the shell) sitting uncommitted on top of each other. **This is no longer a "worth checking" note — the daily-investigation and congressional-monitor scheduled tasks are producing zero research value and should probably be paused** (not deleted — the entity-pipeline/thread/story backlog in this file is still valid work, just currently unreachable) until Derek confirms the device-bridge shell is fixed, rather than continuing to fire daily and log the same finding. If a working `device_bash` call ever succeeds again, the very first thing that session should do is check for a stuck process on :3001 (left running since 2026-10-15) before anything else.

**8th occurrence, 2026-10-21 (congressional-monitor):** identical wedge, 5/5 `device_bash` failures on trivial commands (`ls`+`cd`, `cd`+`ls docs/reference`, `echo hello` x3), with `get_device_info`/`device_list_dir`/`device_stage_files`/`device_commit_files` all working immediately and confirming the device is connected. This is now 8 occurrences across 6 consecutive scheduled-run days (10-15, 10-18 x2, 10-19 x2, 10-20 x2, 10-21) — a full week where this scheduled task has not completed a single successful run. There has been no intervening success at any point since 10-15 to suggest the shell self-recovers; every occurrence looks identical regardless of which command is tried first. Restating the 10-20 recommendation more plainly: this scheduled task should be paused by Derek until he has personally confirmed on the Mac that `device_bash` works (even a bare local shell session, outside any scheduled run, would confirm or rule out a stuck process/permission-prompt/sleep issue) — continuing to let it fire daily is now pure overhead (one more TODO.md/BACKGROUND_RUNS.md bookkeeping edit, zero research value) with no evidence it will resolve on its own.

**9th occurrence, 2026-10-21 (daily-investigation, same day as the 8th):** identical wedge on the very next scheduled task to fire a few hours later — 5/5 `device_bash` failures (`cd`+`ls` x2, `echo hello` x3), `get_device_info`/`device_list_dir`/`device_stage_files` all succeeding immediately as always. This is now 9 occurrences across 7 consecutive scheduled-run days with zero successful `device_bash` calls at any point since 2026-10-15 — a full week of total failure on this specific tool, with the file bridge unaffected every single time. Two prior sessions (10-20, 10-21 congressional-monitor) already recommended Derek pause the daily-investigation and congressional-monitor scheduled tasks until he personally verifies `device_bash` on the Mac; that recommendation has not yet been acted on and the tasks are still firing daily with no research output. Escalating via push notification this run rather than just logging it again, since 7 days of silent identical failure is exactly the kind of thing this routine exists to surface.

**10th occurrence, 2026-10-23 (congressional-monitor):** identical wedge, 5/5 `device_bash` failures from the first attempt (`ls "$HOME/mnt"`, `ls "Side Projects"`, `echo hello` x3), with `get_device_info`/`device_list_dir`/`device_stage_files` all succeeding immediately and confirming the device connected and the repo reachable. This is now 9 consecutive scheduled-run days (10-15 through 10-23) with zero successful `device_bash` calls at any point — a full week and a half of total failure on this specific tool, with the file bridge unaffected every single time. The pause recommendation made repeatedly since 10-20 has still not been acted on; this run sent a push notification as the first run of a new calendar day to hit the still-open issue, per the 10-22 precedent of not duplicating same-day notifications.
