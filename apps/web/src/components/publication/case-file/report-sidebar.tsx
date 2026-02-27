'use client'

import type { CaseFile, Entity, CaseFileEntity } from '@efta/shared'

interface CaseFileEntityWithEntity extends CaseFileEntity {
  entity: Entity
}

interface ReportSidebarProps {
  caseFile: CaseFile
  entities: CaseFileEntityWithEntity[]
  questionCount: number
}

export function ReportSidebar({ caseFile, entities, questionCount }: ReportSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Session info */}
      <div className="pb-5 border-b border-border-default">
        <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
          Report Info
        </h3>
        <dl className="space-y-2.5">
          <SidebarItem label="Case ID" value={caseFile.case_id} />
          <SidebarItem label="Status" value={caseFile.status} />
          <SidebarItem label="Classification" value={caseFile.classification} />
          <SidebarItem label="Documents" value={String(caseFile.docs_reviewed)} />
          <SidebarItem label="Completion" value={`${caseFile.completion_percentage}%`} />
          {caseFile.published_at && (
            <SidebarItem
              label="Published"
              value={new Date(caseFile.published_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            />
          )}
        </dl>
      </div>

      {/* Quick nav */}
      <div className="pb-5 border-b border-border-default">
        <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
          Quick Navigation
        </h3>
        <nav className="space-y-1">
          <NavItem label="Key Findings" section="findings" />
          <NavItem label={`Entities (${entities.length})`} section="entities" />
          <NavItem label={`Open Questions (${questionCount})`} section="questions" />
          {caseFile.methodology_notes && (
            <NavItem label="Methodology" section="methodology" />
          )}
        </nav>
      </div>

      {/* Key persons (top 5 by tier) */}
      {entities.length > 0 && (
        <div className="pb-5 border-b border-border-default">
          <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            Key Persons
          </h3>
          <div className="space-y-1.5">
            {entities
              .sort((a, b) => (a.entity?.tier ?? 99) - (b.entity?.tier ?? 99))
              .slice(0, 5)
              .map((cfe) => (
                <div key={cfe.id} className="font-body text-xs text-text-secondary">
                  {cfe.entity?.name}
                  {cfe.entity?.tier && (
                    <span className="ml-1 font-mono text-[9px] text-text-muted">
                      T{cfe.entity.tier}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-body text-xs text-text-muted">{label}</dt>
      <dd className="font-mono text-xs font-semibold text-text-primary capitalize">
        {value}
      </dd>
    </div>
  )
}

function NavItem({ label, section }: { label: string; section: string }) {
  return (
    <a
      href={`#${section}`}
      className="block font-body text-xs text-text-muted hover:text-accent-red pl-2 border-l-2 border-transparent hover:border-accent-red transition-colors py-0.5"
    >
      {label}
    </a>
  )
}
