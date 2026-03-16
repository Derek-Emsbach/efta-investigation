import Link from 'next/link'
import Image from 'next/image'

const SECTION_LABELS: Record<string, string> = {
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-cover-up': 'The Cover-Up',
  'the-operation': 'The Operation',
  'voices': 'Voices',
}

interface StoryPreview {
  id: string
  slug: string
  title: string
  deck: string | null
  section: string | null
  byline: string
  reading_time_minutes: number | null
  published_at: string | null
  hero_image_url?: string | null
}

interface SectionStoriesProps {
  stories: StoryPreview[]
  sectionColor: string
  sectionSlug: string
}

export function SectionStories({ stories, sectionColor, sectionSlug }: SectionStoriesProps) {
  if (stories.length === 0) {
    return (
      <div className="border border-border-default p-12 text-center">
        <p className="font-display text-lg font-semibold text-text-primary mb-2">Stories Coming Soon</p>
        <p className="font-body text-sm text-text-secondary mb-4">
          Investigative reporting for this section is in development.
        </p>
        <Link
          href="/stories"
          className="font-sans text-xs font-semibold uppercase tracking-wider text-accent-gold hover:underline"
        >
          Browse All Stories →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-8 h-[3px]" style={{ backgroundColor: sectionColor }} />
        <h2 className="font-sans text-sm font-bold uppercase tracking-wider" style={{ color: sectionColor }}>
          {SECTION_LABELS[sectionSlug] ?? sectionSlug} Stories
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href={`/stories?section=${sectionSlug}`}
          className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          All Stories →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-default border border-border-default">
        {stories.map((story) => (
          <Link
            key={story.id}
            href={`/stories/${story.slug}`}
            className="block bg-background p-6 hover:bg-elevated/50 transition-colors group"
          >
            {story.hero_image_url && (
              <div className="relative w-full overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={story.hero_image_url}
                  alt={story.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <h3 className="font-display text-lg font-bold text-text-primary leading-snug group-hover:text-accent-gold transition-colors">
              {story.title}
            </h3>
            {story.deck && (
              <p className="mt-2 font-body text-sm text-text-secondary line-clamp-3">
                {story.deck}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 font-body text-xs text-text-muted">
              <span>{story.byline}</span>
              {story.published_at && (
                <>
                  <span className="text-border-default">|</span>
                  <span>
                    {new Date(story.published_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </>
              )}
              {story.reading_time_minutes && (
                <>
                  <span className="text-border-default">|</span>
                  <span>{story.reading_time_minutes} min read</span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
