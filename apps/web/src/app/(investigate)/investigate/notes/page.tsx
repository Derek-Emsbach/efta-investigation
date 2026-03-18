'use client'

import { useState, useEffect, useCallback } from 'react'

interface Note {
  id: string
  title: string
  content: string
  entity_ids: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/investigate/notes')
      if (!res.ok) throw new Error('Failed to load notes')
      const data = await res.json()
      setNotes(data.notes ?? [])
    } catch {
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function createNote() {
    if (!newTitle.trim()) return
    try {
      const res = await fetch('/api/investigate/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      })
      if (!res.ok) throw new Error('Failed to create note')
      setNewTitle('')
      setNewContent('')
      setCreating(false)
      fetchNotes()
    } catch {
      setError('Failed to create note')
    }
  }

  async function updateNote(id: string) {
    try {
      const res = await fetch(`/api/investigate/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      if (!res.ok) throw new Error('Failed to update note')
      setEditingId(null)
      fetchNotes()
    } catch {
      setError('Failed to update note')
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    try {
      const res = await fetch(`/api/investigate/notes/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete note')
      fetchNotes()
    } catch {
      setError('Failed to delete note')
    }
  }

  async function togglePin(note: Note) {
    try {
      await fetch(`/api/investigate/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      })
      fetchNotes()
    } catch {
      // silently fail
    }
  }

  function startEditing(note: Note) {
    setEditingId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
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
          <h1 className="font-mono text-lg font-bold tracking-wide text-text-primary">Research Notes</h1>
          <p className="text-xs text-text-muted mt-0.5">Private notes for your investigation research</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Note
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-critical/30 bg-critical/10 px-4 py-2 text-sm text-critical mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* New note form */}
      {creating && (
        <div className="rounded border border-border-default bg-surface/50 p-4 mb-6">
          <input
            type="text"
            placeholder="Note title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-transparent font-mono text-sm font-bold text-text-primary placeholder:text-text-muted outline-none mb-3"
            autoFocus
          />
          <textarea
            placeholder="Write your notes here... (markdown supported)"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={6}
            className="w-full bg-transparent text-sm text-text-secondary placeholder:text-text-muted outline-none resize-y font-mono"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={createNote}
              disabled={!newTitle.trim()}
              className="rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 disabled:opacity-50 transition-colors"
            >
              Save Note
            </button>
            <button
              onClick={() => { setCreating(false); setNewTitle(''); setNewContent('') }}
              className="rounded px-3 py-1.5 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !creating ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-muted mb-4">No notes yet. Start documenting your research.</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 transition-colors"
          >
            Create Your First Note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded border border-border-default bg-surface/50 p-4"
            >
              {editingId === note.id ? (
                /* Edit mode */
                <div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-transparent font-mono text-sm font-bold text-text-primary outline-none mb-3"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    className="w-full bg-transparent text-sm text-text-secondary outline-none resize-y font-mono"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => updateNote(note.id)}
                      className="rounded bg-critical px-3 py-1.5 text-xs font-mono text-white hover:bg-critical/90 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded px-3 py-1.5 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {note.is_pinned && (
                        <span className="text-critical text-xs" title="Pinned">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        </span>
                      )}
                      <h3 className="font-mono text-sm font-bold text-text-primary truncate">
                        {note.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => togglePin(note)}
                        className="text-text-muted hover:text-text-secondary transition-colors p-1"
                        title={note.is_pinned ? 'Unpin' : 'Pin'}
                      >
                        <svg className="w-3.5 h-3.5" fill={note.is_pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => startEditing(note)}
                        className="text-text-muted hover:text-text-secondary transition-colors p-1"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-text-muted hover:text-critical transition-colors p-1"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {note.content && (
                    <p className="text-sm text-text-muted whitespace-pre-wrap line-clamp-4 font-mono">
                      {note.content}
                    </p>
                  )}
                  <p className="text-[10px] text-text-muted mt-2">
                    Updated {new Date(note.updated_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
