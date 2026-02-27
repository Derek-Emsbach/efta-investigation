'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** Bell icon that polls for unread notifications and shows a badge count. */
export default function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let mounted = true

    async function poll() {
      try {
        const res = await fetch('/api/admin/notifications')
        if (!res.ok) return
        const data = await res.json()
        const unread = (data.notifications ?? []).filter(
          (n: { is_read: boolean }) => !n.is_read,
        ).length
        if (mounted) setUnreadCount(unread)
      } catch {
        // Silently ignore — non-critical
      }
    }

    poll()
    const interval = setInterval(poll, 60_000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <Link
      href="/dashboard/admin"
      className="relative flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-elevated/50 transition-colors"
      title="Notifications"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Bell SVG */}
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
