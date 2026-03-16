import Link from 'next/link'
import Image from 'next/image'
import { TIER_LABELS, type Tier } from '@efta/shared'

interface EntityPreview {
  id: string
  name: string
  slug: string | null
  entity_type: string
  tier: number | null
  category: string | null
  bio: string | null
  profile_image_url: string | null
}

const TIER_COLORS: Record<number, string> = {
  1: '#c41e3a',
  2: '#e65100',
  3: '#f57f17',
  4: '#283593',
  5: '#6a1b9a',
  6: '#455a64',
}

function formatCategory(cat: string | null): string {
  if (!cat) return ''
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface EntitySpotlightProps {
  entities: EntityPreview[]
  title?: string
  color?: string
}

export function EntitySpotlight({ entities, title = 'Key Entities', color }: EntitySpotlightProps) {
  if (entities.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {color && <span className="w-8 h-[3px]" style={{ backgroundColor: color }} />}
        <h2
          className="font-sans text-sm font-bold uppercase tracking-wider"
          style={color ? { color } : undefined}
        >
          {title}
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href="/entities"
          className="font-sans text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          All Entities →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2">
        {entities.map((entity) => {
          const tierColor = TIER_COLORS[entity.tier ?? 6] ?? '#455a64'

          return (
            <Link
              key={entity.id}
              href={`/entities/${entity.slug}`}
              className="flex-none w-[200px] border border-border-default bg-background p-4 hover:bg-elevated/50 transition-colors group"
            >
              {/* Photo or initials */}
              <div className="flex items-center gap-3 mb-3">
                {entity.profile_image_url ? (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-none">
                    <Image
                      src={entity.profile_image_url}
                      alt={entity.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-none"
                    style={{ backgroundColor: tierColor }}
                  >
                    {entity.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-text-primary truncate group-hover:text-accent-gold transition-colors">
                    {entity.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: tierColor }}
                    >
                      T{entity.tier}
                    </span>
                    {entity.category && (
                      <span className="text-[10px] font-sans text-text-muted truncate">
                        {formatCategory(entity.category)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {entity.bio && (
                <p className="font-body text-xs text-text-secondary line-clamp-3 leading-relaxed">
                  {entity.bio}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
