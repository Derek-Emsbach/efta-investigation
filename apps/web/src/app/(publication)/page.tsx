import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Masthead } from '@/components/publication/home/masthead'
import { InvestigationStats } from '@/components/publication/home/investigation-stats'
import { StoryGrid } from '@/components/publication/home/story-grid'
import { CaseFilesPreview } from '@/components/publication/home/case-files-preview'
import { EntitySpotlight } from '@/components/publication/home/entity-spotlight'
import { EvidenceRoomPromo } from '@/components/publication/home/evidence-room-promo'

export const metadata: Metadata = {
  title: 'The Epstein Record — Independent Investigation',
  description:
    'Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act. 12 DOJ dataset releases. 99 entities identified. The evidence speaks.',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function HomePage() {
  // Fetch all homepage data in parallel
  const [storiesResult, caseFilesResult, entitiesResult, docCountResult] =
    await Promise.all([
      supabase
        .from('stories')
        .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10),

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

      supabase.rpc('estimated_document_count'),
    ])

  const stories = storiesResult.data ?? []
  const caseFiles = caseFilesResult.data ?? []
  const entities = entitiesResult.data ?? []

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
      <div className="mx-auto max-w-5xl px-6">
        <Masthead />
      </div>

      {/* Stats bar (full-width dark) */}
      <InvestigationStats stats={stats} />

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-6">
        {/* Stories */}
        {stories.length > 0 ? (
          <StoryGrid stories={stories} />
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

        {/* Divider */}
        <div className="border-b border-border-default" />

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
