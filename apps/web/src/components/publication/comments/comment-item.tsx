'use client'

import { useState } from 'react'
import type { CommentWithAuthor, CommentReactionType } from '@efta/shared'
import { ReactionBar } from './reaction-bar'

interface CommentItemProps {
  comment: CommentWithAuthor
  userId: string | null
  isReply?: boolean
  onReply?: (commentId: string, authorName: string) => void
  onReact?: (commentId: string, reactionType: CommentReactionType) => Promise<boolean>
  onFlag?: (commentId: string) => void
  onEdit?: (commentId: string, newBody: string) => Promise<void>
  onDelete?: (commentId: string) => Promise<void>
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const RANK_ABBREVIATIONS: Record<string, string> = {
  'Junior Detective': 'JR. DET.',
  'Detective': 'DET.',
  'Detective Sergeant': 'DET. SGT.',
  'Detective Lieutenant': 'DET. LT.',
  'Detective Captain': 'DET. CAPT.',
  'Chief Inspector': 'CHIEF INSP.',
}

export function CommentItem({
  comment,
  userId,
  isReply = false,
  onReply,
  onReact,
  onFlag,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [showActions, setShowActions] = useState(false)
  const [saving, setSaving] = useState(false)

  const isOwn = userId === comment.author_id
  const isEdited = new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 2000
  const canEdit = isOwn && (Date.now() - new Date(comment.created_at).getTime()) < 15 * 60_000

  const rankAbbr = comment.author.current_rank
    ? RANK_ABBREVIATIONS[comment.author.current_rank] ?? comment.author.current_rank
    : null

  const handleSaveEdit = async () => {
    const trimmed = editBody.trim()
    if (!trimmed || trimmed === comment.body || !onEdit) return
    setSaving(true)
    try {
      await onEdit(comment.id, trimmed)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setSaving(true)
    try {
      await onDelete(comment.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${isReply ? 'ml-8 border-l-2 border-border-default pl-4' : ''}`}>
      <div className="py-3">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-1.5">
          {/* Avatar */}
          <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-[9px] text-text-muted">
              {getInitials(comment.author.display_name)}
            </span>
          </div>

          {/* Name + rank */}
          <span className="font-body text-sm font-medium text-text-primary">
            {comment.author.display_name ?? 'Anonymous'}
          </span>
          {rankAbbr && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-accent-gold bg-accent-gold/10 px-1.5 py-0.5 rounded-sm">
              {rankAbbr}
            </span>
          )}

          {/* Timestamp */}
          <span className="font-mono text-[10px] text-text-muted ml-auto">
            {timeAgo(comment.created_at)}
            {isEdited && ' (edited)'}
          </span>

          {/* Actions menu */}
          {(isOwn || (!isOwn && userId)) && (
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="text-text-muted hover:text-text-secondary text-xs p-0.5"
                title="More actions"
              >
                ···
              </button>
              {showActions && (
                <div className="absolute right-0 top-6 z-10 bg-surface border border-border-default shadow-md py-1 min-w-[120px]">
                  {canEdit && onEdit && (
                    <button
                      onClick={() => { setIsEditing(true); setShowActions(false) }}
                      className="block w-full text-left px-3 py-1.5 text-xs font-body text-text-secondary hover:bg-ink/5"
                    >
                      Edit
                    </button>
                  )}
                  {isOwn && onDelete && (
                    <button
                      onClick={() => { handleDelete(); setShowActions(false) }}
                      disabled={saving}
                      className="block w-full text-left px-3 py-1.5 text-xs font-body text-accent-red hover:bg-ink/5"
                    >
                      Delete
                    </button>
                  )}
                  {!isOwn && onFlag && (
                    <button
                      onClick={() => { onFlag(comment.id); setShowActions(false) }}
                      className="block w-full text-left px-3 py-1.5 text-xs font-body text-text-muted hover:bg-ink/5"
                    >
                      Flag
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={2000}
              className="w-full p-2 bg-surface border border-border-default text-text-primary font-body text-sm resize-none focus:outline-none focus:border-accent-gold/60"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editBody.trim() || editBody.trim() === comment.body}
                className="font-mono text-[10px] uppercase tracking-wider text-accent-gold hover:text-accent-gold/80 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditBody(comment.body) }}
                className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="font-body text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {/* Actions row */}
        {!isEditing && (
          <div className="mt-2 flex items-center gap-3">
            <ReactionBar
              commentId={comment.id}
              reactions={comment.reactions}
              userReactions={comment.user_reactions}
              disabled={!userId || isOwn}
              onReact={onReact}
            />
            {!isReply && onReply && userId && (
              <button
                onClick={() => onReply(comment.id, comment.author.display_name ?? 'Anonymous')}
                className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
              >
                Reply
              </button>
            )}
          </div>
        )}

        {/* Replies */}
        {!isReply && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                userId={userId}
                isReply
                onReact={onReact}
                onFlag={onFlag}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
