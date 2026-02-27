# Design System Reference

## Aesthetic Direction

**Editorial Investigative** — The look and feel of a serious investigative journalism platform crossed with a classified intelligence briefing. Every pixel should communicate: this is meticulous, authoritative research backed by primary source evidence.

**NOT:** Generic dashboard, SaaS product, portfolio site, or anything that looks AI-generated.

## Theme System

The app uses a `data-theme` attribute on the layout wrapper to switch between visual modes. Themes are defined in CSS via Tailwind v4's `@theme inline {}` in `globals.css`. Each route group applies its theme automatically.

| Theme | Attribute | Applied To | Vibe |
|-------|-----------|-----------|------|
| Dashboard (default) | none | `dashboard/` | Dark editorial intelligence briefing |
| Publication | `data-theme="publication"` | `(publication)/` | Warm cream paper, newspaper editorial |
| Manila | `data-theme="manila"` | Case file pages | Aged manila folder, classified document |
| Evidence Room | `data-theme="evidence-room"` | `(evidence)/` | Deep dark, neon forensic terminal |

Theme CSS overrides semantic color variables (`--color-background`, `--color-surface`, `--color-text-primary`, etc.) so components use the same class names across all themes.

## Color Palette

### Dashboard Colors (default)
```css
/* Base */
--color-background: #0A0E17;      /* Deep navy-black */
--color-surface: #111827;          /* Content cards */
--color-elevated: #1F2937;         /* Modals, popovers */
--color-border-default: #374151;   /* Subtle borders */
--color-border-light: #4B5563;     /* Emphasis borders */

/* Text */
--color-text-primary: #F9FAFB;    /* Near-white */
--color-text-secondary: #9CA3AF;  /* Muted gray */
--color-text-muted: #6B7280;      /* De-emphasized */

/* Accent */
--color-critical: #DC2626;        /* Tier 1, extreme findings */
--color-warning: #F59E0B;         /* Tier 2, high findings */
--color-info: #3B82F6;            /* Links, institutional */
--color-success: #10B981;         /* Routine, completed */
```

### Publication Colors (`data-theme="publication"`)
```css
--color-background: #faf8f5;      /* Warm cream paper */
--color-surface: #ffffff;          /* White cards */
--color-elevated: #f5f0e8;        /* Slightly warm raised */
--color-border-default: #d4d0c8;  /* Warm gray borders */
--color-border-light: #e8e4dc;    /* Lighter borders */

--color-text-primary: #1a1a1a;    /* Near-black */
--color-text-secondary: #555555;  /* Dark gray */
--color-text-muted: #888888;      /* Medium gray */

/* Accent */
--color-accent-gold: #b8860b;     /* Dark goldenrod, premium feel */
--color-accent-red: #c41e3a;      /* Cardinal red, investigations */

/* Story Section Colors */
--section-inner-circle: #8b0000;  /* Dark red */
--section-financial: #b8860b;     /* Gold */
--section-legal: #2c5282;         /* Navy */
--section-intelligence: #4a5568;  /* Slate */
--section-victims: #553c9a;       /* Purple */
```

### Manila Colors (`data-theme="manila"`)
```css
--color-background: #f2ead8;      /* Manila paper */
--color-surface: #faf5eb;         /* Lighter manila */
--color-elevated: #e8dcc8;        /* Darker manila */
--color-border-default: #c9b99a;  /* Warm tan borders */

--color-text-primary: #2d2418;    /* Dark brown */
--color-text-secondary: #6b5c4a;  /* Medium brown */
--color-text-muted: #9c8b74;      /* Light brown */
```

### Evidence Room Colors (`data-theme="evidence-room"`)
```css
--color-background: #0d0f11;      /* Near-black */
--color-surface: #181c22;         /* Dark slate */
--color-elevated: #1e2430;        /* Slightly lighter */
--color-border-default: #2a3040;  /* Muted borders */

--color-text-primary: #e8eaf0;    /* Cool near-white */
--color-text-secondary: #8892a4;  /* Cool muted */
--color-text-muted: #4a5568;      /* Dark muted */

/* Neon Accents */
--color-neon-green: #00ff88;      /* Primary accent, search hits */
--color-neon-blue: #00aaff;       /* Links, interactive */
--color-neon-cyan: #00e5ff;       /* Metadata labels */
--color-neon-purple: #b388ff;     /* Tier badges */
--glow-green: 0 0 10px rgba(0, 255, 136, 0.3);  /* Glow effects */
--glow-blue: 0 0 10px rgba(0, 170, 255, 0.3);
```

### Tier Colors (shared across all themes)
```css
--color-tier-1: #DC2626;          /* Direct Evidence — red */
--color-tier-2: #F59E0B;          /* Immunized — amber */
--color-tier-3: #F97316;          /* Circumstantial — orange */
--color-tier-4: #6B7280;          /* Associated — gray */
--color-tier-5: #14B8A6;          /* Victim / Witness — teal */
--color-tier-6: #64748B;          /* Peripheral — slate */
```

