import Link from 'next/link'
import { notFound } from 'next/navigation'
import MainContent from '@/components/layout/main-content'
import Breadcrumbs from '@/components/ui/breadcrumbs'
import DocumentViewer from '@/components/documents/document-viewer'
import { SeverityMarker } from '@/components/ui/severity-marker'
import { EvidenceStrength } from '@/components/ui/evidence-strength'
import { TierBadge } from '@/components/ui/tier-badge'
import { VersionDiffAlert, VersionHistory, ReprocessButton } from '@/components/documents/version-panel'
import { createClient } from '@/lib/supabase/server'
import { REDACTION_CATEGORIES } from '@efta/shared'
import type {
  Document,
  Dataset,
  DocumentVersion,
  Entity,
  EntityDocument,
  EventDocument,
  Event,
  EvidenceItem,
  EvidenceItemStrength,
  Redaction,
  RedactionCategory,
  Severity,
  Tier,
  DocumentRole,
} from '@efta/shared'

interface DocumentWithDataset extends Document {
  dataset: Dataset | null
}

interface EntityDocumentWithEntity extends EntityDocument {
  entity: Entity
}

interface EventDocumentWithEvent extends EventDocument {
  event: Event
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function MetadataField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-xs text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-text-primary mt-0.5">
        {value !== null && value !== undefined ? String(value) : '\u2014'}
      </dd>
    </div>
  )
}

function ProcessingStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    queued: 'bg-text-muted/10 text-text-muted',
    processing: 'bg-info/10 text-info',
    extracted: 'bg-info/10 text-info',
    needs_review: 'bg-warning/10 text-warning',
    reviewed: 'bg-success/10 text-success',
    published: 'bg-success/10 text-success',
    failed: 'bg-critical/10 text-critical',
  }

  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${colorMap[status] ?? 'bg-text-muted/10 text-text-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function RoleBadge({ role }: { role: DocumentRole | null }) {
  if (!role) return null

  return (
    <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-elevated text-text-secondary capitalize">
      {role.replace(/_/g, ' ')}
    </span>
  )
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch document with all relations in parallel
  const [documentResult, entitiesResult, eventsResult, redactionsResult, evidenceResult, versionsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('*, dataset:datasets(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('entity_documents')
      .select('*, entity:entities(*)')
      .eq('document_id', id),
    supabase
      .from('event_documents')
      .select('*, event:events(*)')
      .eq('document_id', id),
    supabase
      .from('redactions')
      .select('*')
      .eq('document_id', id)
      .order('page_number', { ascending: true }),
    supabase
      .from('evidence_items')
      .select('*')
      .eq('document_id', id),
    supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', id)
      .order('version_number', { ascending: false }),
  ])

  if (documentResult.error || !documentResult.data) {
    notFound()
  }

  const document = documentResult.data as DocumentWithDataset
  const linkedEntities = (entitiesResult.data ?? []) as EntityDocumentWithEntity[]
  const linkedEvents = (eventsResult.data ?? []) as EventDocumentWithEvent[]
  const redactions = (redactionsResult.data ?? []) as Redaction[]
  const evidenceItems = (evidenceResult.data ?? []) as EvidenceItem[]
  const versions = (versionsResult.data ?? []) as DocumentVersion[]
  const versionDiff = document.forensic_metadata?.version_diff as Record<string, unknown> | undefined

  return (
    <MainContent>
      <Breadcrumbs current={document.bates_number ?? document.title ?? undefined} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <h1 className="font-mono text-2xl font-bold text-text-primary">
          {document.bates_number ?? 'Untitled Document'}
        </h1>
        {document.current_version > 1 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/25">
            v{document.current_version}
          </span>
        )}
        {document.severity && <SeverityMarker severity={document.severity as Severity} />}
        <div className="ml-auto">
          <ReprocessButton documentId={id} hasFileUrl={!!document.file_url} />
        </div>
      </div>

      {/* Document flags */}
      {document.flags && document.flags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {document.flags.map((flag) => (
            <span
              key={flag}
              className="text-xs font-medium px-2 py-0.5 rounded bg-critical/10 text-critical uppercase tracking-wider"
            >
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {(!document.flags || document.flags.length === 0) && <div className="mb-4" />}

      {/* Version diff alert */}
      {versionDiff && (versionDiff as { significant_findings?: unknown[] }).significant_findings?.length ? (
        <VersionDiffAlert diff={versionDiff as Parameters<typeof VersionDiffAlert>[0]['diff']} />
      ) : null}

      {/* Metadata grid */}
      <div className="bg-surface border border-border-default rounded-lg p-6 mb-8">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <MetadataField
            label="Dataset"
            value={
              document.dataset
                ? `Dataset ${document.dataset.number}${document.dataset.name ? `: ${document.dataset.name}` : ''}`
                : null
            }
          />
          <MetadataField
            label="Document Type"
            value={document.document_type ? document.document_type.replace(/_/g, ' ').toUpperCase() : null}
          />
          <MetadataField label="Original Date" value={formatDate(document.original_date)} />
          <MetadataField label="Page Count" value={document.page_count} />
          <MetadataField
            label="Classification"
            value={document.classification ? document.classification.toUpperCase() : null}
          />
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">Processing Status</dt>
            <dd className="mt-1">
              <ProcessingStatusBadge status={document.processing_status} />
            </dd>
          </div>
        </dl>
      </div>

      {/* Version History */}
      {versions.length > 0 && (
        <VersionHistory versions={versions} />
      )}

      {/* Summary */}
      {document.summary && (
        <section className="mb-8">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Summary
          </h3>
          <div className="bg-surface border border-border-default rounded-lg p-6">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {document.summary}
            </p>
          </div>
        </section>
      )}

      {/* Document Viewer */}
      <section className="mb-8">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
          Document Viewer
        </h3>
        <DocumentViewer
          extractedText={document.extracted_text}
          fileUrl={document.file_url ? `/api/documents/${id}/file` : null}
          batesNumber={document.bates_number}
          pageCount={document.page_count}
          forensicMetadata={document.forensic_metadata}
        />
      </section>

      {/* Linked Entities */}
      {linkedEntities.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Entities in this Document ({linkedEntities.length})
          </h3>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {linkedEntities.map((ed) => (
              <Link
                key={ed.id}
                href={`/entities/${ed.entity.id}`}
                className="block px-5 py-3.5 hover:bg-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display font-medium text-text-primary text-sm">
                    {ed.entity.name}
                  </span>
                  {ed.entity.tier && <TierBadge tier={ed.entity.tier as Tier} />}
                  <RoleBadge role={ed.role_in_document} />
                </div>
                {ed.excerpt && (
                  <p className="text-xs text-text-muted mt-1 italic line-clamp-2">
                    &ldquo;{ed.excerpt}&rdquo;
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Source for Events */}
      {linkedEvents.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Referenced in Events
          </h3>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {linkedEvents.map((ed) => (
              <div
                key={ed.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                {ed.event.date && (
                  <span className="text-xs font-mono text-text-muted shrink-0">
                    {formatDate(ed.event.date)}
                  </span>
                )}
                <span className="text-sm text-text-primary">{ed.event.title}</span>
                {ed.event.event_type && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-elevated text-text-secondary uppercase tracking-wider ml-auto shrink-0">
                    {ed.event.event_type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evidence Items */}
      {evidenceItems.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Evidence Items ({evidenceItems.length})
          </h3>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {evidenceItems.map((item) => (
              <div key={item.id} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-relaxed">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {item.evidence_type && (
                        <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                          {item.evidence_type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {item.category && (
                        <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded capitalize">
                          {item.category}
                        </span>
                      )}
                      {item.date && (
                        <span className="text-xs text-text-muted">{formatDate(item.date)}</span>
                      )}
                    </div>
                  </div>
                  {item.strength && (
                    <div className="shrink-0">
                      <EvidenceStrength strength={item.strength as EvidenceItemStrength} showLabel />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Redactions */}
      {redactions.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Redactions ({redactions.length})
          </h3>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {redactions.map((redaction) => {
              const catConfig = redaction.category
                ? REDACTION_CATEGORIES[redaction.category as RedactionCategory]
                : null

              return (
                <div key={redaction.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {redaction.category && catConfig && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: catConfig.color,
                          backgroundColor: `${catConfig.color}15`,
                        }}
                      >
                        CAT {redaction.category} &middot; {catConfig.label}
                      </span>
                    )}
                    {redaction.page_number !== null && (
                      <span className="text-xs text-text-muted font-mono">
                        Page {redaction.page_number}
                      </span>
                    )}
                    {redaction.is_suspect && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-critical/10 text-critical">
                        SUSPECT
                      </span>
                    )}
                    {redaction.assessment && (
                      <span className="text-xs text-text-muted ml-auto capitalize">
                        {redaction.assessment.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {redaction.description && (
                    <p className="text-sm text-text-secondary mt-1.5">{redaction.description}</p>
                  )}
                  {redaction.red_flags && redaction.red_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {redaction.red_flags.map((flag) => (
                        <span
                          key={flag}
                          className="text-xs px-1.5 py-0.5 rounded bg-critical/10 text-critical"
                        >
                          {flag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </MainContent>
  )
}
