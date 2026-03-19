import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SectionHero } from '@/components/publication/sections/section-hero'
import { SectionStories } from '@/components/publication/sections/section-stories'
import { EntitySpotlight } from '@/components/publication/sections/entity-spotlight'
import { CaseProgressGrid } from '@/components/publication/visualizations/case-progress-grid'
import EventTimelineChart from '@/components/publication/visualizations/event-timeline-chart'

export const metadata: Metadata = {
  title: 'Trump — The Epstein Crimes',
  description:
    'FBI victim interviews, civil litigation records, and the NTOC compilation: documenting the evidence connecting Donald Trump to Jeffrey Epstein\u2019s operation.',
  openGraph: {
    title: 'Trump — The Epstein Crimes',
    description:
      'FBI victim interviews, civil litigation records, and the NTOC compilation: documenting the evidence connecting Donald Trump to Jeffrey Epstein\u2019s operation.',
    type: 'website',
    siteName: 'The Epstein Crimes',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function TrumpSectionPage() {
  const [storiesResult, eventsResult, caseFilesResult, questionsResult, entitiesResult] = await Promise.all([
    supabase
      .from('stories')
      .select('id, slug, title, deck, section, byline, reading_time_minutes, published_at, hero_image_url')
      .eq('is_published', true)
      .eq('section', 'trump')
      .order('published_at', { ascending: false }),

    supabase
      .from('public_events')
      .select('id, date, title, description, category, impact_level')
      .in('category', ['doj_release', 'doj_action', 'congressional_action', 'court_action', 'criminal_action'])
      .order('date', { ascending: true }),

    supabase
      .from('case_files')
      .select('id, slug, title, completion_percentage, status')
      .eq('is_published', true)
      .order('completion_percentage', { ascending: false }),

    supabase
      .from('open_questions')
      .select('id, case_file_id, status')
      .eq('status', 'open'),

    supabase
      .from('entities')
      .select('id, name, slug, entity_type, tier, category, bio, profile_image_url')
      .eq('profile_published', true)
      .in('slug', ['donald-trump', 'jeffrey-epstein', 'ghislaine-maxwell', 'alexander-acosta', 'virginia-giuffre', 'bradley-edwards'])
      .order('tier', { ascending: true })
      .order('name'),
  ])

  const stories = storiesResult.data ?? []
  const events = eventsResult.data ?? []
  const caseFilesRaw = caseFilesResult.data ?? []
  const questions = questionsResult.data ?? []
  const entities = entitiesResult.data ?? []

  // Count open questions per case file
  const questionCounts: Record<string, number> = {}
  for (const q of questions) {
    if (q.case_file_id) {
      questionCounts[q.case_file_id] = (questionCounts[q.case_file_id] ?? 0) + 1
    }
  }

  // Merge question counts into case files
  const caseFiles = caseFilesRaw.map(cf => ({
    ...cf,
    open_question_count: questionCounts[cf.id] ?? 0,
  }))

  // Map public_events to timeline chart format
  const timelineEvents = events.map(e => ({
    id: e.id as string,
    date: e.date as string,
    title: e.title as string,
    description: (e.description as string) ?? undefined,
    category: e.category as string,
    impact_level: (e.impact_level as string) ?? 'medium',
  }))

  return (
    <div>
      <SectionHero
        title="Trump"
        description="FBI victim interviews name Donald Trump as an assaulter. Civil litigation documents 14 phone numbers, plane flights, and Mar-a-Lago recruitment. An FBI compilation catalogues 15+ accusers with a distinctive behavioral pattern. These are the documents."
        color="#1a3a5c"
        stat={{ value: String(stories.length), label: 'Stories Published' }}
      />

      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-12 space-y-16">
        {/* Event Timeline */}
        {timelineEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-[3px]" style={{ backgroundColor: '#1a3a5c' }} />
              <h2 className="font-sans text-sm font-bold uppercase tracking-wider" style={{ color: '#1a3a5c' }}>
                Timeline of Events
              </h2>
              <div className="flex-1 h-px bg-border-default" />
              <span className="font-sans text-[11px] text-text-muted">
                {timelineEvents.length} events tracked
              </span>
            </div>
            <EventTimelineChart events={timelineEvents} />
          </section>
        )}

        {/* Case Progress Grid */}
        {caseFiles.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-[3px]" style={{ backgroundColor: '#1a3a5c' }} />
              <h2 className="font-sans text-sm font-bold uppercase tracking-wider" style={{ color: '#1a3a5c' }}>
                Investigation Case Files
              </h2>
              <div className="flex-1 h-px bg-border-default" />
              <span className="font-sans text-[11px] text-text-muted">
                {caseFiles.length} active investigations
              </span>
            </div>
            <CaseProgressGrid caseFiles={caseFiles} />
          </section>
        )}

        {/* Entity Spotlight */}
        {entities.length > 0 && (
          <section>
            <EntitySpotlight
              entities={entities}
              title="Key Figures"
              color="#1a3a5c"
            />
          </section>
        )}

        {/* Section Stories */}
        <section>
          <SectionStories
            stories={stories}
            sectionColor="#1a3a5c"
            sectionSlug="trump"
          />
        </section>
      </div>
    </div>
  )
}
