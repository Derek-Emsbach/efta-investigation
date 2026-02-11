'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

type CustomTextRenderer = (props: { str: string; itemIndex: number }) => string

// Configure PDF.js worker — use CDN for Turbopack compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

export interface Annotation {
  type: 'entity' | 'highlight' | 'navigate'
  text?: string
  tier?: number
  page?: number
  color?: string
}

interface PdfViewerProps {
  fileUrl: string
  annotations: Annotation[]
  currentPage?: number
  onPageChange?: (page: number) => void
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

export default function PdfViewer({
  fileUrl,
  annotations,
  currentPage,
  onPageChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState<string>('1')

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

  return (
    <div className="flex h-full flex-col">
      {/* Navigation bar */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface px-3 py-1.5">
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
            width={Math.min(800, typeof window !== 'undefined' ? window.innerWidth - 400 : 800)}
          />
        </Document>
      </div>
    </div>
  )
}
