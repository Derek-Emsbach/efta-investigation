'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface QueueStats {
  queued: number
  processing: number
  completed: number
  failed: number
  currentDoc: string | null
  currentStep: string | null
}

export function PipelineStatus() {
  const [stats, setStats] = useState<QueueStats | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/alerts')
      if (!res.ok) return
      const data = await res.json()
      setStats(data.processingQueue)
    } catch {
      // Silent fail — dashboard shouldn't break on API error
    }
  }, [])

  useEffect(() => {
    void fetchStats()
    const interval = setInterval(fetchStats, 10_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (!stats) return null

  const total = stats.queued + stats.processing + stats.completed + stats.failed
  const isEmpty = total === 0
  const progress = total > 0 ? (stats.completed / total) * 100 : 0

  if (isEmpty) {
    return (
      <div className="bg-surface border border-border-default rounded-lg px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No documents in pipeline
        </div>
        <Link href="/processing" className="text-xs text-info hover:text-info/80 transition-colors">
          View Pipeline &rarr;
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border-default rounded-lg px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-5">
          {/* Queued */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{stats.queued}</span> queued
            </span>
          </div>

          {/* Processing */}
          <div className="flex items-center gap-1.5">
            {stats.processing > 0 ? (
              <svg className="w-3.5 h-3.5 text-info animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            )}
            <span className="text-sm text-text-secondary">
              <span className="font-medium text-info">{stats.processing}</span> processing
              {stats.currentDoc && (
                <span className="text-xs text-text-muted ml-1 font-mono">
                  ({stats.currentDoc}{stats.currentStep ? ` — ${stats.currentStep}` : ''})
                </span>
              )}
            </span>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm text-text-secondary">
              <span className="font-medium text-success">{stats.completed}</span> done
            </span>
          </div>

          {/* Failed */}
          {stats.failed > 0 && (
            <div className="flex items-center gap-1.5">
              <svg className={`w-3.5 h-3.5 text-critical ${stats.failed > 0 ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-sm text-critical font-medium">{stats.failed} failed</span>
            </div>
          )}
        </div>

        <Link href="/processing" className="text-xs text-info hover:text-info/80 transition-colors">
          View Pipeline &rarr;
        </Link>
      </div>

      {/* Progress bar */}
      <div className="bg-elevated rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-info transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
