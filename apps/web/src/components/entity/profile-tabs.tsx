'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EvidenceStrength } from '@/components/ui/evidence-strength'
import { SeverityMarker } from '@/components/ui/severity-marker'
import { TierBadge } from '@/components/ui/tier-badge'
import type {
  Entity,
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  Event,
  Tier,
  Severity,
  EvidenceItemStrength,
} from '@efta/shared'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type DocumentJoin = EntityDocument & { document: Document }
type EventJoin = EntityEvent & { event: Event }
type ConnectionJoin = EntityConnection & { connected_entity: Entity }

type TabKey = 'evidence' | 'timeline' | 'documents' | 'connections'

interface EntityProfileTabsProps {
  documents: DocumentJoin[]
  events: EventJoin[]
  connections: ConnectionJoin[]
  evidence: EvidenceItem[]
  entityId: string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

const TABS: { key: TabKey; label: string }[] = [
  { key: 'evidence', label: 'Evidence' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'documents', label: 'Documents' },
  { key: 'connections', label: 'Connections' },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const CATEGORY_COLORS: Record<string, string> = {
  primary: '#3B82F6',
  corroborating: '#10B981',
  contradictory: '#DC2626',
  timeline: '#6B7280',
}

const EVIDENCE_STRENGTH_COLORS: Record<string, string> = {
  documented: '#10B981',
  alleged: '#F59E0B',
  circumstantial: '#6B7280',
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function EntityProfileTabs({
  documents,
  events,
  connections,
  evidence,
  entityId,
}: EntityProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('evidence')

  const counts: Record<TabKey, number> = {
    evidence: evidence.length,
    timeline: events.length,
    documents: documents.length,
    connections: connections.length,
  }

  return (
    <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
      {/* Tab headers */}
      <div className="flex border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'text-text-primary border-b-2 border-info'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-info/15 text-info'
                    : 'bg-elevated text-text-muted'
                }`}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === 'evidence' && <EvidenceTab items={evidence} />}
        {activeTab === 'timeline' && <TimelineTab items={events} />}
        {activeTab === 'documents' && <DocumentsTab items={documents} />}
        {activeTab === 'connections' && <ConnectionsTab items={connections} />}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Evidence Tab
// -------------------------------------------------------------------

function EvidenceTab({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="No evidence items recorded for this entity." />
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-lg border border-border-default bg-background p-4"
        >
          {/* Category dot */}
          <span
            className="mt-1.5 w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor:
                CATEGORY_COLORS[item.category ?? ''] ?? '#6B7280',
            }}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary leading-relaxed">
              {item.description}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {item.evidence_type && (
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                  {formatLabel(item.evidence_type)}
                </span>
              )}
              {item.category && (
                <span
                  className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{
                    color: CATEGORY_COLORS[item.category] ?? '#6B7280',
                    backgroundColor: `${CATEGORY_COLORS[item.category] ?? '#6B7280'}15`,
                  }}
                >
                  {formatLabel(item.category)}
                </span>
              )}
              {item.date && (
                <span className="text-xs text-text-muted">
                  {formatFullDate(item.date)}
                </span>
              )}
            </div>
          </div>

          {/* Strength indicator */}
          {item.strength && (
            <div className="shrink-0">
              <EvidenceStrength
                strength={item.strength as EvidenceItemStrength}
                showLabel
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// -------------------------------------------------------------------
// Timeline Tab
// -------------------------------------------------------------------

function TimelineTab({ items }: { items: EventJoin[] }) {
  if (items.length === 0) {
    return <EmptyState message="No timeline events recorded for this entity." />
  }

  return (
    <div className="relative">
      {items.map((item, index) => {
        const event = item.event
        if (!event) return null

        const isLast = index === items.length - 1

        return (
          <div key={item.id} className="flex gap-4">
            {/* Date column + vertical line */}
            <div className="flex flex-col items-center w-24 shrink-0">
              <span className="text-xs font-mono text-text-muted whitespace-nowrap">
                {formatDate(event.date)}
              </span>
              {/* Dot */}
              <span className="mt-2 w-2.5 h-2.5 rounded-full bg-info shrink-0" />
              {/* Vertical connector */}
              {!isLast && (
                <span className="w-px flex-1 bg-border-default" />
              )}
            </div>

            {/* Event content */}
            <div className={`pb-6 flex-1 min-w-0 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-display text-sm font-semibold text-text-primary">
                  {event.title}
                </h4>
                {event.event_type && (
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                    {formatLabel(event.event_type)}
                  </span>
                )}
                {item.role && (
                  <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded">
                    {formatLabel(item.role)}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                  {event.description}
                </p>
              )}
              {event.significance && (
                <p className="text-xs text-text-muted italic mt-1">
                  {event.significance}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------
// Documents Tab
// -------------------------------------------------------------------

function DocumentsTab({ items }: { items: DocumentJoin[] }) {
  if (items.length === 0) {
    return <EmptyState message="No documents linked to this entity." />
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const doc = item.document
        if (!doc) return null

        return (
          <div
            key={item.id}
            className="flex items-start gap-4 rounded-lg border border-border-default bg-background p-4"
          >
            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {doc.bates_number && (
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-mono text-sm font-medium text-info hover:text-info/80 transition-colors"
                  >
                    {doc.bates_number}
                  </Link>
                )}
                {doc.document_type && (
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                    {formatLabel(doc.document_type)}
                  </span>
                )}
                {item.role_in_document && (
                  <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded">
                    {formatLabel(item.role_in_document)}
                  </span>
                )}
              </div>

              {doc.title && (
                <p className="text-sm text-text-primary mt-1">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="hover:text-info transition-colors"
                  >
                    {doc.title}
                  </Link>
                </p>
              )}

              {item.excerpt && (
                <p className="text-xs text-text-muted mt-1 line-clamp-2 italic">
                  &ldquo;{item.excerpt}&rdquo;
                </p>
              )}

              <div className="flex items-center gap-3 mt-2">
                {doc.original_date && (
                  <span className="text-xs text-text-muted">
                    {formatFullDate(doc.original_date)}
                  </span>
                )}
                {doc.page_count && (
                  <span className="text-xs text-text-muted">
                    {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
                  </span>
                )}
              </div>
            </div>

            {/* Severity */}
            {doc.severity && (
              <div className="shrink-0">
                <SeverityMarker severity={doc.severity as Severity} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------
// Connections Tab
// -------------------------------------------------------------------

function ConnectionsTab({ items }: { items: ConnectionJoin[] }) {
  if (items.length === 0) {
    return <EmptyState message="No connections recorded for this entity." />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((conn) => {
        const other = conn.connected_entity
        if (!other) return null

        return (
          <div
            key={conn.id}
            className="rounded-lg border border-border-default bg-background p-4"
          >
            {/* Entity name + tier */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/entities/${other.id}`}
                className="font-display text-sm font-semibold text-text-primary hover:text-info transition-colors"
              >
                {other.name}
              </Link>
              {other.tier && <TierBadge tier={other.tier as Tier} size="sm" />}
            </div>

            {/* Relationship type + evidence strength */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                {formatLabel(conn.relationship_type)}
              </span>
              {conn.evidence_strength && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    color: EVIDENCE_STRENGTH_COLORS[conn.evidence_strength] ?? '#6B7280',
                    backgroundColor: `${EVIDENCE_STRENGTH_COLORS[conn.evidence_strength] ?? '#6B7280'}15`,
                  }}
                >
                  {formatLabel(conn.evidence_strength)}
                </span>
              )}
            </div>

            {/* Description */}
            {conn.description && (
              <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                {conn.description}
              </p>
            )}

            {/* Date range */}
            {(conn.start_date || conn.end_date) && (
              <p className="text-xs text-text-muted mt-2">
                {conn.start_date ? formatFullDate(conn.start_date) : '?'}
                {' — '}
                {conn.end_date ? formatFullDate(conn.end_date) : 'present'}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------
// Empty state
// -------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  )
}
