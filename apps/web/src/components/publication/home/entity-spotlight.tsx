import Link from 'next/link'
import type { Tier } from '@efta/shared'

interface EntityPreview {
  id: string
  name: string
  slug: string | null
  tier: number | null
  category: string | null
  bio: string | null
  profile_published: boolean
}

interface EntitySpotlightProps {
  entities: EntityPreview[]
}

const TIER_COLORS: Record<Tier, string> = {
  1: 'var(--color-tier-1)',
  2: 'var(--color-tier-2)',
  3: 'var(--color-tier-3)',
  4: 'var(--color-tier-4)',
  5: 'var(--color-tier-5)',
  6: 'var(--color-tier-6)',
}

export function EntitySpotlight({ entities }: EntitySpotlightProps) {
  if (entities.length === 0) return null

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Entity Spotlight
        </h2>
        <Link
          href="/entities"
          className="font-mono text-xs text-text-muted hover:text-accent-red transition-colors"
        >
          Browse all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {entities.map((ent) => {
          const tierColor = ent.tier ? TIER_COLORS[ent.tier as Tier] ?? '#6b7280' : '#6b7280'
          const hasProfile = ent.slug && ent.profile_published

          const card = (
            <div className="border border-border-default p-4 hover:border-accent-gold/40 transition-colors group">
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
                    Tier {ent.tier}{ent.category ? ` · ${ent.category.replace(/_/g, ' ')}` : ''}
                  </div>
                  {ent.bio && (
                    <p className="mt-1.5 font-body text-[11px] text-text-secondary line-clamp-2">
                      {ent.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )

          if (hasProfile) {
            return (
              <Link key={ent.id} href={`/entities/${ent.slug}`}>
                {card}
              </Link>
            )
          }
          return <div key={ent.id}>{card}</div>
        })}
      </div>
    </section>
  )
}
