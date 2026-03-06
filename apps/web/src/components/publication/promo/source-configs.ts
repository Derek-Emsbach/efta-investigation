/**
 * Source Attribution Configuration
 *
 * Registry of community-built research tools and archives used in this
 * investigation. Each source gets its own "ad" treatment — branding,
 * tagline, and link — displayed across the publication site.
 *
 * Only includes sources where someone made the effort to build something
 * (e.g., Jmail archive), NOT compulsory government releases.
 */

export interface SourceConfig {
  id: string
  name: string
  shortName: string
  tagline: string
  description: string
  url: string
  /** Hex color used for accent borders and CTA styling */
  accentColor: string
  /** Lighter variant for card backgrounds */
  accentColorLight: string
  ctaLabel: string
  /** URL to a logo image (SVG preferred). Rendered as <img> */
  logoUrl?: string
  /** Alt text for the logo image */
  logoAlt?: string
}

export const SOURCE_CONFIGS: SourceConfig[] = [
  {
    id: 'jmail',
    name: 'Jmail Archive',
    shortName: 'Jmail',
    tagline: 'Curious what Epstein and his network talked about?',
    description:
      'A community-built email archive spanning years of private correspondence within the Epstein network.',
    url: 'https://jmail.world',
    accentColor: '#2563eb',
    accentColorLight: '#dbeafe',
    ctaLabel: 'Explore the Archive',
    logoAlt: 'Jmail Archive',
  },
]

/** Look up a single source by ID */
export function getSourceById(id: string): SourceConfig | undefined {
  return SOURCE_CONFIGS.find((s) => s.id === id)
}

/** Get all source configs */
export function getAllSources(): SourceConfig[] {
  return SOURCE_CONFIGS
}

/**
 * Deterministically pick a source based on a seed string (e.g., pathname).
 * Avoids hydration mismatches by producing stable output for the same input.
 */
export function pickSource(seed: string, exclude: string[] = []): SourceConfig | null {
  const available = SOURCE_CONFIGS.filter((s) => !exclude.includes(s.id))
  if (available.length === 0) return null

  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % available.length
  return available[index]
}
