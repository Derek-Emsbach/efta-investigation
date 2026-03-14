# Story Queue

> Track what's published, what's ready to write, and what needs more investigation before writing.
> Updated during session bookkeeping alongside `TODO.md`.

---

## Published

| # | Slug | Title | Section | Source | Date |
|---|------|-------|---------|--------|------|
| 1 | the-golden-handcuffs | The Golden Handcuffs | the-cover-up | THREAD_03 | 2026-02 |
| 2 | the-case-that-wasnt | The Case That Wasn't | the-cover-up | THREAD_05 | 2026-02 |
| 3 | the-trustee-with-no-exit | The Trustee With No Exit | the-network | THREAD_01 | 2026-02 |
| 4 | the-heirs-with-the-most-to-hide | The Heirs With the Most to Hide | follow-the-money | THREAD_02 | 2026-02 |
| 5 | the-man-who-held-every-key | The Man Who Held Every Key | the-network | THREAD_04 | 2026-02 |
| 6 | the-system | The System | the-operation | MASTER_BRIEF | 2026-02 |
| 7 | the-scheduler | The Scheduler | the-network | LESLEY_GROFF_Analysis.md | 2026-03 |
| 8 | the-billion-dollar-blind-eye | The Billion-Dollar Blind Eye | follow-the-money | LEON_BLACK/Analysis.md | 2026-03 |
| 9 | the-recruitment-trip | The Recruitment Trip | the-operation | DS12_EXPANSION (Cape Town) | 2026-03 |
| 10 | three-million-pages-of-nothing | Three Million Pages of Nothing | the-cover-up | scan-analysis-report.json | 2026-03 |
| 11 | the-washington-list | The Washington List | the-network | Entity enrichment (D.C. cluster) | 2026-03 |
| 12 | the-last-night | The Last Night | the-cover-up | DS12_EXPANSION (MCC) | 2026-03 |
| 13 | the-governors-ranch | The Governor's Ranch | the-network | DS12_EXPANSION (Richardson) | 2026-03 |
| 14 | normal-for-this-client | Normal for This Client | follow-the-money | DEUTSCHE_BANK/Analysis.md | 2026-03 |
| 15 | the-four-names | The Four Names | the-cover-up | NPA_CO_CONSPIRATORS/Analysis.md | 2026-03 |
| 16 | the-conveyor-belt | The Conveyor Belt | the-operation | BRUNEL/Analysis.md | 2026-03 |

## Ready to Write

| Pri | Suggested Title | Section | Source Material | Key Angle |
|-----|-----------------|---------|-----------------|-----------|
| ~~1~~ | ~~The Scheduler~~ | ~~the-network~~ | ~~LESLEY_GROFF_Analysis.md~~ | **PUBLISHED** (Story 7, 2026-03-12) |
| ~~2~~ | ~~The Billion-Dollar Blind Eye~~ | ~~follow-the-money~~ | ~~LEON_BLACK/Analysis.md~~ | **PUBLISHED** (Story 8, 2026-03-12) |
| ~~3~~ | ~~The Recruitment Trip~~ | ~~the-operation~~ | ~~DS12_EXPANSION (Cape Town)~~ | **PUBLISHED** (Story 9, 2026-03-12) |
| ~~4~~ | ~~Three Million Pages of Nothing~~ | ~~the-cover-up~~ | ~~scan-analysis-report.json~~ | **PUBLISHED** (Story 10, 2026-03-14) |
| ~~5~~ | ~~The Washington List~~ | ~~the-network~~ | ~~Entity enrichment (D.C. cluster)~~ | **PUBLISHED** (Story 11, 2026-03-14) |
| ~~6~~ | ~~The Last Night~~ | ~~the-cover-up~~ | ~~DS12_EXPANSION (MCC)~~ | **PUBLISHED** (Story 12, 2026-03-14) |
| ~~7~~ | ~~The Governor's Ranch~~ | ~~the-network~~ | ~~Richardson investigation~~ | **PUBLISHED** (Story 13, 2026-03-14) |

## Needs More Investigation

| Topic | Gap | Next Step |
|-------|-----|-----------|
| ~~Deutsche Bank compliance~~ | ~~Need full deep read of EFTA01681865 (52 pages)~~ | **PUBLISHED** (Story 14, 2026-03-14) |
| ~~NPA co-conspirators (Kellen, Ross)~~ | ~~Only Groff deeply analyzed~~ | **PUBLISHED** (Story 15, 2026-03-14) |
| Financial shell companies | Jeepers Inc, other entities not fully mapped | Corporate entity corpus sweep |
| ~~Jean-Luc Brunel / modeling pipeline~~ | ~~Entity exists but no deep document analysis~~ | **PUBLISHED** (Story 16, 2026-03-14) |

