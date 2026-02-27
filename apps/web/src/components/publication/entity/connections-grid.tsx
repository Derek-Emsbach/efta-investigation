import type { Entity, EntityConnection, Tier } from '@efta/shared'
import Link from 'next/link'

interface ConnectionWithEntity extends EntityConnection {
  connected_entity: Entity
}

interface ConnectionsGridProps {
  connections: ConnectionWithEntity[]
}

const TIER_COLORS: Record<Tier, string> = {
  1: '#c41e3a',
  2: '#d4a017',
  3: '#e07020',
  4: '#6b7280',
  5: '#0d9488',
  6: '#64748b',
}

export function ConnectionsGrid({ connections }: ConnectionsGridProps) {
  if (connections.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No documented connections.
      </p>
    )
  }

  // Sort by strength (descending), then by tier
  const sorted = [...connections].sort((a, b) => {
    const strengthDiff = (b.strength ?? 0) - (a.strength ?? 0)
    if (strengthDiff !== 0) return strengthDiff
    const tierA = a.connected_entity?.tier ?? 99
    const tierB = b.connected_entity?.tier ?? 99
    return tierA - tierB
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sorted.map((conn) => {
        const ent = conn.connected_entity
        if (!ent) return null
        const tierColor = ent.tier ? TIER_COLORS[ent.tier as Tier] : '#6b7280'
        const hasPublicProfile = ent.slug && ent.profile_published

        const card = (
          <div className="border border-border-default p-4 hover:border-accent-gold/40 transition-colors group">
            <div className="flex items-start gap-3">
              {/* Tier dot */}
              <span
                className="w-2.5 h-2.5 mt-1.5 shrink-0"
                style={{ backgroundColor: tierColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-body text-sm font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
                  {ent.name}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-text-muted uppercase tracking-wider">
                  {conn.relationship_type?.replace(/_/g, ' ')}
                </div>
                {conn.description && (
                  <p className="mt-1.5 font-body text-xs text-text-secondary line-clamp-2">
                    {conn.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {conn.evidence_strength && (
                    <span className="font-mono text-[10px] text-text-muted uppercase">
                      {conn.evidence_strength}
                    </span>
                  )}
                  {conn.strength != null && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-border-default">
                        <div
                          className="h-full bg-accent-gold"
                          style={{ width: `${conn.strength}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        {conn.strength}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )

        if (hasPublicProfile) {
          return (
            <Link key={conn.id} href={`/entities/${ent.slug}`}>
              {card}
            </Link>
          )
        }

        return <div key={conn.id}>{card}</div>
      })}
    </div>
  )
}
