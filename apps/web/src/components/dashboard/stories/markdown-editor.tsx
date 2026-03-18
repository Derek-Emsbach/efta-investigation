'use client'

import { useCallback, useRef } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  wordCount: number
}

export function MarkdownEditor({ value, onChange, wordCount }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertAtCursor = useCallback((before: string, after: string = '') => {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    const newText = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newText)

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus()
      const cursorPos = start + before.length + selected.length
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }, [value, onChange])

  const toolbar = [
    { label: 'B', title: 'Bold', action: () => insertAtCursor('**', '**') },
    { label: 'I', title: 'Italic', action: () => insertAtCursor('*', '*') },
    { label: 'H2', title: 'Heading', action: () => insertAtCursor('\n## ') },
    { label: 'HR', title: 'Section Divider', action: () => insertAtCursor('\n\n---\n\n') },
    { label: 'CITE', title: 'Citation [CITE:N]', action: () => insertAtCursor('[CITE:', ']') },
    { label: 'ENT', title: 'Entity {{entity:slug}}', action: () => insertAtCursor('{{entity:', '}}') },
    { label: 'IMG', title: 'Image ![caption](url)', action: () => insertAtCursor('![', '](url)') },
    { label: 'QUOTE', title: 'Pull Quote', action: () => insertAtCursor('\n> [!quote]\n> ', '\n> \u2014 Source') },
    { label: 'FIND', title: 'Key Finding', action: () => insertAtCursor('\n> [!finding]\n> ') },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border-default bg-surface px-2 py-1.5 flex-shrink-0">
        {toolbar.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            title={item.title}
            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-text-muted hover:text-text-primary hover:bg-elevated transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        className="flex-1 resize-none bg-background p-4 font-mono text-sm text-text-primary leading-relaxed outline-none placeholder-text-muted"
        placeholder="Write your story in markdown..."
      />

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-default bg-surface px-3 py-1.5 text-[10px] font-mono text-text-muted flex-shrink-0">
        <span>{wordCount.toLocaleString()} words</span>
        <span>{Math.round(wordCount / 200)} min read</span>
      </div>
    </div>
  )
}

/**
 * Insert image markdown at the editor's cursor position.
 * Called from the image picker to embed an image into the story body.
 */
export function buildImageMarkdown(imageId: string, caption: string): string {
  return `![${caption}](/api/public/images/${imageId}/file)`
}
