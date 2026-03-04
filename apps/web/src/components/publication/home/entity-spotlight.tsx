import Image from 'next/image'
import Link from 'next/link'

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

const TIER_LABELS: Record<number, string> = {
  1: 'Convicted',
  2: 'Immunized',
  3: 'Circumstantial',
  4: 'Associated',
  5: 'Victim/Witness',
  6: 'Peripheral',
}

const TIER_STYLES: Record<number, { bg: string; text: string }> = {
  1: { bg: 'var(--color-tier-1-bg, #fce4ec)', text: 'var(--color-tier-1, #c62828)' },
  2: { bg: 'var(--color-tier-2-bg, #fff3e0)', text: 'var(--color-tier-2, #e65100)' },
  3: { bg: 'var(--color-tier-3-bg, #fff8e1)', text: 'var(--color-tier-3, #f57f17)' },
  4: { bg: 'var(--color-tier-4-bg, #e8eaf6)', text: 'var(--color-tier-4, #283593)' },
  5: { bg: 'var(--color-tier-5-bg, #f3e5f5)', text: 'var(--color-tier-5, #6a1b9a)' },
  6: { bg: 'var(--color-tier-6-bg, #eceff1)', text: 'var(--color-tier-6, #455a64)' },
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
          Browse All 97+ Profiles →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {entities.map((ent) => {
          const tier = ent.tier ?? 6
          const style = TIER_STYLES[tier] ?? TIER_STYLES[6]
          const label = TIER_LABELS[tier] ?? 'Unknown'
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
                      unoptimized={!ent.profile_image_url.includes('wikimedia.org')}
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-elevated border border-border-default flex items-center justify-center shrink-0">
                    <span className="font-display text-sm font-bold text-text-muted">
                      {getInitials(ent.name)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-block font-mono text-[9px] tracking-[0.1em] uppercase mb-1 px-2 py-0.5"
                    style={{ background: style.bg, color: style.text }}
                  >
                    Tier {tier} · {label}
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
