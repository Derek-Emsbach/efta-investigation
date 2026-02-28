# EFTA Investigation Platform — Build TODO

> **Update this file as tasks are completed.** Check off items with `[x]`. Add notes on blockers or changes.

---

> **Phases 1-4 are complete.** Full history archived in [`TODO_ARCHIVE.md`](TODO_ARCHIVE.md).

---

## Phase 5: Polish & Scale (Target: Weeks 7-8)

**Goal:** Production-ready, visually striking, performant.

### 5.1 Visual Design Pass
- [x] Full dark theme implementation
- [x] Light/dark mode toggle with localStorage persistence and FOUC prevention
- [x] Custom loading states and skeleton screens (loading.tsx for dashboard, entity profile, document detail)
- [x] Micro-animations: page transitions (fade-in-up on MainContent), shimmer skeletons, toast notifications
- [x] Empty states for pages with no data (EmptyState component on photos, datasets, hierarchy + existing on entities, documents, timeline, network, processing, review)
- [x] Error states with helpful messages (error.tsx global boundary + not-found.tsx 404 page)
- [x] Responsive layout (works on tablet, graceful on mobile — hamburger sidebar)
- [x] Favicon and meta tags (icon.svg, Open Graph metadata)
- [x] Legal infrastructure: footer with disclaimer, /disclaimer, /terms, /privacy pages
- [x] Skip-to-content link for keyboard accessibility
- [x] Breadcrumb navigation on entity and document detail pages
- [x] robots.txt (was disallow-all for private tool; now dynamic via robots.ts — allows public pages, blocks /dashboard/)
- [x] aria-current on active nav links, aria-hidden on decorative icons
- [x] Copyright notice (© Cyclops Digital LLC) in sidebar + footer

### 5.2 Performance
- [ ] Database indexes audit (EXPLAIN ANALYZE on common queries)
- [x] Cursor-based pagination on documents page (1.37M rows) — cursor encode/decode, estimated count RPC, server-side sort
- [ ] Pagination on remaining list pages (entities, events, locations use offset — fine at current scale)
- [ ] Image optimization (Next.js Image component, R2 transforms)
- [ ] Edge caching for public pages
- [ ] Lazy loading for below-fold content
- [ ] Bundle analysis and code splitting

### 5.3 Export & Reporting
- [ ] Export entity profile as PDF
- [ ] Export timeline as PNG/SVG
- [ ] Export evidence package per entity (zip with docs + summary)
- [ ] Export network graph as image
- [ ] Print-friendly stylesheets

### 5.4 Monitoring
- [ ] Error tracking (Sentry or similar)
- [ ] Basic analytics (page views, search queries)
- [ ] Database monitoring via Supabase dashboard
- [ ] Worker health checks

### 5.5 Automated Analysis Reports
- [ ] Nightly cron job (Supabase Edge Function or worker) that generates:
  - [ ] **Missing connections report:** Entities that co-occur in 3+ documents but have no connection record
  - [ ] **Under-investigated entities:** Tier 3+ entities with fewer than 3 source documents
  - [ ] **Redaction inconsistencies:** Same entity redacted in one document but visible in another
  - [ ] **Timeline gaps:** Date ranges with known entity activity but no events logged
  - [ ] **Stale reviews:** Documents in `needs_review` status for more than 7 days
- [ ] Reports surface on admin dashboard as notification cards
- [ ] Click any finding → relevant entity/document/search

---

## The Epstein Record — Public Publication Build

**Goal:** Transform the platform into a dual-mode app: private dashboard + public investigative publication.

> **Status:** All 7 phases complete + content seeded + first editorial story published. Publication routes live at `/`, `/entities/[slug]`, `/stories/[slug]`, `/case-files/[slug]`, `/evidence`, `/network`. Dashboard remains at `/dashboard/*`. 6 case files seeded (44 open questions, 34 entity links). 1 story published ("The Golden Handcuffs", 18 citations, 8 entity links). 4 more stories planned.

