import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { SectionHero } from '@/components/publication/sections/section-hero'
import { SectionStories } from '@/components/publication/sections/section-stories'
import { EntitySpotlight } from '@/components/publication/sections/entity-spotlight'
import LocationMap from '@/components/publication/visualizations/location-map'

export const metadata: Metadata = {
  title: 'The Operation — The Epstein Crimes',
  description:
    'The operational machinery behind the Epstein network. Properties, logistics, recruitment, and the global infrastructure of abuse.',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SECTION_COLOR = '#8B5E3C'

export default async function TheOperationPage() {
  const [storiesRes, locationsRes, entitiesRes, eventsRes] = await Promise.all([
    supabase
      .from('stories')
      .select('id, slug, title, deck, section, byline, reading_time_minutes, published_at, hero_image_url')
      .eq('section', 'the-operation')
      .eq('is_published', true)
      .order('published_at', { ascending: false }),

    supabase
      .from('locations')
      .select('id, name, location_type, city, latitude, longitude')
      .not('latitude', 'is', null)
      .not('name', 'ilike', '%test%'),

    supabase
      .from('entities')
      .select('id, name, slug, entity_type, tier, category, bio, profile_image_url')
      .eq('profile_published', true)
      .in('category', ['staff', 'operational', 'inner_circle', 'abuser'])
      .order('tier', { ascending: true })
      .order('name', { ascending: true }),

    supabase
      .from('events')
      .select('event_type'),
  ])

  const stories = storiesRes.data ?? []
  const locations = (locationsRes.data ?? []).filter(
    (l): l is typeof l & { latitude: number; longitude: number } =>
      l.latitude != null && l.longitude != null,
  )
  const entities = entitiesRes.data ?? []

  // Count events by type
  const eventsByType: Record<string, number> = {}
  for (const evt of eventsRes.data ?? []) {
    if (evt.event_type) {
      eventsByType[evt.event_type] = (eventsByType[evt.event_type] ?? 0) + 1
    }
  }
  const totalEvents = eventsRes.data?.length ?? 0

  return (
    <div>
      <SectionHero
        title="The Operation"
        description="Behind the crimes was a machine. A network of properties spanning three countries, private aircraft moving between them on no-file flight plans, a recruitment pipeline feeding through schools and spas, and a logistics apparatus designed to evade detection. This section maps the operational infrastructure that made decades of abuse possible."
        color={SECTION_COLOR}
        stat={{ value: String(locations.length), label: 'Mapped Locations' }}
      />

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-16">
        {/* Property Network */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-[3px]" style={{ backgroundColor: SECTION_COLOR }} />
            <h2
              className="font-sans text-sm font-bold uppercase tracking-wider"
              style={{ color: SECTION_COLOR }}
            >
              The Property Network
            </h2>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          <p className="font-body text-base text-text-secondary max-w-3xl mb-6 leading-relaxed">
            Epstein maintained properties across the United States, the U.S. Virgin Islands, and
            Europe. Flight logs, financial records, and witness testimony place key individuals at
            these locations during periods of documented abuse.
          </p>

          <LocationMap locations={locations} />

          {/* Event type breakdown */}
          {totalEvents > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border-default border border-border-default">
              {Object.entries(eventsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([type, count]) => (
                  <div key={type} className="bg-background p-4 text-center">
                    <div className="font-display text-2xl font-bold text-text-primary">
                      {count}
                    </div>
                    <div className="font-sans text-[11px] uppercase tracking-wider text-text-muted mt-1">
                      {type.replace(/_/g, ' ')} events
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Entity Spotlight */}
        <EntitySpotlight
          entities={entities}
          title="Operational Figures"
          color={SECTION_COLOR}
        />

        {/* Stories */}
        <SectionStories
          stories={stories}
          sectionColor={SECTION_COLOR}
          sectionSlug="the-operation"
        />
      </div>
    </div>
  )
}
