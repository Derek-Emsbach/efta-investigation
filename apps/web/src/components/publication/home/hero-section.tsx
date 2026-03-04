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

interface OpenQuestion {
  id: string
  question: string
  priority: string | null
  case_file_id: string | null
}

interface HeroSectionProps {
  leadStory: StoryPreview | null
  sidebarStories: StoryPreview[]
  openQuestions: OpenQuestion[]
}

const SECTION_COLORS: Record<string, string> = {
  'the-network': 'var(--color-section-network, #2c3e50)',
  'follow-the-money': 'var(--color-section-money, #1a472a)',
  'the-cover-up': 'var(--color-section-coverup, #4a1a2a)',
  'the-operation': 'var(--color-section-operation, #3a2a1a)',
  'voices': 'var(--color-section-voices, #2a2a4a)',
}

const SECTION_LABELS: Record<string, string> = {
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-cover-up': 'The Cover-Up',
  'the-operation': 'The Operation',
  'voices': 'Voices',
}

/* Fallback content when no stories are published yet */
const FALLBACK_LEAD = {
  title: 'Systematic Analysis of 3.5 Million Pages Released Under the Epstein Files Transparency Act',
  deck: 'An independent investigation cataloging every document, mapping every connection, and tracking every redaction across twelve DOJ dataset releases. The evidence speaks for itself — when you know where to look.',
  byline: 'The EFTA Investigation Team',
}

const FALLBACK_QUESTIONS = [
  'Why were co-conspirator names redacted from authenticated victim journals while victim details remained visible?',
  'What explains the 18-month gap in DOJ document production between Datasets 8 and 9?',
  'How did the 2007 NPA grant blanket immunity to individuals never named in the original indictment?',
]

