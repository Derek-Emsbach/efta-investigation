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

> **Status:** All 8 phases + Evidence Room expansion + Section Pages complete. Publication routes live at `/`, `/entities/[slug]`, `/stories/[slug]`, `/case-files/[slug]`, `/network`, `/sections/*`. Evidence Room workspace at `/evidence` (tabbed: Search, Entities, Images, Network, Timeline). Mode switch between Newsroom ↔ Evidence Room. Dashboard at `/dashboard/*`. 12 case files (92 open questions, 78 entity links). 30 stories (449 citations, 162 entity links). 4 section landing pages with D3 data visualizations. 42 published entities fully enriched.

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
- [x] Public timeline API — `/api/public/timeline` — rate-limited, 5-min cache, entity slug filter, privacy-filtered (published entities only), cache-control headers. Enhanced: merges `events` (184 investigation) + `public_events` (45 real-world) into unified timeline with source filter, entity name resolution, and source URL links.
- [x] Timeline page — `/evidence/timeline` — chronological events grouped by month-year, event type/date/search filters, entity chips link to evidence room profiles. Enhanced: source filter (All/Investigation/Public Record), public event badges + source URLs, 4 new event types (media, community, international, other).
- [x] Fix homepage timeline link — changed `/dashboard/timeline` → `/evidence/timeline` so public users reach the Evidence Room timeline
- [x] Infinite scroll — replaced Previous/Next pagination with IntersectionObserver-based auto-loading
- [x] Timeline data cleanup — deduplicated 22 events (per-entity copies of NPA, Giuffre journals, Leon Black, Dataset 12, Trust amendment consolidated into single events with multi-entity links), added 8 missing landmark events (2008 guilty plea, 2018 Miami Herald, 2019 CVRA ruling, 2019 arrest, 2019 MCC death, 2020 Maxwell arrest, 2021 Maxwell conviction, 2022 Brunel death). Final count: 170 investigation + 45 public = 215 total events.

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

### Phase 12: Network Graph Visual Redesign
- [x] Phase 1 — Calm physics: charge -300→-120, linkDistance 100→150, velocityDecay 0.45, alphaDecay 0.03, pre-computed layout (150 ticks before render)
- [x] Phase 2 — Edge styling by relationship type: 5 color categories (criminal/financial/legal/personal/other) mapping 15 relationship types. Bezier curves replace straight lines, parallel edge offset, hover tooltips
- [x] Phase 3 — Smarter node sizing: `8 + sqrt(degree) * 5` (min 8, max 28). Progressive label disclosure by tier/zoom. SVG glow filters for T1-T2 (evidence room only)
- [x] Phase 4 — Spatial clustering: weak forceX/forceY (0.04 strength) nudges entities toward category positions (inner circle, financial, legal/political, operations, peripheral)
- [x] Phase 5 — Interactions: click-to-pin subgraph highlight (single click), double-click to navigate to profile, collapsible legend, edge tooltips, auto-fit zoom on simulation end
- [x] Phase 6 — Layout mode toggle: Force (default) + Radial (concentric tier rings via d3.forceRadial)
- [x] Applied to all 3 implementations: evidence room (neon), dashboard (dark), publication (warm cream) — each with theme-appropriate color palettes
- [x] Build verification passes

- [x] Phase 7 — Increased spacing: charge -120→-200, linkDistance 150→200, collision buffer +6→+14, cluster radius 0.18→0.25, center strength 0.05→0.03
- [x] Phase 8 — Profile photo nodes: T1-T2 entities with `profile_image_url` show photos inside SVG circle nodes via `<clipPath>` + `<image>`. Connected nodes reveal photos on selection
- [x] Phase 9 — Entity summary panel: click a node to see connection breakdown (Criminal: N, Financial: N, etc.), evidence summary, status badges, walkable entity chips for graph exploration
- [x] Phase 10 — UX polish: zoom-to-subgraph on selection, animated edge dash flow, hover scale-up (1.12x), Escape key deselect, background click zoom-back, 400ms smooth transitions
- [x] Applied to all 3 implementations with theme-appropriate panels: publication (white card), evidence room (dark glass), dashboard (dark card)
- [x] Build verification passes

**Phase 12 COMPLETE** — Network graph redesigned from rubber-band ball to elegant, readable visualization with relationship-typed edges, progressive disclosure, spatial clustering, radial layout mode, photo nodes, entity summary panel with walkable graph exploration

### Phase 13: Section Landing Pages + Mode Switch + Stats Audit
- [x] Mode switch component (`mode-switch.tsx`) — persistent bar at top of both publication and evidence room layouts
- [x] Homepage stats bar revamp — replaced hardcoded/misleading stats with real queried data
- [x] Section API route (`/api/public/sections/[section]/route.ts`) — aggregated section data with 5-min cache
- [x] Shared section components — `section-hero.tsx`, `section-stories.tsx`, `entity-spotlight.tsx`
- [x] D3 visualizations — `connection-type-chart.tsx`, `event-timeline-chart.tsx`, `location-map.tsx`
- [x] Case progress grid — `case-progress-grid.tsx` (pure React/CSS)
- [x] Follow the Money landing page — connection type chart, financial entities spotlight
- [x] The Cover-Up landing page — DOJ event timeline, case file progress, law enforcement spotlight
- [x] The Operation landing page — location map (16 properties/airports), operational figures spotlight
- [x] Voices landing page — investigation coverage stats, case progress, witness spotlight, empty state
- [x] Nav links updated — section nav → `/sections/*`, "Evidence Room" removed (mode switch handles it)
- [x] Network graph fix — `evidence_summary` → `bio` across 2 API routes + 3 client files, `resetLinkAttrs` D3 type fix

