'use client'

import { useEffect, useRef } from 'react'

interface UseReviewShortcutsOptions<T extends { id: string }> {
  documents: T[]
  selected: T | null
  selectDocument: (doc: T) => void
  currentPage: number | undefined
  setCurrentPage: (page: number | undefined) => void
  numPages: number
  handleAction: (action: 'approve' | 'flag' | 'reject', flag?: string) => Promise<void>
  toggleQueue: () => void
  formExpanded: boolean
  setFormExpanded: (v: boolean) => void
  saving: boolean
  onShowHelp: () => void
}

/**
 * Global keyboard shortcuts for the review page.
 *
 * Uses refs for mutable state to avoid re-registering the keydown
 * listener on every render — a single stable listener reads the
 * latest values through refs instead of closing over stale state.
 */
export function useReviewShortcuts<T extends { id: string }>({
  documents,
  selected,
  selectDocument,
  currentPage,
  setCurrentPage,
  numPages,
  handleAction,
  toggleQueue,
  formExpanded,
  setFormExpanded,
  saving,
  onShowHelp,
}: UseReviewShortcutsOptions<T>) {
  // Refs for values that change frequently
  const docsRef = useRef(documents)
  const selectedRef = useRef(selected)
  const currentPageRef = useRef(currentPage)
  const numPagesRef = useRef(numPages)
  const savingRef = useRef(saving)
  const formExpandedRef = useRef(formExpanded)

  // Keep refs in sync
  docsRef.current = documents
  selectedRef.current = selected
  currentPageRef.current = currentPage
  numPagesRef.current = numPages
  savingRef.current = saving
  formExpandedRef.current = formExpanded

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      const key = e.key.toLowerCase()

      switch (key) {
        // ── Navigation ──────────────────────────
        case 'j': {
          // Next document in queue
          const docs = docsRef.current
          const sel = selectedRef.current
          if (docs.length === 0) return
          if (!sel) {
            selectDocument(docs[0])
            return
          }
          const idx = docs.findIndex((d) => d.id === sel.id)
          if (idx < docs.length - 1) {
            selectDocument(docs[idx + 1])
          }
          break
        }
        case 'k': {
          // Previous document in queue
          const docs = docsRef.current
          const sel = selectedRef.current
          if (docs.length === 0 || !sel) return
          const idx = docs.findIndex((d) => d.id === sel.id)
          if (idx > 0) {
            selectDocument(docs[idx - 1])
          }
          break
        }
        case 'arrowleft': {
          // Previous PDF page
          const page = currentPageRef.current
          if (page && page > 1) {
            setCurrentPage(page - 1)
          }
          break
        }
        case 'arrowright': {
          // Next PDF page
          const page = currentPageRef.current ?? 1
          const total = numPagesRef.current
          if (page < total) {
            setCurrentPage(page + 1)
          }
          break
        }

        // ── Review Actions ──────────────────────
        case 'a': {
          if (savingRef.current || !selectedRef.current) return
          e.preventDefault()
          void handleAction('approve')
          break
        }
        case 'f': {
          if (savingRef.current || !selectedRef.current) return
          e.preventDefault()
          void handleAction('flag', 'needs_attention')
          break
        }
        case 'r': {
          if (savingRef.current || !selectedRef.current) return
          e.preventDefault()
          void handleAction('reject')
          break
        }

        // ── View Controls ───────────────────────
        case 'q': {
          toggleQueue()
          break
        }
        case 'e': {
          if (!selectedRef.current) return
          setFormExpanded(!formExpandedRef.current)
          break
        }
        case '?': {
          e.preventDefault()
          onShowHelp()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Stable callbacks only — mutable state read through refs
  }, [selectDocument, setCurrentPage, handleAction, toggleQueue, setFormExpanded, onShowHelp])
}
