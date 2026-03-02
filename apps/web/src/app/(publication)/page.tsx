import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Masthead } from '@/components/publication/home/masthead'
import { LatestFindingsTicker } from '@/components/publication/home/breaking-ticker'
import { HeroSection } from '@/components/publication/home/hero-section'
import { SectionStoryGrid } from '@/components/publication/home/section-story-grid'
import { FeaturedInvestigation } from '@/components/publication/home/featured-investigation'
import { FollowTheMoney } from '@/components/publication/home/follow-the-money'
import { CoverUpSection } from '@/components/publication/home/cover-up-section'
import { InvestigationStats } from '@/components/publication/home/investigation-stats'
import { CaseFilesPreview } from '@/components/publication/home/case-files-preview'
import { TimelinePreview } from '@/components/publication/home/timeline-preview'
import { EntitySpotlight } from '@/components/publication/home/entity-spotlight'
import { EvidenceRoomPromo } from '@/components/publication/home/evidence-room-promo'

export const metadata: Metadata = {
  title: 'The Epstein Crimes — Independent Investigation',
  description:
    'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act. 12 DOJ dataset releases. 99 entities identified. The evidence speaks.',
  openGraph: {
    title: 'The Epstein Crimes — Independent Investigation',
    description:
      'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Independent%20Investigation&type=home'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Epstein Crimes — Independent Investigation',
    description:
      'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act.',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Sections handled by dedicated components (excluded from generic grid)
const DEDICATED_SECTIONS = ['follow-the-money', 'the-cover-up']

export default async function HomePage() {
  const [storiesResult, caseFilesResult, entitiesResult, eventsResult, docCountResult, questionsResult, entityCountResult, openQuestionCountResult] =
    await Promise.all([
      supabase
        .from('stories')
        .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(30),

      supabase
        .from('case_files')
        .select('id, slug, case_id, title, status, summary, completion_percentage, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(6),

      supabase
        .from('entities')
        .select('id, name, slug, tier, category, bio, profile_published')
        .eq('profile_published', true)
        .in('tier', [1, 2, 3, 4])
        .order('tier', { ascending: true })
        .order('name')
        .limit(8),

      supabase
        .from('events')
        .select('id, date, title, description, significance, event_type')
        .in('event_type', ['legal', 'legislative', 'institutional'])
        .order('date', { ascending: true })
        .limit(8),

      supabase.rpc('estimated_document_count'),

      supabase
        .from('open_questions')
        .select('id, question, priority, case_file_id')
        .eq('status', 'open')
        .in('priority', ['critical', 'high'])
        .order('priority')
        .limit(3),

      supabase
        .from('entities')
        .select('id', { count: 'exact', head: true })
        .eq('profile_published', true),

      supabase
        .from('open_questions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
    ])

  const stories = storiesResult.data ?? []
  const caseFiles = caseFilesResult.data ?? []
  const entities = entitiesResult.data ?? []
  const events = eventsResult.data ?? []
  const openQuestions = questionsResult.data ?? []

  const stats = {
    documents: (docCountResult.data as number) ?? 1_370_000,
    pages: 2_770_000,
    entities: entityCountResult.count ?? 53,
    connections: 200,
    openQuestions: openQuestionCountResult.count ?? 44,
  }

  // Split stories for dedicated sections
  const leadStory = stories.find((s) => s.is_featured) ?? stories[0] ?? null
  const sidebarStories = stories
    .filter((s) => s.id !== leadStory?.id)
    .slice(0, 3)
  const moneyStories = stories.filter((s) => s.section === 'follow-the-money')
  const coverUpStories = stories.filter((s) => s.section === 'the-cover-up')
  const remainingStories = stories.filter(
    (s) => !DEDICATED_SECTIONS.includes(s.section ?? '') && s.id !== leadStory?.id,
  )

  return (
    <div>
      {/* Masthead */}
      <div className="mx-auto max-w-7xl px-6">
        <Masthead />
      </div>

      {/* Breaking News Ticker (full-width) */}
      <LatestFindingsTicker />

      {/* Hero Section — lead story + sidebar */}
      <div className="mx-auto max-w-7xl px-6">
        <HeroSection
          leadStory={leadStory}
          sidebarStories={sidebarStories}
          openQuestions={openQuestions}
        />
      </div>

      {/* Stats bar (full-width dark) */}
      <InvestigationStats stats={stats} />

      {/* Section-organized stories (The Network, The Operation, Voices, etc.) */}
      <div className="mx-auto max-w-7xl px-6">
        {remainingStories.length > 0 ? (
          <SectionStoryGrid stories={remainingStories} />
        ) : (
          <section className="py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { section: 'The Network', desc: 'Mapping the connections between 97+ identified individuals across six evidence tiers.' },
                { section: 'The Operation', desc: 'How recruitment, logistics, and financial systems operated across multiple jurisdictions.' },
                { section: 'Voices', desc: 'Survivor testimony, whistleblower accounts, and institutional responses to the investigation.' },
              ].map((item) => (
                <div key={item.section} className="border border-border-default bg-white p-6">
                  <div className="font-sans text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
                    Coming Soon
                  </div>
                  <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
                    {item.section}
                  </h3>
                  <p className="font-body text-sm text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Featured Investigation (full-width dark section) */}
      <FeaturedInvestigation />

      {/* Follow the Money — dedicated section (always visible) */}
      <div className="mx-auto max-w-7xl px-6">
        <FollowTheMoney stories={moneyStories} />
      </div>

      {/* The Cover-Up — dedicated section (always visible) */}
      <div className="mx-auto max-w-7xl px-6">
        <CoverUpSection stories={coverUpStories} />
      </div>

      {/* Lower content sections */}
      <div className="mx-auto max-w-7xl px-6">
        {/* Case files */}
        {caseFiles.length > 0 ? (
          <CaseFilesPreview caseFiles={caseFiles} />
        ) : (
          <section className="py-10 text-center">
            <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">
              Investigation Reports
            </p>
            <p className="font-body text-text-secondary">
              Case file reports are being compiled from ongoing analysis.
            </p>
          </section>
        )}

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Timeline */}
        <TimelinePreview events={events} />

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Entity spotlight */}
        <EntitySpotlight entities={entities} />

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Evidence Room CTA */}
        <EvidenceRoomPromo />
      </div>
    </div>
  )
}
