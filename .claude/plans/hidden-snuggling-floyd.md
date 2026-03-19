# Investigator Workspace (Community Phase 3)

## Context

The platform has a three-tier subscription model (subscriber/supporter/investigator). Middleware already gates `/investigate/*` paths. Foundation tables (`investigator_stats`, `xp_transactions`, rank triggers) exist from migration 018. The admin AI assistant at `/dashboard/assistant` is the reference implementation for the detective page. This phase builds the actual workspace that investigators are paying for.

---

## Files to Create

```
packages/db/migrations/025_investigator_workspace.sql
packages/shared/src/types/database.ts                    # Add InvestigatorNote, UserSubmission types
apps/web/src/lib/supabase/require-paid-tier.ts           # Auth guard for supporter+investigator
apps/web/src/lib/ai/investigator-tools.ts                # 8 read-only query tools (subset of tools.ts)
apps/web/src/lib/ai/investigator-prompt.ts               # Simplified system prompt (no suggest/apply)

apps/web/src/app/(investigate)/layout.tsx                 # Outer layout (evidence-room theme)
apps/web/src/app/(investigate)/investigate/layout.tsx     # Inner layout (tab bar)
apps/web/src/app/(investigate)/investigate/page.tsx       # Overview dashboard
apps/web/src/app/(investigate)/investigate/notes/page.tsx
apps/web/src/app/(investigate)/investigate/detective/page.tsx  # Forked from admin assistant (~1200 lines)
apps/web/src/app/(investigate)/investigate/submit/page.tsx
apps/web/src/app/(investigate)/investigate/ranks/page.tsx

apps/web/src/components/investigate/entity-linker.tsx     # Shared typeahead for notes + submissions

apps/web/src/app/api/investigate/notes/route.ts           # GET/POST
apps/web/src/app/api/investigate/notes/[id]/route.ts      # GET/PATCH/DELETE
apps/web/src/app/api/investigate/detective/route.ts       # Streaming SSE (fork of /api/assistant)
apps/web/src/app/api/investigate/detective/conversations/route.ts
apps/web/src/app/api/investigate/detective/conversations/[id]/route.ts
apps/web/src/app/api/investigate/detective/conversations/[id]/messages/route.ts
apps/web/src/app/api/investigate/submissions/route.ts     # GET/POST
apps/web/src/app/api/investigate/submissions/[id]/route.ts
apps/web/src/app/api/investigate/ranks/route.ts           # Public leaderboard
apps/web/src/app/api/investigate/stats/route.ts           # User's own stats
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types/database.ts` | Add `InvestigatorNote`, `UserSubmission`, `SubmissionType`, `SubmissionStatus` |
| `packages/shared/src/index.ts` | Export new types |

---

## Migration 025

Three objects:

**1. `investigator_notes`** — personal markdown notes with entity links
- `id UUID PK`, `user_id UUID FK profiles`, `title TEXT`, `content TEXT`, `entity_ids UUID[]`, `is_pinned BOOLEAN`, `created_at`, `updated_at`
- Index on `user_id`. RLS: own rows only + service_role.

**2. `user_submissions`** — finding/connection/entity/correction submissions
- `id UUID PK`, `user_id UUID FK profiles`, `submission_type TEXT CHECK`, `title TEXT`, `body TEXT`, `evidence_urls TEXT[]`, `entity_ids UUID[]`, `status TEXT CHECK (draft/submitted/under_review/approved/rejected)`, `reviewer_notes TEXT`, `reviewed_by UUID FK profiles`, `reviewed_at TIMESTAMPTZ`, `xp_awarded INTEGER DEFAULT 0`, `created_at`, `updated_at`
- Indexes on `user_id`, `status`. RLS: own rows + service_role.

**3. `handle_submission_approval()` trigger** — on status change to `'approved'`:
- Insert XP transaction (finding=50, connection=30, entity=75, correction=25)
- Increment `approved_submissions_count` on `investigator_stats`
- On status change to `'submitted'`: increment `submissions_count`

