'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { TierBadge } from '@/components/ui/tier-badge'
import type { Tier } from '@efta/shared'

// ── Types ──────────────────────────────────────────────────

interface Investigation {
  id: string
  name: string
  status: string
  summary: string | null
  open_questions: string[]
  created_at: string
  updated_at: string
}

interface LinkedEntity {
  id: string
  entity_id: string
  investigation_id: string
  role: string | null
  entities: {
    id: string
    name: string
    entity_type: string
    tier: number | null
    category: string | null
    is_public: boolean
  }
}

interface LinkedDocument {
  id: string
  document_id: string
  investigation_id: string
  relevance_notes: string | null
  added_at: string
  documents: {
    id: string
    bates_number: string | null
    title: string | null
    document_type: string | null
    severity: string | null
    original_date: string | null
    classification: string | null
  }
}

interface LinkedEvent {
  id: string
  event_id: string
  investigation_id: string
  relevance_notes: string | null
  added_at: string
  events: {
    id: string
    title: string | null
    date: string | null
    event_type: string | null
    description: string | null
    significance: string | null
  }
}

interface Note {
  id: string
  content: string
  note_type: string
  created_by: string | null
  created_at: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type TabKey = 'evidence' | 'timeline' | 'questions' | 'notes'

const SEVERITY_STYLES: Record<string, string> = {
  extreme_critical: 'text-critical',
  critical: 'text-critical',
  high: 'text-warning',
  routine: 'text-text-muted',
}

const NOTE_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  narrative: { label: 'Narrative', color: 'text-info' },
  ai_summary: { label: 'AI Summary', color: 'text-info' },
  hypothesis: { label: 'Hypothesis', color: 'text-warning' },
  gap_analysis: { label: 'Gap Analysis', color: 'text-critical' },
  evidence_summary: { label: 'Evidence', color: 'text-success' },
  user_note: { label: 'Note', color: 'text-text-muted' },
}

// ── Evidence Search Modal ──────────────────────────────────

