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

interface FollowTheMoneyProps {
  stories: StoryPreview[]
}

const FALLBACK = {
  title: 'The $158 Million Question: How Leon Black\'s Payments Evaded Scrutiny',
  deck: 'Documents from Dataset 12 reveal the full scope of financial transfers between Leon Black and Jeffrey Epstein — payments that continued years after Epstein\'s first conviction. Three separate trust structures. Multiple wire transfer records. Zero oversight from compliance systems designed to catch exactly this.',
}

const FALLBACK_SIDEBAR = [
  'Wexner Trust Restructuring: $46M in Pre-Arrest Asset Transfers',
  'Shell Company Analysis: 30+ Entities, 5 Jurisdictions, One Purpose',
  'Deutsche Bank SAR Filings: What the Compliance Team Flagged — and What They Missed',
]

export function FollowTheMoney({ stories }: FollowTheMoneyProps) {
  const hasStories = stories.length > 0
  const lead = hasStories ? stories[0] : null
  const sidebar = hasStories ? stories.slice(1, 4) : []

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-4 mb-6 pt-10">
        <h2
          className="font-sans text-[13px] font-bold uppercase tracking-[0.15em] whitespace-nowrap"
          style={{ color: 'var(--color-section-money, #1a472a)' }}
        >
          Follow the Money
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href="/stories?section=follow-the-money"
          className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          See All →
        </Link>
      </div>

      {/* 2/3 + 1/3 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] border-t border-b border-border-default">
        {/* Main story */}
        <article className="py-6 lg:pr-6 lg:border-r border-border-default">
          {lead?.hero_image_url && (
            <div className="relative w-full overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
              <Image
                src={lead.hero_image_url}
                alt={lead.title}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          <div
            className="font-sans text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
            style={{ color: 'var(--color-section-money, #1a472a)' }}
          >
            Financial Infrastructure
          </div>

          <h3 className="font-display text-[28px] font-semibold leading-[1.2] mb-2">
            {lead ? (
              <Link
                href={`/stories/${lead.slug}`}
                className="text-text-primary no-underline hover:underline hover:underline-offset-[3px] hover:decoration-1"
              >
                {lead.title}
              </Link>
            ) : (
              <span className="text-text-primary">{FALLBACK.title}</span>
            )}
          </h3>

          {/* Big money figure */}
          <div
            className="font-display text-[48px] font-bold leading-none mt-4 mb-2"
            style={{ color: 'var(--color-section-money, #1a472a)' }}
          >
            $158M
          </div>
          <div className="font-sans text-[11px] tracking-[0.1em] uppercase text-text-muted mb-5">
            Total documented payments from Black to Epstein
          </div>

          <p className="font-body text-[15px] leading-[1.55] text-text-secondary mb-4">
            {lead?.deck ?? FALLBACK.deck}
          </p>

          <div className="flex items-center gap-2 font-sans text-[11px] text-text-muted mt-4">
            {lead?.published_at && (
              <span>
                {new Date(lead.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            <span className="inline-flex items-center bg-elevated border border-border-default px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em]">
              Dataset 12 Complete
            </span>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="py-6 lg:pl-6">
          <div className="font-sans text-[11px] font-bold tracking-[0.15em] uppercase text-text-muted pb-2 mb-3.5 border-b-2 border-text-primary">
            Financial Trail
          </div>
          <div className="space-y-5">
            {sidebar.length > 0 ? (
              sidebar.map((story) => (
                <div key={story.id}>
                  <h3 className="font-display text-[17px] font-semibold leading-[1.3] mb-1">
                    <Link
                      href={`/stories/${story.slug}`}
                      className="text-text-primary no-underline hover:underline hover:underline-offset-[2px] hover:decoration-1"
                    >
                      {story.title}
                    </Link>
                  </h3>
                  {story.deck && (
                    <p className="font-body text-sm text-text-secondary leading-[1.5] line-clamp-2">
                      {story.deck}
                    </p>
                  )}
                </div>
              ))
            ) : (
              FALLBACK_SIDEBAR.map((title, i) => (
                <div key={i}>
                  <h3 className="font-display text-[17px] font-semibold leading-[1.3] text-text-primary">
                    {title}
                  </h3>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
