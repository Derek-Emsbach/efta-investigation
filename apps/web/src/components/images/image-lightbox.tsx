'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { GalleryImage } from './image-gallery'

interface ImageLightboxProps {
  images: GalleryImage[]
  initialIndex: number
  onClose: () => void
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [loaded, setLoaded] = useState(false)

  const img = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const goNext = useCallback(() => {
    if (hasNext) {
      setLoaded(false)
      setIndex((i) => i + 1)
    }
  }, [hasNext])

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setLoaded(false)
      setIndex((i) => i - 1)
    }
  }, [hasPrev])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goNext, goPrev])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!img) return null

  const content = (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main image area */}
      <div className="relative flex-1 flex items-center justify-center min-w-0">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-mono text-xs text-text-muted bg-elevated/80 border border-border-default px-3 py-1.5 rounded-full">
          {index + 1} / {images.length}
        </div>

        {/* Prev button */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors"
            aria-label="Previous image"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Next button */}
        {hasNext && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors"
            aria-label="Next image"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        )}

        {/* The image */}
        <div className="relative max-w-[80vw] max-h-[85vh] flex items-center justify-center">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={img.id}
            src={`/api/images/${img.id}/file`}
            alt={img.caption ?? `Evidence image from page ${img.page_number + 1}`}
            className={`max-w-full max-h-[85vh] object-contain rounded transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>

      {/* Metadata sidebar */}
      <div className="relative w-72 border-l border-border-default bg-surface overflow-y-auto shrink-0 hidden lg:block">
        <div className="p-5 space-y-5">
          {/* Document link */}
          {img.documents && (
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Source Document
              </h4>
              <Link
                href={`/documents/${img.documents.id}`}
                className="font-mono text-sm text-info hover:text-info/80 transition-colors"
              >
                {img.documents.bates_number ?? 'View Document'}
              </Link>
              {img.documents.title && (
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {img.documents.title}
                </p>
              )}
            </div>
          )}

          {/* Image details */}
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
              Image Details
            </h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-xs text-text-muted">Page</dt>
                <dd className="text-xs font-mono text-text-secondary">{img.page_number + 1}</dd>
              </div>
              {img.width && img.height && (
                <div className="flex justify-between">
                  <dt className="text-xs text-text-muted">Dimensions</dt>
                  <dd className="text-xs font-mono text-text-secondary">
                    {img.width} &times; {img.height}
                  </dd>
                </div>
              )}
              {img.format && (
                <div className="flex justify-between">
                  <dt className="text-xs text-text-muted">Format</dt>
                  <dd className="text-xs font-mono text-text-secondary uppercase">{img.format}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-xs text-text-muted">File Size</dt>
                <dd className="text-xs font-mono text-text-secondary">{formatBytes(img.file_size_bytes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-text-muted">Type</dt>
                <dd className="text-xs text-text-secondary capitalize">{img.image_type}</dd>
              </div>
              {img.is_redacted && (
                <div className="flex justify-between">
                  <dt className="text-xs text-text-muted">Status</dt>
                  <dd className="text-xs font-bold text-critical uppercase">Redacted</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Caption */}
          {img.caption && (
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Caption
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed italic">
                &ldquo;{img.caption}&rdquo;
              </p>
            </div>
          )}

          {/* Tags */}
          {img.tags.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {img.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-info/10 text-info"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata extras */}
          {img.metadata && Object.keys(img.metadata).length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                Extraction Metadata
              </h4>
              <dl className="space-y-1.5">
                {img.metadata.page_coverage != null && (
                  <div className="flex justify-between">
                    <dt className="text-xs text-text-muted">Page Coverage</dt>
                    <dd className="text-xs font-mono text-text-secondary">
                      {(Number(img.metadata.page_coverage) * 100).toFixed(1)}%
                    </dd>
                  </div>
                )}
                {img.metadata.images_on_page != null && (
                  <div className="flex justify-between">
                    <dt className="text-xs text-text-muted">Images on Page</dt>
                    <dd className="text-xs font-mono text-text-secondary">
                      {String(img.metadata.images_on_page)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
