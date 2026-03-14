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
- [x] Dashboard network page rewrite — fixed SVG overflow blocking sidebar, theme-aware background, PageHeader, dual-view toggle (D3 graph + sortable table with TierBadge and entity links)
- [x] robots.txt (was disallow-all for private tool; now dynamic via robots.ts — allows public pages, blocks /dashboard/)
- [x] aria-current on active nav links, aria-hidden on decorative icons
- [x] Copyright notice (© Cyclops Digital LLC) in sidebar + footer

### 5.2 Performance
- [x] Database indexes audit — existing indexes (migration 009) adequate at current scale; entities/events/locations under 10K rows
- [x] Cursor-based pagination on documents page (1.37M rows) — cursor encode/decode, estimated count RPC, server-side sort
- [x] Pagination on remaining list pages — offset fine at current scale (<10K rows each)
- [x] Image CLS prevention — `aspect-square` containers already reserve space before images load
- [x] Edge caching — `Cache-Control` headers on all 10 public API routes (`s-maxage` + `stale-while-revalidate` for Vercel CDN)
- [x] Lazy loading — publication pages are Server Components (no client JS); PDF viewer already dynamic-imported; no further wins
- [x] Bundle analysis — `@next/bundle-analyzer` installed, `pnpm --filter web analyze` script added
- [x] Image optimization — Next.js `<Image>` for entity profile pictures + Wikipedia thumbnails (`remotePatterns` for `upload.wikimedia.org`). R2 images left as `<img>` (served via API routes).
- [x] D3 code splitting — `next/dynamic` with `ssr: false` on both dashboard + public network pages. Client component wrappers for Next.js 16 Server Component constraint.

### 5.3 Export & Reporting
- [x] Export entity profile as PDF — `PrintButton` component + print stylesheet (`window.print()` → Save as PDF)
- [x] Export network graph as SVG/PNG — zero-dependency SVG serialization + canvas rasterization on dashboard network page
- [x] Print-friendly stylesheets — `@media print` rules in globals.css (hides nav/sidebar/donate/search, white bg, serif typography, page break rules, external link URLs shown)
- [x] Print button on entity, story, and case-file pages
- [x] Export timeline as PNG — `html-to-image` `toPng()` capture + PDF via `window.print()`. Export buttons in PageHeader actions slot.
- [x] Export evidence package per entity — JSZip assembly route at `/api/entities/[id]/evidence-package` (summary.txt + up to 20 PDFs from R2). Download button on entity detail page.

### 5.4 Monitoring
- [x] Error tracking — Sentry `@sentry/nextjs` v10 integrated (client/server/edge configs, global error boundary, instrumentation.ts). Dormant until `NEXT_PUBLIC_SENTRY_DSN` env var is set.
- [x] Basic analytics — Vercel Analytics + Speed Insights (zero-config, privacy-friendly)
- [x] Database monitoring via Supabase dashboard
- [x] Worker health checks — `/api/worker/health` infers status (healthy/degraded/offline/idle) from `processing_queue` timestamps + `WorkerHealth` dashboard component with status dot, throughput, fail rate, currently processing indicator. Polls every 15s.

### 5.5 Automated Analysis Reports
- [x] On-demand analysis API at `/api/admin/analysis` (2-min cache) running 5 data quality queries:
  - [x] **Missing connections:** Entity co-occurrence analysis (3+ shared docs, no connection record) with fallback from RPC to in-memory computation
  - [x] **Under-investigated entities:** Tier 1-3 entities with <3 linked documents
  - [x] **Redaction inconsistencies:** Documents with both Category A (victim) and Category D (perpetrator) redactions
  - [x] **Timeline gaps:** Entities with multi-year event spans but <3 events, or Tier 1-2 with only 1 event
  - [x] **Stale reviews:** Documents in `needs_review` >7 days with days-stale calculation
- [x] `AnalysisInsights` dashboard component — expandable cards by severity (critical/warning/info), click items → relevant entity/document page
- [x] Integrated on dashboard home page in new "Analysis Insights" section

---

## The Epstein Crimes — Public Publication Build

**Goal:** Transform the platform into a dual-mode app: private dashboard + public investigative publication.

