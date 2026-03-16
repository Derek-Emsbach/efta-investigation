import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@efta/shared'

interface RelatedStory extends Pick<Story, 'slug' | 'title' | 'deck' | 'section' | 'published_at' | 'hero_image_url' | 'reading_time_minutes'> {
  shared_entity_count?: number
}

interface RelatedStoriesProps {
  stories: RelatedStory[]
}

const SECTION_COLORS: Record<string, string> = {
  'the-network': 'var(--color-section-network)',
  'follow-the-money': 'var(--color-section-money)',
  'the-cover-up': 'var(--color-section-coverup)',
  'the-operation': 'var(--color-section-operation)',
  'voices': 'var(--color-section-voices)',
}

const SECTION_LABELS: Record<string, string> = {
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-cover-up': 'The Cover-Up',
  'the-operation': 'The Operation',
  'voices': 'Voices',
}

export function RelatedStories({ stories }: RelatedStoriesProps) {
  if (stories.length === 0) return null

  return (
    <div className="mt-12 pt-8 border-t-2 border-text-primary">
      <h2 className="font-display text-lg font-semibold text-text-primary mb-1">
        Continue Reading
      </h2>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-5">
        Related investigations
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stories.map((story) => {
          const sectionColor = story.section
            ? SECTION_COLORS[story.section] ?? '#6b7280'
            : '#6b7280'
          const sectionLabel = story.section
            ? SECTION_LABELS[story.section] ?? story.section
            : null

          return (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="block border border-border-default hover:border-accent-gold/40 transition-colors group"
            >
              {story.hero_image_url && (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <Image
                    src={story.hero_image_url}
                    alt={story.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 250px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {sectionLabel && (
                    <>
                      <span
                        className="w-1 h-3.5"
                        style={{ backgroundColor: sectionColor }}
                      />
                      <span
                        className="font-mono text-[9px] uppercase tracking-wider"
                        style={{ color: sectionColor }}
                      >
                        {sectionLabel}
                      </span>
                    </>
                  )}
                  {story.reading_time_minutes && (
                    <span className="font-mono text-[9px] text-text-muted ml-auto">
                      {story.reading_time_minutes} min
                    </span>
                  )}
                </div>
                <h3 className="font-display text-sm font-semibold text-text-primary leading-snug group-hover:text-accent-gold transition-colors line-clamp-2">
                  {story.title}
                </h3>
                {story.deck && (
                  <p className="mt-1.5 font-body text-xs text-text-secondary line-clamp-2">
                    {story.deck}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
