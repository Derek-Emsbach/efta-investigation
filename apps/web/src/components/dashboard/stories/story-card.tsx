'use client'

import Link from 'next/link'
import type { EditorialStatus, StorySection } from '@efta/shared'
import { StatusBadge } from './status-badge'

const SECTION_COLORS: Record<string, string> = {
  'the-cover-up': 'text-[#8b1a1a]',
  'the-network': 'text-text-secondary',
  'follow-the-money': 'text-[#2d6a4f]',
  'the-operation': 'text-text-secondary',
  'voices': 'text-info',
}

interface StoryCardData {
  id: string
  slug: string
  title: string
  deck: string | null
  section: StorySection | null
  byline: string
  reading_time_minutes: number | null
  hero_image_url: string | null
  editorial_status: EditorialStatus
  editorial_notes: string | null
  updated_at: string
  published_at: string | null
  entity_count: number
  citation_count: number
  word_count: number
}

interface StoryCardProps {
  story: StoryCardData
  onStatusChange?: (id: string, action: 'publish' | 'unpublish' | 'review') => void
}

export function StoryCard({ story, onStatusChange }: StoryCardProps) {
  const sectionLabel = story.section?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Uncategorized'
  const sectionColor = story.section ? SECTION_COLORS[story.section] ?? 'text-text-secondary' : 'text-text-muted'
  const hasHero = !!story.hero_image_url
  const updatedDate = new Date(story.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex gap-4 rounded border border-border-default bg-surface p-4 hover:bg-elevated/50 transition-colors">
      {/* Hero thumbnail */}
      <div className="flex-shrink-0 w-24 h-16 rounded overflow-hidden bg-elevated">
        {hasHero ? (
          <img
            src={story.hero_image_url!}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[9px] font-mono text-warning uppercase">No hero</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={story.editorial_status} />
          <span className={`text-[9px] font-mono uppercase tracking-wider ${sectionColor}`}>
            {sectionLabel}
          </span>
        </div>

        <Link
          href={`/dashboard/stories/${story.id}`}
          className="text-sm font-semibold text-text-primary hover:text-critical transition-colors line-clamp-1"
        >
          {story.title}
        </Link>

        {story.deck && (
          <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">{story.deck}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted font-mono">
          <span>{story.entity_count} entities</span>
          <span>{story.citation_count} citations</span>
          <span>{story.word_count.toLocaleString()} words</span>
          {story.reading_time_minutes && <span>{story.reading_time_minutes} min read</span>}
          <span className="ml-auto">{updatedDate}</span>
        </div>

        {story.editorial_notes && (
          <p className="mt-1.5 text-[10px] text-warning/80 line-clamp-1 italic">
            Note: {story.editorial_notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <Link
          href={`/dashboard/stories/${story.id}`}
          className="rounded bg-elevated px-2 py-1 text-[10px] font-mono text-text-secondary hover:text-text-primary hover:bg-border-default transition-colors text-center"
        >
          Edit
        </Link>
        {onStatusChange && story.editorial_status === 'review' && (
          <button
            onClick={() => onStatusChange(story.id, 'publish')}
            className="rounded bg-success/20 px-2 py-1 text-[10px] font-mono text-success hover:bg-success/30 transition-colors"
          >
            Publish
          </button>
        )}
        {onStatusChange && story.editorial_status === 'draft' && (
          <button
            onClick={() => onStatusChange(story.id, 'review')}
            className="rounded bg-warning/20 px-2 py-1 text-[10px] font-mono text-warning hover:bg-warning/30 transition-colors"
          >
            To Review
          </button>
        )}
        {onStatusChange && story.editorial_status === 'published' && (
          <button
            onClick={() => onStatusChange(story.id, 'unpublish')}
            className="rounded bg-critical/10 px-2 py-1 text-[10px] font-mono text-critical/70 hover:bg-critical/20 transition-colors"
          >
            Unpublish
          </button>
        )}
      </div>
    </div>
  )
}
