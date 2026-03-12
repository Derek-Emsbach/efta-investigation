'use client'

import { useState } from 'react'
import type { DocumentImage } from '@efta/shared'
import ImageLightbox from '@/components/images/image-lightbox'
import type { GalleryImage } from '@/components/images/image-gallery'

interface EntityPhotosGridProps {
  photos: DocumentImage[]
  urlPrefix?: string
}

export function EntityPhotosGrid({ photos, urlPrefix = '/api/public/images' }: EntityPhotosGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted font-mono">No photos tagged for this entity</p>
      </div>
    )
  }

  const galleryImages: GalleryImage[] = photos as GalleryImage[]

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative flex flex-col rounded border border-border-default bg-surface overflow-hidden hover:border-accent-gold/40 transition-all duration-200 text-left"
          >
            <div className="relative aspect-square bg-background overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${urlPrefix}/${img.id}/thumbnail`}
                alt={img.caption ?? `Page ${img.page_number + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-text-primary"
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
              {img.is_redacted && (
                <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-red/90 text-white uppercase tracking-wider">
                  Redacted
                </span>
              )}
              {img.image_type && img.image_type !== 'embedded' && img.image_type !== 'unknown' && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface/80 text-text-secondary capitalize backdrop-blur-sm">
                  {img.image_type}
                </span>
              )}
            </div>

            <div className="px-2 py-1.5 border-t border-border-default">
              {img.caption ? (
                <p className="text-[11px] text-text-secondary line-clamp-1">{img.caption}</p>
              ) : (
                <p className="text-[10px] font-mono text-text-muted">
                  p.{img.page_number + 1}
                  {img.width && img.height && (
                    <span className="ml-1.5 opacity-60">
                      {img.width}&times;{img.height}
                    </span>
                  )}
                </p>
              )}
            </div>

            {img.tags.length > 0 && (
              <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                {img.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-medium px-1 py-0.5 rounded bg-accent-gold/10 text-accent-gold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={galleryImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          urlPrefix={urlPrefix}
          readOnly
        />
      )}
    </>
  )
}
