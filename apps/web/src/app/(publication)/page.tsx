import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createCachedReadClient } from '@/lib/supabase/cached-read'
import { Masthead } from '@/components/publication/home/masthead'
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
import { CyclopsPromo } from '@/components/publication/promo/cyclops-promo'
import { SourceAdSlot } from '@/components/publication/promo/source-ad-slot'
import { SourceAttributionBar } from '@/components/publication/promo/source-attribution-bar'
import { NewsWire } from '@/components/publication/home/news-wire'
import { NewsletterSignup } from '@/components/publication/newsletter-signup'
import { MonthlySupportBand } from '@/components/publication/support/monthly-support-band'
import { cookies } from 'next/headers'
import { hasSupabaseAuthCookie } from '@/lib/supabase/auth-cookie'
import type { NewsItem } from '@/lib/news/sources'
import { applyPublicEntityFilter } from '@/lib/supabase/public-visibility'
import {
  formatCount,
  getOpenQuestionCount,
  getPublicConnectionCount,
  getPublishedEntityCount,
} from '@/lib/supabase/public-counts'

export async function generateMetadata(): Promise<Metadata> {
  const entityCount = await getPublishedEntityCount()
  const entitiesClause = entityCount === null ? '' : ` ${entityCount} entities profiled.`
  return {
    title: 'The Epstein Crimes — Independent Investigation',
    description:
      `Systematic investigation of 1.38 million documents released under the Epstein Files Transparency Act. 12 DOJ dataset releases.${entitiesClause} The evidence speaks.`,
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
}

const supabase = createCachedReadClient()

// Sections handled by dedicated components (excluded from generic grid)
const DEDICATED_SECTIONS = ['follow-the-money', 'the-cover-up']

export default async function HomePage() {
  // Only used to label the support button; a cookie check is enough (no auth round-trip).
  const isAuthenticated = hasSupabaseAuthCookie((await cookies()).getAll())
  const [storiesResult, caseFilesResult, entitiesResult, eventsResult, docCountResult, questionsResult, entityCount, connectionCount, openQuestionCount, storyCountResult, newsResult] =
    await Promise.all([
      supabase
        .from('stories')
        .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at, updated_at, hero_image_url')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(30),

      supabase
        .from('case_files')
        .select('id, slug, case_id, title, status, summary, completion_percentage, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(6),

      applyPublicEntityFilter(
        supabase.from('entities').select('id, name, slug, tier, category, bio, profile_published, profile_image_url'),
      )
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

      getPublishedEntityCount(),

      getPublicConnectionCount(),

      getOpenQuestionCount(),

      supabase
        .from('stories')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),

      supabase
        .from('news_items')
        .select('id, headline, summary, source_name, source_url, published_at, category, is_pinned, related_story_slug, created_at')
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6),
    ])

  const stories = storiesResult.data ?? []
  const caseFiles = caseFilesResult.data ?? []
  const entities = entitiesResult.data ?? []
  const events = eventsResult.data ?? []
  const openQuestions = questionsResult.data ?? []
  // news_items may not exist until migration 028 runs — error → empty, homepage still renders.
  const newsItems = (newsResult.data ?? []) as (NewsItem & { created_at: string })[]

  const stats = {
    documents: (docCountResult.data as number) ?? 1_370_000,
    entities: entityCount,
    openQuestions: openQuestionCount,
    stories: storyCountResult.count ?? 21,
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
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        <Masthead />
      </div>

      {/* Hero Section — lead story + sidebar */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        <HeroSection
          leadStory={leadStory}
          sidebarStories={sidebarStories}
          openQuestions={openQuestions}
        />
      </div>

      {/* News Wire — daily outside-reporting roundup (auto-updated by /api/cron/news-wire) */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        <NewsWire items={newsItems} />
      </div>

      {/* Stats bar (full-width dark) */}
      <InvestigationStats stats={stats} />

      {/* Section-organized stories (The Network, The Operation, Voices, etc.) */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        {remainingStories.length > 0 ? (
          <SectionStoryGrid stories={remainingStories} />
        ) : (
          <section className="py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { section: 'The Network', desc: `Mapping the connections between ${entityCount === null ? 'profiled' : formatCount(entityCount)} entities across six evidence tiers.` },
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

      {/* Newsletter capture — turns drive-by traffic into returning readers */}
      <NewsletterSignup source="home" />

      {/* Featured Investigation (full-width dark section) */}
      <FeaturedInvestigation entityCount={entityCount} connectionCount={connectionCount} />

      {/* Source attribution promo (full-width) */}
      <SourceAdSlot variant="inline-banner" seed="homepage-featured" />

      {/* Follow the Money — dedicated section (always visible) */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        <FollowTheMoney stories={moneyStories} />
      </div>

      {/* The Cover-Up — dedicated section (always visible) */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        <CoverUpSection stories={coverUpStories} />
      </div>

      {/* Lower content sections */}
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
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
      </div>

      {/* Monthly support ask — recurring revenue pays the bills */}
      <MonthlySupportBand isAuthenticated={isAuthenticated} />

      {/* Cyclops Digital promo (full-width) */}
      <CyclopsPromo variant="inline" />

      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
        {/* Timeline */}
        <TimelinePreview events={events} />

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Entity spotlight */}
        <EntitySpotlight entities={entities} />

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Source attribution bar */}
        <div className="py-4">
          <SourceAttributionBar />
        </div>

        {/* Divider */}
        <div className="border-b border-border-default" />

        {/* Evidence Room CTA */}
        <EvidenceRoomPromo />
      </div>
    </div>
  )
}