### Phase 0: Route Surgery + Foundation
- [x] Rename `(dashboard)/` → `dashboard/` (URL segment shift)
- [x] Update ~40 internal links (sidebar, pages, router.push)
- [x] Simplify middleware: `pathname.startsWith('/dashboard')` → require auth
- [x] Add redirects in next.config.ts for old dashboard-only paths
- [x] Add publication theme (`data-theme="publication"`) with warm paper palette (#faf8f5, Source Serif 4, DM Sans)
- [x] Add manila theme (`data-theme="manila"`) for case files
- [x] Add evidence room theme dark variant
- [x] Add fonts: Source Serif 4, DM Sans, JetBrains Mono
- [x] Migration 016: `stories`, `story_entities`, `story_citations`, `case_files`, `case_file_entities`, `open_questions` tables + entity slug/financial/profile columns
- [x] Generate slugs for all 99 entities (collision-safe)
- [x] Publish 53 entities (tiers 1-4) via profile_published flag
- [x] Publication layout (PublicHeader, PublicFooter), evidence layout (EvidenceHeader)
- [x] Legal pages moved to (legal)/ route group

### Phase 1: Entity Profiles
- [x] Dossier-style `/entities/[slug]` pages
- [x] 11 components: EntityHero, DossierCard, TierBadgePub, FinancialSummaryCard, EvidenceSection, ConnectionsGrid, DocumentsTable, EntityTimeline, StoriesSection, CaseFilesSection, ProfileTabs
- [x] Public API: `/api/public/entities/[slug]` + `/api/public/entities`
- [x] PersonJsonLd structured data

### Phase 2: Case File Reports
- [x] Manila-themed `/case-files/[slug]` pages
- [x] 5 components: CaseFileCover (stamp watermark), EntityRoster, OpenQuestions, FindingsMarkdown, ReportSidebar
- [x] Public API: `/api/public/case-files/[slug]` + `/api/public/case-files`

### Phase 3: Evidence Room
- [x] Dark-mode `/evidence` search interface
- [x] Full-text search via Supabase TSVECTOR (websearch mode)
- [x] In-memory search cache (5-min TTL)
- [x] SearchInterface + StatsBar components
- [x] Public API: `/api/public/evidence/search` + `/api/public/evidence/stats`
- [x] DatasetJsonLd structured data

### Phase 4: Story Pages
- [x] Editorial `/stories/[slug]` articles
- [x] Custom Markdown renderer with inline patterns: [CITE:N], {{entity:slug}}, {{doc:EFTA...}}, {{redacted:D}}, [!finding], [!data], [!quote]
- [x] StoryHero, StorySidebar, ReadingProgress components
- [x] Public API: `/api/public/stories/[slug]` + `/api/public/stories`
- [x] ArticleJsonLd structured data

### Phase 5: Homepage
- [x] Editorial front page at `/`
- [x] 6 components: Masthead, InvestigationStats, StoryGrid, CaseFilesPreview, EntitySpotlight, EvidenceRoomPromo
- [x] Aggregated data via server-side parallel Supabase queries

### Phase 6: Polish & Integration
- [x] Open Graph + Twitter Card metadata on all public pages
- [x] JSON-LD structured data (Article, Person, Dataset)
- [x] Dynamic sitemap.xml from published content
- [x] Dynamic robots.txt (allow public, block /dashboard/ + /api/)
- [x] Publication-themed 404 page
- [x] Rate limiting on all 9 public API routes (120/min general, 60/min search)
- [x] Mobile hamburger menu on publication header
- [x] Content seeding: 6 case files + 44 open questions + 34 entity links seeded from investigation threads
  - [x] Enhanced FindingsMarkdown component: markdown tables, `[SPECULATION_START/END]` blocks, HTML comment stripping, `<h4>` headings, multi-paragraph blockquotes, horizontal rules
  - [x] Unified renderer upgrade: FindingsMarkdown now uses `lib/markdown-renderer.tsx` (React nodes, no `dangerouslySetInnerHTML`). Auto-links entity names (word-boundary, longest-first) and EFTA Bates numbers in case file findings.
### Phase 7: Homepage Redesign + Public Network Route
- [x] Fix "Explore the Network" link → `/network` (was `/evidence`)
- [x] Redesigned Masthead — "Record" in red, EFTA subtitle, date above title, double border
- [x] Redesigned InvestigationStats — Playfair Display numbers, red-highlighted units, vertical dividers
- [x] Redesigned EntitySpotlight — tier badge pills (e.g., TIER 1 · CONVICTED), white cards, hover shadow
- [x] New HeroSection — newspaper-style lead story (2/3) + sidebar (latest findings + open questions)
- [x] New FollowTheMoney section — $158M figure, 2/3+1/3 grid, green section color
- [x] New CoverUpSection — redaction visual, 2-column grid, maroon section color
- [x] Restructured PublicHeader — dark top bar (Investigation Active + utility links) + sticky centered nav with dividers
- [x] Public network API (`/api/public/network`) — profile_published filter, post-filtered connections, rate limited
- [x] Public network page (`/network`) — D3 force-directed graph adapted from dashboard, publication theme, slug-based navigation
- [x] Recomposed homepage with new section order and open_questions query
- [ ] Full cross-linking audit (entity mentions in stories → profile links, EFTA numbers → evidence room)

### Phase 8: Editorial Stories
- [x] Story seeding infrastructure in `seed-publication.ts` (StoryDef type, seedStories function, document/case-file UUID lookups)
- [x] Story 1: "The Golden Handcuffs" (witness control) — `docs/stories/the-golden-handcuffs.md`, section: the-cover-up, 18 citations, 8 entity links, linked to CF-2026-003
- [x] Story 2: "The Case That Wasn't" (prosecutorial failure) — `docs/stories/the-case-that-wasnt.md`, section: the-cover-up, 20 citations, 6 entity links, linked to CF-2026-005
- [x] Story 3: "The Trustee With No Exit" (Jes Staley) — `docs/stories/the-trustee-with-no-exit.md`, section: the-network, 14 citations, 6 entity links, linked to CF-2026-001
- [ ] Story 4: "The Heirs With the Most to Hide" (Dubin architecture) — section: follow-the-money
- [ ] Story 5: "The Man Who Held Every Key" (Indyke conflicts) — section: the-network
- [ ] Story 6: "The System" (master synthesis, write last) — section: the-operation

---

## Future Phases (Backlog)

### Infrastructure Scaling (Supabase Pro + Bulk Import)
> Full plan: `.claude/plans/hashed-herding-beaver.md`
- [x] Upgrade Supabase to Pro ($25/mo) — 8 GB database, 100K MAUs
- [x] Migration `008_profiles.sql` — profiles table with role column (admin/viewer), auto-create trigger, RLS
- [x] Admin user seeded in profiles table
- [ ] `user_profiles` table expansion: subscription_tier (free/pro/enterprise), Stripe fields, AI query metering
- [ ] Replace all 18+ RLS policies: public read on data tables, admin-only on admin tables, own-user on conversations
- [x] Performance indexes (migration 009): 6 composite + partial indexes for documents, processing_queue, events
- [ ] Grant anon access to RPC functions (from migration 005)
- [x] Fix load_file_parser.py encoding (UTF-8 first, ALT_DELIM priority, thorn stripping)
- [x] Clean up ~1.37M corrupted docs from encoding bug (cleanup_corrupted_docs.py)
- [x] Bulk import large volumes: VOL09 (531,307) + VOL10 (503,154) + VOL11 (331,655) = 1,366,069 created
- [x] Bulk import small volumes: VOL01/03/04/05/06/07/12 = 3,679 updated (existing seed docs)
- [x] Rebuild search vectors (1,366,537 via RPC + Python batching script)
- [x] VACUUM ANALYZE documents
- [x] Verify DB size stays under 8 GB in Supabase dashboard (3.61 GB / 8 GB = 45%)

### Public Access & User Signup
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase C + F)
- [ ] Update middleware — define PROTECTED_PATHS, allow anonymous browsing on public pages
- [ ] Update dashboard layout — anonymous-friendly (no admin section, "Sign In" button)
- [ ] Update sidebar — conditionally show admin links based on user role
- [ ] Access control utility (`lib/access-control.ts`) — canViewPDF, canUseDetective, canUpload
- [ ] Signup page (`/signup`) — email/password, email verification, Turnstile bot prevention
- [ ] Password reset page (`/reset-password`) — uses Supabase built-in flow
- [ ] OAuth sign-in (Google) — enable in Supabase dashboard + Google Cloud Console
- [ ] Update login page — add "Create Account", "Forgot Password" links, OAuth buttons
- [ ] Account settings page — display name, change password, delete account (GDPR)
- [ ] Gate API routes: public GET routes remove auth check, write routes keep auth + role check
- [ ] Content tiers: anon (browse only), free (full text), pro (PDF + AI), admin (upload/review)