export function HeroSection({ leadStory, sidebarStories, openQuestions }: HeroSectionProps) {
  const hasLead = leadStory !== null
  const title = hasLead ? leadStory.title : FALLBACK_LEAD.title
  const deck = hasLead ? leadStory.deck : FALLBACK_LEAD.deck
  const byline = hasLead ? (leadStory.byline || 'By The EFTA Investigation Team') : FALLBACK_LEAD.byline

  const displayQuestions = openQuestions.length > 0
    ? openQuestions
    : FALLBACK_QUESTIONS.map((q, i) => ({ id: `fallback-${i}`, question: q, priority: 'critical', case_file_id: null }))

  return (
    <section className="pt-10">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] border-b border-border-default">
        {/* Lead story */}
        <article className="lg:pr-10 lg:border-r lg:border-border-default pb-6">
          {/* Kicker */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-1 rounded-full bg-accent-red" />
            <span className="font-sans text-[12px] font-semibold tracking-[0.1em] uppercase text-accent-red">
              Exclusive Investigation
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-[clamp(32px,4vw,52px)] font-bold leading-[1.1] tracking-[-0.02em] mb-4">
            {hasLead ? (
              <Link
                href={`/stories/${leadStory.slug}`}
                className="text-text-primary no-underline hover:underline hover:underline-offset-[3px] hover:decoration-2"
              >
                {title}
              </Link>
            ) : (
              <span className="text-text-primary">{title}</span>
            )}
          </h2>

          {/* Summary */}
          {deck && (
            <p className="font-body text-[19px] leading-[1.65] text-text-secondary mb-5 max-w-[640px]">
              {deck}
            </p>
          )}

          {/* Hero image or redaction visual fallback */}
          <div className="mb-5">
            {hasLead && leadStory.hero_image_url ? (
              <>
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '21/9' }}>
                  <Image
                    src={leadStory.hero_image_url}
                    alt={leadStory.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 65vw"
                    className="object-cover"
                    priority
                    unoptimized={!leadStory.hero_image_url.includes('wikimedia.org')}
                  />
                </div>
                <div className="font-sans text-xs text-text-muted mt-2 pt-2 border-t border-border-default">
                  Source document image from the EFTA corpus.
                </div>
              </>
            ) : (
              <>
                <div
                  className="relative w-full overflow-hidden"
                  style={{
                    aspectRatio: '21/9',
                    background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 50%, #2c2c2c 100%)',
                  }}
                >
                  {/* CLASSIFIED watermark */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[15deg] font-mono text-sm tracking-[0.3em] text-white/[0.08] border border-white/[0.06] px-6 py-2 whitespace-nowrap pointer-events-none"
                  >
                    CLASSIFIED DOCUMENT
                  </div>
                  {/* Redaction bars */}
                  <div className="absolute top-[20%] left-[10%] right-[10%]">
                    <div className="h-3 bg-white/[0.04] mb-1.5 w-[85%] rounded-sm" />
                    <div className="h-3 bg-accent-red/[0.15] mb-1.5 w-[60%] rounded-sm" />
                    <div className="h-3 bg-white/[0.04] mb-1.5 w-[92%] rounded-sm" />
                    <div className="h-3 bg-accent-red/[0.15] mb-1.5 w-[45%] rounded-sm" />
                    <div className="h-3 bg-white/[0.04] w-[78%] rounded-sm" />
                  </div>
                </div>
                <div className="font-sans text-xs text-text-muted mt-2 pt-2 border-t border-border-default">
                  <strong className="text-text-secondary">Redaction pattern analysis:</strong>{' '}
                  Across reviewed documents from Dataset 12, names of powerful individuals were systematically
                  redacted while victim identifying details remained visible. Source: EFTA Investigation forensic analysis.
                </div>
              </>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 font-sans text-xs text-text-muted">
            <span className="font-semibold text-text-secondary uppercase tracking-[0.04em]">
              {byline}
            </span>
            {hasLead && leadStory.published_at && (
              <span>
                {new Date(leadStory.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 bg-elevated border border-border-default px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase text-text-secondary">
              Evidence-Based
            </span>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="lg:pl-6 pt-6 lg:pt-0">
          {/* Latest Findings */}
          {sidebarStories.length > 0 && (
            <div className="pb-5 mb-5 border-b border-border-default">
              <div className="font-sans text-[11px] font-bold tracking-[0.15em] uppercase text-text-muted pb-2 mb-3.5 border-b-2 border-text-primary">
                Latest Findings
              </div>
              <div className="space-y-4">
                {sidebarStories.map((story) => (
                  <div key={story.id}>
                    {story.section && (
                      <div
                        className="font-sans text-[10px] font-semibold tracking-[0.1em] uppercase mb-1"
                        style={{ color: SECTION_COLORS[story.section] ?? 'var(--color-text-muted)' }}
                      >
                        {SECTION_LABELS[story.section] ?? story.section}
                      </div>
                    )}
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
                ))}
              </div>
            </div>
          )}

          {/* Open Questions — always shown with fallback */}
          <div className={sidebarStories.length === 0 ? '' : ''}>
            <div className="font-sans text-[11px] font-bold tracking-[0.15em] uppercase text-text-muted pb-2 mb-3.5 border-b-2 border-text-primary">
              Open Questions
            </div>
            <div className="space-y-3">
              {displayQuestions.map((q) => (
                <h3 key={q.id} className="font-display text-[15px] font-semibold leading-[1.3] text-text-primary">
                  {q.question}
                </h3>
              ))}
            </div>
          </div>

          {/* Quick links when no stories */}
          {sidebarStories.length === 0 && (
            <div className="mt-6 pt-5 border-t border-border-default">
              <div className="font-sans text-[11px] font-bold tracking-[0.15em] uppercase text-text-muted pb-2 mb-3.5 border-b-2 border-text-primary">
                Explore
              </div>
              <div className="space-y-2.5">
                <Link href="/case-files" className="block font-display text-[15px] font-semibold text-text-primary hover:underline hover:underline-offset-2">
                  Browse Case Files →
                </Link>
                <Link href="/entities" className="block font-display text-[15px] font-semibold text-text-primary hover:underline hover:underline-offset-2">
                  Entity Profiles →
                </Link>
                <Link href="/evidence" className="block font-display text-[15px] font-semibold text-text-primary hover:underline hover:underline-offset-2">
                  Evidence Room →
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