> **Status:** All 8 phases + Evidence Room expansion complete. Publication routes live at `/`, `/entities/[slug]`, `/stories/[slug]`, `/case-files/[slug]`, `/network`. Evidence Room workspace at `/evidence` (tabbed: Search, Entities, Images, Network, Timeline). Dashboard at `/dashboard/*`. 6 case files (44 open questions, 34 entity links). 16 stories (218 citations, 91 entity links). Entity profiles have Photos + Videos tabs (media expansion). Public document viewer at `/evidence/documents/[bates]`. 32 published entities fully enriched.

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
- [x] Cross-linking audit: enabled `autoLink: true` for story pages — entity names auto-linked to `/entities/{slug}`, EFTA Bates numbers auto-linked to evidence room search. Sarah Kellen/Nadia Marcinkova intentionally unlinked (no published profiles).

### Phase 8: Editorial Stories
- [x] Story seeding infrastructure in `seed-publication.ts` (StoryDef type, seedStories function, document/case-file UUID lookups)
- [x] Story 1: "The Golden Handcuffs" (witness control) — `docs/stories/the-golden-handcuffs.md`, section: the-cover-up, 18 citations, 8 entity links, linked to CF-2026-003
- [x] Story 2: "The Case That Wasn't" (prosecutorial failure) — `docs/stories/the-case-that-wasnt.md`, section: the-cover-up, 20 citations, 6 entity links, linked to CF-2026-005
- [x] Story 3: "The Trustee With No Exit" (Jes Staley) — `docs/stories/the-trustee-with-no-exit.md`, section: the-network, 14 citations, 6 entity links, linked to CF-2026-001
- [x] Story 4: "The Heirs With the Most to Hide" (Dubin Architecture) — `docs/stories/the-heirs-with-the-most-to-hide.md`, section: follow-the-money, 11 citations, 9 entity links, linked to CF-2026-002
- [x] Story 5: "The Man Who Held Every Key" (Indyke Conflicts) — `docs/stories/the-man-who-held-every-key.md`, section: the-network, 12 citations, 4 entity links, linked to CF-2026-004
- [x] Story 6: "The System" (master synthesis) — `docs/stories/the-system.md`, section: the-operation, 9 citations, 10 entity links, linked to CF-2026-000

**Phase 8 COMPLETE** — 6 stories, 84 total citations, 43 total entity links across 4 sections

### Phase 9: Rebrand + SEO + Donation Model
- [x] Site-wide rename: "The Epstein Record" → "The Epstein Crimes" (30+ occurrences across all runtime source files)
- [x] URL fallbacks updated: `theepsteinrecord.com` → `theepsteincrimes.com` (sitemap, robots, JSON-LD)
- [x] Ticker: "Breaking" → "Latest Findings" with 5 factual investigation milestones
- [x] Cyclops Digital branding: footer column with logo placeholder + cyclops-digital.com link
- [x] Donate bar: reusable `<DonateBar />` component (top compact + bottom prominent variants)
- [x] Support page: `/support` — mission statement, what donations fund, Cyclops Digital attribution
- [x] Evidence room: minimal footer with Cyclops Digital attribution + donate bar
- [x] Featured story swap: "The System" as homepage lead (DB update)
- [x] Live stats: entity and open question counts from DB (replaced hardcoded 99/50)
- [x] `metadataBase`: `new URL('https://theepsteincrimes.com')` — auto-resolves relative OG URLs
- [x] Vercel Analytics + Speed Insights: zero-config, privacy-friendly
- [x] Dynamic OG image route: `/api/og?title=...&subtitle=...&type=...` — 1200x630 newspaper-style
- [x] OG images added to all public pages (homepage, entities, stories, case files, evidence, network)
- [x] Network page split: server wrapper (metadata) + client component (D3 graph)
- [x] Sitemap expansion: 7 new routes (network, stories, entities, case-files, support, terms, privacy)

**Phase 9 COMPLETE** — site rebranded, donation model, Cyclops Digital branding, full SEO suite

### Phase 10: Evidence Room Expansion
- [x] Fix network graph rendering bug — `min-h-[600px]` on container div so ResizeObserver fires
- [x] Evidence Room inner layout — client component with horizontal tab bar (Search, Entities, Network, Timeline) at `(evidence)/evidence/layout.tsx`, active tab highlighted via `usePathname()`
- [x] Entity directory — `/evidence/entities` — entity table with tier/type/search filters, fetches from `/api/public/entities`
- [x] Entity detail — `/evidence/entities/[slug]` — data-focused profile (connections table, documents table, timeline, stories & case files), links back to publication dossier
- [x] Network graph — `/evidence/network` — full D3 force graph with tier/relationship/strength filters, search, BFS path finder, using public API (`/api/public/network`), entity clicks navigate to `/evidence/entities/[slug]`
- [x] Public timeline API — `/api/public/timeline` — rate-limited, 5-min cache, entity slug filter, privacy-filtered (published entities only), cache-control headers
- [x] Timeline page — `/evidence/timeline` — chronological events grouped by month-year, event type/date/search filters, entity chips link to evidence room profiles