### Security Hardening
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase E)
- [ ] Rate limiting — Upstash Redis + `@upstash/ratelimit` (free tier: 10K/day)
- [ ] API rate limit: 60 req/min per IP, AI rate limit: 10 req/min per user, auth: 5 attempts/min
- [ ] Email verification — enable "Confirm email" in Supabase Auth settings
- [ ] Bot prevention — Cloudflare Turnstile (free) on signup + login
- [ ] Security headers — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] Anthropic API spend cap — set monthly budget in Anthropic Console ($50/mo initially)
- [ ] Error monitoring — Sentry (free tier: 5K events/mo)
- [ ] Vercel Attack Challenge Mode — keep off normally, enable during active attacks

### Monetization (Stripe + Pro Tier)
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase D)
- [ ] Stripe integration — `stripe` + `@stripe/stripe-js` packages
- [ ] Stripe webhook handler (`/api/webhooks/stripe`) — subscription lifecycle events
- [ ] Checkout route (`/api/billing/checkout`) — create Stripe Checkout session
- [ ] Billing portal route (`/api/billing/portal`) — manage subscription
- [ ] AI query metering — check `ai_queries_used` vs `ai_queries_limit` before Claude API calls
- [ ] Monthly usage reset via `ai_queries_reset_at`
- [ ] Billing settings page — current plan, usage meter, upgrade/manage buttons
- [ ] Add `estimated_cost` column to `api_usage_log` table

