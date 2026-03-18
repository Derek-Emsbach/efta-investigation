'use client'

import { useState } from 'react'
import type { DocumentImage } from '@efta/shared'
import ImageLightbox from '@/components/images/image-lightbox'
import type { GalleryImage } from '@/components/images/image-gallery'

interface EntityPhotosGridProps {
  photos: DocumentImage[]
  urlPrefix?: string
}

/** Check if an image is a corpus-analysis-only record (no actual file in R2 yet) */
function isCorpusPending(img: DocumentImage): boolean {
  return img.r2_key.startsWith('corpus:pending:')
}

/** Type badge colors */
const TYPE_COLORS: Record<string, string> = {
  photo: 'bg-blue-500/10 text-blue-400',
  signature: 'bg-purple-500/10 text-purple-400',
  map: 'bg-green-500/10 text-green-400',
  chart: 'bg-orange-500/10 text-orange-400',
  graphic: 'bg-cyan-500/10 text-cyan-400',
}

/** Icons for image types (simple SVG paths) */
function TypeIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4 opacity-50'
  switch (type) {
    case 'photo':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )
    case 'signature':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 17c3.333-3 5-6 6-8s2.5-3 4-3 2 1 1 3-3.5 5.5-3.5 5.5 1 2 3 2 3.5-1 4.5-2.5" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
  }
}

/** Extract Bates number from corpus r2_key */
function extractBates(r2Key: string): string | null {
  const match = r2Key.match(/EFTA\d{8}/)
  return match ? match[0] : null
}

export function EntityPhotosGrid({ photos, urlPrefix = '/api/public/images' }: EntityPhotosGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Split into real images (R2 files) and corpus evidence (analysis-only)
  const realPhotos = photos.filter((p) => !isCorpusPending(p))
  const corpusEvidence = photos.filter((p) => isCorpusPending(p))

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted font-mono">No photos tagged for this entity</p>
      </div>
    )
  }

  const galleryImages: GalleryImage[] = realPhotos as GalleryImage[]

  return (
    <>
      {/* Real photos with thumbnails */}
      {realPhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {realPhotos.map((img, idx) => (
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
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={galleryImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          urlPrefix={urlPrefix}
          readOnly
        />
      )}

      {/* Corpus evidence cards (analysis-only, no actual image file) */}
      {corpusEvidence.length > 0 && (
        <div className="mt-6">
          {realPhotos.length > 0 && (
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
              Document imagery analysis ({corpusEvidence.length})
            </h4>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {corpusEvidence.slice(0, 50).map((img) => {
              const analysis = (img.metadata as Record<string, unknown>)?.corpus_analysis as Record<string, string> | undefined
              const bates = extractBates(img.r2_key)

              return (
                <div
                  key={img.id}
                  className="flex gap-3 rounded border border-border-default bg-surface p-3 text-left"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <TypeIcon type={img.image_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {img.image_type !== 'embedded' && img.image_type !== 'unknown' && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${TYPE_COLORS[img.image_type] ?? 'bg-surface-elevated text-text-muted'}`}>
                          {img.image_type}
                        </span>
                      )}
                      {bates && (
                        <a
                          href={`/evidence/documents/${bates}`}
                          className="text-[10px] font-mono text-text-muted hover:text-accent-gold transition-colors"
                        >
                          {bates} p.{img.page_number + 1}
                        </a>
                      )}
                    </div>
                    {img.caption && (
                      <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                        {img.caption}
                      </p>
                    )}
                    {analysis?.people && !analysis.people.toLowerCase().includes('no people') && (
                      <p className="text-[10px] text-text-muted mt-1 line-clamp-2">
                        {analysis.people}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {corpusEvidence.length > 50 && (
            <p className="text-[10px] font-mono text-text-muted mt-3 text-center">
              + {corpusEvidence.length - 50} more document images
            </p>
          )}
        </div>
      )}
    </>
  )
}