---

## Story-Writing Workflow

From "analysis doc exists" → "story live on site" in 7 steps:

1. **Identify the angle** — Read the analysis doc's Key Findings, Key Quotes, and Open Questions. A story is one angle told well, not a summary.
2. **Draft the markdown** (`docs/stories/{slug}.md`) — Follow conventions from existing 6 stories (see checklist below).
3. **Build citation table** — Extract every `[CITE:N]`, map to Bates number + description + page reference.
4. **Build entity table** — List every `{{entity:slug}}` with mention_count and is_primary flag.
5. **Define StoryDef metadata** — slug, title, deck, section, case_file_slug, hero_image, reading_time.
6. **Add to seed script and run** — Append StoryDef to `STORIES` array in `scripts/src/seed-publication.ts`, then `pnpm --filter @efta/scripts seed:publication`.
7. **Verify** — Hit `/api/public/stories/{slug}`, check citations resolve and entity links work.

---

## Story Sections

| Section | Theme | Color | Examples |
|---------|-------|-------|----------|
| `the-cover-up` | Institutional failures, prosecutorial inaction, witness suppression | Maroon | Golden Handcuffs, The Case That Wasn't |
| `the-network` | Key individuals and their roles in the operation | Default | Trustee, Indyke, The System |
| `follow-the-money` | Financial flows, trust structures, payments, settlements | Green | Heirs With the Most to Hide |
| `the-operation` | The trafficking system itself — recruitment, logistics | Default | (available) |
| `voices` | Victim perspectives, witness accounts | — | (unused — reserved) |

---

## Quality Checklist (verify before seeding)

### Source Integrity
- [ ] Every factual claim has a `[CITE:N]` tag
- [ ] Every citation maps to a real EFTA Bates number in the `documents` table
- [ ] Citation descriptions are specific (not just "prosecution memo")
- [ ] No uncited factual claims (analysis in `[!finding]` blocks is exempt)

### Entity Markup
- [ ] All published entities use `{{entity:slug}}` on first mention
- [ ] Entity slugs verified against DB (`profile_published = true`)
- [ ] 2-4 primary entities correctly identified in StoryDef

### Narrative Quality
- [ ] Opening is a concrete hook — a fact or scene, not a thesis
- [ ] 3-5 sections separated by `---` with `## Heading`
- [ ] Uses `> [!quote]` for verbatim document excerpts
- [ ] Uses `> [!finding]` for analytical conclusions
- [ ] Uses `> [!data:value]` for highlighted statistics (where applicable)
- [ ] Closing zooms out to systemic implications

### Images (required for Story 7+)
- [ ] Hero image: `hero_image_url` set in StoryDef (Wikimedia Commons preferred)
- [ ] 2-4 inline images using `![caption](url)` syntax in markdown
- [ ] Images are contextual — people, places, or documents mentioned in the story
- [ ] Image sources: Wikimedia Commons (CC/public domain), government photos, court exhibits
- [ ] Captions are descriptive and factual (not decorative)
- [ ] Images placed between sections (after `---` dividers) for visual pacing

### Metadata
- [ ] 1500-2500 words (7-10 minute read)
- [ ] `reading_time_minutes` = round(word_count / 200)
- [ ] Section assignment matches content
- [ ] Deck states the core factual claim in 1-2 sentences
- [ ] Title is evocative (not a dry summary)
- [ ] Hero image sourced from Wikimedia Commons (or null)
- [ ] `case_file_slug` links to relevant case file (or null)

---

## Continuation Prompt Template

For story-focused sessions that pick up after investigation:

```
Continue from the [ENTITY] investigation session. Analysis at
docs/investigation/[FILE]. All DB updates applied.

Write a publishable story for The Epstein Crimes:
1. Draft story markdown in docs/stories/{slug}.md
2. Add StoryDef to scripts/src/seed-publication.ts
3. Run seed script
4. Verify via public API
5. Update docs/STORY_QUEUE.md

Target section: [section]. Suggested title: "[title]".
Follow conventions from existing 6 stories (see docs/STORY_QUEUE.md for checklist).
```
