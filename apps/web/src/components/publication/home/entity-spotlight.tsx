import Image from 'next/image'
import Link from 'next/link'
import { TIER_CONFIG } from '@efta/shared'
import type { Tier } from '@efta/shared'
import { EntityPlaceholder } from '@/components/ui/entity-placeholder'

interface EntityPreview {
  id: string
  name: string
  slug: string | null
  tier: number | null
  category: string | null
  bio: string | null
  profile_published: boolean
  profile_image_url: string | null
}

interface EntitySpotlightProps {
  entities: EntityPreview[]
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

export function EntitySpotlight({ entities }: EntitySpotlightProps) {
  if (entities.length === 0) return null

  return (
    <section className="py-10">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.15em] whitespace-nowrap">
          Entity Profiles
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href="/entities"
          className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          Browse All Profiles →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {entities.map((ent) => {
          const tier = (ent.tier ?? 6) as Tier
          const config = TIER_CONFIG[tier]
          const hasProfile = ent.slug && ent.profile_published

          const card = (
            <div className="border border-border-default bg-white p-5 transition-all hover:border-text-secondary hover:shadow-[0_2px_12px_rgba(0,0,0,0.05)] cursor-pointer">
              <div className="flex items-start gap-3 mb-3">
                {ent.profile_image_url ? (
                  <div className="w-12 h-12 border border-border-default overflow-hidden shrink-0 relative">
                    <Image
                      src={ent.profile_image_url}
                      alt={ent.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <EntityPlaceholder
                    name={ent.name}
                    entityType={ent.category === 'corporate' ? 'organization' : 'person'}
                    size={48}
                    className="border border-border-default"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-block font-mono text-[9px] tracking-[0.1em] uppercase mb-1 px-2 py-0.5"
                    style={{ background: `${config.color}15`, color: config.color }}
                  >
                    Tier {tier} · {config.shortLabel}
                  </span>
                  <div className="font-display text-[17px] font-semibold leading-tight">
                    {ent.name}
                  </div>
                </div>
              </div>
              {ent.category && (
                <div className="font-sans text-xs text-text-muted mb-2">
                  {ent.category.replace(/_/g, ' ')}
                </div>
              )}
              {ent.bio && (
                <p className="font-body text-sm text-text-secondary line-clamp-2">
                  {ent.bio}
                </p>
              )}
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
