import Link from 'next/link'
import type { Entity, CaseFileEntity, Tier } from '@efta/shared'

interface CaseFileEntityWithEntity extends CaseFileEntity {
  entity: Entity
}

interface EntityRosterProps {
  entities: CaseFileEntityWithEntity[]
}

const TIER_BG: Record<Tier, string> = {
  1: '#fce4ec',
  2: '#fff8e1',
  3: '#fff8e1',
  4: '#e8eaf6',
  5: '#f3e5f5',
  6: '#eceff1',
}

const TIER_FG: Record<Tier, string> = {
  1: '#c62828',
  2: '#f57f17',
  3: '#f57f17',
  4: '#283593',
  5: '#6a1b9a',
  6: '#455a64',
}

export function EntityRoster({ entities }: EntityRosterProps) {
  if (entities.length === 0) return null

  // Sort by tier
  const sorted = [...entities].sort((a, b) => {
    const tierA = a.entity?.tier ?? 99
    const tierB = b.entity?.tier ?? 99
    return tierA - tierB
  })

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
          Section 04
        </span>
        Identified Persons & Entities
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((cfe) => {
          const ent = cfe.entity
          if (!ent) return null
          const tier = ent.tier as Tier | null
          const bg = tier ? TIER_BG[tier] : '#eceff1'
          const fg = tier ? TIER_FG[tier] : '#455a64'
          const hasProfile = ent.slug && ent.profile_published

          const card = (
            <div className="border border-border-default bg-white p-3 hover:border-text-secondary hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-body text-[13px] font-semibold text-text-primary leading-tight group-hover:text-accent-red transition-colors">
                    {ent.name}
                  </div>
                  {cfe.role && (
                    <div className="font-body text-[10px] text-text-muted mt-0.5 capitalize">
                      {cfe.role}
                    </div>
                  )}
                </div>
                {tier && (
                  <span
                    className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    Tier {tier}
                  </span>
                )}
              </div>
            </div>
          )

          if (hasProfile) {
            return (
              <Link key={cfe.id} href={`/entities/${ent.slug}`}>
                {card}
              </Link>
            )
          }
          return <div key={cfe.id}>{card}</div>
        })}
      </div>
    </section>
  )
}
