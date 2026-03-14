'use client'

import { useEffect, useState, useCallback } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'

type Tab = 'comments' | 'inaccuracies'

interface FlaggedComment {
  id: string
  content_type: string
  content_id: string
  body: string
  flag_count: number
  is_hidden: boolean
  created_at: string
  author: { id: string; display_name: string | null; email: string | null } | null
  flags: {
    reason: string
    description: string | null
    user: { display_name: string | null } | null
    created_at: string
  }[]
}

interface InaccuracyReport {
  id: string
  content_type: string
  content_id: string
  excerpt: string | null
  description: string
  status: string
  created_at: string
  user: { display_name: string | null; email: string | null } | null
  reviewer: { display_name: string | null } | null
  reviewer_notes: string | null
  resolved_at: string | null
}

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>('comments')
  const [comments, setComments] = useState<FlaggedComment[]>([])
  const [inaccuracies, setInaccuracies] = useState<InaccuracyReport[]>([])
  const [inaccuracyFilter, setInaccuracyFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    const res = await fetch('/api/admin/moderation/comments')
    if (res.ok) {
      const data = await res.json()
      setComments(data.comments)
    }
  }, [])

  const fetchInaccuracies = useCallback(async () => {
    const res = await fetch(`/api/admin/moderation/inaccuracies?status=${inaccuracyFilter}`)
    if (res.ok) {
      const data = await res.json()
      setInaccuracies(data.flags)
    }
  }, [inaccuracyFilter])

  useEffect(() => {
    setLoading(true)
    if (tab === 'comments') {
      fetchComments().finally(() => setLoading(false))
    } else {
      fetchInaccuracies().finally(() => setLoading(false))
    }
  }, [tab, fetchComments, fetchInaccuracies])

  const handleCommentAction = async (id: string, action: 'approve' | 'hide' | 'delete') => {
    setActionLoading(id)
    try {
      await fetch(`/api/admin/moderation/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await fetchComments()
    } finally {
      setActionLoading(null)
    }
  }

  const handleInaccuracyAction = async (id: string, status: string, notes?: string) => {
    setActionLoading(id)
    try {
      await fetch(`/api/admin/moderation/inaccuracies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
      await fetchInaccuracies()
    } finally {
      setActionLoading(null)
    }
  }

  const contentTypeLabel = (type: string) => {
    switch (type) {
      case 'story': return 'Story'
      case 'case_file': return 'Case File'
      case 'entity': return 'Entity'
      default: return type
    }
  }

  return (
    <MainContent>
      <PageHeader
        title="Moderation Queue"
        subtitle="Review flagged comments and inaccuracy reports"
      />

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border-default">
        <button
          onClick={() => setTab('comments')}
          className={`pb-2 text-sm font-mono uppercase tracking-wider transition-colors ${
            tab === 'comments'
              ? 'text-accent-red border-b-2 border-accent-red'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Flagged Comments
          {comments.length > 0 && (
            <span className="ml-2 text-xs bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded">
              {comments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('inaccuracies')}
          className={`pb-2 text-sm font-mono uppercase tracking-wider transition-colors ${
            tab === 'inaccuracies'
              ? 'text-accent-red border-b-2 border-accent-red'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Inaccuracy Reports
        </button>
      </div>

      {loading && (
        <p className="text-text-muted text-sm">Loading...</p>
      )}

      {/* Flagged Comments Tab */}
      {!loading && tab === 'comments' && (
        <div className="space-y-4">
          {comments.length === 0 && (
            <p className="text-text-muted text-sm">No flagged comments.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="border border-border-default p-4 bg-elevated">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-text-muted uppercase">
                      {contentTypeLabel(comment.content_type)}
                    </span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-secondary">
                      {(comment.author as FlaggedComment['author'])?.display_name ??
                        (comment.author as FlaggedComment['author'])?.email ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-text-primary mb-2 line-clamp-3">
                    {comment.body}
                  </p>

                  {/* Flags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-accent-red">
                      {comment.flag_count} flag{comment.flag_count !== 1 ? 's' : ''}
                    </span>
                    {comment.is_hidden && (
                      <span className="text-xs font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5">
                        HIDDEN
                      </span>
                    )}
                    {comment.flags.map((flag, i) => (
                      <span
                        key={i}
                        className="text-xs text-text-muted bg-content px-1.5 py-0.5"
                        title={flag.description ?? undefined}
                      >
                        {flag.reason}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCommentAction(comment.id, 'approve')}
                    disabled={actionLoading === comment.id}
                    className="text-xs font-mono uppercase px-3 py-1 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleCommentAction(comment.id, 'hide')}
                    disabled={actionLoading === comment.id}
                    className="text-xs font-mono uppercase px-3 py-1 text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 disabled:opacity-50"
                  >
                    Hide
                  </button>
                  <button
                    onClick={() => handleCommentAction(comment.id, 'delete')}
                    disabled={actionLoading === comment.id}
                    className="text-xs font-mono uppercase px-3 py-1 text-accent-red border border-accent-red/30 hover:bg-accent-red/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inaccuracy Reports Tab */}
      {!loading && tab === 'inaccuracies' && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 mb-4">
            {['pending', 'under_review', 'resolved', 'dismissed'].map((status) => (
              <button
                key={status}
                onClick={() => setInaccuracyFilter(status)}
                className={`text-xs font-mono uppercase px-3 py-1 border transition-colors ${
                  inaccuracyFilter === status
                    ? 'text-text-primary border-text-primary'
                    : 'text-text-muted border-border-default hover:border-text-muted'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {inaccuracies.length === 0 && (
              <p className="text-text-muted text-sm">No {inaccuracyFilter.replace('_', ' ')} reports.</p>
            )}
            {inaccuracies.map((report) => (
              <div key={report.id} className="border border-border-default p-4 bg-elevated">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-text-muted uppercase">
                        {contentTypeLabel(report.content_type)}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-secondary">
                        Reported by {(report.user as InaccuracyReport['user'])?.display_name ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {report.excerpt && (
                      <p className="text-xs text-text-muted italic mb-1 line-clamp-2">
                        &ldquo;{report.excerpt}&rdquo;
                      </p>
                    )}

                    <p className="text-sm text-text-primary mb-2">
                      {report.description}
                    </p>

                    {report.reviewer_notes && (
                      <p className="text-xs text-text-muted mt-1">
                        Reviewer notes: {report.reviewer_notes}
                      </p>
                    )}
                  </div>

                  {/* Actions (only for actionable statuses) */}
                  {(report.status === 'pending' || report.status === 'under_review') && (
                    <div className="flex gap-2 flex-shrink-0">
                      {report.status === 'pending' && (
                        <button
                          onClick={() => handleInaccuracyAction(report.id, 'under_review')}
                          disabled={actionLoading === report.id}
                          className="text-xs font-mono uppercase px-3 py-1 text-blue-400 border border-blue-400/30 hover:bg-blue-400/10 disabled:opacity-50"
                        >
                          Review
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const notes = prompt('Resolution notes:')
                          if (notes !== null) handleInaccuracyAction(report.id, 'resolved', notes)
                        }}
                        disabled={actionLoading === report.id}
                        className="text-xs font-mono uppercase px-3 py-1 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt('Dismissal reason:')
                          if (notes !== null) handleInaccuracyAction(report.id, 'dismissed', notes)
                        }}
                        disabled={actionLoading === report.id}
                        className="text-xs font-mono uppercase px-3 py-1 text-text-muted border border-border-default hover:bg-content disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainContent>
  )
}
