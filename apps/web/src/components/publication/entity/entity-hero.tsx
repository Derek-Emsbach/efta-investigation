import Image from 'next/image'
import type { Entity, Tier } from '@efta/shared'
import { TierBadgePub } from './tier-badge-pub'
import { EntityPlaceholder } from '@/components/ui/entity-placeholder'

interface EntityHeroProps {
  entity: Entity
  docCount: number
  connectionCount: number
  eventCount: number
  evidenceCount: number
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

export function EntityHero({
  entity,
  docCount,
  connectionCount,
  eventCount,
  evidenceCount,
}: EntityHeroProps) {
  return (
    <section className="animate-fade-in-up">
      {/* Name + Tier */}
      <div className="flex items-start gap-5">
        {/* Avatar */}
        {entity.profile_image_url ? (
          <div className="w-20 h-20 border border-border-default overflow-hidden shrink-0 relative">
            <Image
              src={entity.profile_image_url}
              alt={entity.name}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <EntityPlaceholder
            name={entity.name}
            entityType={entity.entity_type}
            size={80}
            className="border border-border-default"
          />
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="font-display font-bold text-text-primary leading-tight"
            style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
          >
            {entity.name}
          </h1>
          <div className="mt-2 flex items-center gap-4 flex-wrap">
            {entity.tier && (
              <TierBadgePub tier={entity.tier as Tier} />
            )}
            {entity.category && (
              <span className="font-body text-sm text-text-secondary capitalize">
                {entity.category.replace(/_/g, ' ')}
              </span>
            )}
            {entity.status && (
              <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
                {entity.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {entity.bio && (
        <p className="mt-6 font-body text-lg leading-relaxed text-text-secondary">
          {entity.bio}
        </p>
      )}

      {/* Tier justification */}
      {entity.tier_justification && (
        <p className="mt-3 font-body text-sm italic text-text-muted">
          Classification basis: {entity.tier_justification}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 border border-border-default">
        <StatCell label="Documents" value={docCount} />
        <StatCell label="Connections" value={connectionCount} />
        <StatCell label="Events" value={eventCount} />
        <StatCell label="Evidence" value={evidenceCount} />
      </div>
    </section>
  )
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3 border-r border-b border-border-default last:border-r-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r [&:nth-child(4)]:border-r-0 [&:nth-child(3)]:border-b-0 [&:nth-child(4)]:border-b-0">
      <div className="font-mono text-2xl font-bold text-text-primary">{value}</div>
      <div className="font-mono text-xs text-text-muted uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  )
}
