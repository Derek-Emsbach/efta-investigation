import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import type { Tier } from '@efta/shared'
import { TIER_CONFIG } from '@efta/shared'

export const metadata: Metadata = {
  title: 'Entities — The Epstein Crimes',
  description:
    'Individuals and organizations identified across 1.38 million EFTA documents, classified by evidence strength.',
  openGraph: {
    title: 'Entities — The Epstein Crimes',
    description:
      'Individuals and organizations identified in the Epstein files, classified by evidence strength.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Entities&subtitle=Individuals%20and%20organizations%20across%20six%20evidence%20tiers&type=entity'],
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TIER_COLORS: Record<Tier, string> = {
  1: 'var(--color-tier-1)',
  2: 'var(--color-tier-2)',
  3: 'var(--color-tier-3)',
  4: 'var(--color-tier-4)',
  5: 'var(--color-tier-5)',
  6: 'var(--color-tier-6)',
}

export default async function EntitiesPage() {
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, slug, tier, category, bio, profile_published')
    .eq('profile_published', true)
    .order('tier', { ascending: true })
    .order('name')

  const allEntities = entities ?? []

  // Group by tier
  const tiers = new Map<number, typeof allEntities>()
  for (const ent of allEntities) {
    if (ent.tier) {
      const list = tiers.get(ent.tier) ?? []
      list.push(ent)
      tiers.set(ent.tier, list)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 font-mono text-xs text-text-muted">
        <a href="/" className="hover:text-text-secondary transition-colors">
          Home
        </a>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Entities</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary">
          Entities
        </h1>
        <p className="mt-3 font-body text-lg text-text-secondary max-w-2xl">
          Individuals and organizations identified across the EFTA document
          releases. Tier classifications reflect evidence strength, not legal
          determinations.
        </p>
        <div className="mt-4 h-[3px] w-16 bg-accent-red" />
      </header>

      {allEntities.length === 0 ? (
        <p className="font-body text-text-secondary">
          Entity profiles are in development. Check back soon.
        </p>
      ) : (
        <div className="space-y-10">
          {Array.from(tiers.entries())
            .sort(([a], [b]) => a - b)
            .map(([tier, tierEntities]) => {
              const config = TIER_CONFIG[tier as Tier]
              const tierColor = TIER_COLORS[tier as Tier] ?? 'var(--color-text-muted)'

              return (
                <section key={tier}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-3 h-3 shrink-0"
                      style={{ backgroundColor: tierColor }}
                    />
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-text-primary">
                      Tier {tier} — {config?.shortLabel ?? `Tier ${tier}`}
                    </h2>
                    <span className="font-mono text-xs text-text-muted">
                      ({tierEntities.length})
                    </span>
                  </div>
                  {config && (
                    <p className="mb-4 font-body text-sm text-text-secondary">
                      {config.description}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {tierEntities.map((ent) => (
                      <Link
                        key={ent.id}
                        href={`/entities/${ent.slug}`}
                        className="block border border-border-default p-4 hover:border-accent-gold/40 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="w-2.5 h-2.5 mt-1 shrink-0"
                            style={{ backgroundColor: tierColor }}
                          />
                          <div className="min-w-0">
                            <div className="font-display text-sm font-bold text-text-primary group-hover:text-accent-gold transition-colors">
                              {ent.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-text-muted uppercase tracking-wider">
                              {ent.category
                                ? ent.category.replace(/_/g, ' ')
                                : 'Uncategorized'}
                            </div>
                            {ent.bio && (
                              <p className="mt-1.5 font-body text-[11px] text-text-secondary line-clamp-2">
                                {ent.bio}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
        </div>
      )}
    </div>
  )
}
