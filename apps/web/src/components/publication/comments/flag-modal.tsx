'use client'

import { useState } from 'react'
import type { CommentFlagReason } from '@efta/shared'

interface FlagModalProps {
  commentId: string
  onSubmit: (commentId: string, reason: CommentFlagReason, description: string | null) => Promise<void>
  onClose: () => void
}

const FLAG_REASONS: { value: CommentFlagReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'off_topic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
]

export function FlagModal({ commentId, onSubmit, onClose }: FlagModalProps) {
  const [reason, setReason] = useState<CommentFlagReason | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(commentId, reason, description.trim() || null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit flag')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
      <div className="bg-surface border border-border-default shadow-lg w-full max-w-md mx-4 p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-1">
          Flag Comment
        </h3>
        <p className="font-body text-xs text-text-muted mb-4">
          Help us maintain the quality of discussion.
        </p>

        <div className="space-y-2 mb-4">
          {FLAG_REASONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="flag-reason"
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-accent-red"
              />
              <span className="font-body text-sm text-text-secondary">{label}</span>
            </label>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional context (optional)"
          maxLength={500}
          className="w-full p-2 bg-surface border border-border-default text-text-primary font-body text-sm resize-none focus:outline-none focus:border-accent-gold/60 placeholder:text-text-muted/60"
          rows={2}
        />

        {error && (
          <p className="mt-2 font-body text-xs text-accent-red">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="font-mono text-[10px] uppercase tracking-wider px-4 py-1.5 bg-accent-red text-surface hover:bg-accent-red/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Flag'}
          </button>
        </div>
      </div>
    </div>
  )
}
