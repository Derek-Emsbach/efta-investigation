# Congressional Monitoring Workflow

> Keep the public timeline current with real-world developments around EFTA compliance, congressional oversight, DOJ actions, and related legal proceedings.

## When to Run

Run at the **start of each session** (or at minimum weekly). This takes 2-3 minutes.

## Step 1: Check for New Developments

Search the web for recent events:

```
WebSearch: "Epstein EFTA DOJ Congress [current month] [current year]"
WebSearch: "Epstein files congressional [current month] [current year]"
WebSearch: "Epstein DOJ release redaction [current month] [current year]"
```

## Step 2: Check Against Existing Events

Before creating any new event:

```
search_public_events(query: "[topic]")
```

Verify the event doesn't already exist. Check date + title carefully — some events span multiple days (e.g., Friedman visits Feb 13, sends letter Mar 6).

## Step 3: Create New Events

Use `create_public_event` with these fields:

| Field | Required | Notes |
|-------|----------|-------|
| `date` | Yes | ISO format YYYY-MM-DD |
| `title` | Yes | Short headline, <100 chars |
| `category` | Yes | See categories below |
| `description` | No | 1-3 sentences of context |
| `impact_level` | No | critical/high/medium/low |
| `entity_names` | No | People involved (display names matching existing entities when possible) |
| `source_urls` | No | News articles, official statements, .gov links |
| `tags` | No | Freeform, use existing tags when applicable |
| `efta_numbers` | No | If specific EFTA documents are referenced |

## Categories

| Category | Use For |
|----------|---------|
| `legislative` | Bills passed, votes, discharge petitions |
| `congressional_action` | Reading room visits, floor speeches, letters to DOJ, hearings, testimony |
| `doj_release` | Dataset releases, compliance claims |
| `doj_action` | Deletions, re-redactions, surveillance, false claims |
| `criminal_action` | Arrests, charges, indictments |
| `resignation` | Resignations, firings, suspensions |
| `court_action` | Court filings, rulings, orders |
| `media_break` | Major investigative reporting, new findings published |
| `community_resource` | Tools launched, advocacy actions |
| `international` | Foreign government actions |
| `victim_advocacy` | Survivor statements, advocacy group actions |

## Impact Level Guide

| Level | Use For |
|-------|---------|
| `critical` | Changes the landscape: arrest, major release, GAO audit, new law |
| `high` | Significant: resignation, reading room revelation, formal letter/demand |
| `medium` | Notable: media article, routine filing, tool update |
| `low` | Minor/contextual: social media post, routine procedural step |

## Key Sources to Monitor

- [DOJ Epstein Library](https://www.justice.gov/epstein) — official releases
- [House Oversight Committee](https://oversight.house.gov/) — Epstein records releases
- [House Judiciary Democrats](https://democrats-judiciary.house.gov/) — DOJ oversight
- [Congress.gov](https://www.congress.gov/search?q=epstein) — new bills/resolutions
- [GAO](https://www.gao.gov/) — audit status updates
- News: The Hill, NPR, Washington Post, CNN Politics, CBS News

## Existing Tags (reuse when applicable)

`reading_room`, `surveillance`, `names_revealed`, `redactions`, `compliance`, `false_compliance`, `dataset_release`, `efta_passage`, `bipartisan`, `missing_files`, `letter`, `testimony`, `oversight_committee`, `gao_audit`, `investigation`, `doj_response`, `ai_tools`, `journalism`, `transparency`
