'use client'

import { useState } from 'react'
import type { DocumentVersion } from '@efta/shared'

// ── Version Diff Alert ───────────────────────────────────────────

interface VersionDiff {
  previous_version?: number
  trigger?: string
  redaction_changes?: Record<string, { old: number; new: number; delta: number }>
  entity_changes?: { added?: string[]; removed?: string[]; added_count?: number; removed_count?: number }
  classification_change?: { old: string | null; new: string | null } | null
  severity_change?: { old: string | null; new: string | null } | null
  text_length_change?: { old: number; new: number; delta: number } | null
  significant_findings?: Array<{
    type: string
    description: string
    severity: string
    category?: string
  }>
}

const CATEGORY_LABELS: Record<string, string> = {
  A: 'Victim Protection',
  B: 'Legal Privilege',
  C: 'Institutional',
  D: 'Perpetrator Protection',
}

function FindingSeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-critical',
    high: 'bg-warning',
    medium: 'bg-info',
    low: 'bg-text-muted',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity] ?? colors.low}`} />
}

export function VersionDiffAlert({ diff }: { diff: VersionDiff }) {
  const findings = diff.significant_findings ?? []
  const redactionChanges = diff.redaction_changes ?? {}
  const hasRedactionChanges = Object.keys(redactionChanges).length > 0
  const hasCritical = findings.some((f) => f.severity === 'critical')

  return (
    <div
      className={`border rounded-lg p-5 mb-8 ${
        hasCritical
          ? 'bg-critical/5 border-critical/30'
          : 'bg-warning/5 border-warning/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-warning shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="font-display text-sm font-semibold text-text-primary">
          Version Diff — compared to v{diff.previous_version ?? '?'}
          {diff.trigger && (
            <span className="ml-2 text-xs font-normal text-text-muted">
              ({diff.trigger})
            </span>
          )}
        </h3>
      </div>

      {/* Significant findings */}
      {findings.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {findings.map((finding, i) => (
            <div key={i} className="flex items-start gap-2">
              <FindingSeverityDot severity={finding.severity} />
              <span className="text-sm text-text-primary">{finding.description}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-muted ml-auto shrink-0">
                {finding.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Redaction category changes */}
      {hasRedactionChanges && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {(['A', 'B', 'C', 'D'] as const).map((cat) => {
            const change = redactionChanges[cat]
            if (!change) return null
            const isDecrease = change.delta < 0

            return (
              <div
                key={cat}
                className={`text-center p-2.5 rounded border ${
                  isDecrease
                    ? 'bg-critical/5 border-critical/20'
                    : 'bg-elevated border-border-default'
                }`}
              >
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                  Cat {cat}
                </div>
                <div className={`text-sm font-mono font-semibold ${isDecrease ? 'text-critical' : 'text-text-primary'}`}>
                  {change.old} → {change.new}
                </div>
                <div className={`text-xs ${isDecrease ? 'text-critical' : 'text-success'}`}>
                  {change.delta > 0 ? '+' : ''}{change.delta}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {CATEGORY_LABELS[cat]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Entity changes */}
      {diff.entity_changes && (diff.entity_changes.added_count || diff.entity_changes.removed_count) ? (
        <div className="mt-3 text-xs text-text-muted">
          {diff.entity_changes.added_count ? (
            <span className="text-success mr-3">+{diff.entity_changes.added_count} entities linked</span>
          ) : null}
          {diff.entity_changes.removed_count ? (
            <span className="text-critical">-{diff.entity_changes.removed_count} entities unlinked</span>
          ) : null}
        </div>
      ) : null}

      {/* Classification / severity changes */}
      {(diff.classification_change || diff.severity_change) && (
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-text-muted">
          {diff.classification_change && (
            <span>
              Classification: <span className="text-text-secondary">{diff.classification_change.old ?? 'none'}</span>
              {' → '}
              <span className="text-text-primary font-medium">{diff.classification_change.new ?? 'none'}</span>
            </span>
          )}
          {diff.severity_change && (
            <span>
              Severity: <span className="text-text-secondary">{diff.severity_change.old ?? 'none'}</span>
              {' → '}
              <span className="text-text-primary font-medium">{diff.severity_change.new ?? 'none'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Version History Collapsible ──────────────────────────────────

function formatVersionDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const TRIGGER_LABELS: Record<string, string> = {
  initial_import: 'Initial import',
  reupload: 'Re-uploaded PDF',
  reprocess: 'Re-processed',
}

export function VersionHistory({ versions }: { versions: DocumentVersion[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (versions.length === 0) return null

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <h3 className="font-display text-lg font-semibold text-text-primary group-hover:text-text-secondary transition-colors">
          Version History ({versions.length})
        </h3>
      </button>

      {isOpen && (
        <div className="mt-3 bg-surface border border-border-default rounded-lg divide-y divide-border-default">
          {versions.map((v) => (
            <div key={v.id} className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-semibold text-text-primary">
                  v{v.version_number}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-elevated text-text-secondary">
                  {TRIGGER_LABELS[v.trigger] ?? v.trigger}
                </span>
                {v.processing_status && (
                  <span className="text-xs text-text-muted capitalize">
                    {v.processing_status.replace(/_/g, ' ')}
                  </span>
                )}
                <span className="text-xs text-text-muted ml-auto">
                  {formatVersionDate(v.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-text-muted">
                {v.page_count && <span>{v.page_count} pages</span>}
                {v.classification && <span>Classification: {v.classification}</span>}
                {v.severity && <span>Severity: {v.severity}</span>}
                {v.entity_ids && v.entity_ids.length > 0 && (
                  <span>{v.entity_ids.length} entities</span>
                )}
                {v.redaction_summary && typeof v.redaction_summary === 'object' && 'total_redactions' in v.redaction_summary && (
                  <span>{(v.redaction_summary as Record<string, number>).total_redactions} redactions</span>
                )}
              </div>
              {v.review_notes && (
                <p className="text-xs text-text-muted mt-1 italic line-clamp-2">
                  Review: {v.review_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Re-process Button ────────────────────────────────────────────

export function ReprocessButton({ documentId, hasFileUrl }: { documentId: string; hasFileUrl: boolean }) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  if (!hasFileUrl) return null

  const handleReprocess = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/documents/${documentId}/reprocess`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        setResult({ success: true, message: `Queued for re-processing (v${data.version})` })
      } else {
        setResult({ success: false, message: data.error || 'Failed to re-process' })
      }
    } catch {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleReprocess}
        disabled={isLoading || result?.success === true}
        className="text-xs font-medium px-3 py-1.5 rounded border border-warning/30 bg-warning/5 text-warning hover:bg-warning/10 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Queuing...' : 'Re-process'}
      </button>
      {result && (
        <span className={`text-xs ${result.success ? 'text-success' : 'text-critical'}`}>
          {result.message}
        </span>
      )}
    </div>
  )
}
