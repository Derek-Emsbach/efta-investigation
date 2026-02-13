'use client'

import { useState } from 'react'
import type { DocumentImage } from '@efta/shared'
import ImageLightbox from './image-lightbox'

// Extended image with optional document join
export interface GalleryImage extends DocumentImage {
  documents?: {
    id: string
    bates_number: string | null
    title: string | null
    dataset_id: string | null
  } | null
}

interface ImageGalleryProps {
  images: GalleryImage[]
  loading?: boolean
}

export default function ImageGallery({ images, loading }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded border border-border-default bg-elevated skeleton-shimmer"
          />
        ))}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg
          className="w-12 h-12 text-text-muted mb-4"
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
        <p className="text-sm text-text-muted">
          No images extracted yet. Process documents to build the photo album.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative flex flex-col rounded border border-border-default bg-surface overflow-hidden hover:border-border-light transition-all duration-200 text-left"
          >
            {/* Thumbnail */}
            <div className="relative aspect-square bg-background overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/images/${img.id}/thumbnail`}
                alt={img.caption ?? `Image from page ${img.page_number + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              {/* Redacted badge */}
              {img.is_redacted && (
                <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-critical/90 text-white uppercase tracking-wider">
                  Redacted
                </span>
              )}
              {/* Type badge */}
              {img.image_type && img.image_type !== 'embedded' && img.image_type !== 'unknown' && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface/80 text-text-secondary capitalize backdrop-blur-sm">
                  {img.image_type}
                </span>
              )}
            </div>

            {/* Metadata strip */}
            <div className="px-2 py-1.5 border-t border-border-default">
              <p className="font-mono text-[10px] text-text-muted truncate">
                {img.documents?.bates_number ?? 'No Bates #'}
              </p>
              <p className="text-[10px] text-text-muted">
                p.{img.page_number + 1}
                {img.width && img.height && (
                  <span className="ml-1.5 text-text-muted/60">
                    {img.width}&times;{img.height}
                  </span>
                )}
              </p>
            </div>

            {/* Tags */}
            {img.tags.length > 0 && (
              <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                {img.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-medium px-1 py-0.5 rounded bg-info/10 text-info"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
