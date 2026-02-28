import Link from 'next/link'

interface StoryPreview {
  id: string
  slug: string
  title: string
  deck: string | null
  section: string | null
  byline: string
  reading_time_minutes: number | null
  published_at: string | null
}

interface CoverUpSectionProps {
  stories: StoryPreview[]
}

const FALLBACK_LEFT = {
  title: 'The Redaction Playbook: How DOJ Shielded Co-Conspirators Across 12 Dataset Releases',
  deck: 'A systematic comparison of redaction patterns reveals that Category D redactions — those protecting perpetrator identities — increased 340% between Datasets 3 and 9, even as victim protection redactions remained constant.',
}

const FALLBACK_RIGHT = {
  title: '2007 NPA: The Agreement That Granted Immunity to People Who Were Never Named',
  deck: 'The Non-Prosecution Agreement signed by Alexander Acosta granted blanket immunity to unnamed "co-conspirators" — a legal mechanism with no precedent in federal sex trafficking cases.',
}

export function CoverUpSection({ stories }: CoverUpSectionProps) {
  const hasStories = stories.length > 0
  const left = hasStories ? stories[0] : null
  const right = hasStories && stories.length > 1 ? stories[1] : null

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-4 mb-6 pt-10">
        <h2
          className="font-sans text-[13px] font-bold uppercase tracking-[0.15em] whitespace-nowrap"
          style={{ color: 'var(--color-section-coverup, #4a1a2a)' }}
        >
          The Cover-Up
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href="/stories?section=the-cover-up"
          className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          See All →
        </Link>
      </div>

      {/* 2-column grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 border-b border-border-default"
        style={{ borderTop: '2px solid var(--color-section-coverup, #4a1a2a)' }}
      >
        {/* Left: redaction visual + story */}
        <article className="p-6 md:border-r border-border-default">
          {/* Redaction visual */}
          <div className="bg-ink p-5 mb-4 font-body text-sm leading-8 text-white/70 relative overflow-hidden">
            On <span className="bg-accent-red text-transparent px-1 relative select-none">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] tracking-[0.15em] text-white/40 whitespace-nowrap">REDACTED</span>
              ███████████
            </span> the subject met with{' '}
            <span className="bg-accent-red text-transparent px-1 relative select-none">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] tracking-[0.15em] text-white/40 whitespace-nowrap">REDACTED</span>
              ████████
            </span> at the residence located at 358 El Brillo Way. Also present was{' '}
            <span className="bg-accent-red text-transparent px-1 relative select-none">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] tracking-[0.15em] text-white/40 whitespace-nowrap">REDACTED</span>
              ██████████████
            </span> who had been previously identified as a co-conspirator in case{' '}
            <span className="bg-accent-red text-transparent px-1 relative select-none">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] tracking-[0.15em] text-white/40 whitespace-nowrap">REDACTED</span>
              ███████
            </span>.
          </div>

          <div
            className="font-sans text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
            style={{ color: 'var(--color-section-coverup, #4a1a2a)' }}
          >
            Redaction Analysis
          </div>

          <h3 className="font-display text-[22px] font-semibold leading-[1.25] mb-2.5">
            {left ? (
              <Link
                href={`/stories/${left.slug}`}
                className="text-text-primary no-underline hover:underline hover:underline-offset-[3px] hover:decoration-1"
              >
                {left.title}
              </Link>
            ) : (
              <span className="text-text-primary">{FALLBACK_LEFT.title}</span>
            )}
          </h3>

          <p className="font-body text-[15px] leading-[1.55] text-text-secondary mb-3">
            {left?.deck ?? FALLBACK_LEFT.deck}
          </p>

          <div className="flex items-center gap-2 font-sans text-[11px] text-text-muted">
            {left?.published_at && (
              <span>
                {new Date(left.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </article>

        {/* Right: second story */}
        <article className="p-6">
          <div
            className="font-sans text-[10px] font-semibold tracking-[0.12em] uppercase mb-2"
            style={{ color: 'var(--color-section-coverup, #4a1a2a)' }}
          >
            Prosecutorial Failure
          </div>

          <h3 className="font-display text-[22px] font-semibold leading-[1.25] mb-2.5">
            {right ? (
              <Link
                href={`/stories/${right.slug}`}
                className="text-text-primary no-underline hover:underline hover:underline-offset-[3px] hover:decoration-1"
              >
                {right.title}
              </Link>
            ) : (
              <span className="text-text-primary">{FALLBACK_RIGHT.title}</span>
            )}
          </h3>

          <p className="font-body text-[15px] leading-[1.55] text-text-secondary mb-3">
            {right?.deck ?? FALLBACK_RIGHT.deck}
          </p>

          <div className="flex items-center gap-2 font-sans text-[11px] text-text-muted">
            {right?.published_at && (
              <span>
                {new Date(right.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
