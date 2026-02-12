'use client'

import { useEffect } from 'react'

interface ShortcutHelpOverlayProps {
  open: boolean
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'J', description: 'Next document in queue' },
      { key: 'K', description: 'Previous document in queue' },
      { key: '\u2190', description: 'Previous PDF page' },
      { key: '\u2192', description: 'Next PDF page' },
    ],
  },
  {
    title: 'Review Actions',
    shortcuts: [
      { key: 'A', description: 'Approve document' },
      { key: 'F', description: 'Flag for attention' },
      { key: 'R', description: 'Reject document' },
    ],
  },
  {
    title: 'View Controls',
    shortcuts: [
      { key: 'Q', description: 'Toggle queue panel' },
      { key: 'E', description: 'Toggle review form' },
      { key: '?', description: 'Show this help' },
    ],
  },
]

export function ShortcutHelpOverlay({ open, onClose }: ShortcutHelpOverlayProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-default rounded-lg shadow-lg max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-default">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-elevated hover:text-text-secondary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sections */}
        <div className="px-5 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-text-secondary">{shortcut.description}</span>
                    <kbd className="bg-elevated border border-border-default rounded px-2 py-0.5 font-mono text-xs text-text-primary min-w-[28px] text-center">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-default">
          <p className="text-[10px] text-text-muted">
            Shortcuts are disabled when typing in form fields
          </p>
        </div>
      </div>
    </div>
  )
}
