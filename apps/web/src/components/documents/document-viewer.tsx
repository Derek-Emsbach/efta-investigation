'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type ViewMode = 'text' | 'pdf'
type PdfLoadState = 'loading' | 'loaded' | 'error'

interface DocumentViewerProps {
  extractedText: string | null
  fileUrl: string | null
  batesNumber: string | null
  pageCount: number | null
  forensicMetadata: Record<string, unknown>
}

export default function DocumentViewer({
  extractedText,
  fileUrl,
  batesNumber,
  pageCount,
  forensicMetadata,
}: DocumentViewerProps) {
  const hasText = extractedText && extractedText.trim().length > 0
  const hasPdf = !!fileUrl
  const defaultMode: ViewMode = hasPdf ? 'pdf' : 'text'

  const [mode, setMode] = useState<ViewMode>(defaultMode)
  const [textSearch, setTextSearch] = useState('')
  const [showForensics, setShowForensics] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [pdfState, setPdfState] = useState<PdfLoadState>('loading')
  const [pdfError, setPdfError] = useState<string | null>(null)
  const textRef = useRef<HTMLDivElement>(null)

  // Pre-check PDF availability so we can show a graceful error
  useEffect(() => {
    if (!fileUrl) return
    setPdfState('loading')
    setPdfError(null)

    fetch(fileUrl, { method: 'HEAD' }).then((res) => {
      if (res.ok) {
        setPdfState('loaded')
      } else {
        setPdfState('error')
        // Try to read the JSON error body with a GET
        fetch(fileUrl).then(r => r.json()).then((body) => {
          setPdfError(body.detail ?? body.error ?? 'File unavailable')
        }).catch(() => {
          setPdfError(`Storage returned status ${res.status}`)
        })
      }
    }).catch(() => {
      setPdfState('error')
      setPdfError('Could not connect to file storage')
    })
  }, [fileUrl])

  // Scroll to first search match
  useEffect(() => {
    if (!textSearch || !textRef.current) return
    const mark = textRef.current.querySelector('mark')
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [textSearch])

  const highlightText = useCallback(
    (text: string): React.ReactNode => {
      if (!textSearch.trim()) return text

      const parts = text.split(new RegExp(`(${escapeRegex(textSearch)})`, 'gi'))
      return parts.map((part, i) =>
        part.toLowerCase() === textSearch.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-text-primary rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )
    },
    [textSearch],
  )

  const matchCount =
    textSearch.trim() && extractedText
      ? (extractedText.match(new RegExp(escapeRegex(textSearch), 'gi')) ?? []).length
      : 0

  const forensicEntries = Object.entries(forensicMetadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )

  // No content at all
  if (!hasText && !hasPdf) {
    return (
      <div className="bg-surface border border-border-default rounded-lg">
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          <svg
            className="w-16 h-16 text-text-muted/40 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <p className="text-sm text-text-muted text-center">
            No document content available yet.
          </p>
          <p className="text-xs text-text-muted/70 text-center mt-1">
            Upload the PDF to R2 storage or run the text extraction pipeline.
          </p>
        </div>

        {/* Forensic metadata even when no content */}
        {forensicEntries.length > 0 && (
          <ForensicMetadataPanel entries={forensicEntries} />
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-2 bg-elevated/30">
        {/* Mode tabs */}
        <div className="flex items-center gap-1">
          {hasText && (
            <button
              onClick={() => setMode('text')}
              className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                mode === 'text'
                  ? 'bg-info/10 text-info'
                  : 'text-text-muted hover:text-text-secondary hover:bg-elevated'
              }`}
            >
              Extracted Text
            </button>
          )}
          {hasPdf && (
            <button
              onClick={() => setMode('pdf')}
              className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                mode === 'pdf'
                  ? 'bg-info/10 text-info'
                  : 'text-text-muted hover:text-text-secondary hover:bg-elevated'
              }`}
            >
              PDF Document
            </button>
          )}
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* Text-mode controls */}
          {mode === 'text' && hasText && (
            <>
              {/* Font size */}
              <div className="flex items-center gap-1 border-r border-border-default pr-2 mr-1">
                <button
                  onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                  className="text-text-muted hover:text-text-primary transition-colors p-0.5"
                  title="Decrease font size"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M5 12h14" />
                  </svg>
                </button>
                <span className="text-xs text-text-muted tabular-nums w-6 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                  className="text-text-muted hover:text-text-primary transition-colors p-0.5"
                  title="Increase font size"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M5 12h14M12 5v14" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  placeholder="Search text..."
                  className="bg-elevated border border-border-default rounded px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted w-40 focus:outline-none focus:border-info"
                />
                {textSearch && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                    {matchCount}
                  </span>
                )}
              </div>
            </>
          )}

          {/* PDF controls */}
          {mode === 'pdf' && hasPdf && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info hover:text-info/80 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Open in new tab
            </a>
          )}

          {/* Forensics toggle */}
          {forensicEntries.length > 0 && (
            <button
              onClick={() => setShowForensics(!showForensics)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded transition-colors ${
                showForensics
                  ? 'bg-info/10 text-info'
                  : 'text-text-muted hover:text-text-secondary hover:bg-elevated'
              }`}
            >
              Forensics
            </button>
          )}
        </div>
      </div>

      {/* Document info bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-elevated/20 border-b border-border-default text-xs text-text-muted">
        {batesNumber && (
          <span className="font-mono">{batesNumber}</span>
        )}
        {pageCount && (
          <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
        )}
        {mode === 'text' && hasText && (
          <span>{extractedText!.length.toLocaleString()} characters</span>
        )}
      </div>

      {/* Content area */}
      {mode === 'text' && hasText && (
        <div
          ref={textRef}
          className="overflow-auto max-h-[600px] p-6"
          style={{ fontSize: `${fontSize}px` }}
        >
          <pre className="whitespace-pre-wrap font-body text-text-secondary leading-relaxed break-words">
            {highlightText(extractedText!)}
          </pre>
        </div>
      )}

      {mode === 'pdf' && hasPdf && (
        <div className="relative bg-[#1a1a2e]">
          {pdfState === 'loading' && (
            <div className="flex items-center justify-center" style={{ height: '300px' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-info/30 border-t-info rounded-full animate-spin" />
                <span className="text-xs text-text-muted">Loading document...</span>
              </div>
            </div>
          )}
          {pdfState === 'error' && (
            <div className="flex items-center justify-center" style={{ height: '300px' }}>
              <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
                <svg
                  className="w-12 h-12 text-text-muted/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <p className="text-sm text-text-secondary font-medium">
                  PDF not available
                </p>
                <p className="text-xs text-text-muted">
                  {pdfError ?? 'The original PDF file could not be loaded from storage.'}
                </p>
                {hasText && (
                  <button
                    onClick={() => setMode('text')}
                    className="text-xs text-info hover:text-info/80 transition-colors mt-1"
                  >
                    View extracted text instead
                  </button>
                )}
              </div>
            </div>
          )}
          {pdfState === 'loaded' && (
            <object
              data={fileUrl}
              type="application/pdf"
              className="w-full"
              style={{ height: '600px' }}
            >
              <iframe
                src={fileUrl}
                className="w-full border-0"
                style={{ height: '600px' }}
                title={`PDF: ${batesNumber ?? 'Document'}`}
              />
            </object>
          )}
        </div>
      )}

      {/* Forensic metadata panel */}
      {showForensics && forensicEntries.length > 0 && (
        <ForensicMetadataPanel entries={forensicEntries} />
      )}
    </div>
  )
}

// ─── Forensic Metadata Panel ──────────────────────────────────

function ForensicMetadataPanel({
  entries,
}: {
  entries: [string, unknown][]
}) {
  return (
    <div className="border-t border-border-default px-4 py-3 bg-elevated/20">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
        Forensic Metadata
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs text-text-muted capitalize">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd className="text-xs text-text-secondary font-mono truncate" title={String(value)}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
