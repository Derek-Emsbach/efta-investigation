'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

type CustomTextRenderer = (props: { str: string; itemIndex: number }) => string

// Configure PDF.js worker — served from public/ for Turbopack compatibility
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface Annotation {
  type: 'entity' | 'highlight' | 'navigate'
  text?: string
  tier?: number
  page?: number
  color?: string
}

interface ImagePageInfo {
  page: number
  count: number
}

interface PdfViewerProps {
  fileUrl: string
  annotations: Annotation[]
  currentPage?: number
  onPageChange?: (page: number) => void
  onNumPagesChange?: (n: number) => void
  forensicMetadata?: Record<string, unknown> | null
}

const TIER_HIGHLIGHT_COLORS: Record<number, string> = {
  1: 'rgba(220, 38, 38, 0.25)',   // red — convicted/charged
  2: 'rgba(245, 158, 11, 0.25)',  // amber — NPA immunity
  3: 'rgba(249, 115, 22, 0.25)',  // orange — suspicious
  4: 'rgba(107, 114, 128, 0.25)', // gray — social/professional
  5: 'rgba(20, 184, 166, 0.25)',  // teal — victim/witness
  6: 'rgba(100, 116, 139, 0.25)', // slate — staff/legal
}

const NAMED_COLORS: Record<string, string> = {
  warning: 'rgba(245, 158, 11, 0.3)',
  info: 'rgba(59, 130, 246, 0.3)',
  critical: 'rgba(220, 38, 38, 0.3)',
  success: 'rgba(16, 185, 129, 0.3)',
}

function getHighlightColor(annotation: Annotation): string {
  if (annotation.tier && TIER_HIGHLIGHT_COLORS[annotation.tier]) {
    return TIER_HIGHLIGHT_COLORS[annotation.tier]
  }
  if (annotation.color && NAMED_COLORS[annotation.color]) {
    return NAMED_COLORS[annotation.color]
  }
  return 'rgba(59, 130, 246, 0.25)' // default info blue
}

/** Extract image page info from forensic metadata */
function parseImagePages(metadata: Record<string, unknown> | null | undefined): ImagePageInfo[] {
  if (!metadata) return []

  // Support multiple metadata formats from the worker
  const imagePages: ImagePageInfo[] = []

  // Format 1: { images: [{ page: 1, count: 3 }, ...] }
  if (Array.isArray(metadata.images)) {
    for (const img of metadata.images) {
      if (typeof img === 'object' && img && typeof (img as Record<string, unknown>).page === 'number') {
        const record = img as Record<string, unknown>
        imagePages.push({
          page: record.page as number,
          count: typeof record.count === 'number' ? record.count : 1,
        })
      }
    }
  }

  // Format 2: { image_pages: [1, 3, 7] }
  if (Array.isArray(metadata.image_pages)) {
    for (const p of metadata.image_pages) {
      if (typeof p === 'number' && !imagePages.some((ip) => ip.page === p)) {
        imagePages.push({ page: p, count: 1 })
      }
    }
  }

  // Format 3: { pages_with_images: { "1": 3, "3": 1 } }
  if (metadata.pages_with_images && typeof metadata.pages_with_images === 'object') {
    const pwi = metadata.pages_with_images as Record<string, unknown>
    for (const [pageStr, count] of Object.entries(pwi)) {
      const page = parseInt(pageStr, 10)
      if (!isNaN(page) && !imagePages.some((ip) => ip.page === page)) {
        imagePages.push({ page, count: typeof count === 'number' ? count : 1 })
      }
    }
  }

  return imagePages.sort((a, b) => a.page - b.page)
}

