import Link from 'next/link'
import type { Entity, StoryEntity, StoryCitation, Document, CaseFile } from '@efta/shared'

interface StoryEntityWithEntity extends StoryEntity {
  entity: Entity
}

interface StoryCitationWithDoc extends StoryCitation {
  document: Document | null
}

interface StorySidebarProps {
  entities: StoryEntityWithEntity[]
  citations: StoryCitationWithDoc[]
  caseFile: { slug: string; case_id: string; title: string } | null
}

const TIER_COLORS: Record<number, string> = {
  1: '#c41e3a',
  2: '#d4a017',
  3: '#e07020',
  4: '#6b7280',
  5: '#0d9488',
  6: '#64748b',
}

export function StorySidebar({ entities, citations, caseFile }: StorySidebarProps) {
  return (
    <aside className="space-y-6 lg:sticky lg:top-16 lg:self-start">
      {/* Source case file */}
      {caseFile && (
        <div className="pb-5 border-b border-border-default">
          <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Source Investigation
          </h3>
          <Link
            href={`/case-files/${caseFile.slug}`}
            className="block font-body text-sm text-text-primary hover:text-accent-gold transition-colors"
          >
            <span className="font-mono text-xs text-accent-red mr-1">
              {caseFile.case_id}
            </span>
            {caseFile.title}
          </Link>
        </div>
      )}

      {/* People mentioned */}
      {entities.length > 0 && (
        <div className="pb-5 border-b border-border-default">
          <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            People Mentioned
          </h3>
          <div className="space-y-1.5">
            {entities
              .sort((a, b) => (a.entity?.tier ?? 99) - (b.entity?.tier ?? 99))
              .map((se) => {
                const ent = se.entity
                if (!ent) return null
                const tierColor = ent.tier ? TIER_COLORS[ent.tier] ?? '#6b7280' : '#6b7280'
                const hasProfile = ent.slug && ent.profile_published

                const row = (
                  <div className="flex items-center gap-2 group">
                    <span
                      className="w-1.5 h-1.5 shrink-0"
                      style={{ backgroundColor: tierColor }}
                    />
                    <span className="font-body text-xs text-text-secondary group-hover:text-accent-gold transition-colors truncate">
                      {ent.name}
                    </span>
                    {ent.tier && (
                      <span className="font-mono text-[9px] text-text-muted ml-auto shrink-0">
                        T{ent.tier}
                      </span>
                    )}
                  </div>
                )

                if (hasProfile) {
                  return (
                    <Link key={se.id} href={`/entities/${ent.slug}`}>
                      {row}
                    </Link>
                  )
                }
                return <div key={se.id}>{row}</div>
              })}
          </div>
        </div>
      )}

      {/* Documents cited */}
      {citations.length > 0 && (
        <div className="pb-5 border-b border-border-default">
          <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            Documents Cited
          </h3>
          <div className="space-y-1.5">
            {citations.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-accent-red shrink-0">
                  [{c.citation_number}]
                </span>
                <span className="font-mono text-[10px] text-text-muted truncate">
                  {c.bates_number ?? c.document?.bates_number ?? 'Source document'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
