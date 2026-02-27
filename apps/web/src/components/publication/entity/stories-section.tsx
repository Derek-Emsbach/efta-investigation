import Link from 'next/link'
import type { Story, StoryEntity } from '@efta/shared'

interface StoryWithJunction extends StoryEntity {
  story: Story
}

interface StoriesSectionProps {
  stories: StoryWithJunction[]
}

const SECTION_COLORS: Record<string, string> = {
  'the-network': '#c41e3a',
  'follow-the-money': '#b8860b',
  'the-cover-up': '#6b21a8',
  'the-operation': '#0e7490',
  'voices': '#0d9488',
}

const SECTION_LABELS: Record<string, string> = {
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-cover-up': 'The Cover-Up',
  'the-operation': 'The Operation',
  'voices': 'Voices',
}

export function StoriesSection({ stories }: StoriesSectionProps) {
  if (stories.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No published stories reference this entity yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {stories.map((se) => {
        const story = se.story
        if (!story) return null
        const sectionColor = story.section
          ? SECTION_COLORS[story.section] ?? '#6b7280'
          : '#6b7280'
        const sectionLabel = story.section
          ? SECTION_LABELS[story.section] ?? story.section
          : null

        return (
          <Link
            key={se.id}
            href={`/stories/${story.slug}`}
            className="block border border-border-default p-4 hover:border-accent-gold/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              {sectionLabel && (
                <>
                  <span
                    className="w-1 h-4"
                    style={{ backgroundColor: sectionColor }}
                  />
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: sectionColor }}
                  >
                    {sectionLabel}
                  </span>
                </>
              )}
              {story.published_at && (
                <span className="font-mono text-[10px] text-text-muted ml-auto">
                  {new Date(story.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
            <h4 className="font-display text-base font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
              {story.title}
            </h4>
            {story.deck && (
              <p className="mt-1 font-body text-sm text-text-secondary line-clamp-2">
                {story.deck}
              </p>
            )}
            <div className="mt-2 font-mono text-[10px] text-text-muted">
              By {story.byline}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
