import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { REDACTION_CATEGORIES } from '@efta/shared'
import type { Metadata } from 'next'
import DocumentImagesStrip from '@/components/images/document-images-strip'
import TextExcerpt from './text-excerpt'
import ViewDocumentButton from './view-document-button'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// --- Helpers ---

const TYPE_COLORS: Record<string, string> = {
  email: '#60a5fa',
  fbi_302: '#e63950',
  financial: '#34d399',
  photo: '#a78bfa',
  memo: '#f59e0b',
  prosecution_memo: '#e63950',
  court_filing: '#60a5fa',
  victim_journal: '#e63950',
  senate_letter: '#60a5fa',
  legal_report: '#3b82f6',
  call_notes: '#f59e0b',
}

const SEVERITY_COLORS: Record<string, string> = {
  extreme_critical: '#e63950',
  critical: '#f59e0b',
  high: '#60a5fa',
  routine: '#6b7585',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- Data fetching ---

async function fetchDocument(bates: string) {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, dataset:datasets(id, name, number)')
    .eq('bates_number', bates)
    .single()

  if (error || !doc) return null

  const [entitiesResult, eventsResult, imagesResult, citationsResult, redactionsResult] =
    await Promise.all([
      supabase
        .from('entity_documents')
        .select('role_in_document, excerpt, page_number, entity:entities(id, name, slug, tier, category, profile_published)')
        .eq('document_id', doc.id),
      supabase
        .from('event_documents')
        .select('event:events(id, date, title, event_type, significance)')
        .eq('document_id', doc.id),
      supabase
        .from('document_images')
        .select('*')
        .eq('document_id', doc.id)
        .order('page_number', { ascending: true }),
      supabase
        .from('story_citations')
        .select('citation_number, description, page_reference, story:stories(slug, title, section, is_published)')
        .eq('document_id', doc.id),
      supabase
        .from('redactions')
        .select('category, suspect_flag')
        .eq('document_id', doc.id),
    ])

  // Filter entities to published only
  const entities = (entitiesResult.data ?? [])
    .filter((ed: Record<string, unknown>) => {
      const entity = ed.entity as Record<string, unknown> | null
      return entity?.profile_published === true
    })
    .map((ed: Record<string, unknown>) => {
      const entity = ed.entity as Record<string, unknown>
      return {
        id: entity.id as string,
        name: entity.name as string,
        slug: entity.slug as string,
        tier: entity.tier as number,
        category: entity.category as string | null,
        role_in_document: ed.role_in_document as string | null,
        excerpt: ed.excerpt as string | null,
        page_number: ed.page_number as number | null,
      }
    })

  // Events sorted by date
  const events = (eventsResult.data ?? [])
    .map((ed: Record<string, unknown>) => ed.event as Record<string, unknown>)
    .filter(Boolean)
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.date as string) ?? '').localeCompare((b.date as string) ?? '')
    )

  // Published story citations
  const storyCitations = (citationsResult.data ?? [])
    .filter((sc: Record<string, unknown>) => {
      const story = sc.story as Record<string, unknown> | null
      return story?.is_published === true
    })
    .map((sc: Record<string, unknown>) => {
      const story = sc.story as Record<string, unknown>
      return {
        citation_number: sc.citation_number as number,
        description: sc.description as string | null,
        page_reference: sc.page_reference as string | null,
        story: {
          slug: story.slug as string,
          title: story.title as string,
          section: story.section as string | null,
        },
      }
    })

  // Redaction summary
  const redactions = redactionsResult.data ?? []
  const byCategory: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  let suspectCount = 0
  for (const r of redactions) {
    const cat = (r as Record<string, unknown>).category as string
    if (cat && cat in byCategory) byCategory[cat]++
    if ((r as Record<string, unknown>).suspect_flag) suspectCount++
  }

  return {
    document: {
      id: doc.id as string,
      bates_number: doc.bates_number as string,
      title: doc.title as string | null,
      document_type: doc.document_type as string | null,
      original_date: doc.original_date as string | null,
      page_count: doc.page_count as number | null,
      file_size_bytes: doc.file_size_bytes as number | null,
      summary: doc.summary as string | null,
      classification: doc.classification as string | null,
      severity: doc.severity as string | null,
      flags: (doc.flags ?? []) as string[],
      text_excerpt: (doc.extracted_text as string | null)?.slice(0, 2000) ?? null,
      has_file: !!doc.file_url,
      dataset: doc.dataset as { id: string; name: string | null; number: number } | null,
    },
    entities,
    events,
    images: (imagesResult.data ?? []) as Array<Record<string, unknown>>,
    storyCitations,
    redactionSummary: { total: redactions.length, byCategory, suspectCount },
  }
}

