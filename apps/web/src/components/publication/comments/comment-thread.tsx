'use client'

import { useState, useCallback } from 'react'
import type {
  CommentWithAuthor,
  CommentContentType,
  CommentReactionType,
  CommentFlagReason,
  SubscriptionTier,
} from '@efta/shared'
import { CommentItem } from './comment-item'
import { CommentForm } from './comment-form'
import { FlagModal } from './flag-modal'
import { AuthGatePrompt } from './auth-gate-prompt'

interface CommentThreadProps {
  initialComments: CommentWithAuthor[]
  initialTotal: number
  contentType: CommentContentType
  contentId: string
  perPage: number
  user: {
    id: string
    tier: SubscriptionTier | null
  } | null
  currentPath: string
}

export function CommentThread({
  initialComments,
  initialTotal,
  contentType,
  contentId,
  perPage,
  user,
  currentPath,
}: CommentThreadProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [flaggingId, setFlaggingId] = useState<string | null>(null)

  const canComment = user && (user.tier === 'supporter' || user.tier === 'investigator')
  const hasMore = page * perPage < total

  const loadMore = async () => {
    if (loading) return
    setLoading(true)
    try {
      const nextPage = page + 1
      const params = new URLSearchParams({
        content_type: contentType,
        content_id: contentId,
        page: String(nextPage),
        per_page: String(perPage),
      })
      if (user) params.set('user_id', user.id)

      const res = await fetch(`/api/public/comments?${params}`)
      if (!res.ok) throw new Error('Failed to load comments')
      const data = await res.json()
      setComments((prev) => [...prev, ...data.comments])
      setTotal(data.total)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = useCallback(async (body: string, parentId: string | null) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        parent_id: parentId,
        body,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to post comment')
    }

    // Refresh the comment thread
    const params = new URLSearchParams({
      content_type: contentType,
      content_id: contentId,
      page: '1',
      per_page: String(page * perPage),
    })
    if (user) params.set('user_id', user.id)

    const refreshRes = await fetch(`/api/public/comments?${params}`)
    if (refreshRes.ok) {
      const data = await refreshRes.json()
      setComments(data.comments)
      setTotal(data.total)
    }

    setReplyTo(null)
  }, [contentType, contentId, page, perPage, user])

  const handleReact = useCallback(async (commentId: string, reactionType: CommentReactionType): Promise<boolean> => {
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, reaction_type: reactionType }),
    })

    if (!res.ok) throw new Error('Failed to react')
    const data = await res.json()
    return data.added
  }, [])

  const handleFlag = useCallback(async (commentId: string, reason: CommentFlagReason, description: string | null) => {
    const res = await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'comment',
        comment_id: commentId,
        reason,
        description,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to flag comment')
    }
  }, [])

  const handleEdit = useCallback(async (commentId: string, newBody: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newBody }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to edit comment')
    }

    // Update locally
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) return { ...c, body: newBody, updated_at: new Date().toISOString() }
        return {
          ...c,
          replies: c.replies.map((r) =>
            r.id === commentId ? { ...r, body: newBody, updated_at: new Date().toISOString() } : r,
          ),
        }
      }),
    )
  }, [])

  const handleDelete = useCallback(async (commentId: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: true }),
    })

    if (!res.ok) throw new Error('Failed to delete comment')

    // Remove locally
    setComments((prev) =>
      prev
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies.filter((r) => r.id !== commentId),
        })),
    )
    setTotal((prev) => prev - 1)
  }, [])

  return (
    <div>
      {/* Comment count */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {total === 0 ? 'No comments yet' : `${total} comment${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* New comment form or auth gate */}
      {canComment ? (
        <div className="mb-6">
          <CommentForm
            contentType={contentType}
            contentId={contentId}
            onSubmit={handleSubmit}
          />
        </div>
      ) : (
        <div className="mb-6">
          <AuthGatePrompt currentPath={currentPath} />
        </div>
      )}

      {/* Comments list */}
      <div className="divide-y divide-border-default">
        {comments.map((comment) => (
          <div key={comment.id}>
            <CommentItem
              comment={comment}
              userId={user?.id ?? null}
              onReply={(id, name) => setReplyTo({ id, name })}
              onReact={canComment ? handleReact : undefined}
              onFlag={canComment ? (id) => setFlaggingId(id) : undefined}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            {/* Inline reply form */}
            {replyTo?.id === comment.id && canComment && (
              <div className="pb-3">
                <CommentForm
                  contentType={contentType}
                  contentId={contentId}
                  parentId={comment.id}
                  replyingTo={replyTo.name}
                  onSubmit={handleSubmit}
                  onCancelReply={() => setReplyTo(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more comments'}
          </button>
        </div>
      )}

      {/* Flag modal */}
      {flaggingId && (
        <FlagModal
          commentId={flaggingId}
          onSubmit={handleFlag}
          onClose={() => setFlaggingId(null)}
        />
      )}
    </div>
  )
}
