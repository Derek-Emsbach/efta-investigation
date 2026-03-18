import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { SectionHero } from '@/components/publication/sections/section-hero'
import { SectionStories } from '@/components/publication/sections/section-stories'
import { EntitySpotlight } from '@/components/publication/sections/entity-spotlight'
import { CaseProgressGrid } from '@/components/publication/visualizations/case-progress-grid'

export const metadata: Metadata = {
  title: 'Voices — The Epstein Crimes',
  description:
    'Testimony, witness accounts, and the unanswered questions in the Epstein investigation.',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SECTION_COLOR = '#4a2d6e'

export default async function VoicesPage() {
  const [storiesRes, caseFilesRes, openQuestionsRes, entitiesRes, eventsRes, publishedEntitiesRes] =
    await Promise.all([
      supabase
        .from('stories')
        .select('id, slug, title, deck, section, byline, reading_time_minutes, published_at, hero_image_url')
        .eq('section', 'voices')
        .eq('is_published', true)
        .order('published_at', { ascending: false }),

      supabase
        .from('case_files')
        .select('id, slug, case_id, title, status, completion_percentage, summary, docs_reviewed')
        .eq('is_published', true)
        .order('case_id', { ascending: true }),

      supabase
        .from('open_questions')
        .select('id, case_file_id, status'),

      supabase
        .from('entities')
        .select('id, name, slug, entity_type, tier, category, bio, profile_image_url')
        .eq('profile_published', true)
        .eq('category', 'witness')
        .order('tier', { ascending: true })
        .order('name', { ascending: true }),

      supabase
        .from('events')
        .select('id', { count: 'exact', head: true }),

      supabase
        .from('entities')
        .select('id', { count: 'exact', head: true })
        .eq('profile_published', true),
    ])

  const stories = storiesRes.data ?? []
  const caseFiles = caseFilesRes.data ?? []
  const openQuestions = openQuestionsRes.data ?? []
  const entities = entitiesRes.data ?? []
  const totalEvents = eventsRes.count ?? 0
  const totalEntities = publishedEntitiesRes.count ?? 0

  // Count open questions and group by case file
  const totalOpenQuestions = openQuestions.filter(q => q.status === 'open').length
  const questionCountByCase = new Map<string, number>()
  for (const q of openQuestions) {
    if (q.case_file_id && q.status === 'open') {
      questionCountByCase.set(q.case_file_id, (questionCountByCase.get(q.case_file_id) ?? 0) + 1)
    }
  }

  // Merge open question counts into case files
  const caseFilesWithQuestions = caseFiles.map(cf => ({
    ...cf,
    open_question_count: questionCountByCase.get(cf.id) ?? 0,
  }))

  const stats = [
    { value: totalEvents, label: 'Investigation Events' },
    { value: totalOpenQuestions, label: 'Unanswered Questions' },
    { value: caseFiles.length, label: 'Active Case Threads' },
    { value: totalEntities, label: 'Entities Profiled' },
  ]

  return (
    <div>
      <SectionHero
        title="Voices"
        description="Witness testimony, survivor accounts, and the questions that remain unanswered. Every investigation leaves gaps — and in this one, the gaps tell a story of their own. The unanswered questions below represent documented failures of the system to pursue leads, take statements, or follow the evidence."
        color={SECTION_COLOR}
        stat={{ value: String(totalOpenQuestions), label: 'Unanswered Questions' }}
      />

      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-12 space-y-16">
        {/* What We Still Don't Know */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-[3px]" style={{ backgroundColor: SECTION_COLOR }} />
            <h2
              className="font-sans text-sm font-bold uppercase tracking-wider"
              style={{ color: SECTION_COLOR }}
            >
              What We Still Don&apos;t Know
            </h2>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-default border border-border-default">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-background p-6 text-center">
                <div className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
                  {value.toLocaleString()}
                </div>
                <div className="font-sans text-[11px] uppercase tracking-[0.08em] text-text-muted mt-2">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Case Progress Grid */}
        {caseFilesWithQuestions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-[3px]" style={{ backgroundColor: SECTION_COLOR }} />
              <h2
                className="font-sans text-sm font-bold uppercase tracking-wider"
                style={{ color: SECTION_COLOR }}
              >
                Case File Progress
              </h2>
              <div className="flex-1 h-px bg-border-default" />
            </div>

            <CaseProgressGrid caseFiles={caseFilesWithQuestions} />
          </section>
        )}

        {/* Entity Spotlight */}
        <EntitySpotlight
          entities={entities}
          title="Witnesses &amp; Voices"
          color={SECTION_COLOR}
        />

        {/* Stories */}
        <SectionStories
          stories={stories}
          sectionColor={SECTION_COLOR}
          sectionSlug="voices"
        />
      </div>
    </div>
  )
}