**Phase 13 COMPLETE** — 4 dedicated section landing pages with D3 data visualizations, mode switch for Newsroom ↔ Evidence Room, homepage stats audit with real data

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
- [x] Story 17: "The Architecture of Opacity" (Shell company network / 1953 Trust) — section: follow-the-money — ~2,800 words, 15 citations, 4 entity links, 3 inline images + hero image. Full investigation: corpus sweep (25+ documents deep-read, 10+ key docs), analysis at `docs/investigation/sources/SHELL_COMPANIES/Analysis.md`. Maps 30+ shell entities, tree-named property corps, $577M estate, Section 2.5(B) loyalty/intimidation clause, Boris Nikolic successor executor, Deutsche Bank "Southern Financial Relationship." DB entity updates deferred (MCP server down). Seeded 2026-03-14.

### Editorial Pipeline ("My Desk")

- [x] Migration 026: `editorial_status` + `editorial_notes` columns on stories, `story_images` junction table, RLS policies
- [x] Shared types: `EditorialStatus`, `StoryImageRole`, `StoryImage` interface added to `@efta/shared`
- [x] 8 API routes at `/api/stories/*` — list (GET with status filter), single GET/PATCH, publish, unpublish, story images CRUD, relevant-images corpus query
- [x] My Desk page (`/dashboard/stories`) — tabbed list (Review / Draft / Published), story cards with hero thumbnail + counts + notes preview, stats bar, quick status transitions
- [x] Story Editor (`/dashboard/stories/[id]`) — three-column resizable layout (metadata+images | markdown editor with toolbar | live publication preview with `data-theme="publication"`)
- [x] Image Picker modal — corpus images from story entities via `image_entities` + `entity_documents`, type/entity filters, Set as Hero / Insert Inline actions
- [x] Sidebar: "My Desk" nav item (pencil icon) added to admin section
- [x] Seed script: `--draft` flag seeds stories as `editorial_status: 'review'` instead of published
- [x] Admin Dashboard link in PublicHeader — visible to admin users on both desktop and mobile, links to `/dashboard`

**⚠️ Migration 026 already deployed.** All existing published stories backfilled with `editorial_status = 'published'`.

### Entity Enrichment & Network Buildout (Session BB — 2026-03-16)

- [x] **Web news sweep**: 8 public events created (Mandelson arrest, Noel testimony demand, Clinton testimony, Lutnick testimony, Noel suspicious activity, Lajčák resignation, Lang resignation, Summers retirement, Khanna/Massie six men)
- [x] **Phase B — Publish existing entities**:
  - [x] Ehud Barak (T3, `3fdbbc66`) — enriched bio, 4 connections, published with photo
  - [x] Peter Mandelson (T3, `eab4e1e6`) — enriched bio, 4 connections, published with photo
  - [x] Annie Farmer (T5, `cdbb8ab3`) — enriched bio, `is_public=true`, 3 connections, published
  - [x] Brad Edwards (T6, `f2660867`) — enriched bio, attorney, 3 connections, published
- [x] **Phase C — Create new entities**:
  - [x] Juan Alessi (T6, `31eea887`) — Palm Beach house manager, 3 connections, published
  - [x] Alfredo Rodriguez (T6, `cd52857e`) — butler, stole black book, deceased, 3 connections, published
  - [x] Steve Bannon (T4, `cdba6600`) — promoted from suspect watchlist, DS9 texts, 2 connections, published
  - [x] Larry Visoski (T6, `90352d4c`) — already existed, updated bio + enriched, published
- [x] **Phase D — Suspect watchlist**: 3 new suspects (Mona Juul, Nili Priell Barak, Timothy Routch), ~10 suspects updated with corpus findings, 5 marked `pending_promotion` (Sultan Ahmed bin Sulayem, Howard Lutnick, Mona Juul, Richard Branson)
- [x] **Phase E — Corpus cross-reference**: All P1-P3 suspects checked against corpus, John Phelan deprioritized (no corpus evidence)
- [x] **Totals**: 7 entities published, 1 updated, 23 connections created, 8 public events, 3 suspects added, ~10 suspects updated

### Story 18: "She's Here" (George Mitchell / FBI 302)

- [x] Story written + seeded: `docs/stories/shes-here.md` — section: the-network — 18 citations, 6 entity links. Seeded 2026-03-18.

### Story 19: "The Worst Dancer in the World" (Prince Andrew)

- [x] Story written + seeded: `docs/stories/the-worst-dancer-in-the-world.md` — section: the-operation — 11 citations, 4 entity links. Seeded 2026-03-18.

### Entity Enrichment & Cleanup (Session BC — 2026-03-18)

- [x] **Ruemmler dedup**: Merged duplicate `51627176` ("Kathy Ruemmler") into primary `3120ba47` ("Kathryn Ruemmler"). 5,000 doc links reassigned, Maxwell connection recreated, duplicate deleted.
- [x] **Promoted from watchlist**:
  - [x] Sultan Ahmed bin Sulayem (T4, `7c26c8ad`) — Dubai ports magnate, 10 docs, 5 connections (Epstein, Wexner, Groff, Bannon, Staley). 40+ direct emails, gateway to Sheikh Mohammed.
  - [x] Howard Lutnick (T3, `2cfa90bf`) — Cantor Fitzgerald CEO, 10 docs, 2 connections. FBI "Prominent Names," island invitations, $10 property sale allegation.
  - [x] Mona Juul (T3, `904b3f4c`) — Norwegian diplomat, 8 docs, 3 connections (Epstein, Jagland, Eva Dubin). Island flights, passport to Visoski, IPI dinners. Charged by Okokrim 2026.
  - [x] Richard Branson (T4, `5039161a`) — Virgin Group, 15 docs, 4 connections (Epstein, Gates, Groff, Visoski). Reciprocal island visits, "met once" denial demolished by 15+ docs.