**Phase 10 COMPLETE** — Evidence Room expanded from search-only to full research workspace with 4 integrated views

### Phase 11: Image Support
- [x] Entity profile photos — seed script (`scripts/src/seed-entity-photos.ts`) populates `profile_image_url` from Wikimedia Commons for ~30 published entities (people only; orgs/properties keep initials fallback)
- [x] Entity photo components — 48x48 thumbnails in EntitySpotlight, 28x28 in evidence room entity directory/detail, `profile_image_url` added to all entity API queries
- [x] Story hero image schema — migration 017 adds `hero_image_url` + `hero_image_caption` to `stories` table
- [x] Story type updated — `hero_image_url` and `hero_image_caption` added to `Story` interface in `@efta/shared`
- [x] Story hero image rendering — hero images on story detail page (16:9, priority load, caption), homepage HeroSection, StoryGrid, SectionStoryGrid, FollowTheMoney, CoverUpSection, stories list page
- [x] Public document image API — `/api/public/images/[id]/file` + `/api/public/images/[id]/thumbnail` (R2 proxy, 24hr browser cache, 7-day CDN cache, rate-limited)
- [x] 6 story hero images seeded from Wikimedia Commons (Palm Beach aerial, Power of Attorney doc, Deutsche Bank HQ, Les Wexner, Alexander Acosta, DOJ seal)
- [x] Image optimization fix — `unoptimized={!url.includes('wikimedia.org')}` pattern across all 7 story image components (lets Next.js optimize Wikimedia URLs)
- [x] next.config.ts already has `upload.wikimedia.org` in `remotePatterns`

**Phase 11 COMPLETE** — Real images throughout public site: entity profile photos, story hero images, public document image API

### Story Pipeline (Ongoing)

> Stories are written as a natural extension of investigation sessions. See `docs/STORY_QUEUE.md` for the full workflow, quality checklist, and continuation prompt template.

- [x] Create `docs/STORY_QUEUE.md` — backlog tracking with workflow + checklist
- [x] Update CLAUDE.md session checklist with story step
- [x] Story 7: "The Scheduler" (Lesley Groff) — section: the-network — 1,299 words, 19 citations, 5 entity links. Seeded 2026-03-12.
- [x] Story 8: "The Billion-Dollar Blind Eye" (Leon Black) — section: follow-the-money — ~2,000 words, 22 citations, 4 entity links, 3 inline images + hero image. First story with inline `![caption](url)` images. Seeded 2026-03-12.
- [x] Story 9: "The Recruitment Trip" (Cape Town) — section: the-operation — ~1,500 words, 19 citations, 5 entity links, 3 inline images + hero image. Seeded 2026-03-12.
- [x] Image retrofit — all 9 stories now have hero images + 2-3 inline images each. Broken Cape Town URL fixed.
- [x] Editorial attribution — Derek Emsbach as named editor across masthead, story bylines, footer, about page. AI-Assisted badge on stories.
- [x] Related Stories — "Continue Reading" section on every story page (3 related articles, matched by shared entities → section → recency)
- [x] Story 10: "Three Million Pages of Nothing" (DOJ scanning analysis) — section: the-cover-up — ~1,800 words, 6 citations, 1 entity link, 2 inline images + hero image. Systematic sampling of all 12 datasets confirms 100% hybrid scans at 96 DPI. Seeded 2026-03-14.
- [x] Story 11: "The Washington List" (D.C. journal cluster) — section: the-network — ~2,000 words, 10 citations, 9 entity links, 4 inline images + hero image. Kimsey/Case/Leonsis/Snyder AOL cluster pattern. Seeded 2026-03-14.
- [x] Story 12: "The Last Night" (MCC death) — section: the-cover-up — ~2,000 words, 5 citations, 2 entity links, 2 inline images + hero image. Minute-by-minute MCC timeline from prosecution slide deck + grand jury transcripts. Seeded 2026-03-14.
- [x] Story 13: "The Governor's Ranch" (Bill Richardson) — section: the-network — ~2,000 words, 10 citations, 6 entity links, 3 inline images + hero image. Pilot Morrison deposition, Zorro Trust campaign money, Groff/Hartley scheduling, Juliette ¶50 convergence. Richardson entity enriched to T3 published with bio, evidence summary, photo, 4 events, 2 new connections. Seeded 2026-03-14.
- [x] Story 14: "Normal for This Client" (Deutsche Bank) — section: follow-the-money — ~2,200 words, 16 citations, 6 entity links, 2 inline images + hero image. Full investigation: corpus sweep (200+ docs), deep read EFTA01681865 (52 pages) + 7 supporting docs, analysis at `docs/investigation/sources/DEUTSCHE_BANK/Analysis.md`. 5 new entities (Paul Morris, Tazia Smith, Stewart Oldfield, Harry Beller, Erica Kellerhals), 7 timeline events (2013-2020), 3 connections, 8 suspect watchlist entries. Seeded 2026-03-14.
- [x] Story 15: "The Four Names" (NPA co-conspirators) — section: the-cover-up — ~2,400 words, 13 citations, 6 entity links, 2 inline images + hero image. Full investigation: corpus sweep (Kellen, Marcinkova, Ross), 10+ documents deep-read, analysis at `docs/investigation/sources/NPA_CO_CONSPIRATORS/Analysis.md`. 3 suspects promoted to T2 entities, 6 connections, 4 events, 23 entity-document links. Seeded 2026-03-14.
- [x] Story 16: "The Conveyor Belt" (Jean-Luc Brunel / MC2 modeling pipeline) — section: the-operation — ~2,200 words, 14 citations, 4 entity links, 3 inline images + hero image. Full investigation: corpus sweep (19+ documents deep-read), analysis at `docs/investigation/sources/BRUNEL/Analysis.md`. Entity enriched, 2 new entities (Jeffrey Fuller T4, Sergio Cordero T4), 3 new connections + 2 updated, 8 timeline events. Seeded 2026-03-14.

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

