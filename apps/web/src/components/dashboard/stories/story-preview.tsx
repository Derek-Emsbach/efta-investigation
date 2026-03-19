'use client'

import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown-renderer'
import type { EntityRef, RenderContext } from '@/lib/markdown-renderer'

interface Citation {
  citation_number: number
  description: string | null
  bates_number: string | null
  document: { bates_number: string | null; title: string | null } | null
}

interface StoryPreviewProps {
  title: string
  deck: string | null
  section: string | null
  byline: string
  heroImageUrl: string | null
  heroImageCaption: string | null
  bodyMarkdown: string
  citations: Citation[]
  entities: EntityRef[]
}

const SECTION_LABELS: Record<string, string> = {
  'the-cover-up': 'The Cover-Up',
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-operation': 'The Operation',
  'voices': 'Voices',
  'trump': 'Trump',
}

export function StoryPreview({
  title,
  deck,
  section,
  byline,
  heroImageUrl,
  heroImageCaption,
  bodyMarkdown,
  citations,
  entities,
}: StoryPreviewProps) {
  const rendered = useMemo(() => {
    if (!bodyMarkdown) return null
    const context: RenderContext = {
      citations,
      entities,
      autoLink: true,
    }
    return renderMarkdown(bodyMarkdown, context)
  }, [bodyMarkdown, citations, entities])

  return (
    <div data-theme="publication" className="h-full overflow-y-auto bg-[#faf8f5] text-[#1a1a1a]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Section tag */}
        {section && (
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#b8860b] mb-3">
            {SECTION_LABELS[section] ?? section}
          </p>
        )}

        {/* Title */}
        <h1 className="font-serif text-3xl font-bold leading-tight text-[#1a1a1a] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          {title || 'Untitled Story'}
        </h1>

        {/* Deck */}
        {deck && (
          <p className="text-lg text-[#555] leading-relaxed mb-4" style={{ fontFamily: 'Source Serif 4, serif' }}>
            {deck}
          </p>
        )}

        {/* Meta bar */}
        <div className="flex items-center gap-2 text-xs text-[#888] border-b border-[#e0ddd5] pb-3 mb-6">
          <span>{byline}</span>
        </div>

        {/* Hero image */}
        {heroImageUrl && (
          <figure className="mb-6 -mx-6">
            <img
              src={heroImageUrl}
              alt={heroImageCaption ?? ''}
              className="w-full max-h-[400px] object-cover"
            />
            {heroImageCaption && (
              <figcaption className="mt-2 px-6 text-xs text-[#888] italic">
                {heroImageCaption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Body */}
        <div className="prose-publication text-base leading-relaxed" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>
          {rendered}
        </div>
      </div>
    </div>
  )
}
