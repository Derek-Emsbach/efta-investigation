import type { Entity, Tier } from '@efta/shared'
import { TIER_CONFIG } from '@efta/shared'

interface DossierCardProps {
  entity: Entity
}

const TIER_COLORS: Record<Tier, string> = {
  1: 'var(--color-tier-1)',
  2: 'var(--color-tier-2)',
  3: 'var(--color-tier-3)',
  4: 'var(--color-tier-4)',
  5: 'var(--color-tier-5)',
  6: 'var(--color-tier-6)',
}

export function DossierCard({ entity }: DossierCardProps) {
  const tierConfig = entity.tier ? TIER_CONFIG[entity.tier as Tier] : null
  const tierColor = entity.tier ? TIER_COLORS[entity.tier as Tier] : '#6b7280'

  return (
    <div className="border border-border-default overflow-hidden animate-fade-in-up">
      {/* Dark header */}
      <div className="bg-[#1a1a1a] px-5 py-3 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-white uppercase tracking-[0.2em]">
          Classified Dossier
        </span>
        <span className="font-mono text-xs text-gray-400">
          EFTA Investigation
        </span>
      </div>

      {/* Content */}
      <div className="bg-surface p-5 space-y-4">
        <DossierField label="Full Name" value={entity.name} />

        {entity.aliases && entity.aliases.length > 0 && (
          <div>
            <dt className="font-mono text-xs text-text-muted uppercase tracking-wider mb-1.5">
              Known Aliases
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {entity.aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex font-mono text-xs px-2 py-0.5 bg-elevated border border-border-default text-text-secondary"
                >
                  {alias}
                </span>
              ))}
            </dd>
          </div>
        )}

        {entity.entity_type && (
          <DossierField
            label="Entity Type"
            value={entity.entity_type.charAt(0).toUpperCase() + entity.entity_type.slice(1)}
          />
        )}

        {tierConfig && (
          <div>
            <dt className="font-mono text-xs text-text-muted uppercase tracking-wider mb-1">
              Tier Classification
            </dt>
            <dd className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5"
                style={{ backgroundColor: tierColor }}
              />
              <span className="font-body text-sm text-text-primary">
                Tier {entity.tier} — {tierConfig.label}
              </span>
            </dd>
            <p className="mt-1 font-body text-xs text-text-muted italic">
              {tierConfig.description}
            </p>
          </div>
        )}

        {entity.status && (
          <DossierField
            label="Status"
            value={entity.status.replace(/_/g, ' ')}
          />
        )}

        {entity.datasets_appeared && entity.datasets_appeared.length > 0 && (
          <div>
            <dt className="font-mono text-xs text-text-muted uppercase tracking-wider mb-1.5">
              Associated Datasets
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {entity.datasets_appeared.map((ds) => (
                <span
                  key={ds}
                  className="inline-flex font-mono text-xs px-2 py-0.5 bg-elevated border border-border-default text-text-secondary"
                >
                  DS{ds}
                </span>
              ))}
            </dd>
          </div>
        )}
      </div>
    </div>
  )
}

function DossierField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-xs text-text-muted uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="font-body text-sm text-text-primary capitalize">
        {value}
      </dd>
    </div>
  )
}
