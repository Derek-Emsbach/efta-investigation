import Link from 'next/link'
import Image from 'next/image'

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

interface SectionStoryGridProps {
  stories: StoryPreview[]
}

const SECTION_ORDER = [
  'the-network',
  'follow-the-money',
  'the-cover-up',
  'the-operation',
  'voices',
]

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

export function SectionStoryGrid({ stories }: SectionStoryGridProps) {
  if (stories.length === 0) return null

  // Group by section
  const sections = new Map<string, StoryPreview[]>()
  const unsectioned: StoryPreview[] = []

  for (const story of stories) {
    if (story.section) {
      const list = sections.get(story.section) ?? []
      list.push(story)
      sections.set(story.section, list)
    } else {
      unsectioned.push(story)
    }
  }

  // Order sections by SECTION_ORDER, skip empty
  const orderedSections = SECTION_ORDER.filter((s) => sections.has(s))
  // Add any sections not in the predefined order
  for (const key of sections.keys()) {
    if (!orderedSections.includes(key)) orderedSections.push(key)
  }

  return (
    <div className="space-y-2">
      {orderedSections.map((section) => {
        const sectionStories = sections.get(section)!.slice(0, 4)
        const color = SECTION_COLORS[section] ?? 'var(--color-text-muted)'
        const label = SECTION_LABELS[section] ?? section

        return (
          <section key={section}>
            {/* Section header */}
            <SectionHeader label={label} color={color} href={`/sections/${section}`} />

            {/* 3-column grid with border dividers */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 border-t border-b border-border-default">
              {sectionStories.map((story, i) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  sectionColor={color}
                  isLast={i === sectionStories.length - 1}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Unsectioned stories */}
      {unsectioned.length > 0 && (
        <section>
          <SectionHeader label="Latest" color="var(--color-text-muted)" href="/stories" />
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 border-t border-b border-border-default">
            {unsectioned.slice(0, 4).map((story, i) => (
              <StoryCard
                key={story.id}
                story={story}
                sectionColor="var(--color-text-muted)"
                isLast={i === Math.min(unsectioned.length, 4) - 1}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({
  label,
  color,
  href,
}: {
  label: string
  color: string
  href: string
}) {
  return (
    <div className="flex items-center gap-4 mb-6 pt-10">
      <h2
        className="font-sans text-[13px] font-bold uppercase tracking-[0.15em] whitespace-nowrap"
        style={{ color }}
      >
        {label}
      </h2>
      <div className="flex-1 h-px bg-border-default" />
      <Link
        href={href}
        className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
      >
        See All →
      </Link>
    </div>
  )
}

function StoryCard({
  story,
  sectionColor,
  isLast,
}: {
  story: StoryPreview
  sectionColor: string
  isLast: boolean
}) {
  return (
    <Link
      href={`/stories/${story.slug}`}
      className={`block group ${
        isLast ? '' : 'md:border-r md:border-border-default'
      } border-b md:border-b-0 border-border-default last:border-b-0`}
      style={{ padding: '24px' }}
    >
      {/* Thumbnail */}
      {story.hero_image_url && (
        <div className="relative w-full overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
          <Image
            src={story.hero_image_url}
            alt={story.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Kicker */}
      {story.section && (
        <div
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
          style={{ color: sectionColor }}
        >
          {SECTION_LABELS[story.section] ?? story.section}
        </div>
      )}

      {/* Headline */}
      <h3 className="font-display text-[22px] font-semibold leading-[1.25] text-text-primary group-hover:underline group-hover:underline-offset-[3px] group-hover:decoration-1 mb-2.5">
        {story.title}
      </h3>

      {/* Summary */}
      {story.deck && (
        <p className="font-body text-[15px] leading-[1.55] text-text-secondary mb-3 line-clamp-3">
          {story.deck}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 font-sans text-[11px] text-text-muted">
        {story.published_at && (
          <span>
            {new Date(story.published_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {story.reading_time_minutes && (
          <>
            <span className="text-border-default">·</span>
            <span>{story.reading_time_minutes} min read</span>
          </>
        )}
      </div>
    </Link>
  )
}
