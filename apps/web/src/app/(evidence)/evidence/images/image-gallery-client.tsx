'use client'

import { useState, useEffect, useCallback } from 'react'
import ImageGallery from '@/components/images/image-gallery'
import type { GalleryImage } from '@/components/images/image-gallery'

const IMAGE_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'photo', label: 'Photos' },
  { value: 'graphic', label: 'Graphics' },
  { value: 'signature', label: 'Signatures' },
  { value: 'map', label: 'Maps' },
  { value: 'chart', label: 'Charts' },
  { value: 'embedded', label: 'Embedded' },
]

const PAGE_SIZE = 40

export function ImageGalleryClient() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)

  // Filters
  const [imageType, setImageType] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const fetchImages = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    })
    if (imageType) params.set('image_type', imageType)
    if (tagFilter.trim()) params.set('tag', tagFilter.trim())

    try {
      const res = await fetch(`/api/public/images?${params}`)
      if (!res.ok) throw new Error('Failed to fetch images')
      const json = await res.json()
      setImages(json.data ?? [])
      setTotalCount(json.count ?? 0)
    } catch {
      setImages([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, imageType, tagFilter])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [imageType, tagFilter])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasActiveFilters = !!(imageType || tagFilter)

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Document Images
        </h1>
        <p className="text-sm text-text-muted font-mono mt-1">
          {totalCount.toLocaleString()} images extracted from EFTA document releases
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={imageType}
          onChange={(e) => setImageType(e.target.value)}
          className="text-sm bg-surface border border-border-default rounded px-3 py-1.5 text-text-primary focus:border-critical focus:outline-none"
        >
          {IMAGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="text-sm bg-surface border border-border-default rounded px-3 py-1.5 text-text-primary placeholder:text-text-muted focus:border-critical focus:outline-none w-48"
        />

        {hasActiveFilters && (
          <button
            onClick={() => { setImageType(''); setTagFilter('') }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {!loading && images.length === 0 && (
        <div className="text-center py-20">
          <svg
            className="w-12 h-12 text-text-muted mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-sm text-text-muted font-mono">
            {hasActiveFilters ? 'No images match your filters' : 'No images extracted yet'}
          </p>
        </div>
      )}

      {/* Gallery */}
      {(loading || images.length > 0) && (
        <ImageGallery
          images={images}
          loading={loading}
          urlPrefix="/api/public/images"
          readOnly
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-default">
          <p className="text-xs text-text-muted font-mono">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of{' '}
            {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 rounded border border-border-default bg-surface text-text-secondary hover:text-text-primary hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-text-muted px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm px-3 py-1.5 rounded border border-border-default bg-surface text-text-secondary hover:text-text-primary hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