### AI-Assisted Analysis (Phase 2 of processing)
- [ ] Train entity extraction on our reviewed data
- [ ] Automated cross-referencing with confidence scores
- [ ] Anomaly detection (unusual redaction patterns, timeline gaps)
- [ ] Suggested connections based on co-occurrence analysis

### Additional Data Sources
- [ ] Giuffre v. Maxwell court records import
- [ ] House Oversight materials import
- [ ] FOIA release comparison tools
- [ ] Congressional oversight monitoring

### Photo Album & Image Pipeline
- [x] Image extraction pipeline stage (Stage 1.5) — PyMuPDF `page.get_images()`, upload to R2 `images/{doc_id}/`, scan detection (skip >85% page coverage)
- [x] `document_images` table — document_id, page_number, r2_key, thumbnail_r2_key, tags[], caption, metadata JSONB, image_type, is_redacted
- [x] Photo Album page (`/photos`) — global gallery grid, type/tag filters, pagination, lightbox viewer with metadata sidebar
- [x] Entity photo tab — Photos tab on entity detail page (lazy-loaded via API)
- [x] Document images strip — horizontal scrollable thumbnails on document detail page
- [x] Image tagging: entities + locations (junction tables, API endpoints, search-select components, lightbox tagging UI, photos page filters)
- [ ] Image tagging: dates, evidence type, redaction level (future enhancement)

### Rich Entity Profiles
- [x] AI-generated mentions summary (Claude-powered, cached in entity metadata, role distribution chips)
- [x] External sources section on entity profile (news, court records, flight logs from `external_sources` table)
- [x] Wikipedia bio section with cached thumbnail and verification badge
- [x] Profile picture sourcing (Wikipedia thumbnail → `profile_image_url` → initials fallback)
- [x] External sources API route (`GET /api/entities/[id]/sources`)
- [x] News article fetching (Google News RSS → `external_sources`, auto-triggered from entity profile)

### Access Control & Roles
- [x] `profiles` table with `role` column (admin/viewer) + auto-create trigger on signup
- [x] `getUserRole()` server helper + `requireAdmin()` API route guard
- [x] Middleware route guards — viewers redirected from admin paths (/upload, /processing, /review, /assistant, /admin, /settings)
- [x] API guards on mutating endpoints (presign, retry, clear, review PATCH, assistant POST)
- [x] Sidebar hides admin section for viewers, shows role badge
- [x] User management table on `/admin` page with role toggle
- [ ] RLS policy rewrite (future — currently application-layer enforcement only)

