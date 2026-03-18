'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { MarkdownEditor, buildImageMarkdown } from '@/components/dashboard/stories/markdown-editor'
import { StoryPreview } from '@/components/dashboard/stories/story-preview'
import { StatusBadge, LiveBadge } from '@/components/dashboard/stories/status-badge'
import { ImagePicker } from '@/components/dashboard/stories/image-picker'
import type { EditorialStatus, StorySection } from '@efta/shared'
import type { EntityRef } from '@/lib/markdown-renderer'

interface StoryData {
  id: string
  slug: string
  title: string
  deck: string | null
  section: StorySection | null
  body_markdown: string
  byline: string
  reading_time_minutes: number | null
  is_published: boolean
  is_featured: boolean
  published_at: string | null
  case_file_id: string | null
  hero_image_url: string | null
  hero_image_caption: string | null
  editorial_status: EditorialStatus
  editorial_notes: string | null
  metadata: Record<string, unknown>
  updated_at: string
}

interface StoryEntity {
  entity_id: string
  mention_count: number
  is_primary: boolean
  entity: {
    id: string
    name: string
    slug: string | null
    tier: number | null
    category: string | null
    entity_type: string
  } | null
}

interface StoryCitation {
  citation_number: number
  description: string | null
  bates_number: string | null
  document: { bates_number: string | null; title: string | null } | null
}

interface CaseFileRef {
  id: string
  slug: string
  case_id: string
  title: string
}

const SECTIONS: StorySection[] = ['the-network', 'follow-the-money', 'the-cover-up', 'the-operation', 'voices']