- [x] Terje Rød-Larsen (T3, `92e21365`) — Norwegian diplomat, IPI president. 13 docs, 6 connections (Epstein, Juul, Jagland, Barak, Allen, Gates). $130K wire instruction, island visit with family, IPI as diplomatic networking hub.
- [x] **Totals**: 5 entities published, 56 docs linked, 20 connections, 1 dedup (5000 docs migrated). Published count: 50 → 55.

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

**Phase 3: Investigator Workspace /investigate — COMPLETE**
- [x] Migration 025: investigator_notes + user_submissions tables + XP-on-approve trigger
- [x] (investigate)/layout.tsx + tab bar (Overview, Notes, Detective, Submit, Ranks)
- [x] /investigate — overview dashboard (stats grid, quick actions, recent XP)
- [x] /investigate/notes — personal markdown notes with pin/edit/delete
- [x] /investigate/detective — quota-gated AI (simplified from admin assistant, daily limit enforcement, 8 read-only tools)
- [x] /investigate/submit — submission form (4 types: finding/connection/entity/correction) + draft/submit workflow + status tracking
- [x] /investigate/ranks — rank progression display, XP sources table, progress bar
- [x] API: /api/investigate/* routes (detective, notes, notes/[id], submissions, submissions/[id], stats, ranks)
- [x] investigator-prompt.ts — stripped system prompt (no suggestions, encourages submission workflow)
- [x] investigator-tools.ts — 8 read-only query tools (filtered from ASSISTANT_TOOLS)
- [x] Rate limiting: investigators get 3x on general/search tiers via Upstash Redis

**⚠️ Before deploying Phase 3:** Run migrations 023, 024, 025 in Supabase SQL Editor

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
- [x] Upstash Redis upgrade — `@upstash/ratelimit` + `@upstash/redis` replaces in-memory Maps. Sliding window per tier, graceful fallback to in-memory when env vars unset. 22 API routes updated to `await` async `checkRateLimit`.

### Monetization (Stripe + Pro Tier)
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase D)
- [x] Stripe integration — `stripe` + `@stripe/stripe-js` packages
- [x] Migration 023: stripe_tiers — subscription_tier column, donation_events table, stripe columns on profiles
- [x] Migration 024: stripe_hardening — atomic record_donation RPC, restrict investigator_stats trigger to investigator-only
- [x] Stripe webhook handler (`/api/stripe/webhook`) — checkout.session.completed, customer.subscription.deleted
- [x] Checkout route (`/api/stripe/checkout`) — create Stripe Checkout session
- [x] AI query metering — daily quota enforcement in /api/investigate/detective (checks investigator_stats.ai_queries_used_today)
- [ ] Billing portal route — manage subscription via Stripe Customer Portal
- [ ] Billing settings page — current plan, usage meter, upgrade/manage buttons
- [ ] Add `estimated_cost` column to `api_usage_log` table

### AI-Assisted Analysis (Phase 2 of processing)
- [x] **ML pipeline built (March 15, 2026)** — Full `services/ml/` Python package with Click CLI, 4 pipeline features:
  - [x] Entity extraction: spaCy NER training pipeline (extract → prepare → train → evaluate → inference)
  - [x] Anomaly detection: 9 detectors (timeline gaps, mention frequency shifts, event clustering, entity density outliers, redaction inconsistency, category mismatch, density spikes, type-redaction combos, cross-dataset inconsistency). First run: **95 anomalies** (14 critical, 7 high, 74 medium)
  - [x] Automated cross-referencing: sentence-transformer embeddings (MiniLM-L6-v2), FAISS index, 4-signal weighted scoring (entity co-occurrence, semantic similarity, temporal proximity, document type compatibility)
  - [x] Connection suggestions: co-occurrence mining, context extraction, 4-signal scoring, Claude API type classification (~$2-3 for 500 pairs)
  - [x] Migration 022: 6 ML tables (ml_training_snapshots, ml_model_runs, ml_entity_eval, ml_crossref_scores, ml_anomalies, ml_connection_suggestions)
  - [x] Dashboard UI: `/dashboard/ml` with anomaly review, connection approval cards, model run history. 4 API routes at `/api/admin/ml/*`
  - [x] Run connection suggestions pipeline — 19 suggestions across 11 unique entity pairs. Top pairs: Marcinkova↔Kellen (co_accused, 44 shared docs), Marcinkova↔Ross (co_accused, 35 shared docs), Clinton↔Dershowitz (5 excerpts), Christensen↔Epstein (attorney_for). Context enrichment via SQLite corpus (6/14 enriched). Claude classification cost: $0.02. Results reviewable at `/dashboard/ml`.
  - [ ] Deploy ML service to Railway

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
- [x] Auto-classification pass — corpus Qwen2-VL descriptions (92K images) imported into `document_images` as analysis-only records (`r2_key='corpus:pending:...'`), classified via Claude Haiku into photo/signature/map/chart/graphic/embedded types with generated captions. Entity linking via `entity_documents` → `image_entities` junction. Script: `scripts/classify-and-link-images.mjs`. Entity profile Photos tab updated to show corpus evidence as text cards (publication + evidence room themes).
- [x] Public image gallery — `/evidence/images` page with type/tag filters, pagination, public API at `/api/public/images`. ImageGallery component gains `urlPrefix` + `readOnly` props. "Images" tab added to evidence room layout.
- [x] OCR entity tagging — `scripts/tag-image-entities.mjs` searches corpus SQLite `text_content` + `notable` fields for published entity name mentions. Zero API cost (exact string matching). Result: 803 new `image_entities` links across 32 entities (Epstein 440, Groff 139, Black 70, Maxwell 40, etc.), role='mentioned', confidence='possible'.
- [x] Tag review UI — `/dashboard/photos/review` admin page + `/api/images/entity-tags` (GET/PATCH/DELETE). Shows pending OCR text-mention tags with corpus description context; actions: ✓ Subject (confirmed/subject), ~ Mentioned (likely/mentioned), ✗ Remove. Pagination at 40/page. "Review Tags →" link added to `/dashboard/photos`.
- [ ] Real image extraction — corpus:pending records have no image file (original Qwen2-VL images not stored locally). Options: (A) extract from R2 PDFs for priority docs (published entity/story docs), (B) future upload pipeline. Deferred — text-only corpus evidence cards accepted as display format for now.
- [ ] Classify remaining ~40K unclassified images — still typed 'embedded', awaiting increased Anthropic TPM limits (currently 50K TPM on Haiku). Re-run `scripts/classify-and-link-images.mjs --phase classify` when limits increase.

### Connection Graph Enrichment (Session BD — 2026-03-19)
- [x] **Connection type upgrade** — all 68 generic `connected_to` edges upgraded to specific semantic types via bulk Supabase update. Zero `connected_to` remaining out of 246 total connections.
  - Types used: social (10), professional (15), financial (12), associated_with (9), trafficked_for (6), attorney_for (5), employed_by (4), family_of (3), victim_of (2), investigated_by (1), paid_by (1), protected_by (1), referred_by (1 deleted as duplicate)
  - 1 duplicate `connected_to` (Shuliak→Epstein) deleted — `social` already existed
- [ ] Connection type audit — review `associated_with` connections (9 remain as catch-all) for possible upgrade to more specific types as evidence improves
- [ ] Connection strength audit — review all connections with `strength < 30` for potential deprioritization or removal

### Additional Data Sources
- [x] Giuffre v. Maxwell court records — Option B (key events + cross-refs). 9 public events added covering full case arc: filing (2015), Maxwell deposition (2016), settlement (2017), 2020 partial unsealing, Preska unsealing order (Dec 2023), Jan 2024 batch releases (150 names including Clinton, Prince Andrew, Dershowitz), Prince Andrew settlement (2022), Second Circuit appeal (2025). Sources documented: CourtListener, Epstein Archive, Public Intelligence, Black Vault. Full PDF import deferred to future phase.
  - **Key sources for future full import**: [CourtListener docket](https://www.courtlistener.com/docket/4355835/giuffre-v-maxwell/), [Epstein Archive](https://www.epsteinarchive.org/docs/giuffre-v-maxwell-unsealed/), [Public Intelligence batches](https://publicintelligence.net/epstein-docs-batch-1/)
- [ ] House Oversight materials import
- [ ] FOIA release comparison tools
- [x] Congressional oversight monitoring — workflow doc at `docs/reference/CONGRESSIONAL_MONITORING.md`, integrated into session bookkeeping in CLAUDE.md. 12 missing events added (Jan 30 – Mar 11, 2026): DOJ fifth/sixth releases, Blanche compliance claims, House Dem surveillance investigation, Friedman redaction findings, bipartisan Comer/Garcia investigation, Clinton testimony, GAO audit request. Total public events now ~57.

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

> Full audit via `scripts/audit-database.mjs`. Snapshot: 121 entities (30 published), 21 stories (299 citations, 116 entity links), **11 case files** (82 open questions, 65 entity links), 188 events, 165 connections, 59,866 entity-document links.

### Document Linkage Fix — RESOLVED
- [x] Investigated: all 31/32 published entities have doc links (59,866 total). Only "Gerd" (T4, single-name alias) has 0. Original audit had Supabase pagination bug (PostgREST 1000-row default limit). Verified via `scripts/verify-all-doc-links.mjs`.
- [x] Jim Kimsey (1), Ted Leonsis (2), Steve Case (22), Dan Snyder (38) — verified low counts are accurate. Minimal corpus presence confirmed via FTS5. Involvement documented through specific documents (flight logs, journals), not broad mentions.

### Entity Bios — COMPLETE
- [x] All 32 published entities seeded with bios (200-486 chars each) via `scripts/seed-entity-bios.mjs`. Bios populate the `bio` column (top-level, not metadata JSONB). Used for entity hero display + SEO meta descriptions.

### Entity Photos — PARTIAL
- [x] Sourced from Wikimedia Commons: Dan Snyder, Glenn Dubin, Larry Summers (3 new photos seeded)
- [ ] No freely-licensed photos available: Jean-Luc Brunel, Jim Kimsey, Leon Black (3 T1 remaining)
- [ ] No freely-licensed photos available: Lesley Groff, Sarah Kellen, Nadia Marcinkova, Adriana Ross (4 T2 remaining)
- T4 entities (people) also missing: Barnaby Mars, Celina Dubin, Eva Andersson-Dubin, Karyna Shuliak, Mark Epstein (Dr. Chen and Gerd unpublished)
- T4 corporate entities use initials fallback (appropriate — no photo needed)

### Publish T2 Entities — COMPLETE
- [x] Sarah Kellen — published, slug set, bio (435 chars), 261 doc links, 4 connections, 3 events
- [x] Nadia Marcinkova — published, slug set, bio (476 chars), 169 doc links, 1 connection, 3 events
- [x] Adriana Ross — published, slug set, bio (429 chars), 162 doc links, 2 connections, 2 events

### Story Coverage Gaps
- [x] **Prince Andrew story** — PUBLISHED (Story 18, "The Worst Dancer in the World", 2026-03-15). 11 citations from FBI 302s, internal FBI emails, royal correspondence. Linked to `prosecutorial-failure` case file. `the-operation` section now has 4 stories.
- [x] **George Mitchell story** — PUBLISHED (Story 19, "She's Here", 2026-03-15). 18 citations from FBI 302, scheduling docs, depositions, witness lists, Maxwell trial testimony. 4 connections added (Epstein, Maxwell, Groff, Black). 7 events added. `the-network` section now has 6 stories.
- [x] **Les Wexner story** — PUBLISHED (Story 21, "The Source of All His Wealth", 2026-03-16). 13 citations from SDNY prosecution memo, corporate prosecution memo, Financial Trust records, power of attorney, FBI slides, Giuffre interview. Wexner upgraded from T4→T3 with enriched bio, evidence summary, tier justification. `follow-the-money` section now has 5 stories.
- [x] **Harvey Weinstein story** — PUBLISHED (Story 22, "The Other Predator", 2026-03-16). 15 citations from guest lists, Peggy Siegal emails, Cannes scheduling docs, Giuffre journals, Deutsche Bank records. 5 entity links (Weinstein, Epstein, Maxwell, Leon Black, Glenn Dubin). `the-operation` section now has 5 stories.
- [x] **Alan Dershowitz story** — PUBLISHED (Story 23, "Reversal of Fortune", 2026-03-16). 19 citations from NYT profile, Palm Beach police reports, MySpace evidence packages, USAO meeting records, NPA documents, Giuffre testimony, FBI notes, court filings. 5 entity links (Dershowitz, Epstein, Maxwell, Giuffre, Prince Andrew). `the-cover-up` section now has 6 stories.
- [x] **Larry Summers story** — PUBLISHED (Story 24, "Power Dinner", 2026-03-16). 19 citations from Groff scheduling emails, dinner/breakfast arrangements, Deutsche Bank consent order ($53K wire to L.H. Summers Economic Consulting LLC), Giuffre victim journals (p.5: "Both he and Larry Summers are fucking disgusting!"), Wigdor Law letter confirming Dana Chasin transportation. 3 entity links (Summers, Epstein, Maxwell). `follow-the-money` section now has 6 stories. All sections balanced at 6.

### Entity Enrichment
- [x] **Donald Trump enrichment** — (2026-03-16) Tier 4, all DB writes from Session AJ plan completed. Bio, evidence_summary (6 primary sources, signal-vs-noise note, 3 unresolved questions), tier_justification, profile photo (official White House portrait), external_urls (Wikipedia, Wikimedia). 2 connections (Epstein strength 75, Maxwell strength 50). 6 timeline events (Giuffre recruitment, Vanity Fair quote, falling out, Mark Epstein deposition, Katie Johnson suit, Bondi notification). 5 key document links upgraded with roles + excerpts (EFTA00729910 subject, EFTA01249325 subject, EFTA00105921/EFTA01657683/EFTA01987273 mentioned with notes). 38,000+ corpus mentions (~95% political noise, ~10 substantive docs).
- [x] **Virginia Giuffre entity CREATED** — (2026-03-16) Tier 5, `is_public=true`. First published victim/witness entity. Sourced bio centering her agency as survivor and key witness. 8 connections (Epstein, Maxwell, Prince Andrew, Dershowitz, Mitchell, Richardson, Wexner, Trump). 19 events linked (16 existing + 3 new: Giuffre v. Maxwell 2015, CVRA 2008, sworn interview 2011). Added to Stories 18, 19, 21 entity lists. Now 34 published entities, 116 story entity links.

### Connection Network Gaps
- [x] Enrich connections for under-connected T1 entities — 33 connections added. Dershowitz 4→10, Weinstein 2→5, Summers 3→5, Minsky 2→4. Also enriched: Marcinkova 1→5, Ross 2→5, Ehud Barak 1→4, Peter Mandelson 1→4, Les Wexner 1→4, Bill Richardson 3→5. Total connections: 114→157.
- [x] ~~Add connections for T4 entities with only 1 connection: Dr. Chen, Gerd~~ — Both unpublished (2026-03-16). Dr. Chen was a service provider (dentist), Gerd had unclear identity. Neither warranted published profiles.

### T4 Corporate Entity Triage — COMPLETE
- [x] **KKR, Oaktree, Blackstone, Carlyle unpublished** (2026-03-16) — empty shells with no events, docs, or stories. Only evidence was "co-founder in contact directory" or "referenced in financial records." Data preserved in dashboard, removed from public site. 4 artificial inter-firm connections to Apollo deleted.
- [x] **Apollo Global Management enriched** (2026-03-16) — kept published. 2 new connections (Leon Black strength 95, Epstein financial strength 80). 2 new events (CEO resignation 2021-03-22, Dechert $158M disclosure 2021-01). Linked to existing Morgan Stanley event. 3 key documents linked (Senate Finance letter EFTA02731023, corporate prosecution memo EFTA02731018, SDNY prosecution memo EFTA02731082). 2 story_entities links (Stories 8 & 17). Published entity count: 34 → 30.

### T4 Entity Events & Enrichment — COMPLETE
- [x] **Dr. Chen and Gerd unpublished** (2026-03-16) — Dr. Chen was an oral surgeon (service provider, not network participant, identity may conflate two people). Gerd had unclear identity (could be Gerd Weber, Gerd Gigerenzer, or AmEx card holder — 3 different people). Published count: 30 → 28.
- [x] **Eva Andersson-Dubin enriched** (2026-03-16) — linked to 2 existing events (Maxwell/Dubin abuse event, 2014 Trust). Already had 5 connections. Linked to trust document EFTA01266403 as subject (successor trustee).
- [x] **Celina Edith Dubin enriched** (2026-03-16) — 2 new connections (Epstein financial strength 85, Eva family_of strength 95; Glenn already connected). Linked to 2014 Trust event. Linked to EFTA01266403 as subject (primary beneficiary of entire estate).
- [x] **Barnaby Mars enriched** (2026-03-16) — Bio corrected (was wrongly listed as pilot; actually a philanthropy strategist who flew AS PASSENGER). Category changed to associate. Aliases added (Barnaby Marsh, B. Marsh). 1 new connection (Epstein strength 70). 2 new events (flight to Nowak's institute 2013-04-01, Woody Allen dinner invite 2015-11-30). 2 document links added.
- [x] **Karyna Shuliak enriched** (2026-03-16) — 3 new connections (Epstein strength 85, Darren Indyke strength 60, Lesley Groff strength 50). 2 new events (Butterfly Trust $50K wire 2015-02-07, Deutsche Bank KYC review ~2019). 3 document links added (trust accounts, authorized signers).

### Story Section Balance
- [x] `the-operation` now balanced at 5 stories (cover-up: 5, network: 6, follow-the-money: 5, operation: 5)
- [x] Dershowitz story brings cover-up to 6. Current balance: cover-up 6, network 6, follow-the-money 5, operation 6.
- [x] `follow-the-money` now at 6 stories — all sections balanced at 6/6/6/6
- [x] **"The Rehabilitation" story PUBLISHED** (Story 26, 2026-03-16) — Bill Gates post-conviction relationship. 17 citations from Kosslyn PR scripts, Gates Foundation visitor registration, Nikolic severance authorization, trophy photos, DAF collaboration, name-dropping pattern, Wolff rehabilitation claim. `the-network` section now at 7 stories. Section balance: 7/7/6/6.
- [ ] Consider additional stories: recruitment mechanics, Caribbean island operations, massage protocol, scheduling systems
- [ ] **"The Cambridge Corridor"** — potential combined story: Summers + Minsky + Joi Ito + MIT/Harvard institutional complicity. Both Summers and Minsky named in Giuffre journals, both in Epstein's science philanthropy orbit, both connected to Martin Nowak's Program for Evolutionary Dynamics.
- [x] **"The September Salon"** (Story 29) — Thread 15 story published. Burns, Jagland, Barak, Ruemmler, Thiel, Kerrey, Allen, Black, Summers in one month. 15 citations, 11 entity links. Section: `the-network`.
- [x] **Bill Burns entity** (T4, `c1b2ed72`) — Created and published. 3 connections, 4 events. Slug: `william-j-burns`.
- [x] **Thorbjørn Jagland entity** (T4, `d73e6a80`) — Created and published. 2 connections, 4 events. Slug: `thorbjorn-jagland`.
- [x] **Thread 16: Intelligence Asset Question** — Full investigation into Epstein as intelligence asset. FBI FD-1023 SECRET//NOFORN ("Israeli state-sponsored technology collection and extortion operation"), Acosta "belonged to intelligence," Austrian passport (Marius Fortelni), hidden cameras, Robert Maxwell/Mossad, Barak/Unit 8200/Carbyne, Burns→CIA Director pipeline. 35 source documents. Three hypotheses: CIA, Mossad, multi-agency.

### Dershowitz Entity Enrichment — MOSTLY COMPLETE
- [x] Timeline events: Dershowitz already has 15 events in DB — all 6 planned events already existed from prior enrichment sessions (MySpace, grand jury, USAO presentation, NPA negotiations, NPA drop-in, defamation suit, settlement). No new events needed.
- [x] Update "Prosecutorial Failure" thread (THREAD_05) with Dershowitz self-immunization + Reinhart revolving door as Failures 6 and 7 (2026-03-16)

### Summers Entity Enrichment — COMPLETE
- [x] Add timeline events from Story 24 research — 5 new events created (2026-03-16): breakfast at Summers' home (Apr 2012), Palm Beach lunch with Woody Allen/Soon-Yi (Feb 16, 2013), Little St. James invitation with Ehud Barak (Dec 22, 2013), Deutsche Bank wire $53,750 (Nov 7, 2014), Harvard visit (Sep 17, 2016). All linked to Summers + Epstein entities. Barak linked to island invitation. Summers now has 10 events total.
- [x] Summers → Jes Staley connection already existed (from prior enrichment session)
- [ ] Link key documents: EFTA02189210 (Power Dinner email), EFTA01873597 (breakfast schedule), EFTA01681865 p.37 (Deutsche Bank wire), EFTA01941328 (island invitation), EFTA02043934 (2016 Harvard) — pending document UUID resolution (search_documents timeouts)

### Investigation Leads
- [x] **Judge Reinhart revolving door** — INVESTIGATED (2026-03-16). Thread 11 written (`docs/investigation/threads/THREAD_11_Reinhart_Revolving_Door.md`). AUSA who discussed case strategy with lead prosecutor, left USAO Jan 1 2008, began representing Epstein co-conspirators Jan 2 2008. Office next door to Florida Science Foundation. Filed false affidavit (DOJ admitted it was false). $84K+ in JPMorgan wires from Epstein. OPR investigated, no action. Perjury referral stonewalled. Now U.S. Magistrate Judge. Entity recommended: T6 legal.
- [x] **Bruce Reinhart entity CREATED + PUBLISHED + STORY** (2026-03-16) — T6 legal entity (`abec8a80`). Published with slug `bruce-reinhart`. Bio, evidence summary, tier justification. 3 connections (Epstein paid_by 80, Kellen attorney_for 75, Dershowitz connected_to 55). 6 events (4 new + linked to NPA and plea deal). Story 25 "The Revolving Door" published in `the-cover-up` section, 10 citations, 4 entity links. Section balance now 7/6/6/6.
- [x] **Peggy Siegal INVESTIGATED + ENTITY CREATED + PUBLISHED** (2026-03-16) — Thread 13 written (`docs/investigation/threads/THREAD_13_Siegal_Social_Infrastructure.md`). Classification: POST-CONVICTION NETWORK / SOCIAL INFRASTRUCTURE. 8 key findings, 8 open questions, 25 source documents. Entity created T4 (`d52ef9ab`), published with slug `peggy-siegal`. 3 connections (Epstein 80, Gates 40, Weinstein 65). 3 events (dinner guest list curation, Weinstein $90K payment bridge, amfAR Cannes ticket). 50+ corpus docs. Bridge between Epstein and Weinstein social networks. Story potential HIGH — "The Premiere Queen." Published entity count: 32.
- [x] **Kathryn Ruemmler INVESTIGATED + ENTITY CREATED + PUBLISHED + STORY** (2026-03-17) — Thread 14 written (`docs/investigation/threads/THREAD_14_Ruemmler_White_House_Counsel.md`). Classification: POST-CONVICTION NETWORK / LEGAL-POLITICAL INFRASTRUCTURE. 11 key findings, 7 open questions, 22 source documents. Entity created T4 (`3120ba47`), published with slug `kathryn-ruemmler`. 3 connections (Epstein 90, Bill Gates 45, Eva Andersson-Dubin 40). 5 events (Gates/Four Seasons meeting, Woody Allen dinner, Kerrey/Thiel brunch, AG coaching, 2017 Trust successor trustee). Key findings: (1) Successor trustee of $577M 2017 Trust (Section 7.1, EFTA01266434), (2) Successor executor in Last Will (EFTA01266268), (3) AG nomination coaching by Epstein (video, glasses, body language — EFTA02590624), (4) Dinner with Woody Allen/Peter Thiel Sept 2014, (5) Meeting with Gates at Four Seasons Sept 2014, (6) Introduced Cass Sunstein to Epstein, (7) Gifts: ring, $1,099 TV, spa payment, flowers "per usual," (8) Brad Karp/Paul Weiss recruitment while still WH Counsel, (9) Ehud Barak meeting, (10) David Axelrod CURE email forward, (11) Apartment viewing assistance. Story 28 "The White House Counsel" published in `follow-the-money` section. Published entity count: 33. Section balance: cover-up 7, network 7, money 7, operation 7.
- [x] **Ruemmler Network Expansion — 5 entities CREATED/PUBLISHED** (2026-03-17) — Peter Thiel T4 (`7d42f463`, 3 connections, 3 events), Woody Allen T4 (`46f77660`, 2 connections, 4 events), Ehud Barak T3 (`3fdbbc66`, 8 connections, 3 events — existing, published + Ruemmler connection added), Brad Karp T4 (`c5fe31fc`, 2 connections, 2 events), Bob Kerrey T4 (`dce2c027`, 2 connections, 2 events). 10 new connections, 7 new events, 22 entity-event links across 9 events. Cross-linked to existing Ruemmler events (Woody Allen dinner, Kerrey/Thiel brunch). Published entity count: 33 → 38.
- [x] **Dana Chasin PUBLISHED** (2026-03-16) — renamed from "Mr. Dana" to "Dana Chasin." Published with slug `dana-chasin`. Category changed to `associate`. Added Summers connection (strength 65). Created travel event (flew victim to NYC ~2001). Linked to Giuffre journals event. 2 connections, 2 events. Published count: 30.
- [x] **Bill Gates entity CREATED + ENRICHED + PUBLISHED** (2026-03-16) — T4 associated entity (`701de77d`). Published with slug `bill-gates`. 6,656 corpus documents / 7,856 pages. 3 connections (Epstein 75, Summers 65, Nikolic 70). 11 events spanning Jan 2011–Sept 2014. Key findings: (1) Kosslyn PR rehabilitation scripts — Gates knowingly participated in Epstein reputation laundering (EFTA02030179), (2) Gates Foundation HQ formal visitor registration July 2011 (EFTA02032102), (3) Gates authorized Epstein to negotiate Nikolic severance (EFTA01965179), (4) Nikolic draft resignation with explosive allegations forwarded to Epstein (EFTA01965732), (5) photos of Gates displayed at dining room as social proof (EFTA01844429), (6) Melinda attended dinner at Epstein's Sept 2013, (7) Gates offered to donate in Epstein's name, (8) DAF collaboration as primary financial nexus. Published entity count: 31.

### Unpublished Entity Pipeline (86 entities)
- [ ] Review 21 unpublished T3 entities for publishing readiness
- [ ] Review 61 T6 entities — many are financial/peripheral from Leon Black case; consider bulk cleanup vs selective publishing

### Platform
- [ ] Stripe/monetization integration — 25 stories with 362 citations provides substantial depth for paid access
- [x] **Bill Gates investigation thread WRITTEN** (2026-03-16) — Thread 12 at `docs/investigation/threads/THREAD_12_Gates_Post_Conviction.md`. 8 key findings, 10 open questions, 30 source documents cataloged. Classification: POST-CONVICTION NETWORK / INSTITUTIONAL COMPLICITY. Key findings: (1) Kosslyn PR rehabilitation scripts, (2) Gates Foundation HQ visitor registration, (3) Boris Nikolic channel + draft resignation, (4) trophy photos, (5) name-dropping for access, (6) DAF collaboration 2011-2014, (7) Paris visits + Crazy Horse incident, (8) Gates offered donation in Epstein's name. Story potential rated HIGH — suggested title "The Rehabilitation."

### Developer Tooling — Claude Code Agents
- [x] **5 custom subagents configured** (2026-03-17) — `.claude/agents/` directory created with 5 project-scoped agents:
  - `editorial-writer.md` — Story assembly: analysis → publication-ready story (citations, entity markup, StoryDef, seed script). Full write access.
  - `investigator.md` — Read-only corpus analyst: 25+ MCP write tools blocked via `disallowedTools`. Corpus search strategy, redaction analysis, thread format, evidence summary output.
  - `entity-enricher.md` — Full entity enrichment pipeline: corpus research → bio/tier → DB create/update → document linking → connection proposals. T5 privacy rules hardcoded. T1-T3 require human publish approval.
  - `frontend-designer.md` — 3-theme design system expert: full Tailwind v4 token rules, anti-patterns list, Server Component architecture, Next.js 16 param rules. No Bash execution (TypeScript check only).
  - `db-migrator.md` — Safe migration specialist: `tools: Read, Write, Grep, Glob` only (no Bash). Writes SQL files for human review — never runs migrations. UUID/RLS/FTS conventions baked in.
- [ ] **Congressional Monitor agent** — future: scheduled corpus + web search → `create_public_event` MCP. Needs cron scheduling.
- [ ] **Connection Discoverer agent** — future: multi-entity co-occurrence + timeline overlap analysis → ranked connection suggestions.

### Trump Investigation Deep-Dive (2026-03-19)
- [x] **Thread 17 created + updated** — FD-302 Protect Source: Hilton Head Victim, Trump Assault, Atkins Blackmail. Version 2.0: 13 primary documents, 4 interviews mapped, NTOC compilation, external corroboration (Rick James Oct 1981/July 1982, Trump Tower Feb 1983), 5 resolved + 8 open questions. Corroboration upgraded to Moderate.
- [x] **Trump-Epstein Timeline created** — Comprehensive chronological document at `docs/investigation/data/TRUMP_EPSTEIN_TIMELINE.md`. Pre-1980 through 2026, cross-referenced with EFTA corpus evidence. Pattern match table (3 sources: oral sex → biting → striking). 15 key documents indexed.
- [x] **Migration 027** — `packages/db/migrations/027_trump_section.sql` adds 'trump' to stories section CHECK constraint.
- [x] **Trump upgraded T4 → T3** — Justified by FBI FD-302 victim account, dedicated Interview #4, NTOC 15+ accusers, Katie Johnson suit, Edwards Affidavit 7-point basis. New bio (comprehensive), new evidence_summary (Phase 1 deep-dive).
- [x] **Jim Atkins entity CREATED** — T3, `c3a15e8e`. Ohio university official, co-perpetrator, blackmail scheme architect. Name is phonetic. Connection to Epstein (co_conspirator, strength 80).
- [x] **Connections updated** — Trump→Epstein upgraded to 85, Trump→Maxwell upgraded to 60. New: Trump→Acosta (political_appointment, 70). New: Atkins→Epstein (co_conspirator, 80).
- [x] **7 new timeline events** — Hilton Head abuse (~1980), Trump assault (~1982), blackmail imprisonment (~1984), Trump appoints Acosta (2017-03-22), FBI hotline call (2019-07-10), Interview #4 (2019-10-16), NTOC compilation (2025-08-06). All entity-linked.
- [x] **4 Trump stories written** — "Fresh Meat" (Story 31), "Let Me Teach You" (Story 32), "The Mar-a-Lago Connection" (Story 33), "The Acosta Deal" (Story 34). All in `trump` section with StoryDefs in seed script.
- [x] **Trump section page** — `apps/web/src/app/(publication)/sections/trump/page.tsx`. Nav updated. CSS token `--color-section-trump: #1a3a5c`. Section color/label maps updated in 9 component files.
- [ ] **Run migration 027** in Supabase SQL Editor
- [ ] **Run `pnpm seed:publication`** to seed stories 31-34
- [ ] **Publish Trump entity** — currently `is_public: false`. Need to verify T3 designation with editorial review before publishing.
- [ ] **Create case file CF-2026-012** "trump-epstein-connection" — title, entities, open questions, findings markdown
- [ ] **Jim Atkins** — publish decision pending. No independent corpus corroboration. Name is phonetic.
- [ ] **PACER verification** — Search for mother's federal embezzlement conviction, Columbia SC, ~1983-1986. Single most important remaining external verification.