### Usage Rules
- Background hierarchy: `background` → `surface` → `elevated` (each level lighter/darker per theme)
- Critical/red is ONLY for high-severity findings, Tier 1 entities, and destructive actions
- Blue is for links, informational elements, and institutional entities
- Never use red for links or routine interactive elements
- Text on dark backgrounds: always `text-primary` or `text-secondary`, never pure white (#FFFFFF)
- Publication theme: use `accent-gold` for premium elements, `accent-red` for investigation markers
- Evidence room: neon accents are for interactive/highlighted elements only — body text stays muted

## Typography

### Dashboard Fonts
```javascript
fontFamily: {
  display: ['Playfair Display', 'Georgia', 'serif'],    // Headings, titles, entity names
  body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],   // Body text, data, UI
  mono: ['IBM Plex Mono', 'monospace'],                  // Code, bates numbers, metadata
}
```

### Publication Fonts
```javascript
fontFamily: {
  display: ['Playfair Display', 'Georgia', 'serif'],     // Headings (shared with dashboard)
  body: ['Source Serif 4', 'Georgia', 'serif'],           // Article body text
  ui: ['DM Sans', 'system-ui', 'sans-serif'],            // Navigation, buttons, labels
  mono: ['JetBrains Mono', 'monospace'],                  // Bates numbers, code
}
```

### Evidence Room Fonts
```javascript
fontFamily: {
  display: ['JetBrains Mono', 'monospace'],              // Headings (terminal aesthetic)
  body: ['DM Sans', 'system-ui', 'sans-serif'],          // Body text
  mono: ['JetBrains Mono', 'monospace'],                  // Everything else
}
```

### Font Loading
Fonts loaded via `next/font/google` in layout files. CSS variables (`--font-body`, `--font-display`, `--font-mono`) are overridden per theme so components use generic `font-body`/`font-display` classes.

### Scale
- Page titles: `font-display text-3xl font-bold` (30px)
- Section headers: `font-display text-2xl font-semibold` (24px)
- Subsection: `font-body text-lg font-semibold` (18px)
- Body: `font-body text-sm` (14px) — dashboard / `font-body text-base` (16px) — publication
- Metadata/labels: `font-body text-xs text-text-secondary uppercase tracking-wider`
- Bates numbers: `font-mono text-sm` (14px)
- Data tables: `font-body text-sm`
- Publication headlines: `font-display text-4xl md:text-5xl` (clamp 34-54px)

## Component Patterns

### Dashboard Components

#### TierBadge
Small chip showing entity tier. Color-coded per tier colors above.
```
[TIER 1 · DIRECT]          — red background, white text
[TIER 2 · IMMUNIZED]       — amber background, white text
[TIER 3 · CIRCUMSTANTIAL]  — orange background, white text
[TIER 4 · ASSOCIATED]      — gray background, white text
[TIER 5 · VICTIM]          — teal background, white text
[TIER 6 · PERIPHERAL]      — slate background, white text
```

#### SeverityMarker
Indicator for document/finding severity.
```
● EXTREME CRITICAL  — red, with subtle pulse animation
● CRITICAL          — red, static
● HIGH              — amber
● ROUTINE           — green, subdued
```

#### EvidenceStrength
Three dots showing strength: ●●● strong, ●●○ moderate, ●○○ weak

#### DocumentCard
```
┌──────────────────────────────────────────────┐
│ ● CRITICAL                    DS12 · Email   │
│                                              │
│ EFTA02731623                                 │
│ Redaction Failure — DANY Names Revealed      │
│                                              │
│ Oct 29, 2021    5 pages    3 entities        │
└──────────────────────────────────────────────┘
```
Dark surface background, left border colored by severity, mono font for bates number.

#### EntityCard
```
┌──────────────────────────────────────────────┐
│ ┌────┐                                       │
│ │ LB │  Leon Black            [TIER 1]       │
│ └────┘  Subject · NO CHARGES                 │
│                                              │
│ 47 documents · 12 evidence items · 15 events │
└──────────────────────────────────────────────┘
```
Avatar initials in circle, tier badge, count stats at bottom.

#### DataTable
- Dark header row with uppercase labels
- Alternating row shading (surface / slightly lighter)
- Hover highlight
- Sortable columns (click header)
- Pagination at bottom
- Filter bar above table

### Publication Components

#### PublicHeader
Sticky navigation bar with "The Epstein Record" branding. Warm cream background, DM Sans font.
- Left: Site title (serif) + section navigation (Subjects, Case Files, Stories, Evidence Room)
- Right: Desktop links inline, mobile hamburger menu
- Sticky with `backdrop-blur-sm` and `bg-surface/95`

#### PublicFooter
Dark 4-column footer (`#1a1a1a` background). Sections: Investigation, Resources, Legal, About. Copyright notice.

#### StoryHero
Full-width story header. Section tag (color-coded), headline (Playfair 34-54px clamped), deck paragraph, meta bar (byline, date, reading time).

#### CaseFileCover
Manila-themed case file header with stamp watermark effect. Shows case ID (`CF-2026-001`), title, status badge (Open/Closed/Active), classification level, completion percentage bar.

#### EntityRoster
Grid of entity cards linked to a case file. Shows name, tier badge, role in case.

#### OpenQuestions
Numbered list of investigative questions for a case file. Priority badges (Critical/High/Medium), category tags, expandable context.

#### FindingsMarkdown
Custom markdown renderer for case file findings. Handles:
- `[CITE:N]` → citation footnotes linking to source documents
- `{{entity:slug}}` → inline entity links with tier color
- `{{doc:EFTA...}}` → evidence room document links
- `{{redacted:D}}text{{/redacted}}` → styled redaction markers
- `> [!finding]` → highlighted finding callout box
- `> [!data:$158M]` → data point callout with large number
- `> [!quote]` → styled blockquote with attribution
- `[SPECULATION_START/END]` → collapsible speculation blocks
- Markdown tables with styled headers

### Evidence Room Components

#### EvidenceHeader
Dark 48px sticky header. "The Epstein Record" breadcrumb → "EVIDENCE ROOM" in red mono font (`font-mono font-bold tracking-wider text-critical`). "Back to Newsroom" link.

#### SearchInterface
Full-width search bar with neon green focus ring. Real-time result count. Document results show bates number (mono), excerpt with highlighted matches, severity/dataset badges.

#### StatsBar
Horizontal stats row showing total documents, datasets, entities, date range. Neon cyan labels on dark background.

## Layout

### Dashboard Layout (Sidebar Navigation)
```
┌──────────┬──────────────────────────────────┐
│          │                                  │
│ EFTA     │  [Page Content]                  │
│ ────     │                                  │
│          │                                  │
│INVESTIG. │                                  │
│ Dashboard│                                  │
│ Entities │                                  │
│ Documents│                                  │
│ Timeline │                                  │
│ Search   │                                  │
│ Network  │                                  │
│ Datasets │                                  │
│ Hierarchy│                                  │
│ Forensics│                                  │
│ Photos   │                                  │
│ Locations│                                  │
│ Cases    │                                  │
│          │                                  │
│ ──────── │                                  │
│ ADMIN    │  (hidden for viewer role)        │
│ Upload   │                                  │
│ Process  │                                  │
│ Review   │                                  │
│ Detective│  → /assistant                    │
│ Admin    │                                  │
│          │                                  │
│ ──────── │                                  │
│ [user]   │  role badge                      │
│ Logout   │                                  │
└──────────┴──────────────────────────────────┘
```

- Fixed left sidebar, 240px wide
- Max width 1440px content area, centered
- Padding: 32px on large screens, 16px on smaller
- Cards use `surface` background with `border` borders
- Section spacing: 32px between major sections

### Publication Layout (No Sidebar)
```
┌──────────────────────────────────────────────┐
│ The Epstein Record    Subjects | Cases | ...  │
├──────────────────────────────────────────────┤
│                                              │
│         [Full-width content area]            │
│         max-w-7xl (1280px) centered          │
│                                              │
│  Stories: 3-col grid → 1-col on mobile       │
│  Entities: responsive card grid              │
│  Articles: centered prose (max-w-3xl)        │
│                                              │
├──────────────────────────────────────────────┤
│         [Dark 4-column footer]               │
└──────────────────────────────────────────────┘
```

- No sidebar — full-width with `max-w-7xl` centered content
- Article prose narrower at `max-w-3xl` for readability
- Responsive: 3-col story grid → 1-col, entity grid → stacked cards
- Padding: `px-6` (24px) consistent

### Evidence Room Layout
Full-width dark layout with centered search. No sidebar. `max-w-7xl` content area. Terminal/forensic aesthetic.

## Animations

- Page transitions: subtle fade (200ms)
- Card hover: slight lift + border color change (150ms)
- Data loading: skeleton screens with shimmer animation
- Timeline events: stagger-in on scroll
- Network graph: smooth force simulation
- Severity pulse: gentle red glow for EXTREME items (CSS animation, not distracting)
- Toast notifications: slide in from top-right
- Publication: reading progress bar (top of viewport, gold accent)
- Evidence room: neon glow on search focus, result fade-in

## Responsive Breakpoints

- Desktop: > 1280px (full sidebar + content / full publication grid)
- Tablet: 768px-1280px (collapsed sidebar / 2-col publication grid)
- Mobile: < 768px (no sidebar / single column, hamburger menu on publication)
- Primary target is desktop. Tablet should work. Mobile is graceful degradation.
