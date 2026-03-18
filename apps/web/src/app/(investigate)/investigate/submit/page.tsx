'use client'

import { useState, useEffect, useCallback } from 'react'

interface Submission {
  id: string
  submission_type: string
  title: string
  body: string
  evidence_urls: string[]
  entity_ids: string[]
  status: string
  reviewer_notes: string | null
  xp_awarded: number
  created_at: string
  updated_at: string
}

const TYPE_OPTIONS = [
  { value: 'finding', label: 'Finding', description: 'A new investigative finding with evidence' },
  { value: 'connection', label: 'Connection', description: 'A link between entities not yet documented' },
  { value: 'entity', label: 'Entity', description: 'A new person or organization to add' },
  { value: 'correction', label: 'Correction', description: 'Fix an error in existing data' },
] as const

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  under_review: 'bg-warning/20 text-warning border-warning/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-critical/20 text-critical border-critical/30',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const XP_VALUES: Record<string, number> = {
  entity: 75,
  finding: 50,
  connection: 30,
  correction: 25,
}

export default function SubmitPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formType, setFormType] = useState('finding')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formUrls, setFormUrls] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/investigate/submissions')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
    } catch {
      setError('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

  async function createSubmission(asDraft: boolean) {
    if (!formTitle.trim() || !formBody.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      // Create as draft first
      const res = await fetch('/api/investigate/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_type: formType,
          title: formTitle,
          body: formBody,
          evidence_urls: formUrls.split('\n').map((u) => u.trim()).filter(Boolean),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create')
      }

      const { submission } = await res.json()

      // If not draft, immediately submit
      if (!asDraft && submission) {
        await fetch(`/api/investigate/submissions/${submission.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'submitted' }),
        })
      }

      setFormTitle('')
      setFormBody('')
      setFormUrls('')
      setShowForm(false)
      fetchSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDraft(id: string) {
    try {
      const res = await fetch(`/api/investigate/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted' }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      fetchSubmissions()
    } catch {
      setError('Failed to submit')
    }
  }

  async function deleteDraft(id: string) {
    if (!confirm('Delete this draft?')) return
    try {
      await fetch(`/api/investigate/submissions/${id}`, { method: 'DELETE' })
      fetchSubmissions()
    } catch {
      setError('Failed to delete')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-critical border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-wide text-text-primary">Submit Findings</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Submit research findings for review. Approved submissions earn XP.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 transition-colors"
          >
            New Submission
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-critical/30 bg-critical/10 px-4 py-2 text-sm text-critical mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* New submission form */}
      {showForm && (
        <div className="rounded border border-border-default bg-surface/50 p-5 mb-6">
          <h2 className="font-mono text-sm font-bold text-text-primary mb-4">New Submission</h2>

          {/* Type selector */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFormType(opt.value)}
                className={`rounded border p-2.5 text-left transition-colors ${
                  formType === opt.value
                    ? 'border-critical bg-critical/10'
                    : 'border-border-default hover:border-critical/30'
                }`}
              >
                <p className="font-mono text-xs font-bold text-text-primary">{opt.label}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{opt.description}</p>
                <p className="font-mono text-[10px] text-green-400 mt-1">+{XP_VALUES[opt.value]} XP</p>
              </button>
            ))}
          </div>

          {/* Title */}
          <input
            type="text"
            placeholder="Title of your submission..."
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full bg-transparent border-b border-border-default font-mono text-sm text-text-primary placeholder:text-text-muted outline-none py-2 mb-3 focus:border-critical/50 transition-colors"
          />

          {/* Body */}
          <textarea
            placeholder="Describe your finding in detail. Include evidence references, Bates numbers, entity names, and your analysis..."
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            rows={8}
            className="w-full bg-transparent border border-border-default rounded px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted outline-none resize-y font-mono focus:border-critical/50 transition-colors"
          />

          {/* Evidence URLs */}
          <div className="mt-3">
            <label className="font-mono text-[10px] tracking-wider text-text-muted uppercase block mb-1">
              Evidence URLs (one per line, optional)
            </label>
            <textarea
              placeholder="https://example.com/document&#10;https://example.com/source"
              value={formUrls}
              onChange={(e) => setFormUrls(e.target.value)}
              rows={2}
              className="w-full bg-transparent border border-border-default rounded px-3 py-2 text-xs text-text-secondary placeholder:text-text-muted outline-none resize-none font-mono focus:border-critical/50 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => createSubmission(false)}
              disabled={!formTitle.trim() || !formBody.trim() || submitting}
              className="rounded bg-critical px-4 py-2 text-xs font-mono text-white hover:bg-critical/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
            <button
              onClick={() => createSubmission(true)}
              disabled={!formTitle.trim() || !formBody.trim() || submitting}
              className="rounded border border-border-default px-4 py-2 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              Save as Draft
            </button>
            <button
              onClick={() => { setShowForm(false); setFormTitle(''); setFormBody(''); setFormUrls('') }}
              className="rounded px-4 py-2 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Submissions list */}
      {submissions.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-muted mb-4">
            No submissions yet. Use the Detective to research, then submit your findings here.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 transition-colors"
          >
            Create Your First Submission
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded border border-border-default bg-surface/50 p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-medium ${STATUS_COLORS[sub.status] ?? ''}`}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted uppercase">
                    {sub.submission_type}
                  </span>
                  <h3 className="font-mono text-sm font-bold text-text-primary truncate">
                    {sub.title}
                  </h3>
                </div>
                {sub.xp_awarded > 0 && (
                  <span className="font-mono text-xs font-bold text-green-400 flex-shrink-0">
                    +{sub.xp_awarded} XP
                  </span>
                )}
              </div>

              <p className="text-sm text-text-muted whitespace-pre-wrap line-clamp-3 font-mono mb-2">
                {sub.body}
              </p>

              {sub.reviewer_notes && (
                <div className="rounded bg-background/50 border border-border-default px-3 py-2 mb-2">
                  <p className="text-[10px] font-mono text-text-muted uppercase mb-0.5">Reviewer Notes</p>
                  <p className="text-xs text-text-secondary">{sub.reviewer_notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-text-muted">
                  {new Date(sub.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
                {sub.status === 'draft' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => submitDraft(sub.id)}
                      className="text-xs font-mono text-critical hover:underline"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => deleteDraft(sub.id)}
                      className="text-xs font-mono text-text-muted hover:text-critical"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
