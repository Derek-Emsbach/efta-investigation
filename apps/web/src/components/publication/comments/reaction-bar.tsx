'use client'

import { useState } from 'react'
import type { CommentReactionCounts, CommentReactionType } from '@efta/shared'

interface ReactionBarProps {
  commentId: string
  reactions: CommentReactionCounts
  userReactions: CommentReactionType[]
  disabled?: boolean
  onReact?: (commentId: string, reactionType: CommentReactionType) => Promise<boolean>
}

const REACTION_CONFIG: { type: CommentReactionType; label: string; icon: string }[] = [
  { type: 'helpful', label: 'Helpful', icon: '💡' },
  { type: 'insightful', label: 'Insightful', icon: '⭐' },
  { type: 'disagree', label: 'Disagree', icon: '✕' },
]

export function ReactionBar({ commentId, reactions, userReactions, disabled, onReact }: ReactionBarProps) {
  const [localReactions, setLocalReactions] = useState<CommentReactionCounts>(reactions)
  const [localUserReactions, setLocalUserReactions] = useState<CommentReactionType[]>(userReactions)
  const [pending, setPending] = useState(false)

  const handleReact = async (type: CommentReactionType) => {
    if (disabled || pending || !onReact) return
    setPending(true)

    const wasActive = localUserReactions.includes(type)

    // Optimistic update
    setLocalReactions((prev) => ({
      ...prev,
      [type]: prev[type] + (wasActive ? -1 : 1),
    }))
    setLocalUserReactions((prev) =>
      wasActive ? prev.filter((r) => r !== type) : [...prev, type],
    )

    try {
      const added = await onReact(commentId, type)
      // Server confirmed — state is already correct from optimistic update
      // But reconcile in case server disagrees
      if (added === wasActive) {
        // Server and optimistic diverged — revert
        setLocalReactions((prev) => ({
          ...prev,
          [type]: prev[type] + (added ? 1 : -1),
        }))
        setLocalUserReactions((prev) =>
          added ? [...prev, type] : prev.filter((r) => r !== type),
        )
      }
    } catch {
      // Revert on error
      setLocalReactions((prev) => ({
        ...prev,
        [type]: prev[type] + (wasActive ? 1 : -1),
      }))
      setLocalUserReactions((prev) =>
        wasActive ? [...prev, type] : prev.filter((r) => r !== type),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {REACTION_CONFIG.map(({ type, label, icon }) => {
        const isActive = localUserReactions.includes(type)
        const count = localReactions[type]

        return (
          <button
            key={type}
            onClick={() => handleReact(type)}
            disabled={disabled || pending}
            title={label}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono
              transition-colors border
              ${isActive
                ? 'border-accent-gold/40 text-accent-gold bg-accent-gold/5'
                : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-[10px]">{icon}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
