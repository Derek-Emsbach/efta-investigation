'use client'

import { useCallback, useEffect, useState } from 'react'

interface RelevantImage {
  id: string
  document_id: string
  page_number: number
  r2_key: string
  thumbnail_r2_key: string | null
  width: number | null
  height: number | null
  image_type: string
  tags: string[]
  caption: string | null
  is_redacted: boolean
  entity_tags: Array<{ name: string; slug: string; tier: number }>
  document: { bates_number: string | null; title: string | null } | null
  is_direct_match: boolean
}

interface ImagePickerProps {
  storyId: string
  onClose: () => void
  onSetHero: (imageId: string, caption: string) => void
  onInsertInline: (imageId: string, caption: string) => void
}

const IMAGE_TYPES = ['photo', 'graphic', 'map', 'chart']

export function ImagePicker({ storyId, onClose, onSetHero, onInsertInline }: ImagePickerProps) {
  const [images, setImages] = useState<RelevantImage[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('')

  const fetchImages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '40' })
      if (typeFilter) params.set('image_type', typeFilter)

      const res = await fetch(`/api/stories/${storyId}/relevant-images?${params}`)
      if (!res.ok) throw new Error('Failed to fetch images')
      const data = await res.json()
      setImages(data.images ?? [])
      setTotal(data.count ?? 0)
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [storyId, page, typeFilter])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const thumbnailUrl = (img: RelevantImage) => {
    return `/api/public/images/${img.id}/thumbnail`
  }

  const totalPages = Math.ceil(total / 40)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-border-default bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div>
            <h2 className="font-mono text-sm font-bold text-text-primary">Browse Corpus Images</h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              Images from documents linked to this story&apos;s entities
              {total > 0 && ` \u2014 ${total} available`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-border-default px-4 py-2">
          <label className="text-[10px] text-text-muted font-mono">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="rounded border border-border-default bg-elevated px-2 py-0.5 text-[10px] text-text-primary outline-none"
          >
            <option value="">All</option>
            {IMAGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-critical" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <p className="text-sm">No relevant images found</p>
              <p className="text-xs mt-1">Try changing the type filter or adding entity-image links</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img) => (
                <ImageCard
                  key={img.id}
                  image={img}
                  thumbnailUrl={thumbnailUrl(img)}
                  onSetHero={() => onSetHero(img.id, img.caption ?? '')}
                  onInsertInline={() => onInsertInline(img.id, img.caption ?? '')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-border-default px-4 py-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded px-2 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-[10px] font-mono text-text-muted">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded px-2 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ImageCard({
  image,
  thumbnailUrl,
  onSetHero,
  onInsertInline,
}: {
  image: RelevantImage
  thumbnailUrl: string
  onSetHero: () => void
  onInsertInline: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="group relative rounded border border-border-default bg-surface overflow-hidden"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-elevated">
        <img
          src={thumbnailUrl}
          alt={image.caption ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div className="p-2 space-y-1">
        {/* Type badge */}
        <div className="flex items-center gap-1">
          <span className="rounded bg-elevated px-1 py-0.5 text-[8px] font-mono uppercase text-text-muted">
            {image.image_type}
          </span>
          {image.is_direct_match && (
            <span className="rounded bg-success/20 px-1 py-0.5 text-[8px] font-mono text-success">
              tagged
            </span>
          )}
        </div>

        {/* Bates */}
        {image.document?.bates_number && (
          <p className="text-[9px] font-mono text-text-muted truncate">
            {image.document.bates_number}
          </p>
        )}

        {/* Entity tags */}
        {image.entity_tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {image.entity_tags.slice(0, 3).map((e) => (
              <span key={e.slug} className="text-[8px] text-text-secondary">
                {e.name.split(' ').pop()}
              </span>
            ))}
          </div>
        )}

        {/* Caption preview */}
        {image.caption && (
          <p className="text-[8px] text-text-muted line-clamp-2 italic">{image.caption}</p>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
          <button
            onClick={onSetHero}
            className="rounded bg-critical px-3 py-1 text-[10px] font-mono font-bold text-white hover:bg-critical/80 transition-colors"
          >
            Set as Hero
          </button>
          <button
            onClick={onInsertInline}
            className="rounded bg-white/20 px-3 py-1 text-[10px] font-mono text-white hover:bg-white/30 transition-colors"
          >
            Insert Inline
          </button>
        </div>
      )}
    </div>
  )
}
