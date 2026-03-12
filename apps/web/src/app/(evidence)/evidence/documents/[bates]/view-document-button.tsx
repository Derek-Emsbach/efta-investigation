'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface ViewDocumentButtonProps {
  documentId: string
  hasFile: boolean
}

export default function ViewDocumentButton({ documentId, hasFile }: ViewDocumentButtonProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user)
    })
  }, [])

  if (!hasFile) return null

  // Still loading auth state
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 border border-border-default rounded-lg bg-surface">
        <span className="font-mono text-xs text-text-muted">Checking access…</span>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <Link
        href={`/dashboard/documents/${documentId}`}
        className="inline-flex items-center gap-2 px-5 py-3 bg-critical text-white font-mono text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-critical/90 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        View Full Document
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 border border-border-default rounded-lg bg-surface/50">
      <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <div>
        <p className="font-mono text-xs font-semibold text-text-primary">PDF requires authentication</p>
        <p className="font-mono text-[10px] text-text-muted mt-0.5">Sign in to view the full document</p>
      </div>
      <Link
        href="/login"
        className="ml-auto px-4 py-2 border border-critical text-critical font-mono text-xs font-semibold uppercase tracking-wider rounded hover:bg-critical/10 transition-colors"
      >
        Sign In
      </Link>
    </div>
  )
}