export default function StoryEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [story, setStory] = useState<StoryData | null>(null)
  const [entities, setEntities] = useState<StoryEntity[]>([])
  const [citations, setCitations] = useState<StoryCitation[]>([])
  const [caseFile, setCaseFile] = useState<CaseFileRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)

  // Editable fields (local state for debounced save)
  const [title, setTitle] = useState('')
  const [deck, setDeck] = useState('')
  const [section, setSection] = useState<StorySection | null>(null)
  const [byline, setByline] = useState('')
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [heroImageCaption, setHeroImageCaption] = useState<string | null>(null)
  const [editorialNotes, setEditorialNotes] = useState('')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch story data
  const fetchStory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/stories/${id}`)
      if (!res.ok) throw new Error('Failed to fetch story')
      const data = await res.json()

      setStory(data.story)
      setEntities(data.entities ?? [])
      setCitations(data.citations ?? [])
      setCaseFile(data.caseFile ?? null)

      // Init editable fields
      setTitle(data.story.title)
      setDeck(data.story.deck ?? '')
      setSection(data.story.section)
      setByline(data.story.byline)
      setBodyMarkdown(data.story.body_markdown)
      setHeroImageUrl(data.story.hero_image_url)
      setHeroImageCaption(data.story.hero_image_caption)
      setEditorialNotes(data.story.editorial_notes ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  // Auto-save with debounce
  const saveFields = useCallback(async (fields: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setStory(data.story)
    } catch {
      // Silently fail — could add toast here
    } finally {
      setSaving(false)
    }
  }, [id])

  const debouncedSave = useCallback((fields: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveFields(fields), 1000)
  }, [saveFields])

  // Field change handlers
  const handleTitleChange = (v: string) => { setTitle(v); debouncedSave({ title: v }) }
  const handleDeckChange = (v: string) => { setDeck(v); debouncedSave({ deck: v }) }
  const handleSectionChange = (v: StorySection) => { setSection(v); saveFields({ section: v }) }
  const handleBylineChange = (v: string) => { setByline(v); debouncedSave({ byline: v }) }
  const handleBodyChange = (v: string) => { setBodyMarkdown(v); debouncedSave({ body_markdown: v }) }
  const handleNotesChange = (v: string) => { setEditorialNotes(v); debouncedSave({ editorial_notes: v }) }

  // Publish / Unpublish
  const handlePublish = async () => {
    const res = await fetch(`/api/stories/${id}/publish`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setStory(data.story)
    }
  }

  const handleUnpublish = async () => {
    const res = await fetch(`/api/stories/${id}/unpublish`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setStory(data.story)
    }
  }

  // Image picker actions
  const handleSetHero = async (imageId: string, caption: string) => {
    const res = await fetch(`/api/stories/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_id: imageId, role: 'hero', caption_override: caption }),
    })
    if (res.ok) {
      const newUrl = `/api/public/images/${imageId}/file`
      setHeroImageUrl(newUrl)
      setHeroImageCaption(caption)
      setStory((prev) => prev ? { ...prev, hero_image_url: newUrl, hero_image_caption: caption } : prev)
    }
  }

  const handleInsertInline = async (imageId: string, caption: string) => {
    const markdown = buildImageMarkdown(imageId, caption)
    setBodyMarkdown((prev) => prev + '\n\n' + markdown + '\n')
    debouncedSave({ body_markdown: bodyMarkdown + '\n\n' + markdown + '\n' })

    // Track it in story_images
    await fetch(`/api/stories/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_id: imageId, role: 'inline', caption_override: caption }),
    })
  }

  // Derived data for preview
  const previewEntities: EntityRef[] = useMemo(() =>
    entities
      .filter((e) => e.entity?.slug)
      .map((e) => ({
        slug: e.entity!.slug!,
        name: e.entity!.name,
        tier: e.entity!.tier ?? null,
      })),
    [entities],
  )

  const wordCount = useMemo(() =>
    bodyMarkdown ? bodyMarkdown.split(/\s+/).filter(Boolean).length : 0,
    [bodyMarkdown],
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-critical" />
      </div>
    )
  }

  if (error || !story) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-critical">
        {error ?? 'Story not found'}
      </div>
    )
  }

  const isLive = story.editorial_status === 'published'

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/stories')}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            &larr; My Desk
          </button>
          <span className="text-border-default">|</span>
          <StatusBadge status={story.editorial_status} />
          {isLive && <LiveBadge />}
          {saving && (
            <span className="text-[10px] font-mono text-text-muted animate-pulse">Saving...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {story.editorial_status !== 'published' && (
            <button
              onClick={handlePublish}
              className="rounded bg-success/20 px-3 py-1 text-xs font-mono text-success hover:bg-success/30 transition-colors"
            >
              Publish
            </button>
          )}
          {story.editorial_status === 'published' && (
            <button
              onClick={handleUnpublish}
              className="rounded bg-critical/10 px-3 py-1 text-xs font-mono text-critical/70 hover:bg-critical/20 transition-colors"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <Group orientation="horizontal" className="flex-1">
        {/* Left: Metadata + Images */}
        <Panel defaultSize={25} minSize={18} maxSize={40}>
          <div className="h-full overflow-y-auto border-r border-border-default bg-surface p-4 space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Metadata</h2>

            {/* Title */}
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full rounded border border-border-default bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-critical"
              />
            </div>

            {/* Deck */}
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Deck (subtitle)</label>
              <input
                value={deck}
                onChange={(e) => handleDeckChange(e.target.value)}
                className="w-full rounded border border-border-default bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-critical"
              />
            </div>

            {/* Section */}
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Section</label>
              <select
                value={section ?? ''}
                onChange={(e) => handleSectionChange(e.target.value as StorySection)}
                className="w-full rounded border border-border-default bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-critical"
              >
                <option value="">None</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Byline */}
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Byline</label>
              <input
                value={byline}
                onChange={(e) => handleBylineChange(e.target.value)}
                className="w-full rounded border border-border-default bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-critical"
              />
            </div>

            {/* Divider */}
            <hr className="border-border-default" />

            {/* Hero Image */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">Hero Image</h2>
              {heroImageUrl ? (
                <div className="space-y-2">
                  <img
                    src={heroImageUrl}
                    alt=""
                    className="w-full h-24 object-cover rounded"
                  />
                  {heroImageCaption && (
                    <p className="text-[10px] text-text-muted italic line-clamp-2">{heroImageCaption}</p>
                  )}
                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="w-full rounded bg-elevated px-2 py-1 text-[10px] font-mono text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Change Hero Image
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowImagePicker(true)}
                  className="w-full rounded border border-dashed border-warning/50 bg-warning/5 px-3 py-4 text-[10px] font-mono text-warning hover:bg-warning/10 transition-colors"
                >
                  + Add Hero Image
                </button>
              )}
            </div>

            {/* Divider */}
            <hr className="border-border-default" />

            {/* Editorial Notes */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">Editorial Notes</h2>
              <textarea
                value={editorialNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                rows={4}
                placeholder="Notes for review..."
                className="w-full resize-none rounded border border-border-default bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none focus:border-critical placeholder-text-muted"
              />
            </div>

            {/* Divider */}
            <hr className="border-border-default" />

            {/* Entities */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">
                Entities ({entities.length})
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {entities.map((e) => (
                  <div key={e.entity_id} className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary truncate">
                      {e.entity?.name ?? 'Unknown'}
                    </span>
                    <span className="text-text-muted flex-shrink-0 ml-2">
                      T{e.entity?.tier ?? '?'} · {e.mention_count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Citations */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">
                Citations ({citations.length})
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {citations.map((c) => (
                  <div key={c.citation_number} className="text-[10px] text-text-muted">
                    <span className="text-critical font-mono">[{c.citation_number}]</span>{' '}
                    <span className="text-text-secondary">{c.bates_number ?? 'No doc'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Case File */}
            {caseFile && (
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1">Case File</h2>
                <p className="text-[10px] text-text-secondary">{caseFile.case_id}: {caseFile.title}</p>
              </div>
            )}
          </div>
        </Panel>

        <Separator className="w-1 cursor-col-resize bg-border-default hover:bg-critical/30 transition-colors" />

        {/* Center: Markdown Editor */}
        <Panel defaultSize={40} minSize={25}>
          <MarkdownEditor
            value={bodyMarkdown}
            onChange={handleBodyChange}
            wordCount={wordCount}
          />
        </Panel>

        <Separator className="w-1 cursor-col-resize bg-border-default hover:bg-critical/30 transition-colors" />

        {/* Right: Live Preview */}
        <Panel defaultSize={35} minSize={20}>
          <StoryPreview
            title={title}
            deck={deck || null}
            section={section}
            byline={byline}
            heroImageUrl={heroImageUrl}
            heroImageCaption={heroImageCaption}
            bodyMarkdown={bodyMarkdown}
            citations={citations}
            entities={previewEntities}
          />
        </Panel>
      </Group>

      {/* Image Picker Modal */}
      {showImagePicker && (
        <ImagePicker
          storyId={id}
          onClose={() => setShowImagePicker(false)}
          onSetHero={handleSetHero}
          onInsertInline={handleInsertInline}
        />
      )}
    </div>
  )
}
