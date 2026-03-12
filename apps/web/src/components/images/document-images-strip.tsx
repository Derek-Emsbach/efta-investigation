'use client'

import { useState } from 'react'
import type { DocumentImage } from '@efta/shared'
import ImageLightbox from './image-lightbox'
import type { GalleryImage } from './image-gallery'

interface DocumentImagesStripProps {
  images: DocumentImage[]
  urlPrefix?: string
}

export default function DocumentImagesStrip({ images, urlPrefix = '/api/images' }: DocumentImagesStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Convert DocumentImage[] to GalleryImage[] (no document join needed here)
  const galleryImages: GalleryImage[] = images as GalleryImage[]

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative shrink-0 w-28 rounded border border-border-default bg-surface overflow-hidden hover:border-border-light transition-all duration-200"
          >
            <div className="relative aspect-square bg-background overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${urlPrefix}/${img.id}/thumbnail`}
                alt={img.caption ?? `Page ${img.page_number + 1}, image ${img.image_index + 1}`}
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
                <span className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded bg-critical/90 text-white uppercase">
                  Redacted
                </span>
              )}
            </div>
            <div className="px-1.5 py-1 border-t border-border-default">
              <p className="text-[10px] text-text-muted text-center">
                p.{img.page_number + 1}
              </p>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={galleryImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
