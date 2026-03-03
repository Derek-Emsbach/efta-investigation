'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { WorkerStatus, WorkerHealthData } from '@/app/api/worker/health/route'

const STATUS_CONFIG: Record<WorkerStatus, { label: string; color: string; bgColor: string; pulse: boolean }> = {
  healthy: { label: 'Worker Online', color: 'text-success', bgColor: 'bg-success', pulse: false },
  degraded: { label: 'Worker Degraded', color: 'text-warning', bgColor: 'bg-warning', pulse: true },
  offline: { label: 'Worker Offline', color: 'text-critical', bgColor: 'bg-critical', pulse: true },
  idle: { label: 'Worker Idle', color: 'text-text-muted', bgColor: 'bg-text-muted', pulse: false },
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function WorkerHealth() {
  const [data, setData] = useState<WorkerHealthData | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/worker/health')
      if (!res.ok) return
      setData(await res.json())
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    void fetchHealth()
    const interval = setInterval(fetchHealth, 15_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  if (!data) return null

  const config = STATUS_CONFIG[data.status]

  return (
    <div className="bg-surface border border-border-default rounded-lg px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div className="relative flex items-center justify-center">
            <div className={`w-2.5 h-2.5 rounded-full ${config.bgColor}`} />
            {config.pulse && (
              <div className={`absolute w-2.5 h-2.5 rounded-full ${config.bgColor} animate-ping opacity-40`} />
            )}
          </div>

          {/* Status label + details */}
          <div>
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
              {data.lastActivity && (
                <span>Last activity: {formatTimeAgo(data.lastActivity)}</span>
              )}
              {data.throughputLastHour > 0 && (
                <span>{data.throughputLastHour} docs/hr</span>
              )}
              {data.failRateLastHour > 0 && (
                <span className="text-warning">{data.failRateLastHour}% fail rate</span>
              )}
              {data.averageProcessingMinutes !== null && (
                <span>~{data.averageProcessingMinutes}m avg</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Currently processing indicator */}
          {data.currentlyProcessing && (
            <div className="text-right">
              <span className="text-xs text-text-muted font-mono">
                {data.currentlyProcessing.batesNumber ?? 'Unknown'}
              </span>
              <div className="flex items-center gap-1.5 justify-end">
                <svg className="w-3 h-3 text-info animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <span className="text-[10px] text-info capitalize">
                  {data.currentlyProcessing.step ?? 'processing'}
                  {data.currentlyProcessing.minutesElapsed !== null && (
                    <span className="text-text-muted"> ({data.currentlyProcessing.minutesElapsed}m)</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Stuck items warning */}
          {data.stuckItems > 0 && (
            <span className="text-xs text-critical font-medium">
              {data.stuckItems} stuck
            </span>
          )}

          <Link href="/dashboard/processing" className="text-xs text-info hover:text-info/80 transition-colors">
            Details &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
