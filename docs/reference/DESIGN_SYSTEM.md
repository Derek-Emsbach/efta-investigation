# Design System Reference

## Aesthetic Direction

**Editorial Investigative** — The look and feel of a serious investigative journalism platform crossed with a classified intelligence briefing. Every pixel should communicate: this is meticulous, authoritative research backed by primary source evidence.

**NOT:** Generic dashboard, SaaS product, portfolio site, or anything that looks AI-generated.

## Color Palette

### Core Colors (Tailwind config)
```javascript
colors: {
  // Base
  background: '#0A0E17',        // Deep navy-black, main background
  surface: '#111827',           // Slightly lighter, content cards
  elevated: '#1F2937',          // Raised elements, modals, popovers
  border: '#374151',            // Subtle borders
  'border-light': '#4B5563',    // Emphasis borders
  
  // Text
  'text-primary': '#F9FAFB',    // Primary text (near-white)
  'text-secondary': '#9CA3AF',  // Secondary text (muted gray)
  'text-muted': '#6B7280',      // De-emphasized text
  
  // Accent - Investigation
  critical: '#DC2626',          // EXTREME/CRITICAL findings, Tier 1
  warning: '#F59E0B',           // HIGH findings, Tier 2, warnings
  info: '#3B82F6',              // Institutional blue, links, Tier 4
  success: '#10B981',           // Completed, ROUTINE, Tier 5 (victims)
  
  // Tier Colors
  'tier-1': '#DC2626',          // Convicted/Charged — deep red
  'tier-2': '#F59E0B',          // NPA Immunity — amber
  'tier-3': '#F97316',          // Suspicious/Concerning — orange
  'tier-4': '#6B7280',          // Social/Professional — gray
  'tier-5': '#14B8A6',          // Victims/Witnesses — teal
  'tier-6': '#64748B',          // Staff/Legal — slate
  
  // Severity Colors
  'severity-extreme': '#DC2626',
  'severity-critical': '#EF4444',
  'severity-high': '#F59E0B',
  'severity-routine': '#10B981',
}
```

### Usage Rules
- Background hierarchy: `background` → `surface` → `elevated` (each level lighter)
- Critical/red is ONLY for high-severity findings, Tier 1 entities, and destructive actions
- Blue is for links, informational elements, and institutional entities
- Never use red for links or routine interactive elements
- Text on dark backgrounds: always `text-primary` or `text-secondary`, never pure white (#FFFFFF)

## Typography

### Fonts
```javascript
fontFamily: {
  display: ['Playfair Display', 'Georgia', 'serif'],    // Headings, titles, entity names
  body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],   // Body text, data, UI
  mono: ['IBM Plex Mono', 'monospace'],                  // Code, bates numbers, metadata
}
```

### Load via Google Fonts in `layout.tsx`:
```typescript
import { Playfair_Display, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' })
const ibmPlex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-body' })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })
```

### Scale
- Page titles: `font-display text-3xl font-bold` (Playfair 30px)
- Section headers: `font-display text-2xl font-semibold` (Playfair 24px)
- Subsection: `font-body text-lg font-semibold` (IBM Plex 18px)
- Body: `font-body text-sm` (IBM Plex 14px)
- Metadata/labels: `font-body text-xs text-text-secondary uppercase tracking-wider`
- Bates numbers: `font-mono text-sm` (IBM Plex Mono 14px)
- Data tables: `font-body text-sm`

## Component Patterns

### TierBadge
Small chip showing entity tier. Color-coded per tier colors above.
```
[TIER 1 · CONVICTED]  — red background, white text
[TIER 3 · SUSPICIOUS] — orange background, white text
[TIER 5 · VICTIM]     — teal background, white text
```

### SeverityMarker
Indicator for document/finding severity.
```
● EXTREME CRITICAL  — red, with subtle pulse animation
● CRITICAL          — red, static
● HIGH              — amber
● ROUTINE           — green, subdued
```

### EvidenceStrength
Three dots showing strength: ●●● strong, ●●○ moderate, ●○○ weak

### DocumentCard
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

### EntityCard
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

### DataTable
- Dark header row with uppercase labels
- Alternating row shading (surface / slightly lighter)
- Hover highlight
- Sortable columns (click header)
- Pagination at bottom
- Filter bar above table

## Layout

### Sidebar Navigation (fixed left, 240px wide)
```
┌──────────┬──────────────────────────────────┐
│          │                                  │
│ EFTA     │  [Page Content]                  │
│ ────     │                                  │
│          │                                  │
│ Dashboard│                                  │
│ Entities │                                  │
│ Documents│                                  │
│ Timeline │                                  │
│ Network  │                                  │
│ Hierarchy│                                  │
│ Datasets │                                  │
│ Search   │                                  │
│          │                                  │
│ ──────── │                                  │
│ ADMIN    │                                  │
│ Process  │                                  │
│ Review   │                                  │
│ Import   │                                  │
│          │                                  │
│ ──────── │                                  │
│ [user]   │                                  │
│ Logout   │                                  │
└──────────┴──────────────────────────────────┘
```

### Content Area
- Max width 1440px, centered
- Padding: 32px on large screens, 16px on smaller
- Cards use `surface` background with `border` borders
- Section spacing: 32px between major sections

## Animations

- Page transitions: subtle fade (200ms)
- Card hover: slight lift + border color change (150ms)
- Data loading: skeleton screens with shimmer animation
- Timeline events: stagger-in on scroll
- Network graph: smooth force simulation
- Severity pulse: gentle red glow for EXTREME items (CSS animation, not distracting)
- Toast notifications: slide in from top-right

## Responsive Breakpoints

- Desktop: > 1280px (full sidebar + content)
- Tablet: 768px-1280px (collapsed sidebar, hamburger menu)
- Mobile: < 768px (no sidebar, bottom navigation, simplified layouts)
- Primary target is desktop. Tablet should work. Mobile is graceful degradation.
