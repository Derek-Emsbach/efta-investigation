import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Stories — The Epstein Record',
  description:
    'Investigative stories based on 1.38 million documents released under the Epstein Files Transparency Act.',
  openGraph: {
    title: 'Stories — The Epstein Record',
    description:
      'Investigative stories based on documents released under the Epstein Files Transparency Act.',
    type: 'website',
    siteName: 'The Epstein Record',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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

export default async function StoriesPage() {
  const { data: stories } = await supabase
    .from('stories')
    .select(
      'id, slug, title, deck, section, byline, reading_time_minutes, published_at',
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  const allStories = stories ?? []

  // Group by section
  const sections = new Map<string, typeof allStories>()
  const unsectioned: typeof allStories = []
  for (const story of allStories) {
    if (story.section) {
      const list = sections.get(story.section) ?? []
      list.push(story)
      sections.set(story.section, list)
    } else {
      unsectioned.push(story)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 font-mono text-xs text-text-muted">
        <a href="/" className="hover:text-text-secondary transition-colors">
          Home
        </a>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Stories</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary">
          Stories
        </h1>
        <p className="mt-3 font-body text-lg text-text-secondary max-w-2xl">
          Document-sourced investigative reporting on the Epstein files. Every
          claim linked to specific EFTA documents by Bates number.
        </p>
        <div className="mt-4 h-[3px] w-16 bg-accent-red" />
      </header>

      {allStories.length === 0 ? (
        <p className="font-body text-text-secondary">
          Stories are in development. Check back soon.
        </p>
      ) : (
        <div className="space-y-12">
          {/* Render by section */}
          {Array.from(sections.entries()).map(([section, sectionStories]) => (
            <section key={section}>
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="w-8 h-[3px]"
                  style={{
                    backgroundColor:
                      SECTION_COLORS[section] ?? 'var(--color-text-muted)',
                  }}
                />
                <h2
                  className="font-mono text-sm font-bold uppercase tracking-wider"
                  style={{
                    color:
                      SECTION_COLORS[section] ?? 'var(--color-text-muted)',
                  }}
                >
                  {SECTION_LABELS[section] ?? section}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-default border border-border-default">
                {sectionStories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </section>
          ))}

          {/* Unsectioned stories */}
          {unsectioned.length > 0 && (
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-default border border-border-default">
                {unsectioned.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function StoryCard({
  story,
}: {
  story: {
    id: string
    slug: string
    title: string
    deck: string | null
    section: string | null
    byline: string
    reading_time_minutes: number | null
    published_at: string | null
  }
}) {
  const sectionColor = story.section
    ? SECTION_COLORS[story.section] ?? 'var(--color-text-muted)'
    : null

  return (
    <Link
      href={`/stories/${story.slug}`}
      className="block bg-background p-6 hover:bg-elevated/50 transition-colors group"
    >
      {story.section && sectionColor && (
        <div className="flex items-center gap-1.5 mb-2">
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
  )
}
