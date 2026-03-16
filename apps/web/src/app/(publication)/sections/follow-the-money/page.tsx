import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SectionHero } from '@/components/publication/sections/section-hero'
import { SectionStories } from '@/components/publication/sections/section-stories'
import { EntitySpotlight } from '@/components/publication/sections/entity-spotlight'
import ConnectionTypeChart from '@/components/publication/visualizations/connection-type-chart'

export const metadata: Metadata = {
  title: 'Follow the Money — The Epstein Crimes',
  description:
    'Financial infrastructure behind the Epstein operation. Documented payments, shell companies, and institutional failures.',
  openGraph: {
    title: 'Follow the Money — The Epstein Crimes',
    description:
      'Financial infrastructure behind the Epstein operation. Documented payments, shell companies, and institutional failures.',
    type: 'website',
    siteName: 'The Epstein Crimes',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function FollowTheMoneyPage() {
  const [storiesResult, entitiesResult, connectionsResult] = await Promise.all([
    supabase
      .from('stories')
      .select('id, slug, title, deck, section, byline, reading_time_minutes, published_at, hero_image_url')
      .eq('is_published', true)
      .eq('section', 'follow-the-money')
      .order('published_at', { ascending: false }),

    supabase
      .from('entities')
      .select('id, name, slug, entity_type, tier, category, bio, profile_image_url')
      .eq('profile_published', true)
      .or('category.eq.financial,entity_type.in.(organization,trust)')
      .order('tier', { ascending: true })
      .order('name')
      .limit(12),

    supabase
      .from('entity_connections')
      .select('relationship_type'),
  ])

  const stories = storiesResult.data ?? []
  const entities = entitiesResult.data ?? []
  const connections = connectionsResult.data ?? []

  // Aggregate connection counts by relationship type
  const connectionCounts: Record<string, number> = {}
  for (const conn of connections) {
    const type = conn.relationship_type as string
    connectionCounts[type] = (connectionCounts[type] ?? 0) + 1
  }

  // Filter to financial-relevant connection types if desired, or show all
  const financialTypes = ['paid_by', 'financial', 'employed_by', 'hired_by', 'owned_by', 'subsidiary_of']
  const financialConnections: Record<string, number> = {}
  for (const [key, value] of Object.entries(connectionCounts)) {
    if (financialTypes.includes(key)) {
      financialConnections[key] = value
    }
  }

  // If we have financial-specific connections, show those; otherwise show all
  const chartData = Object.keys(financialConnections).length > 0 ? financialConnections : connectionCounts

  return (
    <div>
      <SectionHero
        title="Follow the Money"
        description="Tracing the financial infrastructure behind the Epstein operation. Documented payments, shell companies, bank compliance failures, and the money trails that institutions chose not to follow."
        color="#1a472a"
        stat={{ value: '$158M+', label: 'Documented Payments' }}
      />

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-16">
        {/* Connection Type Chart */}
        {Object.keys(chartData).length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-[3px]" style={{ backgroundColor: '#1a472a' }} />
              <h2 className="font-sans text-sm font-bold uppercase tracking-wider" style={{ color: '#1a472a' }}>
                Relationship Types
              </h2>
              <div className="flex-1 h-px bg-border-default" />
            </div>
            <ConnectionTypeChart data={chartData} />
          </section>
        )}

        {/* Entity Spotlight */}
        {entities.length > 0 && (
          <section>
            <EntitySpotlight
              entities={entities}
              title="Financial Entities"
              color="#1a472a"
            />
          </section>
        )}

        {/* Section Stories */}
        <section>
          <SectionStories
            stories={stories}
            sectionColor="#1a472a"
            sectionSlug="follow-the-money"
          />
        </section>
      </div>
    </div>
  )
}
