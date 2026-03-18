'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'

interface TagRecord {
  id: string
  image_id: string
  entity_id: string
  role: string
  confidence: string
  created_at: string
  document_images: {
    id: string
    image_type: string
    caption: string | null
    r2_key: string
    metadata: Record<string, unknown>
    documents: { bates_number: string; title: string | null } | null
  } | null
  entities: { id: string; name: string; tier: number; slug: string } | null
}

const CONFIDENCE_COLORS: Record<string, string> = {
  possible: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  likely: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  confirmed: 'text-green-400 bg-green-400/10 border-green-400/30',
}

const ROLE_LABELS: Record<string, string> = {
  mentioned: 'Text mention',
  background: 'Background',
  subject: 'Subject',
}

export default function ImageTagReviewPage() {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/images/entity-tags?page=${page}&limit=40&role=mentioned&confidence=possible`)
    if (res.ok) {
      const json = await res.json()
      setTags(json.data ?? [])
      setTotal(json.count ?? 0)
    }
    setLoading(false)
  }, [page])

  useEffect(() => { fetchTags() }, [fetchTags])

  async function handleConfirm(tag: TagRecord) {
    setActionLoading(tag.id)
    await fetch('/api/images/entity-tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, role: 'subject', confidence: 'confirmed' }),
    })
    setTags(prev => prev.filter(t => t.id !== tag.id))
    setTotal(prev => prev - 1)
    setActionLoading(null)
  }

  async function handleMarkMentioned(tag: TagRecord) {
    setActionLoading(tag.id)
    await fetch('/api/images/entity-tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, role: 'mentioned', confidence: 'likely' }),
    })
    setTags(prev => prev.filter(t => t.id !== tag.id))
    setTotal(prev => prev - 1)
    setActionLoading(null)
  }

  async function handleRemove(tag: TagRecord) {
    setActionLoading(tag.id)
    await fetch(`/api/images/entity-tags?id=${tag.id}`, { method: 'DELETE' })
    setTags(prev => prev.filter(t => t.id !== tag.id))
    setTotal(prev => prev - 1)
    setActionLoading(null)
  }

  const totalPages = Math.ceil(total / 40)

  return (
    <MainContent>
      <PageHeader
        title="Image Tag Review"
        subtitle={`${total} pending OCR text-mention tags to review`}
        actions={
          <Link href="/dashboard/photos" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← Back to Photos
          </Link>
        }
      />

      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span><strong className="text-text-primary">Confirm subject</strong> — entity visually appears in image</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span><strong className="text-text-primary">Mark mentioned</strong> — entity named in image text, not necessarily pictured</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span><strong className="text-text-primary">Remove</strong> — false positive / not related</span>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-text-muted py-12 text-center">Loading...</div>
      ) : tags.length === 0 ? (
        <div className="text-sm text-text-muted py-12 text-center">No pending tags to review.</div>
      ) : (
        <div className="space-y-3">
          {tags.map(tag => {
            const img = tag.document_images
            const entity = tag.entities
            const corpusAnalysis = img?.metadata?.corpus_analysis as Record<string, string> | undefined
            const bates = img?.documents?.bates_number
            const isLoading = actionLoading === tag.id

            return (
              <div
                key={tag.id}
                className="bg-elevated border border-border rounded-lg p-4 flex gap-4 items-start"
              >
                {/* Image type badge + corpus description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {/* Entity */}
                    {entity && (
                      <Link
                        href={`/dashboard/entities/${entity.id}`}
                        className="font-mono text-sm font-semibold text-accent-cyan hover:underline"
                      >
                        {entity.name}
                      </Link>
                    )}
                    <span className="text-text-muted text-xs">→ mentioned in</span>
                    {/* Image type */}
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-text-muted">
                      {img?.image_type ?? 'unknown'}
                    </span>
                    {/* Role badge */}
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${CONFIDENCE_COLORS[tag.confidence] ?? ''}`}>
                      {ROLE_LABELS[tag.role] ?? tag.role}
                    </span>
                    {/* Bates link */}
                    {bates && (
                      <a
                        href={`/evidence/documents/${bates}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-text-muted hover:text-accent-cyan transition-colors"
                      >
                        {bates}
                      </a>
                    )}
                  </div>

                  {/* Caption */}
                  {img?.caption && (
                    <p className="text-sm text-text-primary mb-2 leading-snug">{img.caption}</p>
                  )}

                  {/* Corpus people + notable */}
                  {corpusAnalysis && (
                    <div className="space-y-1 text-xs text-text-muted font-mono">
                      {corpusAnalysis.people && !/no (visible |people|person)/i.test(corpusAnalysis.people) && (
                        <p><span className="text-text-secondary">PEOPLE:</span> {corpusAnalysis.people.slice(0, 200)}</p>
                      )}
                      {corpusAnalysis.text_content && (
                        <p><span className="text-text-secondary">TEXT:</span> {corpusAnalysis.text_content.slice(0, 300)}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleConfirm(tag)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-mono rounded border border-green-400/40 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-40"
                  >
                    ✓ Subject
                  </button>
                  <button
                    onClick={() => handleMarkMentioned(tag)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-mono rounded border border-blue-400/40 text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-40"
                  >
                    ~ Mentioned
                  </button>
                  <button
                    onClick={() => handleRemove(tag)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-mono rounded border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    ✗ Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded border border-border text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border border-border text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </MainContent>
  )
}