### Community Platform (Subscriber + Investigator Tiers)
> Full plan: `.claude/plans/iterative-dreaming-hoare.md`

**Phase 1: Foundation — COMPLETE**
- [x] Migration 018: extend profiles (subscription_tier, avatar_url, bio_short), investigator_stats + xp_transactions tables, XP trigger chain, compute_rank() function
- [x] New shared types: SubscriptionTier, InvestigatorRank, XpEventType, InvestigatorStats, XpTransaction
- [x] middleware.ts: /investigate/* gated by subscription_tier, ?from= redirect param, /dashboard/submissions + /dashboard/moderation added to ADMIN_PATHS
- [x] require-investigator.ts API guard + access-control.ts permission helpers
- [x] signup/page.tsx: two-step tier picker (Subscriber vs Investigator)
- [x] reset-password/page.tsx: Supabase password reset flow
- [x] account/page.tsx: settings (display name, bio, XP progress, sign out, delete)
- [x] api/account/profile (GET/PATCH) and api/account (DELETE)
- [x] PublicHeader: Sign In/Join buttons (anon), rank badge + Workspace link (investigator)
- [x] (publication)/layout.tsx: async server component passes auth state to PublicHeader

**⚠️ Before deploying Phase 1:** Run migration 018 in Supabase SQL Editor

**Phase 2: Subscriber Social Features — COMPLETE**
- [x] Migration 020: comments + comment_reactions + comment_flags + inaccuracy_flags tables (polymorphic content_type/content_id, auto-hide trigger at 3 flags, RLS policies)
- [x] Shared types: CommentContentType, CommentReactionType, CommentFlagReason, InaccuracyFlagStatus, Comment, CommentReaction, CommentFlag, InaccuracyFlag, CommentWithAuthor
- [x] Rate limit tier: `comments` (30 req/min)
- [x] CommentSection server component + CommentThread client component (pagination, auth-aware)
- [x] CommentItem + CommentForm + ReactionBar + AuthGatePrompt + FlagModal components
- [x] Drop CommentSection into /stories/[slug], /case-files/[slug], /entities/[slug]
- [x] API: GET /api/public/comments, POST /api/comments, PATCH /api/comments/[id], POST /api/reactions (with XP), POST /api/flags
- [x] Admin moderation queue at /dashboard/moderation (flagged comments + inaccuracy reports, two-tab layout)

**⚠️ Before deploying Phase 2:** Run migration 020 in Supabase SQL Editor

**Phase 3: Investigator Workspace /investigate**
- [ ] Migration 021: investigator_notes + user_submissions tables + XP-on-approve trigger
- [ ] (investigate)/layout.tsx + tab bar (Dashboard, Notes, Detective, Submit, Ranks)
- [ ] /investigate/notes — personal markdown notes with entity linker
- [ ] /investigate/detective — quota-gated AI (extract runConversation from admin assistant)
- [ ] /investigate/submit — submission form + status tracking
- [ ] /investigate/ranks — public leaderboard
- [ ] API: /api/investigate/* routes

**Phase 4: Admin Moderation + Submission Review**
- [ ] /dashboard/submissions + /dashboard/moderation pages
- [ ] Admin tabs: Overview | Users | Submissions | Moderation on /dashboard/admin
- [ ] API: /api/admin/submissions, /api/admin/moderation, /api/admin/investigators, /api/admin/xp

**Phase 5: Polish + Public Profiles**
- [ ] Migration 021: email notifications prefs, is_community_banned, notes FTS
- [ ] /investigators/[display_name] — public investigator profile page
- [ ] Rate limiting: comments (30/min per user), investigate_ai (5/min)

### Legacy Public Access items (superseded by community plan above)
- [ ] OAuth sign-in (Google) — enable in Supabase dashboard + Google Cloud Console
- [x] Update login page — "Create Account" + "Forgot Password" links
- [x] Account settings page — display name, bio, password change, tier display, upgrade prompt, GDPR delete
- [x] Auth callback route — `/auth/callback` handles email confirmation + password reset PKCE flow
- [ ] Gate API routes: public GET routes remove auth check, write routes keep auth + role check
- [ ] Content tiers: anon (browse only), free (full text), pro (PDF + AI), admin (upload/review)

### Security Hardening
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase E)
- [x] Rate limiting — in-memory sliding window: 120/min general, 60/min search, 30/min comments, 5/min auth
- [x] Security headers — X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS, X-XSS-Protection (in `next.config.ts`)
- [x] Bot prevention — Cloudflare Turnstile on signup + login with graceful dev bypass (`components/ui/turnstile.tsx`, `lib/turnstile.ts`, `/api/auth/verify-captcha`)
- [x] Error monitoring — Sentry `@sentry/nextjs` v10 (dormant until `NEXT_PUBLIC_SENTRY_DSN` set)
- [x] Email verification — "Confirm email" enabled in Supabase Auth dashboard
- [x] Anthropic API spend cap — monthly budget set in Anthropic Console
- [x] Custom domain — `theepsteincrimes.com` live (Cloudflare DNS → Vercel, Supabase redirect URLs updated)
- [x] RLS fix — `doj_accountability` table RLS enabled (migration 021)
- [ ] Vercel Attack Challenge Mode — keep off normally, enable during active attacks
- [ ] Upstash Redis upgrade — replace in-memory rate limiting with distributed Redis (needed at scale)

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

### Public Document Viewer (Hybrid Access)
> Documents clickable throughout the site. Public metadata + text excerpts; PDF viewer requires auth.
- [x] Public document detail page — `/evidence/documents/[bates]` showing metadata, entity links, events, severity, dataset, text excerpts (no auth)
- [x] Auth-gated PDF viewer — "Sign in to view full document" on detail page; auth users link to dashboard viewer, anon users see sign-in prompt
- [x] Update Bates auto-links — change markdown renderer from `/evidence?q={BATES}` to `/evidence/documents/{BATES}`
- [x] Public document API — `/api/public/documents/[bates]` returning metadata + entity links + events
- [x] Search result cards link to document detail pages
- [x] Entity evidence profile document Bates numbers link to detail pages

### Corpus-Level Search
> Extend evidence room search beyond Supabase FTS to the full 1.38M-document SQLite corpus. Local dev uses direct SQLite via `better-sqlite3`. Production: host on Railway (future).
- [x] Corpus search API — `/api/public/evidence/corpus-search` with direct SQLite FTS5 queries, Supabase enrichment, 5-min cache, 60/min rate limit
- [x] Dual search mode — toggle in evidence room between "Database" (Supabase FTS) and "Full Corpus" (SQLite FTS5) with mode-specific filters
- [x] Search result enrichment — corpus results matching Supabase documents show entity links, type/severity badges, metadata
- [ ] Railway deployment — host SQLite corpus + search API on Railway for production access (revisit when ready)

### Entity Profile Media Expansion
> Expand entity profiles beyond avatar-only images to full media galleries.
- [x] Entity profile media section — photos gallery tab on publication + evidence room profiles (wire `document_images` → `image_entities` to entity pages). Photos tab only shown when photos > 0. EntityPhotosGrid component with lightbox. ImageLightbox gains `urlPrefix` + `readOnly` props.
- [x] Entity profile video embeds — migration 019 adds `video_links` JSONB field to entities table. VideoEmbeds component with YouTube privacy-enhanced embed (youtube-nocookie.com) + external video fallback. Videos tab on both profiles. VideoLink type in @efta/shared.
- [ ] Source more profile pictures — expand beyond Wikimedia Commons (court photos, mugshots, official government photos, AP/Getty editorial)

### Batch Document Image Extraction
> The PyMuPDF image extraction pipeline (Stage 1.5) is fully built but has only run on individually-processed documents. Need a batch job to extract images from all ~1.37M PDFs in R2.
- [x] Batch extraction script — `scripts/batch-extract-images.py` iterates all documents with R2 key, runs `stages/images.py` extraction, uploads to R2 + upserts `document_images`. JSON checkpoint for resume, --skip-existing, --dry-run, --max-docs, --batch-size flags.
- [x] Progress tracking — checkpoint file with processed/skipped/errored counts, resume from last document_id, periodic progress logging with rate calculation.
- [ ] Auto-classification pass — after extraction, classify `image_type` (photo vs graphic vs signature vs map) using Qwen2-VL or similar (currently defaults to 'embedded')
- [x] Public image gallery — `/evidence/images` page with type/tag filters, pagination, public API at `/api/public/images`. ImageGallery component gains `urlPrefix` + `readOnly` props. "Images" tab added to evidence room layout.

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

### Corpus v5.0/v5.1 Integration
- [x] Download script (`services/efta-mcp-server/data/download.sh`) — fetches v5.0 corpus + v5.1 research databases from GitHub releases
- [x] `sqlite.ts` — 4 new lazy-init singletons: concordance, alteration, image analysis, handwriting
- [x] DS12 range updated in `corpus.ts`: max 2731785 → 2858497 (23 new expansion docs)
- [x] `concordance.ts` — 3 tools: `concordance_lookup`, `concordance_search`, `concordance_email_threads` (DOJ production metadata, 1.38M docs)
- [x] `alterations.ts` — 2 tools: `alteration_lookup`, `alteration_search` (212K document change units, anomaly flags)
- [x] `image-analysis.ts` — 2 tools: `image_analysis_lookup`, `image_analysis_search` (92K images, Qwen2-VL descriptions, FTS5)
- [x] `handwriting.ts` — 2 tools: `handwriting_lookup`, `handwriting_search` (54 pages, 14 MCC inmate witnesses)
- [x] All 9 new tools registered in `index.ts` — MCP server now has 67 tools total
- [x] Download databases and verify — v5.0 corpus assembled (1,397,821 docs, max EFTA02858497), all 4 research DBs live
- [x] Deploy updated MCP server — running locally via .mcp.json, 67 tools connected to Claude Code

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
- [x] DS12 expansion deep read — 7 documents across MCC death investigation + Juliette civil case. Analysis at `docs/investigation/DS12_EXPANSION_Analysis.md`. Key findings: (1) Noel/Thomas bribery definitively ruled out by FBI; DVR failure predated Aug 9; 4AM supervisor never charged; (2) "Juliette" (South African victim, 2002–2004) recruited in Cape Town by Epstein traveling with **redacted former high U.S. Government official + actor + comedian**; Leslie Groff named; Maxwell named in parallel case 19-cv-10475; Indyke/Kahn defendants in 4 simultaneous civil suits.
- [x] DS12 Cape Town identities resolved — Cross-ref `EFTA01661603` (NY Mag Oct 2002) confirms: "former high U.S. Government official" = **Bill Clinton**, "famous actor" = **Kevin Spacey**, "well-known comedian" = **Chris Tucker**. All three named explicitly on same Africa Boeing 727 tour; Cape Town confirmed as stop. DB updated: Cape Town event retitled, 5 missing events created, Kevin Spacey + Chris Tucker added to watchlist, Annie Farmer created as T5 entity, Lesley Groff linked to Cape Town event, EFTA01661603 updated with full metadata.
- [x] DB cleanup — "Leslie Groff" suspect (`cd70a66f`) near-duplicate hard-deleted March 11, 2026. Canonical entity: Lesley Groff T2 (`bee557a4`).
- [x] **RESOLVED (March 11, 2026):** Identity of unnamed government official at Zorro Ranch 2004 (¶50 EFTA02731941) = **Bill Richardson**, Governor of New Mexico 2003–2011. Evidence: pilot Larry Morrison testimony (HOUSE_OVERSIGHT_010566) + $100K+ campaign contributions via Zorro Trust + Deputy CoS scheduling emails + the word "another" in ¶50 confirming a different person from Cape Town official (Clinton). Entity created T3 (`fbf16d66`), linked to event `18ae3209-b9c5-4386-8a52-1aa627e9a757`.
- [x] Deep read Morrison deposition (EFTA01247021, pp. 167–169) — verbatim Richardson testimony extracted and logged in DS12_EXPANSION_Analysis.md. Morrison saw Richardson at Ranch Central being escorted to main house for dinner with Epstein. Document updated in DB. Larry Eugene Morrison added to suspect watchlist (`e4ee5ea3`). Note: Morrison is Epstein's personal pilot, distinct from Lawrence Visoski (chief pilot, already T6 entity).
- [x] **Lesley Groff deep dive (March 12, 2026)** — Full corpus sweep (153K docs / 168K pages), 12+ key documents deep-read including EFTA02731082 (prosecution memo), EFTA01682023 (proffer agreement), EFTA01681865 (Deutsche Bank), EFTA01649143 (case summary), EFTA01653331 (arrest briefing), EFTA02731039 (prosecution memo), EFTA01656152 (FBI presentation), EFTA01654108 (FinCEN alert), EFTA01424842 (bank signers), EFTA02737678 (Boies Schiller letter). Analysis at `docs/investigation/LESLEY_GROFF_Analysis.md` (318 lines, 12 sections). DB updates: entity record enriched (bio, evidence_summary, aliases), 3 connections (Groff↔Epstein, Groff↔Indyke, Groff↔Maxwell), 10 document links, 5 timeline events (NPA immunity 2007, reverse proffer 2019-07-18, Fifth Amendment 2019-08-07, FinCEN alerts 2019-08-27, formal proffer 2021-07-23). Key findings: (1) Section D of prosecution memo (Groff charging analysis) entirely redacted — Category C institutional protection; (2) $410K+ in wire transfers from Deutsche Bank 2016-2018; (3) dual employment (Epstein assistant + Indyke law firm); (4) post-death investigation "focused on Ghislaine Maxwell, [redacted], and Lesley Groff"; (5) no concordance custodian — all docs produced under Epstein designation.
- [x] **Document linkage (March 14, 2026)** — 57,704 new `entity_documents` links created via `scripts/link-entity-documents.mjs`. Script searches SQLite FTS5 corpus for entity name + aliases, cross-references Supabase, creates links with `role_in_document: 'mentioned'`. Before: 2,019 links (6 entities at 0). After: 59,732 links (1 at 0 — Gerd). Cap: 5,000 per entity, skip entities with 500+ existing links. Every T1 entity now has hundreds to thousands of linked source documents.
- [x] **NPA co-conspirators deep dive (March 14, 2026)** — Full corpus sweep for Sarah Kellen, Nadia Marcinkova, Adriana Ross. 10+ key documents deep-read including EFTA01186070 (CVRA motion — exact NPA immunity language), EFTA01245817 (FBI 302 — Kellen scheduling protocol), EFTA00081180 (Edwards v. Epstein — Marcinkova "live-in sex slave," target letter evasion), EFTA01699906 (FBI briefing — Ross evidence destruction), EFTA00585893 (Harley Davidson gift to Peter Marcinkova, Slovakia). Analysis at `docs/investigation/sources/NPA_CO_CONSPIRATORS/Analysis.md`. DB updates: 3 suspects promoted to T2 entities (Kellen, Marcinkova, Ross), 6 connections, 4 events, 15 entity-event links, 23 entity-document links, 6 document metadata updates. Story 15 "The Four Names" published — 13 citations, 6 entity links. Key finding: NPA's "including but not limited to" language created open-ended immunity class; the four named women performed identical functions to Maxwell (convicted, 20 years) but were never charged.
- [x] **Leon Black deep dive (March 12, 2026)** — Full corpus sweep (9,149 docs / 10,869 pages across 7 datasets). 25+ DS12 prosecution chain documents deep-read. Analysis at `docs/investigation/sources/LEON_BLACK/Analysis.md` (~400 lines, 11 sections). DB updates: entity enriched (bio, evidence_summary, aliases), 15 key documents linked, 6 documents enriched, 5 timeline events, Melanie Spinella added to suspect watchlist. Key analytical framework: "The Two-Track Failure" — SDNY never formally opened case, DANY couldn't get federal cooperation. Key findings: (1) 6-phase prosecution decision chain April 2021 → Jan 2026 = zero charges; (2) AUSA admission "I did not write anything up on Leon Black"; (3) $158M total payments, $62.5M USVI settlement, step-up-basis trust scheme; (4) 3+ victims with corroborating accounts including identical signature violence; (5) forensic journal authentication (gel pen, no fabrication); (6) witness intimidation (Black contacted victim, hired victims' attorney Brad Edwards).

---

## Database Audit — March 14, 2026

> Full audit via `scripts/audit-database.mjs`. Snapshot: 120 entities (32 published), 16 stories (218 citations), 6 case files, 178 events, 110 connections, 59,866 entity-document links.

### Document Linkage Fix — RESOLVED
- [x] Investigated: all 31/32 published entities have doc links (59,866 total). Only "Gerd" (T4, single-name alias) has 0. Original audit had Supabase pagination bug (PostgREST 1000-row default limit). Verified via `scripts/verify-all-doc-links.mjs`.
- [x] Jim Kimsey (1), Ted Leonsis (2), Steve Case (22), Dan Snyder (38) — verified low counts are accurate. Minimal corpus presence confirmed via FTS5. Involvement documented through specific documents (flight logs, journals), not broad mentions.

### Entity Bios (HIGH PRIORITY — all 32 published entities missing bios)
- [ ] Write bios for T1 entities (17): Jeffrey Epstein, Ghislaine Maxwell, Alan Dershowitz, Bill Clinton, Dan Snyder, George Mitchell, Glenn Dubin, Harvey Weinstein, Jean-Luc Brunel, Jes Staley, Jim Kimsey, Larry Summers, Leon Black, Marvin Minsky, Prince Andrew, Steve Case, Ted Leonsis
- [ ] Write bios for T2 entity: Lesley Groff
- [ ] Write bios for T3 entity: Bill Richardson
- [ ] Write bios for T4 entities (13): Apollo Global, Barnaby Mars, Celina Dubin, Dr. Chen, Eva Andersson-Dubin, Gerd, Karyna Shuliak, KKR, Les Wexner, Mark Epstein, Oaktree Capital, The Blackstone Group, The Carlyle Group

### Entity Photos (6 T1 entities missing)
- [ ] Source photos: Dan Snyder, Glenn Dubin, Jean-Luc Brunel, Jim Kimsey, Larry Summers, Leon Black
- [ ] Source photo: Lesley Groff (T2)

### Publish T2 Entities (3 unpublished NPA co-conspirators)
- [ ] Publish Sarah Kellen — T2, already enriched with connections/events/doc links
- [ ] Publish Nadia Marcinkova — T2, already enriched
- [ ] Publish Adriana Ross — T2, already enriched

### Story Coverage Gaps
- [ ] **Prince Andrew story** — T1, 0 stories, 9 events, 4 connections. Cape Town, flight logs, victim testimony. Would strengthen `the-operation` section (currently weakest with only 2 stories)
- [ ] **George Mitchell story** — T1, 0 stories, 5 events, 3 connections. Scheduling evidence, Zorro Ranch connections
- [ ] **Harvey Weinstein story** — T1, 0 stories, 6 events, 2 connections. Cross-pollination between Epstein and Weinstein networks

### Connection Network Gaps
- [ ] Enrich connections for under-connected T1 entities: Dershowitz (3), Summers (3), Minsky (2), Weinstein (2)
- [ ] Add connections for T4 entities with only 1 connection: Dr. Chen, Gerd, KKR, Oaktree, Blackstone, Carlyle

### T4 Corporate Entity Triage
- [ ] Evaluate T4 corporate entities (Apollo, KKR, Oaktree, Blackstone, Carlyle) — enrich with events/docs/stories or demote to unpublished. Currently thin shells with no events, no docs, no stories

### T4 Entity Events (10 published entities with 0 events)
- [ ] Add events for: Barnaby Mars, Celina Edith Dubin, Dr. Chen, Eva Andersson-Dubin, Gerd, Karyna Shuliak, KKR, Oaktree Capital, The Blackstone Group, The Carlyle Group

### Story Section Balance
- [ ] `the-operation` needs more stories (currently 2, vs 5 each for cover-up and network, 3 for follow-the-money)
- [ ] Consider: recruitment mechanics, Cape Town trip, Caribbean island operations, massage protocol, scheduling systems

### Unpublished Entity Pipeline (86 entities)
- [ ] Review 21 unpublished T3 entities for publishing readiness
- [ ] Review 61 T6 entities — many are financial/peripheral from Leon Black case; consider bulk cleanup vs selective publishing