### MCP Server Upgrades
- [x] Migration 013: `suspect_watchlist` table + `pg_trgm` extension + `strength` column on `entity_connections` + fuzzy search RPCs
- [x] Split monolithic `tools.ts` (812 lines) into 10 domain modules under `src/tools/`
- [x] Fix 4 critical bugs: `connections` → `entity_connections`, remove `document_cross_references`, remove `entity_evidence_items`, fix `get_schema` RPC fallback
- [x] Standardize all tool responses: `toolResponse()` / `errorResponse()` helpers, `{success, count, total_count, data, message, id}` envelope
- [x] Enhanced `safeJson`: truncation metadata `[TRUNCATION_INFO: {shown_chars, total_chars}]`
- [x] 5 suspect watchlist tools: search, create, update, promote (→ entities), delete (soft/hard)
- [x] 5 entity sighting tools (using existing `entity_sightings` + `locations` tables): search_entity_locations, add_entity_location, find_co_locations, get_location_timeline, find_entities_at_location
- [x] `lookup_person`: unified fuzzy name search across entities + suspects (exact + ilike + pg_trgm trigram)
- [x] `batch_link_entities_to_document`: upsert multiple entity-doc links in one call
- [x] All search tools enhanced with `total_count` and `summary` mode
- [x] All write tools return `{success, id, data, message}` consistently
- [x] `link_entity_to_document` uses upsert (no error on duplicate)
- [x] `get_schema` rewritten with hardcoded `TABLE_INFO` map (purposes + FK relationships)
- [x] Entity/document search uses FTS via `search_vector` with ilike fallback
- [x] `SuspectWatchlist` types added to `@efta/shared`
- [x] Run migration 013 in Supabase SQL Editor
- [x] Deploy updated MCP server
- [x] `corpus_get_document_text`: added `start_page`/`end_page` range params for multi-page reads (up to 30K chars)
- [x] `corpus_search`: added `efta_number` filter param for within-document FTS searches
- [x] Dynamic SQL builder for `corpus_search` — handles all 4 filter combinations (dataset × efta_number)

### Investigation Analysis Reports
- [x] EFTA02731082 deep read — all 86 pages read in 9 sequential chunk calls, zero truncation
- [x] `docs/investigation/EFTA02731082_Analysis.md` — 12-section analysis report (overview, victim accounts, named subjects, evidence inventory, legal analysis, charging decision, key quotes, redaction analysis, entity register, cross-references, open questions, database updates)
- [x] EFTA02731082 database updates — 3 suspects promoted to entities (Wexner T4, Dubin T1, Indyke T6), document record updated (extreme_critical), 10 entity-doc links, 7 events with entity links, 5 connections (Dubin↔Maxwell, Dubin↔Epstein, Wexner↔Epstein, Indyke↔Epstein attorney_for, Clinton↔Epstein)
- [x] Fix `promote_suspect` phantom column bug — `evidence_summary` was inserted as column instead of `metadata.evidence_summary` JSONB
- [x] EFTA01266403 deep read — all 24 pages read in 4 chunk calls (7 pages each), zero truncation, 60,494 chars
- [x] `docs/investigation/EFTA01266403_Analysis.md` — 12-section analysis (trust structure, trustees, beneficiaries, properties, shell companies, key quotes, entity register, cross-references, open questions, database updates)
- [x] `docs/investigation/EFTA01266403_Database_Updates_Prompt.md` — structured DB update spec: 5 new entities (Mitchell, Celina Dubin, Eva Andersson-Dubin, Shuliak, Kahn), 12 entity-doc links, 2 events, 9 connections, 11 suspect watchlist additions
- [x] EFTA01266403 database updates — 5 new entities (Mitchell T6, Celina Dubin T4, Eva Andersson-Dubin T4, Shuliak T4, Kahn T6), 3 entity updates (Dubin/Indyke/Staley evidence_summary merged), 11 entity-doc links, 2 events, 9 connections (incl. 2 `family_of`), 11 suspects added to watchlist
- [x] EFTA01266380 + EFTA01266427 deep read — 3-way trust comparison complete. Staley confirmed as original trustee (Nov 2014). Combined analysis at `docs/investigation/EFTA01266380_Analysis.md`. Raw text for 01266427 extracted. Trust chain: 01266380 (original) → 01266403 (A&R May 2015) → 01266427 (1st amendment).
