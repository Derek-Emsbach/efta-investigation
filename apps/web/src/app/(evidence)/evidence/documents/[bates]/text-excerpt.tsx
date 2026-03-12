'use client'

import { useState } from 'react'

const PREVIEW_LENGTH = 500

export default function TextExcerpt({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > PREVIEW_LENGTH

  return (
    <div className="bg-surface border border-border-default rounded-lg p-6">
      <pre className="font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
        {expanded || !needsTruncation ? text : `${text.slice(0, PREVIEW_LENGTH)}…`}
      </pre>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 font-mono text-xs text-critical hover:text-critical/80 transition-colors"
        >
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
    </div>
  )
}
