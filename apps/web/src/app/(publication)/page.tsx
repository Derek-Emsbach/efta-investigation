import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Masthead } from '@/components/publication/home/masthead'
import { BreakingNewsTicker } from '@/components/publication/home/breaking-ticker'
import { SectionStoryGrid } from '@/components/publication/home/section-story-grid'
import { FeaturedInvestigation } from '@/components/publication/home/featured-investigation'
import { InvestigationStats } from '@/components/publication/home/investigation-stats'
import { CaseFilesPreview } from '@/components/publication/home/case-files-preview'
import { TimelinePreview } from '@/components/publication/home/timeline-preview'
import { EntitySpotlight } from '@/components/publication/home/entity-spotlight'
import { EvidenceRoomPromo } from '@/components/publication/home/evidence-room-promo'

export const metadata: Metadata = {
  title: 'The Epstein Record — Independent Investigation',
  description:
    'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act. 12 DOJ dataset releases. 99 entities identified. The evidence speaks.',
  openGraph: {
    title: 'The Epstein Record — Independent Investigation',
    description:
      'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act.',
    type: 'website',
    siteName: 'The Epstein Record',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Epstein Record — Independent Investigation',
    description:
      'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act.',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function HomePage() {
  // Fetch all homepage data in parallel
  const [storiesResult, caseFilesResult, entitiesResult, eventsResult, docCountResult] =
    await Promise.all([
      supabase
        .from('stories')
        .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(20),

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
        .in('tier', [1, 2])
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
    ])

  const stories = storiesResult.data ?? []
  const caseFiles = caseFilesResult.data ?? []
  const entities = entitiesResult.data ?? []
  const events = eventsResult.data ?? []

  const stats = {
    documents: (docCountResult.data as number) ?? 1_370_000,
    pages: 2_770_000,
    entities: 99,
    connections: 200,
    openQuestions: 50,
  }

  return (
    <div>
      {/* Masthead */}
      <div className="mx-auto max-w-7xl px-6">
        <Masthead />
      </div>

      {/* Breaking News Ticker (full-width) */}
      <BreakingNewsTicker />

      {/* Section-organized stories */}
      <div className="mx-auto max-w-7xl px-6">
        {stories.length > 0 ? (
          <SectionStoryGrid stories={stories} />
        ) : (
          <section className="py-10 text-center">
            <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">
              Stories
            </p>
            <p className="font-body text-text-secondary">
              Editorial coverage is in development. Check back soon.
            </p>
          </section>
        )}
      </div>

      {/* Featured Investigation (full-width dark section) */}
      <FeaturedInvestigation />

      {/* Stats bar (full-width dark) */}
      <InvestigationStats stats={stats} />

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