function EvidenceSearchModal({
  open,
  investigationId,
  onClose,
  onLinked,
}: {
  open: boolean
  investigationId: string
  onClose: () => void
  onLinked: () => void
}) {
  const [searchType, setSearchType] = useState<'entity' | 'document' | 'event'>(
    'entity'
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Array<{ id: string; label: string; subtitle: string }>
  >([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)

    try {
      let endpoint: string
      switch (searchType) {
        case 'entity':
          endpoint = `/api/entities?search=${encodeURIComponent(query)}&limit=20`
          break
        case 'document':
          endpoint = `/api/documents?search=${encodeURIComponent(query)}&limit=20`
          break
        case 'event':
          endpoint = `/api/timeline?search=${encodeURIComponent(query)}&limit=20`
          break
      }

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()

      switch (searchType) {
        case 'entity':
          setResults(
            (data.entities ?? []).map(
              (e: { id: string; name: string; entity_type: string; tier: number | null }) => ({
                id: e.id,
                label: e.name,
                subtitle: `${e.entity_type} · Tier ${e.tier ?? '?'}`,
              })
            )
          )
          break
        case 'document':
          setResults(
            (data.documents ?? []).map(
              (d: { id: string; bates_number: string | null; title: string | null; document_type: string | null }) => ({
                id: d.id,
                label: d.bates_number ?? d.title ?? d.id.slice(0, 8),
                subtitle: `${d.document_type ?? 'Unknown'} · ${d.title ?? ''}`,
              })
            )
          )
          break
        case 'event':
          setResults(
            (data.events ?? []).map(
              (e: { id: string; title: string | null; date: string | null; event_type: string | null }) => ({
                id: e.id,
                label: e.title ?? 'Untitled',
                subtitle: `${e.date ?? 'No date'} · ${e.event_type ?? ''}`,
              })
            )
          )
          break
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query, searchType])

  async function handleLink(targetId: string) {
    setLinking(targetId)
    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/evidence`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: searchType, target_id: targetId }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to link')
      }
      // Remove from results
      setResults((prev) => prev.filter((r) => r.id !== targetId))
      onLinked()
    } catch {
      // Could show error but keeping it simple
    } finally {
      setLinking(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-default rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Link Evidence
          </h2>
          <div className="flex gap-2 mt-3">
            {(['entity', 'document', 'event'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSearchType(t)
                  setResults([])
                }}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors capitalize ${
                  searchType === t
                    ? 'bg-info/10 text-info border border-info/30'
                    : 'bg-elevated text-text-muted border border-border-default'
                }`}
              >
                {t === 'entity' ? 'Entities' : t === 'document' ? 'Documents' : 'Events'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border-default">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${searchType === 'entity' ? 'entities' : searchType === 'document' ? 'documents' : 'events'}...`}
              className="flex-1 bg-elevated border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info"
              autoFocus
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors disabled:opacity-50"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {results.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              {searching
                ? 'Searching...'
                : query.trim()
                  ? 'No results found'
                  : `Type to search for ${searchType === 'entity' ? 'entities' : searchType === 'document' ? 'documents' : 'events'}`}
            </p>
          ) : (
            <div className="space-y-1">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b border-border-default last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {r.label}
                    </p>
                    <p className="text-[10px] text-text-muted">{r.subtitle}</p>
                  </div>
                  <button
                    onClick={() => handleLink(r.id)}
                    disabled={linking === r.id}
                    className="shrink-0 ml-2 px-2.5 py-1 text-[10px] font-medium bg-info/10 text-info rounded hover:bg-info/20 transition-colors disabled:opacity-50"
                  >
                    {linking === r.id ? '...' : '+ Link'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-default flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Archer Panel ───────────────────────────────────────────

function InvestigationArcher({
  investigationId,
}: {
  investigationId: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const QUICK_ACTIONS = [
    { label: 'Summarize case', prompt: 'Summarize this investigation case based on all the linked evidence.' },
    { label: 'Find gaps', prompt: 'Analyze the linked evidence and identify gaps, missing connections, and unanswered questions.' },
    { label: 'Suggest evidence', prompt: 'Search the database for entities, documents, and events that might be relevant to this investigation but are not yet linked.' },
    { label: 'Cross-reference', prompt: 'Cross-reference the linked entities and look for patterns in their connections, timeline overlaps, and shared documents.' },
  ]

  async function sendMessage(text: string) {
    if (streaming || !text.trim()) return

    const userMessage: ChatMessage = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/archer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to get response')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let assistantContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: text')) continue
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                assistantContent += data.content
                setMessages([
                  ...newMessages,
                  { role: 'assistant', content: assistantContent },
                ])
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }

      if (assistantContent) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: assistantContent },
        ])
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        },
      ])
    } finally {
      setStreaming(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="p-4 border-b border-border-default">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="text-[10px] px-2 py-1 bg-elevated border border-border-default rounded text-text-secondary hover:text-info hover:border-info/30 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">
            Ask Archer to analyze this investigation or use a quick action above.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-info/5 border border-info/20 rounded-lg p-3 text-text-primary'
                : 'text-text-secondary'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}

        {streaming && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
            Archer is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border-default">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Archer about this investigation..."
            disabled={streaming}
            className="flex-1 bg-elevated border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Detail Page ───────────────────────────────────────

export default function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [entities, setEntities] = useState<LinkedEntity[]>([])
  const [documents, setDocuments] = useState<LinkedDocument[]>([])
  const [events, setEvents] = useState<LinkedEvent[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('evidence')
  const [showArcherPanel, setShowArcherPanel] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newNoteType, setNewNoteType] = useState('user_note')

  const summaryRef = useRef<HTMLTextAreaElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInvestigation(data.investigation)
      setEntities(data.entities)
      setDocuments(data.documents)
      setEvents(data.events)
      setNotes(data.notes)
    } catch {
      // Handle error silently
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveSummary = useCallback(async () => {
    if (!investigation) return
    setEditingSummary(false)
    try {
      await fetch(`/api/investigations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryDraft || null }),
      })
      setInvestigation({ ...investigation, summary: summaryDraft || null })
    } catch {
      // Revert
    }
  }, [id, investigation, summaryDraft])

  const handleUnlink = useCallback(
    async (type: 'entity' | 'document' | 'event', targetId: string) => {
      try {
        await fetch(
          `/api/investigations/${id}/evidence?type=${type}&target_id=${targetId}`,
          { method: 'DELETE' }
        )
        fetchData()
      } catch {
        // Silently fail
      }
    },
    [id, fetchData]
  )

  const handleAddQuestion = useCallback(async () => {
    if (!investigation || !newQuestion.trim()) return
    const updated = [...investigation.open_questions, newQuestion.trim()]
    try {
      await fetch(`/api/investigations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open_questions: updated }),
      })
      setInvestigation({ ...investigation, open_questions: updated })
      setNewQuestion('')
    } catch {
      // Silently fail
    }
  }, [id, investigation, newQuestion])

  const handleRemoveQuestion = useCallback(
    async (index: number) => {
      if (!investigation) return
      const updated = investigation.open_questions.filter(
        (_, i) => i !== index
      )
      try {
        await fetch(`/api/investigations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ open_questions: updated }),
        })
        setInvestigation({ ...investigation, open_questions: updated })
      } catch {
        // Silently fail
      }
    },
    [id, investigation]
  )

  const handleAddNote = useCallback(async () => {
    if (!newNote.trim()) return
    try {
      const res = await fetch(`/api/investigations/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          note_type: newNoteType,
          created_by: 'user',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setNotes([data.note, ...notes])
      setNewNote('')
    } catch {
      // Silently fail
    }
  }, [id, newNote, newNoteType, notes])

  const handleStatusChange = useCallback(
    async (status: string) => {
      if (!investigation) return
      try {
        await fetch(`/api/investigations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        setInvestigation({ ...investigation, status })
      } catch {
        // Silently fail
      }
    },
    [id, investigation]
  )

  const handleDelete = useCallback(async () => {
    try {
      await fetch(`/api/investigations/${id}`, { method: 'DELETE' })
      router.push('/investigations')
    } catch {
      // Silently fail
    }
  }, [id, router])

  if (loading) {
    return (
      <MainContent>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-elevated rounded" />
          <div className="h-4 w-96 bg-elevated rounded" />
          <div className="h-96 bg-elevated rounded-lg" />
        </div>
      </MainContent>
    )
  }

  if (!investigation) {
    return (
      <MainContent>
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">Investigation not found</p>
          <Link
            href="/investigations"
            className="text-info text-sm mt-2 inline-block"
          >
            Back to investigations
          </Link>
        </div>
      </MainContent>
    )
  }

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'evidence', label: 'Evidence', count: entities.length + documents.length + events.length },
    { key: 'timeline', label: 'Timeline', count: events.length },
    { key: 'questions', label: 'Questions', count: investigation.open_questions.length },
    { key: 'notes', label: 'Notes', count: notes.length },
  ]

  return (
    <MainContent>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-6">
        <div>
          <Link
            href="/investigations"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            &larr; Investigations
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-primary mt-1">
            {investigation.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <select
              value={investigation.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs bg-elevated border border-border-default rounded px-2 py-1 text-text-secondary"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
            <span className="text-[10px] text-text-muted">
              Created{' '}
              {new Date(investigation.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="px-3 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors"
          >
            + Link Evidence
          </button>
          <button
            onClick={() => setShowArcherPanel(!showArcherPanel)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              showArcherPanel
                ? 'bg-warning/10 text-warning border border-warning/30'
                : 'bg-elevated text-text-muted border border-border-default'
            }`}
          >
            Archer
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs text-critical hover:bg-critical/10 rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-6">
        {/* Left panel */}
        <div className={`flex-1 min-w-0 ${showArcherPanel ? 'max-w-[calc(100%-396px)]' : ''}`}>
          {/* Summary */}
          <section className="bg-surface border border-border-default rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                Case Summary
              </p>
              <button
                onClick={() => {
                  setSummaryDraft(investigation.summary ?? '')
                  setEditingSummary(!editingSummary)
                }}
                className="text-[10px] text-info hover:text-info/80 transition-colors"
              >
                {editingSummary ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  ref={summaryRef}
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={4}
                  className="w-full bg-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-info resize-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveSummary}
                  className="text-xs px-3 py-1 bg-info text-white rounded"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {investigation.summary || 'No summary yet. Click Edit to add one.'}
              </p>
            )}
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border-default mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-info border-info'
                    : 'text-text-muted border-transparent hover:text-text-secondary'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-[10px] bg-elevated rounded-full px-1.5 py-0.5">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {/* Entities */}
              {entities.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">
                    Linked Entities ({entities.length})
                  </p>
                  <div className="space-y-1">
                    {entities.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between bg-surface border border-border-default rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/entities/${e.entities.id}`}
                            className="text-sm text-text-primary hover:text-info transition-colors truncate"
                          >
                            {e.entities.name}
                          </Link>
                          {e.entities.tier && (
                            <TierBadge tier={e.entities.tier as Tier} />
                          )}
                          {e.role && (
                            <span className="text-[10px] text-text-muted capitalize">
                              {e.role}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnlink('entity', e.entities.id)}
                          className="text-[10px] text-text-muted hover:text-critical transition-colors shrink-0 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {documents.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">
                    Linked Documents ({documents.length})
                  </p>
                  <div className="space-y-1">
                    {documents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-surface border border-border-default rounded px-3 py-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/documents/${d.documents.id}`}
                            className="text-sm text-text-primary hover:text-info transition-colors truncate block"
                          >
                            {d.documents.bates_number ?? d.documents.title ?? d.document_id.slice(0, 8)}
                          </Link>
                          <p className="text-[10px] text-text-muted">
                            {d.documents.document_type ?? 'Unknown'}
                            {d.documents.severity && (
                              <span className={`ml-2 ${SEVERITY_STYLES[d.documents.severity] ?? ''}`}>
                                {d.documents.severity}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnlink('document', d.documents.id)}
                          className="text-[10px] text-text-muted hover:text-critical transition-colors shrink-0 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {events.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">
                    Linked Events ({events.length})
                  </p>
                  <div className="space-y-1">
                    {events.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between bg-surface border border-border-default rounded px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-text-primary truncate block">
                            {e.events.title ?? 'Untitled'}
                          </span>
                          <p className="text-[10px] text-text-muted">
                            {e.events.date ?? 'No date'} · {e.events.event_type ?? ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnlink('event', e.events.id)}
                          className="text-[10px] text-text-muted hover:text-critical transition-colors shrink-0 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {entities.length === 0 &&
                documents.length === 0 &&
                events.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-8">
                    No evidence linked yet. Click &quot;Link Evidence&quot; to add entities, documents, or events.
                  </p>
                )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div>
              {events.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">
                  No events linked. Link events from the Evidence tab.
                </p>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-border-default" />
                  {[...events]
                    .sort((a, b) => {
                      if (!a.events.date) return 1
                      if (!b.events.date) return -1
                      return a.events.date.localeCompare(b.events.date)
                    })
                    .map((e) => (
                      <div key={e.id} className="relative">
                        <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-info border-2 border-surface" />
                        <p className="text-[10px] font-mono text-text-muted">
                          {e.events.date ?? 'No date'}
                        </p>
                        <p className="text-sm text-text-primary mt-0.5">
                          {e.events.title ?? 'Untitled'}
                        </p>
                        {e.events.description && (
                          <p className="text-xs text-text-secondary mt-1 line-clamp-3">
                            {e.events.description}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3">
              {investigation.open_questions.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between bg-surface border border-border-default rounded px-3 py-2"
                >
                  <p className="text-sm text-text-primary">{q}</p>
                  <button
                    onClick={() => handleRemoveQuestion(i)}
                    className="text-[10px] text-text-muted hover:text-critical transition-colors shrink-0 ml-2 mt-0.5"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddQuestion()
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Add an open question..."
                  className="flex-1 bg-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info"
                />
                <button
                  type="submit"
                  disabled={!newQuestion.trim()}
                  className="px-3 py-2 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              {/* Add note */}
              <div className="bg-surface border border-border-default rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value)}
                    className="text-xs bg-elevated border border-border-default rounded px-2 py-1 text-text-secondary"
                  >
                    <option value="user_note">Note</option>
                    <option value="narrative">Narrative</option>
                    <option value="hypothesis">Hypothesis</option>
                    <option value="evidence_summary">Evidence Summary</option>
                  </select>
                </div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write a note..."
                  rows={3}
                  className="w-full bg-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info resize-none mb-2"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>

              {/* Existing notes */}
              {notes.map((note) => {
                const noteStyle =
                  NOTE_TYPE_STYLES[note.note_type] ??
                  NOTE_TYPE_STYLES.user_note
                return (
                  <div
                    key={note.id}
                    className="bg-surface border border-border-default rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] font-medium ${noteStyle.color}`}
                      >
                        {noteStyle.label}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {note.created_by === 'archer' ? 'Archer' : 'You'} ·{' '}
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                )
              })}

              {notes.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">
                  No notes yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right panel — Archer */}
        {showArcherPanel && (
          <div className="w-[380px] shrink-0 bg-surface border border-border-default rounded-lg overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
            <div className="px-4 py-3 border-b border-border-default">
              <h3 className="font-display text-xs font-semibold text-text-primary">
                Investigation Archer
              </h3>
              <p className="text-[10px] text-text-muted">
                AI-assisted case analysis
              </p>
            </div>
            <InvestigationArcher investigationId={id} />
          </div>
        )}
      </div>

      <EvidenceSearchModal
        open={showSearch}
        investigationId={id}
        onClose={() => setShowSearch(false)}
        onLinked={fetchData}
      />
    </MainContent>
  )
}
