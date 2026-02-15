'use client'

import { useState, useEffect, useCallback } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import ImageGallery from '@/components/images/image-gallery'
import type { GalleryImage } from '@/components/images/image-gallery'
import type { ImageType } from '@efta/shared'

const IMAGE_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'photo', label: 'Photos' },
  { value: 'graphic', label: 'Graphics' },
  { value: 'signature', label: 'Signatures' },
  { value: 'map', label: 'Maps' },
  { value: 'chart', label: 'Charts' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'unknown', label: 'Unknown' },
]

const PAGE_SIZE = 40

export default function PhotosPage() {
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
      const res = await fetch(`/api/images?${params}`)
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

  return (
    <MainContent>
      <PageHeader
        title="Photo Album"
        subtitle={`${totalCount.toLocaleString()} extracted images from processed documents`}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Image type filter */}
        <select
          value={imageType}
          onChange={(e) => setImageType(e.target.value)}
          className="text-sm bg-surface border border-border-default rounded px-3 py-1.5 text-text-primary focus:border-info focus:outline-none"
        >
          {IMAGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Tag filter */}
        <input
          type="text"
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="text-sm bg-surface border border-border-default rounded px-3 py-1.5 text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none w-48"
        />

        {/* Active filter indicator */}
        {(imageType || tagFilter) && (
          <button
            onClick={() => {
              setImageType('')
              setTagFilter('')
            }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {!loading && images.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
            </svg>
          }
          label="Photo Album"
          title="No images extracted yet"
          description="Images are extracted during document processing. Upload and process documents to populate the photo album."
          action={{ label: 'Upload Documents', href: '/upload' }}
        />
      )}

      {/* Gallery grid */}
      {(loading || images.length > 0) && (
        <ImageGallery images={images} loading={loading} />
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
    </MainContent>
  )
}