// --- Metadata ---

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bates: string }>
}): Promise<Metadata> {
  const { bates } = await params
  return {
    title: `${bates} — Evidence Room — The Epstein Crimes`,
    description: `Document ${bates} from the EFTA disclosure corpus. View metadata, linked entities, timeline events, and redaction analysis.`,
  }
}

// --- Page ---

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ bates: string }>
}) {
  const { bates } = await params
  const data = await fetchDocument(bates)

  if (!data) notFound()

  const { document: doc, entities, events, images, storyCitations, redactionSummary } = data

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/evidence"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-text-muted hover:text-text-secondary transition-colors mb-6"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to search
      </Link>

      {/* Header */}
      <div className="border-t-2 border-critical pt-6 mb-8">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="font-mono text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            {doc.bates_number}
          </h1>
          {doc.severity && doc.severity !== 'routine' && (
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
              style={{
                color: SEVERITY_COLORS[doc.severity] ?? '#6b7585',
                backgroundColor: `${SEVERITY_COLORS[doc.severity] ?? '#6b7585'}20`,
              }}
            >
              {doc.severity === 'extreme_critical' ? 'EXTREME CRITICAL' : doc.severity}
            </span>
          )}
          {doc.document_type && (
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
              style={{
                color: TYPE_COLORS[doc.document_type] ?? '#6b7585',
                backgroundColor: `${TYPE_COLORS[doc.document_type] ?? '#6b7585'}20`,
              }}
            >
              {doc.document_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Title */}
        {doc.title && doc.title !== doc.bates_number && (
          <p className="mt-2 text-lg text-text-secondary font-body">
            {doc.title}
          </p>
        )}

        {/* Flags */}
        {doc.flags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {doc.flags.map((flag) => (
              <span
                key={flag}
                className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-critical/10 text-critical"
              >
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Metadata grid */}
      <div className="bg-surface border border-border-default rounded-lg p-6 mb-8">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Dataset</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {doc.dataset ? `Dataset ${doc.dataset.number}${doc.dataset.name ? `: ${doc.dataset.name}` : ''}` : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Type</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {doc.document_type ? doc.document_type.replace(/_/g, ' ').toUpperCase() : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Date</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {formatDate(doc.original_date)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Pages</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {doc.page_count ?? '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Classification</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {doc.classification ? doc.classification.toUpperCase() : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">File Size</dt>
            <dd className="font-mono text-sm text-text-primary mt-1">
              {formatBytes(doc.file_size_bytes)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Summary */}
      {doc.summary && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Summary
          </h2>
          <div className="bg-surface border border-border-default rounded-lg p-6">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line font-body">
              {doc.summary}
            </p>
          </div>
        </section>
      )}

      {/* Text excerpt */}
      {doc.text_excerpt && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Extracted Text
          </h2>
          <TextExcerpt text={doc.text_excerpt} />
        </section>
      )}

      {/* View document button */}
      <div className="mb-8">
        <ViewDocumentButton documentId={doc.id} hasFile={doc.has_file} />
      </div>

      {/* Linked entities */}
      {entities.length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Linked Entities
            <span className="ml-2 text-text-muted/60">{entities.length}</span>
          </h2>
          <div className="border border-border-default rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="font-mono text-[10px] text-text-muted uppercase tracking-wider px-4 py-2">Name</th>
                  <th className="font-mono text-[10px] text-text-muted uppercase tracking-wider px-4 py-2">Tier</th>
                  <th className="font-mono text-[10px] text-text-muted uppercase tracking-wider px-4 py-2">Role</th>
                  <th className="font-mono text-[10px] text-text-muted uppercase tracking-wider px-4 py-2 hidden md:table-cell">Excerpt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {entities.map((e) => (
                  <tr key={`${e.id}-${e.role_in_document}`} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/evidence/entities/${e.slug}`}
                        className="font-body text-sm text-neon-blue hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          color: e.tier <= 2 ? '#e63950' : e.tier <= 4 ? '#f59e0b' : '#6b7585',
                          backgroundColor: e.tier <= 2 ? '#e6395020' : e.tier <= 4 ? '#f59e0b20' : '#6b758520',
                        }}
                      >
                        T{e.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.role_in_document && (
                        <span className="font-mono text-[10px] text-text-secondary capitalize">
                          {e.role_in_document.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {e.excerpt && (
                        <span className="text-xs text-text-muted italic line-clamp-1">
                          &ldquo;{e.excerpt}&rdquo;
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Timeline events */}
      {events.length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Timeline Events
            <span className="ml-2 text-text-muted/60">{events.length}</span>
          </h2>
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id as string}
                className="flex items-start gap-4 px-4 py-3 border border-border-default rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
              >
                <span className="font-mono text-xs text-neon-green shrink-0 w-28">
                  {formatDate(event.date as string | null)}
                </span>
                <div className="min-w-0">
                  <span className="text-sm text-text-primary font-body">{event.title as string}</span>
                  {typeof event.event_type === 'string' && (
                    <span className="ml-2 font-mono text-[9px] text-text-muted uppercase tracking-wider">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extracted images */}
      {images.length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Extracted Images
            <span className="ml-2 text-text-muted/60">{images.length}</span>
          </h2>
          <DocumentImagesStrip
            images={images as unknown as Parameters<typeof DocumentImagesStrip>[0]['images']}
            urlPrefix="/api/public/images"
          />
        </section>
      )}

      {/* Story citations */}
      {storyCitations.length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Cited In Stories
            <span className="ml-2 text-text-muted/60">{storyCitations.length}</span>
          </h2>
          <div className="space-y-2">
            {storyCitations.map((sc) => (
              <div
                key={`${sc.story.slug}-${sc.citation_number}`}
                className="flex items-start gap-4 px-4 py-3 border border-border-default rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
              >
                <span className="font-mono text-xs font-bold text-critical shrink-0">
                  [{sc.citation_number}]
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/stories/${sc.story.slug}`}
                    className="text-sm text-neon-blue hover:underline font-body"
                  >
                    {sc.story.title}
                  </Link>
                  {sc.description && (
                    <p className="text-xs text-text-muted mt-0.5">{sc.description}</p>
                  )}
                  {sc.page_reference && (
                    <span className="font-mono text-[10px] text-text-muted">p. {sc.page_reference}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Redaction summary */}
      {redactionSummary.total > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
            Redaction Analysis
            <span className="ml-2 text-text-muted/60">{redactionSummary.total} total</span>
          </h2>
          <div className="bg-surface border border-border-default rounded-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(redactionSummary.byCategory).map(([cat, count]) => {
                const info = REDACTION_CATEGORIES[cat as keyof typeof REDACTION_CATEGORIES]
                if (!count) return null
                return (
                  <div key={cat} className="text-center">
                    <div
                      className="font-mono text-2xl font-bold"
                      style={{ color: info?.color ?? '#6b7585' }}
                    >
                      {count}
                    </div>
                    <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider mt-1">
                      Cat {cat}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {info?.label ?? 'Unknown'}
                    </div>
                  </div>
                )
              })}
            </div>
            {redactionSummary.suspectCount > 0 && (
              <div className="mt-4 pt-4 border-t border-border-default text-center">
                <span className="font-mono text-xs text-critical font-semibold">
                  {redactionSummary.suspectCount} flagged as suspect
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