export default function PdfViewer({
  fileUrl,
  annotations,
  currentPage,
  onPageChange,
  onNumPagesChange,
  forensicMetadata,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState<string>('1')
  const [showImageDropdown, setShowImageDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const imageDropdownRef = useRef<HTMLDivElement>(null)

  // Parse image pages from forensic metadata
  const imagePages = useMemo(() => parseImagePages(forensicMetadata), [forensicMetadata])

  // Track container width for responsive PDF rendering
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Close image dropdown on click outside
  useEffect(() => {
    if (!showImageDropdown) return
    function handleClick(e: MouseEvent) {
      if (imageDropdownRef.current && !imageDropdownRef.current.contains(e.target as Node)) {
        setShowImageDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showImageDropdown])

  // Sync with external page navigation (from Archer)
  useEffect(() => {
    if (currentPage && currentPage >= 1 && currentPage <= numPages) {
      setPageNumber(currentPage)
      setPageInput(String(currentPage))
    }
  }, [currentPage, numPages])

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
    setLoadError(null)
    onNumPagesChange?.(n)
  }

  function onDocumentLoadError(error: Error) {
    setLoadError(error.message)
  }

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, numPages))
    setPageNumber(clamped)
    setPageInput(String(clamped))
    onPageChange?.(clamped)
  }

  function handlePageInputSubmit() {
    const parsed = parseInt(pageInput, 10)
    if (!isNaN(parsed)) {
      goToPage(parsed)
    } else {
      setPageInput(String(pageNumber))
    }
  }

  // Build text renderer that highlights annotations on the current page
  const pageAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => a.text && (a.type === 'entity' || a.type === 'highlight') && (!a.page || a.page === pageNumber),
      ),
    [annotations, pageNumber],
  )

  const customTextRenderer: CustomTextRenderer = useCallback(
    ({ str }: { str: string; itemIndex: number }) => {
      if (pageAnnotations.length === 0) return str

      let result = str
      for (const annotation of pageAnnotations) {
        if (!annotation.text) continue
        try {
          const escaped = annotation.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(${escaped})`, 'gi')
          const color = getHighlightColor(annotation)
          result = result.replace(
            regex,
            `<mark style="background-color: ${color}; border-radius: 2px; padding: 0 1px;">$1</mark>`,
          )
        } catch {
          // Invalid regex, skip this annotation
        }
      }
      return result
    },
    [pageAnnotations],
  )

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p className="text-sm">Failed to load PDF</p>
        <p className="text-xs">{loadError}</p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-info underline"
        >
          Open in new tab
        </a>
      </div>
    )
  }

  // Compute page width — leave some padding for scroll area
  const pageWidth = Math.min(containerWidth - 32, 1200)

  return (
    <div className="flex h-full flex-col" ref={containerRef}>
      {/* Navigation bar */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            className="rounded p-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-secondary disabled:opacity-30"
            aria-label="Previous page"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handlePageInputSubmit()}
              className="w-10 rounded border border-border-default bg-elevated px-1.5 py-0.5 text-center text-xs text-text-primary"
              aria-label="Page number"
            />
            <span>of {numPages || '...'}</span>
          </div>

          <button
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= numPages}
            className="rounded p-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-secondary disabled:opacity-30"
            aria-label="Next page"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {pageAnnotations.length > 0 && (
            <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] font-medium text-info">
              {pageAnnotations.length} highlight{pageAnnotations.length !== 1 ? 's' : ''}
            </span>
          )}

          {/* Image navigation dropdown */}
          {imagePages.length > 0 && (
            <div className="relative" ref={imageDropdownRef}>
              <button
                onClick={() => setShowImageDropdown(!showImageDropdown)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showImageDropdown
                    ? 'bg-warning/20 text-warning'
                    : 'bg-warning/10 text-warning hover:bg-warning/20'
                }`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Images ({imagePages.length})
              </button>

              {showImageDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border-default bg-surface shadow-lg overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-border-default">
                    <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                      Pages with images
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {imagePages.map((ip) => (
                      <button
                        key={ip.page}
                        onClick={() => {
                          goToPage(ip.page)
                          setShowImageDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                          ip.page === pageNumber
                            ? 'bg-info/5 text-info'
                            : 'text-text-secondary hover:bg-elevated'
                        }`}
                      >
                        <span>Page {ip.page}</span>
                        <span className="text-[10px] text-text-muted">
                          {ip.count} image{ip.count !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-secondary"
            title="Open in new tab"
            aria-label="Open PDF in new tab"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {/* PDF rendering area */}
      <div className="flex-1 overflow-auto bg-elevated/50">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex h-full items-center justify-center py-20">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading PDF...
              </div>
            </div>
          }
          className="flex justify-center py-2"
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            customTextRenderer={customTextRenderer}
            className="shadow-lg"
            width={pageWidth}
          />
        </Document>
      </div>
    </div>
  )
}
