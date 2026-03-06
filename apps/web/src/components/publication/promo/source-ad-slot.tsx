import { pickSource, getSourceById } from './source-configs'
import { SourceAd } from './source-ad'

interface SourceAdSlotProps {
  variant: 'display' | 'sidebar' | 'inline-banner'
  /** Show a specific source. If omitted, picks deterministically from the pool. */
  sourceId?: string
  /** Source IDs to exclude (avoid duplicates on the same page). */
  exclude?: string[]
  /** Seed for deterministic source selection (e.g., page slug). Defaults to variant name. */
  seed?: string
}

export function SourceAdSlot({ variant, sourceId, exclude = [], seed }: SourceAdSlotProps) {
  const source = sourceId
    ? getSourceById(sourceId)
    : pickSource(seed ?? variant, exclude)

  if (!source) return null

  return <SourceAd source={source} variant={variant} />
}
