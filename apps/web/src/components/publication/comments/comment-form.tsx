'use client'

import { useState } from 'react'

interface CommentFormProps {
  contentType: string
  contentId: string
  parentId?: string | null
  replyingTo?: string | null
  onSubmit: (body: string, parentId: string | null) => Promise<void>
  onCancelReply?: () => void
}

const MAX_LENGTH = 2000

export function CommentForm({
  contentType: _contentType,
  contentId: _contentId,
  parentId = null,
  replyingTo = null,
  onSubmit,
  onCancelReply,
}: CommentFormProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = body.trim()
  const charCount = trimmed.length

  const handleSubmit = async () => {
    if (!trimmed || charCount > MAX_LENGTH || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed, parentId)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${parentId ? 'ml-8 pl-4 border-l-2 border-border-default' : ''}`}>
      {replyingTo && (
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] text-text-muted">
            Replying to {replyingTo}
          </span>
          {onCancelReply && (
            <button
              onClick={onCancelReply}
              className="font-mono text-[10px] text-accent-red hover:text-accent-red/80"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? 'Write a reply...' : 'Add to the discussion...'}
        maxLength={MAX_LENGTH + 100}
        className="w-full p-3 bg-surface border border-border-default text-text-primary font-body text-sm resize-none focus:outline-none focus:border-accent-gold/60 placeholder:text-text-muted/60"
        rows={parentId ? 2 : 3}
      />

      <div className="flex items-center justify-between mt-1.5">
        <span className={`font-mono text-[10px] ${charCount > MAX_LENGTH ? 'text-accent-red' : 'text-text-muted'}`}>
          {charCount > 0 && `${charCount}/${MAX_LENGTH}`}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!trimmed || charCount > MAX_LENGTH || submitting}
          className="font-mono text-[10px] uppercase tracking-wider px-4 py-1.5 bg-ink text-surface hover:bg-ink/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Posting...' : parentId ? 'Reply' : 'Post Comment'}
        </button>
      </div>

      {error && (
        <p className="mt-1 font-body text-xs text-accent-red">{error}</p>
      )}
    </div>
  )
}
