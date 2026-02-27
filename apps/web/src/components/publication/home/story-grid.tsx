import Link from 'next/link'

interface StoryPreview {
  id: string
  slug: string
  title: string
  deck: string | null
  section: string | null
  byline: string
  reading_time_minutes: number | null
  is_featured: boolean
  published_at: string | null
}

interface StoryGridProps {
  stories: StoryPreview[]
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

export function StoryGrid({ stories }: StoryGridProps) {
  if (stories.length === 0) return null

  const featured = stories.find((s) => s.is_featured) ?? stories[0]
  const rest = stories.filter((s) => s.id !== featured.id).slice(0, 3)

  return (
    <section className="py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        {/* Lead story */}
        <Link
          href={`/stories/${featured.slug}`}
          className="group border border-border-default p-6 hover:border-accent-gold/40 transition-colors"
        >
          {featured.section && (
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-6 h-[2px]"
                style={{ backgroundColor: SECTION_COLORS[featured.section] ?? '#6b7280' }}
              />
              <span
                className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: SECTION_COLORS[featured.section] ?? '#6b7280' }}
              >
                {SECTION_LABELS[featured.section] ?? featured.section}
              </span>
            </div>
          )}
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary leading-tight group-hover:text-accent-gold transition-colors">
            {featured.title}
          </h2>
          {featured.deck && (
            <p className="mt-3 font-body text-lg text-text-secondary leading-relaxed">
              {featured.deck}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 font-body text-sm text-text-muted">
            <span>By {featured.byline}</span>
            {featured.published_at && (
              <>
                <span className="text-border-default">|</span>
                <span>
                  {new Date(featured.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </>
            )}
          </div>
        </Link>

        {/* Sidebar stories */}
        <div className="space-y-4">
          {rest.map((story) => {
            const sectionColor = story.section
              ? SECTION_COLORS[story.section] ?? '#6b7280'
              : '#6b7280'

            return (
              <Link
                key={story.id}
                href={`/stories/${story.slug}`}
                className="block border border-border-default p-4 hover:border-accent-gold/40 transition-colors group"
              >
                {story.section && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="w-1 h-3"
                      style={{ backgroundColor: sectionColor }}
                    />
                    <span
                      className="font-mono text-[9px] uppercase tracking-wider"
                      style={{ color: sectionColor }}
                    >
                      {SECTION_LABELS[story.section] ?? story.section}
                    </span>
                  </div>
                )}
                <h3 className="font-display text-base font-bold text-text-primary leading-snug group-hover:text-accent-gold transition-colors">
                  {story.title}
                </h3>
                <div className="mt-1.5 font-body text-xs text-text-muted">
                  {story.byline}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