---

## Detective Page Strategy: Copy and Simplify

Fork `/dashboard/assistant/page.tsx` (1950 lines) → `/investigate/detective/page.tsx` (~1200 lines).

**Remove:**
- All suggestion/approve/dismiss logic (~500 lines): `handleApprove`, `handleDismiss`, `SuggestionCard`, `ConnectionCard`, `TierChangeCard`, `EvidenceCard`, `PlatformCard`, `CardActions`, `suggestionStatus` fields
- Apply route integration (no `/api/assistant/apply` calls)

**Add:**
- Quota meter header: "N/10 queries remaining" badge
- Quota check before each query (429 if exhausted)
- Atomic increment via SQL: `UPDATE investigator_stats SET ai_queries_used_today = CASE WHEN ai_queries_reset_date < CURRENT_DATE THEN 1 ELSE ai_queries_used_today + 1 END, ai_queries_reset_date = CURRENT_DATE WHERE user_id = $1 RETURNING ai_queries_used_today, ai_queries_daily_limit`
- Supporter upgrade prompt (if tier != 'investigator')

**Keep unchanged:**
- ConversationPanel, MessageBubble, ToolCallBlock (without suggestion cards), streaming SSE parsing, auto-scroll, textarea auto-resize

**AI tools:** 8 read-only query tools (no suggest_* tools):
`search_entities`, `search_documents`, `search_events`, `get_entity_profile`, `get_document_detail`, `get_document_text`, `query_connections`, `cross_reference`

**System prompt:** Encourage submitting findings via the submission form instead of direct DB writes.

---

## Page Designs

### Overview (`/investigate`)
Rank card (badge + XP progress bar) | AI queries widget (N/10 circular) | Recent notes (last 3) | Submission stats (submitted/approved/pending) | Quick action buttons

### Notes (`/investigate/notes`)
Two-column: note list (pinned first, search/filter) + editor (title, markdown textarea, entity linker chips, save/delete/pin)

### Detective (`/investigate/detective`)
Conversation sidebar + chat area + streaming messages. Same UX as admin assistant minus suggestion cards. Quota badge in header.

### Submit (`/investigate/submit`)
Form: type radio (finding/connection/entity/correction), title, body textarea, evidence URL list, entity linker. Below: past submissions table with status badges (draft=gray, submitted=blue, under_review=yellow, approved=green, rejected=red).

### Ranks (`/investigate/ranks`)
Leaderboard table: position, display name, rank badge, XP, approved submissions. Rank explanation card showing all 6 ranks + thresholds.

---

## Implementation Order

1. Migration 025 + shared types
2. `requirePaidTier()` helper
3. Notes API (GET/POST, GET/PATCH/DELETE [id])
4. `investigator-tools.ts` + `investigator-prompt.ts`
5. Detective API route (fork + simplify `/api/assistant/route.ts`)
6. Detective conversation API routes (fork of existing)
7. Submissions API routes
8. Stats + Ranks API routes
9. Route group layouts (outer + inner tab bar)
10. Entity Linker component
11. Overview page
12. Notes page
13. Detective page (fork + simplify — biggest piece)
14. Submit page
15. Ranks page
16. Build verification + type check

---

## Verification

1. `/investigate` shows overview with rank card, quota widget, recent notes
2. `/investigate/notes` — create/edit/delete/pin notes, entity linker works
3. `/investigate/detective` — streaming AI with quota enforcement, conversation persistence
4. `/investigate/submit` — create draft, submit, see status in list
5. `/investigate/ranks` — leaderboard displays
6. Subscriber redirected to `/support` by middleware
7. Supporter sees notes + ranks but upgrade prompt on detective + submit
8. `pnpm --filter web exec tsc --noEmit` passes
9. `pnpm turbo build --filter=web` passes
